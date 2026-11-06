import { NextResponse } from "next/server";
import ts from "typescript";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatMessage = { role: "user" | "assistant"; content: string };
type WorkMode = "fast" | "complete" | "deep";
type CloudflareError = { errors?: Array<{ message?: string }>; messages?: Array<{ message?: string }> };
type ProgressEvent = { type: "status"; stage: string; detail: string };
type TokenEvent = { type: "token"; response: string };
type ErrorEvent = { type: "error"; error: string };

const MODEL = process.env.CLOUDFLARE_MODEL?.trim() || "@cf/qwen/qwen3-30b-a3b-fp8";
const MAX_MESSAGES = 14;
const MAX_MESSAGE_LENGTH = 40_000;
const MAX_CONTEXT_CHARS = 28_000;
const MAX_OUTPUT_TOKENS = 6_144;
const MAX_DEEP_OUTPUT_TOKENS = 8_192;
const MAX_REPAIR_TOKENS = 3_072;
const requestCounts = new Map<string, { count: number; resetAt: number }>();

const REVIEW_SYSTEM = `
Você é um revisor técnico independente de código. Examine o pedido original e a solução gerada.
Procure erros de lógica e integração, não apenas sintaxe: referências a elementos removidos do DOM, IDs e seletores inexistentes, variáveis sem inicialização, eventos que não funcionam, estados impossíveis, limites incorretos, colisões inconsistentes, dependências ausentes e requisitos ignorados.
Não reescreva o código. Não exponha raciocínio interno. Responda exclusivamente em JSON válido, neste formato:
{"needsFix": false, "findings": []}
Se encontrar problemas concretos que possam impedir o funcionamento ou contrariar o pedido, use needsFix=true e findings com descrições curtas e objetivas. Não invente problemas hipotéticos.
`;

function parseReviewReport(raw: string): { needsFix: boolean; findings: string[] } | null {
  const match = raw.match(/\\{[\\s\\S]*\\}/);
  if (!match) return null;
  try {
    const value = JSON.parse(match[0]) as { needsFix?: unknown; findings?: unknown };
    if (typeof value.needsFix !== "boolean" || !Array.isArray(value.findings)) return null;
    return {
      needsFix: value.needsFix,
      findings: value.findings.filter((item): item is string => typeof item === "string").slice(0, 8)
    };
  } catch {
    return null;
  }
}

const QUALITY_RULES = `
PADRÃO DE QUALIDADE ROBOEDUC:
- Responda em português brasileiro, com precisão, clareza e foco educacional.
- Atenda todos os requisitos explícitos do pedido. Não substitua o projeto pedido por um exemplo genérico ou por outro gênero de jogo.
- Quando houver contexto anterior relevante, preserve as decisões e restrições já estabelecidas.
- Não invente bibliotecas, APIs, resultados de testes, arquivos ou funcionalidades.
- Diferencie fatos confirmados, hipóteses e limitações.
- Em tarefas técnicas, explique decisões importantes e dê instruções que o aluno consiga seguir.
- Em código, entregue uma solução completa, consistente e executável. Não deixe variáveis, argumentos, declarações CSS ou funções pela metade.
- Nunca use placeholders como TODO, "...", "INSIRA AQUI", "SEU_CODIGO" ou "restante do código".
- Não omita partes com frases como "o restante permanece igual". Se o pedido for por um arquivo completo, entregue o arquivo completo.
- Em HTML/CSS/JavaScript, prefira um único HTML autocontido quando isso atender ao pedido. Feche tags, chaves, parênteses e aspas.
- Não transforme caracteres da linguagem em entidades HTML (&lt;, &gt;, &amp;) dentro de blocos de código.
- Antes de finalizar código, confira coerência entre IDs, seletores, nomes de funções, variáveis, eventos, referências e ordem de inicialização.
- Considere telas pequenas e controles por toque quando o projeto for destinado a celular.
- Se o pedido estiver ambíguo, faça uma pergunta objetiva; não invente requisitos essenciais.
- Nunca diga que executou o código ou que ele está livre de bugs sem ter ocorrido uma execução real. Informe quando a validação foi apenas estática.
- Prefira uma implementação menor e funcional a uma solução ambiciosa e incompleta.
- Não exponha raciocínio interno privado. Forneça apenas uma explicação resumida das decisões e verificações relevantes.
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

function trimContext(messages: ChatMessage[]) {
  const recent = messages.slice(-MAX_MESSAGES);
  let remaining = MAX_CONTEXT_CHARS;
  const selected: ChatMessage[] = [];

  for (let index = recent.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const message = recent[index];
    const content = message.content.length > remaining
      ? message.content.slice(-remaining)
      : message.content;
    selected.unshift({ role: message.role, content });
    remaining -= content.length;
  }
  return selected;
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

function isRuntimeRepairRequest(messages: ChatMessage[]) {
  const latest = [...messages].reverse().find(message => message.role === "user")?.content ?? "";
  return /Erros registrados:|corrija os erros.*execu[cç][aã]o|ReferenceError:|TypeError:|SyntaxError:/i.test(latest) &&
    /Código atual:|\`\`\`html/i.test(latest);
}

function isLikelyCodeTask(messages: ChatMessage[], answer = "") {
  const latestUser = [...messages].reverse().find(message => message.role === "user")?.content ?? "";
  return /\`\`\`(?:html?|css|javascript|js|typescript|ts|python|py|java|cpp|c\+\+|csharp|cs|jsx|tsx)|<!doctype\s+html|<html\b/i.test(answer) ||
    /\b(c[oó]digo|programa[cç][aã]o|programar|html|css|javascript|typescript|python|arduino|jogo|site|aplicativo|debug|depurar|bug|erro de sintaxe|script)\b/i.test(latestUser);
}

function stripBasicEntities(value: string) {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}

function inspectCode(answer: string): string[] {
  const issues: string[] = [];
  const fenceCount = (answer.match(/\`\`\`/g) ?? []).length;
  if (fenceCount % 2 !== 0) issues.push("bloco de código aberto ou resposta possivelmente truncada");

  const blocks = [...answer.matchAll(/\`\`\`([a-zA-Z0-9_+-]*)\s*\n([\s\S]*?)(?:\`\`\`|$)/g)];
  for (const [, languageRaw, rawCode] of blocks) {
    const language = languageRaw.toLowerCase();
    const code = stripBasicEntities(rawCode);
    const isHtml = ["html", "htm"].includes(language) || /<!doctype\s+html|<html\b/i.test(code);
    const isCss = language === "css";
    const isScript = ["javascript", "js", "typescript", "ts", "jsx", "tsx"].includes(language);

    const incompletePatterns = [
      { pattern: /\b(?:width|height|margin|padding|gap|font-size|border|color|background)\s*:\s*;/i, message: "declaração CSS sem valor" },
      { pattern: /(?:const|let|var)\s+[\w$]+\s*=\s*;/, message: "variável declarada sem valor" },
      { pattern: /Math\.(?:max|min)\(\s*,/, message: "argumento ausente em Math.max/Math.min" },
      { pattern: /#[\s]*;/, message: "cor hexadecimal incompleta" },
      { pattern: /\b(?:TODO|INSIRA AQUI|SEU_CODIGO|PLACEHOLDER)\b/i, message: "placeholder não substituído" },
      { pattern: /(?:=|=>|\+|\.|,|\breturn)\s*$/, message: "linha de código possivelmente incompleta" }
    ];
    for (const item of incompletePatterns) {
      if (item.pattern.test(code)) issues.push(item.message);
    }

    if (isCss) {
      const cleanCss = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ");
      const opens = (cleanCss.match(/\{/g) ?? []).length;
      const closes = (cleanCss.match(/\}/g) ?? []).length;
      if (opens !== closes) issues.push("chaves CSS não balanceadas");
    }

    if (isHtml) {
      const openScripts = (code.match(/<script\b/gi) ?? []).length;
      const closeScripts = (code.match(/<\/script\s*>/gi) ?? []).length;
      if (openScripts !== closeScripts) issues.push("tag script HTML sem fechamento");
    }

    if (isHtml) {
      const robotBinding = /(?:const|let|var)\s+(\w+)\s*=\s*document\.getElementById\(\s*['"]robot['"]\s*\)/i.exec(code);
      const rewriteMatch = /\w+\.innerHTML\s*=/i.exec(code);
      const robotMarkupRecreated = /innerHTML\s*=\s*[\s\S]{0,500}?id\s*=\s*['"]robot['"]/i.test(code);
      if (robotBinding && rewriteMatch && robotMarkupRecreated) {
        const tail = code.slice(rewriteMatch.index + rewriteMatch[0].length);
        const refreshed = new RegExp("\\b" + robotBinding[1] + "\\s*=\\s*document\\.(?:getElementById|querySelector)\\s*\\(", "i").test(tail);
        if (!refreshed) {
          issues.push("possível referência DOM obsoleta: o HTML recria o elemento #robot, mas a variável robot pode continuar apontando para o elemento antigo");
        }
      }
    }

    const scripts = isHtml
      ? [...code.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)].map(match => match[1])
      : isScript ? [code] : [];

    for (const script of scripts) {
      if (!script.trim()) continue;
      const result = ts.transpileModule(script, {
        reportDiagnostics: true,
        compilerOptions: {
          allowJs: true,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
          reportDiagnostics: true
        }
      });
      const syntaxErrors = (result.diagnostics ?? []).filter(diagnostic =>
        diagnostic.category === ts.DiagnosticCategory.Error
      );
      if (syntaxErrors.length) issues.push("erro de sintaxe JavaScript/TypeScript detectado pelo compilador");
    }
  }
  return [...new Set(issues)];
}

function toEvents(execute: (send: (event: ProgressEvent | TokenEvent | ErrorEvent | { type: "done" }) => void, signal: AbortSignal) => Promise<void>, requestSignal: AbortSignal) {
  const encoder = new TextEncoder();
  const aborter = new AbortController();
  const signal = AbortSignal.any([requestSignal, aborter.signal]);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: ProgressEvent | TokenEvent | ErrorEvent | { type: "done" }) => {
        try {
          controller.enqueue(encoder.encode("data: " + JSON.stringify(event) + "\n\n"));
        } catch {
          aborter.abort();
        }
      };
      void execute(send, signal)
        .catch(error => {
          if (!signal.aborted) {
            send({ type: "error", error: error instanceof Error ? error.message : "Não foi possível concluir a solicitação." });
          }
        })
        .finally(() => {
          try { controller.close(); } catch {}
        });
    },
    cancel() {
      aborter.abort();
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}

async function callModel(
  accountId: string,
  apiToken: string,
  messages: ChatMessage[],
  systemInstruction: string,
  maxTokens: number,
  signal: AbortSignal,
  timeoutMs = 40_000,
  selectedModel = "cloudflare"
): Promise<string> {
  const useOpenRouter = selectedModel !== "cloudflare";
  const endpoint = useOpenRouter
    ? "https://openrouter.ai/api/v1/chat/completions"
    : `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${MODEL}`;
  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
  let upstream: Response;
  try {
    upstream = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${useOpenRouter ? openRouterKey : apiToken}`, "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({
      messages: [{ role: "system", content: systemInstruction }, ...messages],
      ...(useOpenRouter ? { model: selectedModel, max_tokens: maxTokens } : { max_tokens: maxTokens }),
      temperature: 0.2,
      top_p: 0.85,
      stream: true
    }),
    cache: "no-store",
    signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
    });
  } catch (error) {
    if (signal.aborted) throw error;
    if (error instanceof Error && (error.name === "TimeoutError" || /timeout|timed out|aborted/i.test(error.message))) {
      throw new Error("A IA demorou mais que o limite desta etapa. Tente novamente no modo Completo ou envie uma correção menor.");
    }
    throw error;
  }

  if (!upstream.ok) {
    const payload = await upstream.json().catch(() => null) as CloudflareError | null;
    const detail = payload?.errors?.map(item => item.message).filter(Boolean).join("; ") ||
      payload?.messages?.map(item => item.message).filter(Boolean).join("; ") ||
      (payload as { error?: { message?: string } } | null)?.error?.message ||
      `${useOpenRouter ? "OpenRouter" : "Cloudflare"} retornou HTTP ${upstream.status}.`;
    console.error("Workers AI error:", upstream.status, detail);
    const error = new Error(upstream.status === 401
      ? (useOpenRouter ? "Chave OpenRouter inválida. Confira OPENROUTER_API_KEY na Vercel." : "Token Cloudflare inválido ou sem permissão Workers AI - Read.")
      : upstream.status === 429
        ? "Limite de uso ou cota do provedor atingido. Tente novamente mais tarde."
        : detail);
    (error as Error & { status?: number }).status = upstream.status;
    throw error;
  }
  try {
    return await readCloudflareStream(upstream);
  } catch (error) {
    if (signal.aborted) throw error;
    if (error instanceof Error && (error.name === "TimeoutError" || /timeout|timed out|aborted/i.test(error.message))) {
      throw new Error("A geração excedeu o tempo disponível. Tente novamente com um pedido menor ou no modo Completo.");
    }
    throw error;
  }
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
    const body = await request.json() as { messages?: ChatMessage[]; systemInstruction?: string; mode?: WorkMode; model?: string };
    const allowedModels = ["cloudflare", "recursive/flint-v1.0:free", "cohere/north-mini-code:free", "nvidia/nemotron-3-ultra-550b-a55b:free", "google/gemma-4-31b-it:free"];
    const selectedModel = typeof body.model === "string" && allowedModels.includes(body.model) ? body.model : "cloudflare";
    if (selectedModel !== "cloudflare" && !process.env.OPENROUTER_API_KEY?.trim()) {
      return NextResponse.json({ error: "Para usar modelos OpenRouter, cadastre OPENROUTER_API_KEY nas variáveis de ambiente da Vercel." }, { status: 503 });
    }
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json({ error: "Envie ao menos uma mensagem." }, { status: 400 });
    }

    const valid = body.messages.every(message =>
      message && (message.role === "user" || message.role === "assistant") &&
      typeof message.content === "string" && message.content.trim().length > 0 &&
      message.content.length <= MAX_MESSAGE_LENGTH
    );
    if (!valid) {
      return NextResponse.json({ error: "A conversa contém mensagens inválidas ou muito longas." }, { status: 400 });
    }

    const messages = trimContext(body.messages);
    const requestedInstruction = typeof body.systemInstruction === "string" && body.systemInstruction.trim()
      ? body.systemInstruction.trim().slice(0, 5_000)
      : "Você é o RoboEduc AI, assistente educacional especializado em tecnologia, robótica, eletrônica, programação e ciências. Responda em português brasileiro, com precisão e exemplos práticos.";
    const systemInstruction = requestedInstruction + "\n\n" + QUALITY_RULES;
    const mode: WorkMode = body.mode === "fast" || body.mode === "deep" ? body.mode : "complete";
    const codeTask = isLikelyCodeTask(messages);
    const runtimeRepair = isRuntimeRepairRequest(messages);
    const maxTokens = runtimeRepair ? 4_096 : mode === "fast"
      ? (codeTask ? 4_096 : 3_072)
      : mode === "deep" ? MAX_DEEP_OUTPUT_TOKENS
        : codeTask ? MAX_OUTPUT_TOKENS : 4_096;
    const repairTokens = runtimeRepair ? 4_096 : mode === "deep" ? MAX_REPAIR_TOKENS : 1_536;

    return toEvents(async (send, signal) => {
      const status = (stage: string, detail: string) => send({ type: "status", stage, detail });
      status("context", "Preparando o contexto e os requisitos da solicitação.");
      status("generation", `Gerando resposta com limite de até ${maxTokens.toLocaleString("pt-BR")} tokens de saída.`);

      let answer = await callModel(accountId, apiToken, messages, runtimeRepair
        ? systemInstruction + "\\n\\nMODO DE CORREÇÃO DE EXECUÇÃO: concentre-se nos erros reais informados e no código fornecido. Identifique a causa provável, faça a menor correção que resolva o problema, preserve o restante do projeto e entregue o arquivo completo. Não faça auditoria adicional nem reescreva funcionalidades sem necessidade."
        : systemInstruction, maxTokens, signal, runtimeRepair ? 48_000 : mode === "deep" ? 36_000 : 40_000, selectedModel);
      if (!answer.trim()) throw new Error("O modelo encerrou a geração sem retornar texto. Tente novamente.");

      if (isLikelyCodeTask(messages, answer)) {
        status("review", "Verificando integridade dos blocos, sintaxe e sinais de código incompleto.");
        const findings = inspectCode(answer);

        if (mode === "deep" && !runtimeRepair) {
          status("audit", "Executando uma auditoria adicional de lógica e integração do código.");
          try {
            const audit = await callModel(
              accountId,
              apiToken,
              [
                ...messages,
                { role: "assistant", content: answer },
                { role: "user", content: "Faça a auditoria técnica desta solução. Responda somente no formato JSON definido nas instruções do revisor." }
              ],
              REVIEW_SYSTEM,
              640,
              signal,
              7_000,
              selectedModel
            );
            const report = parseReviewReport(audit);
            if (report?.needsFix) findings.push(...report.findings);
          } catch (auditError) {
            if (signal.aborted) throw auditError;
            status("audit-limited", "A auditoria adicional não terminou a tempo; a revisão estática continua válida como verificação parcial.");
          }
        }

        const uniqueFindings = [...new Set(findings)];
        if (uniqueFindings.length && !runtimeRepair) {
          status("repair", "A revisão encontrou possíveis falhas. Solicitando uma correção antes da entrega.");
          const repairMessages: ChatMessage[] = [
            ...messages,
            { role: "assistant", content: answer },
            {
              role: "user",
              content: "Faça uma revisão técnica e corrija a resposta anterior. A verificação encontrou: " +
                uniqueFindings.join("; ") +
                ". Reescreva a resposta completa, preserve o pedido e as decisões anteriores, feche todos os blocos e não use placeholders. Não afirme que executou o código. Entregue a versão completa corrigida."
            }
          ];
          try {
            const repaired = await callModel(accountId, apiToken, repairMessages,
              systemInstruction + "\\n\\nCORREÇÃO OBJETIVA: preserve o código e corrija somente os problemas apontados. Retorne o arquivo completo, sem auditoria adicional.",
              repairTokens, signal, 8_000, selectedModel);
            if (repaired.trim()) {
              const remainingIssues = inspectCode(repaired);
              if (remainingIssues.length) {
                status("warning", "A correção foi aplicada, mas ainda há alertas estáticos que precisam ser conferidos.");
                answer = repaired + "\\n\\n> A revisão automática ainda identificou pontos que precisam de conferência: " + remainingIssues.join(", ") + ". A execução real deve ser testada no navegador.";
              } else {
                status("reviewed", "A revisão estática foi concluída após a correção.");
                answer = repaired;
              }
            }
          } catch (repairError) {
            if (signal.aborted) throw repairError;
            status("warning", "A geração foi preservada, mas a etapa de correção automática não terminou a tempo.");
            answer += "\\n\\n> A revisão automática não conseguiu concluir a correção dentro do tempo disponível. Teste o código no executor e envie eventuais erros para a IA.";
          }
        } else if (uniqueFindings.length && runtimeRepair) {
          status("warning", "A correção foi gerada, mas a revisão estática ainda encontrou um alerta. Teste novamente no executor.");
          answer += "\\n\\n> Observação: a revisão estática ainda sinaliza: " + uniqueFindings.join(", ") + ".";
        } else {
          status("reviewed", mode === "deep"
            ? "A revisão estática e a auditoria adicional não identificaram falhas concretas."
            : "Nenhum problema sintático conhecido foi detectado na revisão estática.");
        }
      } else {
        status("reviewed", "Resposta conferida quanto à presença de conteúdo e consistência básica.");
      }

      status("delivery", "Preparando a resposta final.");
      const chunks = answer.match(/[\s\S]{1,96}/g) ?? [answer];
      for (const chunk of chunks) {
        if (signal.aborted) return;
        send({ type: "token", response: chunk });
      }
      send({ type: "done" });
    }, request.signal);
  } catch (error) {
    console.error("Chat API validation error:", error);
    const status = (error as Error & { status?: number }).status;
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Não foi possível concluir a solicitação."
    }, { status: status === 429 ? 429 : 400 });
  }
}
