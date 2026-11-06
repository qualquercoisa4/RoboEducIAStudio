import { NextResponse } from "next/server";
import ts from "typescript";

export const runtime = "nodejs";
export const maxDuration = 60; // Mantido dentro do limite de execução do projeto.

type ChatMessage = { role: "user" | "assistant"; content: string };
type CloudflareError = { errors?: Array<{ message?: string }>; messages?: Array<{ message?: string }> };
const MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";
const MAX_MESSAGES = 16;
const MAX_MESSAGE_LENGTH = 12000;
const MAX_OUTPUT_TOKENS = 4096; // Permite respostas longas, como jogos completos em um arquivo.
const MAX_REPAIR_TOKENS = 3072;
const requestCounts = new Map<string, { count: number; resetAt: number }>();

const QUALITY_RULES = `
REGRAS OBRIGATÓRIAS DE QUALIDADE:
- Entregue código completo, executável e coerente com o pedido. Nunca deixe valores, argumentos, nomes ou trechos em branco.
- Não use placeholders como "TODO", "...", "INSIRA AQUI", "SEU_CODIGO" ou propriedades sem valor em código que deveria estar pronto.
- Antes de responder, revise mentalmente a sintaxe, variáveis, imports, fechamento de tags/chaves/parênteses, dependências e instruções de execução.
- Para HTML/CSS/JavaScript, confira especialmente se todas as declarações CSS têm valores válidos e se expressões JavaScript não têm argumentos ou atribuições vazias.
- Se o pedido exigir um arquivo único, coloque HTML, CSS e JavaScript no mesmo arquivo e inclua tudo que for necessário.
- Não afirme que executou ou testou o código se isso não aconteceu. Se não puder executar, diga que fez uma revisão estática.
- Prefira uma solução menor e funcional a uma solução ambiciosa, incompleta ou com dependências desnecessárias.
`;

function getClientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") || "unknown";
}

function rateLimited(ip: string) {
  const now = Date.now();
  const current = requestCounts.get(ip);
  if (!current || current.resetAt <= now) {
    requestCounts.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  if (current.count >= 20) return true;
  current.count += 1;
  return false;
}

function extractResponse(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const data = payload as {
    response?: unknown;
    result?: { response?: unknown };
    choices?: Array<{ delta?: { content?: unknown }; message?: { content?: unknown } }>;
    delta?: { response?: unknown };
  };
  const candidates = [
    data.response,
    data.result?.response,
    data.choices?.[0]?.delta?.content,
    data.choices?.[0]?.message?.content,
    data.delta?.response
  ];
  return candidates.find((value): value is string => typeof value === "string") ?? "";
}

async function readCloudflareStream(response: Response): Promise<string> {
  if (!response.body) throw new Error("A API não retornou um fluxo de resposta.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";

  const consume = (event: string) => {
    for (const line of event.split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (!raw || raw === "[DONE]") continue;
      try {
        const parsed = JSON.parse(raw) as unknown;
        answer += extractResponse(parsed);
        if (parsed && typeof parsed === "object" && "error" in parsed) {
          throw new Error(String((parsed as { error: unknown }).error));
        }
      } catch (error) {
        if (error instanceof SyntaxError) continue;
        throw error;
      }
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() ?? "";
    for (const event of events) consume(event);
  }
  buffer += decoder.decode();
  if (buffer.trim()) consume(buffer);
  return answer.trim();
}

function inspectCode(answer: string): string[] {
  const blocks = [...answer.matchAll(/```([a-zA-Z0-9_+-]*)\s*\n([\s\S]*?)```/g)];
  const issues: string[] = [];
  if (!blocks.length) return issues;

  for (const [, languageRaw, code] of blocks) {
    const language = languageRaw.toLowerCase();
    const isWebCode = ["html", "htm", "css", "javascript", "js", "typescript", "ts", "jsx", "tsx"].includes(language);

    const incompletePatterns = [
      { pattern: /\b(?:width|height|margin|padding|gap|font-size|border)\s*:\s*;/i, message: "declaração CSS sem valor" },
      { pattern: /\b(?:width|height|margin|padding|gap|font-size)\s*:\s*(?:px|rem|em|%)\s*;/i, message: "valor CSS incompleto" },
      { pattern: /(?:const|let|var)\s+[\w$]+\s*=\s*;/, message: "variável declarada sem valor" },
      { pattern: /Math\.(?:max|min)\(\s*,/, message: "argumento ausente em Math.max/Math.min" },
      { pattern: /#[\s]*;/, message: "cor hexadecimal incompleta" },
      { pattern: /\b(?:TODO|INSIRA AQUI|SEU_CODIGO|PLACEHOLDER)\b/i, message: "placeholder não substituído" }
    ];
    for (const item of incompletePatterns) {
      if (item.pattern.test(code)) issues.push(item.message);
    }

    if (isWebCode) {
      const scripts = language === "html"
        ? [...code.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)].map(match => match[1])
        : [code];
      for (const script of scripts) {
        if (!script.trim()) continue;
        const result = ts.transpileModule(script, {
          reportDiagnostics: true,
          compilerOptions: {
            allowJs: true,
            target: ts.ScriptTarget.ES2020,
            jsx: ts.JsxEmit.ReactJSX,
            reportDiagnostics: true
          }
        });
        const syntaxErrors = (result.diagnostics ?? []).filter(diagnostic =>
          diagnostic.category === ts.DiagnosticCategory.Error &&
          [1002, 1003, 1005, 1109, 1128, 1136, 1161, 1381, 1382].includes(diagnostic.code)
        );
        if (syntaxErrors.length) issues.push("erro de sintaxe JavaScript/TypeScript");
      }
    }
  }
  return [...new Set(issues)];
}

function toEventStream(text: string) {
  const encoder = new TextEncoder();
  const chunks = text.match(/[\s\S]{1,72}/g) ?? [text];
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ response: chunk })}\n\n`));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    }
  });
}

async function callModel(accountId: string, apiToken: string, messages: ChatMessage[], systemInstruction: string, maxTokens: number, timeoutMs = 42_000): Promise<string> {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${MODEL}`;
  const upstream = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({
      messages: [{ role: "system", content: systemInstruction }, ...messages],
      max_tokens: maxTokens,
      temperature: 0.25,
      stream: true
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!upstream.ok) {
    const payload = await upstream.json().catch(() => null) as CloudflareError | null;
    const detail = payload?.errors?.map(item => item.message).filter(Boolean).join("; ") ||
      payload?.messages?.map(item => item.message).filter(Boolean).join("; ") ||
      `Cloudflare retornou HTTP ${upstream.status}.`;
    console.error("Workers AI error:", upstream.status, detail);
    const error = new Error(upstream.status === 401
      ? "Token Cloudflare inválido ou sem permissão Workers AI - Read."
      : upstream.status === 429
        ? "Limite de uso da IA atingido. Tente novamente mais tarde."
        : detail);
    (error as Error & { status?: number }).status = upstream.status;
    throw error;
  }
  return readCloudflareStream(upstream);
}

export async function POST(request: Request) {
  if (rateLimited(getClientIp(request))) {
    return NextResponse.json({ error: "Limite temporário atingido. Aguarde um minuto e tente novamente." }, { status: 429 });
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!accountId || !apiToken) {
    return NextResponse.json({ error: "A API ainda não foi configurada. Cadastre CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN nas variáveis de ambiente da Vercel." }, { status: 503 });
  }

  try {
    const body = await request.json() as { messages?: ChatMessage[]; systemInstruction?: string };
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json({ error: "Envie ao menos uma mensagem." }, { status: 400 });
    }

    const messages = body.messages.slice(-MAX_MESSAGES);
    const valid = messages.every(message =>
      message && (message.role === "user" || message.role === "assistant") &&
      typeof message.content === "string" && message.content.trim().length > 0 &&
      message.content.length <= MAX_MESSAGE_LENGTH
    );
    if (!valid) {
      return NextResponse.json({ error: "A conversa contém mensagens inválidas ou muito longas." }, { status: 400 });
    }

    const requestedInstruction = typeof body.systemInstruction === "string" && body.systemInstruction.trim()
      ? body.systemInstruction.trim().slice(0, 5000)
      : "Você é o RoboEduc AI, assistente educacional especializado em tecnologia, robótica, eletrônica, programação e ciências. Responda em português brasileiro, com precisão e exemplos práticos.";
    const systemInstruction = `${requestedInstruction}\n\n${QUALITY_RULES}`;

    let answer = await callModel(accountId, apiToken, messages, systemInstruction, MAX_OUTPUT_TOKENS);
    if (!answer) {
      return NextResponse.json({ error: "O modelo encerrou a geração sem retornar texto. Tente novamente." }, { status: 502 });
    }

    const issues = inspectCode(answer);
    if (issues.length) {
      console.warn("RoboEduc AI code validation requested repair:", issues);
      const repairMessages: ChatMessage[] = [
        ...messages,
        { role: "assistant", content: answer },
        {
          role: "user",
          content: `REVISE E CORRIJA a resposta anterior antes de entregá-la. A revisão automática encontrou: ${issues.join(", ")}. Reescreva a resposta completa, preservando o objetivo original. Corrija todos os erros, preencha todos os valores e argumentos, e entregue o código completo. Não explique a auditoria; apresente a versão corrigida.`
        }
      ];
      const repaired = await callModel(accountId, apiToken, repairMessages, systemInstruction, MAX_REPAIR_TOKENS, 15_000);
      if (repaired.trim()) {
        const remainingIssues = inspectCode(repaired);
        if (remainingIssues.length) {
          console.warn("RoboEduc AI repair still has static warnings:", remainingIssues);
          answer = repaired + "\n\n> Observação: fiz uma revisão estática, mas não consegui confirmar a execução deste código. Revise antes de usar em um projeto real.";
        } else {
          answer = repaired;
        }
      }
    }

    return new Response(toEventStream(answer), {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
      }
    });
  } catch (error) {
    console.error("Chat API error:", error);
    const status = (error as Error & { status?: number }).status;
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return NextResponse.json({
      error: timedOut ? "A geração ou revisão demorou demais. Tente novamente com uma pergunta menor." :
        error instanceof Error ? error.message : "Não foi possível concluir a solicitação."
    }, { status: status === 429 ? 429 : timedOut ? 504 : 500 });
  }
}
