import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatMessage = { role: "user" | "assistant"; content: string };
const MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";
const MAX_MESSAGES = 16;
const MAX_MESSAGE_LENGTH = 12000;
const MAX_OUTPUT_TOKENS = 1400;
const requestCounts = new Map<string, { count: number; resetAt: number }>();

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
    const valid = messages.every((message) =>
      message && (message.role === "user" || message.role === "assistant") &&
      typeof message.content === "string" && message.content.trim().length > 0 &&
      message.content.length <= MAX_MESSAGE_LENGTH
    );
    if (!valid) {
      return NextResponse.json({ error: "A conversa contém mensagens inválidas ou muito longas." }, { status: 400 });
    }

    const systemInstruction = typeof body.systemInstruction === "string" && body.systemInstruction.trim()
      ? body.systemInstruction.trim().slice(0, 5000)
      : "Você é o RoboEduc AI, um assistente educacional especializado em tecnologia, robótica, eletrônica, programação, ciências e criação de projetos. Responda em português brasileiro, com precisão, clareza e exemplos práticos. Ao gerar código, forneça soluções completas, explique onde salvar e como executar. Não invente testes ou resultados.";

    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${MODEL}`;
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({
        messages: [{ role: "system", content: systemInstruction }, ...messages],
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: 0.35,
        stream: true
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(55_000)
    });

    if (!upstream.ok) {
      const payload = await upstream.json().catch(() => null) as { errors?: Array<{ message?: string }>; messages?: Array<{ message?: string }> } | null;
      const detail = payload?.errors?.map((item) => item.message).filter(Boolean).join("; ") ||
        payload?.messages?.map((item) => item.message).filter(Boolean).join("; ") ||
        `Cloudflare retornou HTTP ${upstream.status}.`;
      console.error("Workers AI error:", upstream.status, detail);
      return NextResponse.json({
        error: upstream.status === 401 ? "Token Cloudflare inválido ou sem permissão Workers AI - Read." :
          upstream.status === 429 ? "Limite de uso da IA atingido. Tente novamente mais tarde." : detail
      }, { status: upstream.status === 429 ? 429 : 502 });
    }

    if (!upstream.body) {
      return NextResponse.json({ error: "A API não retornou um fluxo de resposta." }, { status: 502 });
    }

    return new Response(upstream.body, {
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
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return NextResponse.json({
      error: timedOut ? "A geração demorou demais. Tente novamente com uma pergunta menor." :
        "Não foi possível concluir a solicitação. Verifique a conexão e a configuração da API."
    }, { status: timedOut ? 504 : 500 });
  }
}
