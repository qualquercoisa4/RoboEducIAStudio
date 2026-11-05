import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const host = (process.env.OLLAMA_HOST || "http://127.0.0.1:11434").replace(/\/$/, "");
  try {
    const response = await fetch(`${host}/api/tags`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error("Ollama indisponível");
    const data = await response.json() as { models?: Array<{ name: string }> };
    return NextResponse.json({ connected: true, models: data.models?.map((m) => m.name) || [] });
  } catch {
    return NextResponse.json({ connected: false, models: [], message: "Ollama não está acessível neste servidor." }, { status: 503 });
  }
}
