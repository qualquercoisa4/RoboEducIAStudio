import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ollamaHost = (process.env.OLLAMA_HOST || "http://127.0.0.1:11434").replace(/\/$/, "");
const defaultModel = process.env.OLLAMA_MODEL || "qwen2.5-coder:3b";

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      messages?: ChatMessage[];
      systemInstruction?: string;
      model?: string;
    };

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json({ error: "Envie ao menos uma mensagem." }, { status: 400 });
    }

    const messages = body.messages.slice(-30);
    const valid = messages.every((m) =>
      m && (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" && m.content.trim().length > 0 &&
      m.content.length <= 20000
    );
    if (!valid) return NextResponse.json({ error: "Conversa inválida." }, { status: 400 });

    const system = typeof body.systemInstruction === "string" && body.systemInstruction.trim()
      ? body.systemInstruction.trim().slice(0, 8000)
      : "Você é um assistente educacional claro, preciso e didático. Ao gerar código, forneça exemplos completos e explique como executar.";

    const model = typeof body.model === "string" && body.model.trim()
      ? body.model.trim()
      : defaultModel;

    const response = await fetch(`${ollamaHost}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: system }, ...messages],
        stream: false,
        options: { temperature: 0.3 }
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(180000)
    });

    const data = await response.json().catch(() => null) as {
      message?: { content?: string };
      error?: string;
      model?: string;
    } | null;

    if (!response.ok) {
      const detail = data?.error || `Ollama retornou HTTP ${response.status}.`;
      const missing = /not found|pull model/i.test(detail);
      return NextResponse.json({
        error: missing
          ? `Modelo "${model}" não instalado. Execute: ollama pull ${model}`
          : detail
      }, { status: response.status === 404 ? 503 : 502 });
    }

    const text = data?.message?.content;
    if (!text?.trim()) return NextResponse.json({ error: "O modelo retornou uma resposta vazia." }, { status: 502 });

    return NextResponse.json({ text, model: data?.model || model });
  } catch {
    return NextResponse.json({
      error: "Não foi possível acessar o Ollama. Esta versão precisa do Ollama instalado e em execução no mesmo computador que hospeda o Next.js."
    }, { status: 503 });
  }
}
