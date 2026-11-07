import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const configured = Boolean(process.env.CLOUDFLARE_ACCOUNT_ID?.trim() && process.env.CLOUDFLARE_API_TOKEN?.trim());
  const openrouterConfigured = Boolean(process.env.OPENROUTER_API_KEY?.trim());
  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY?.trim());
  const anyProviderConfigured = configured || openrouterConfigured || openaiConfigured || geminiConfigured;

  const provider = openrouterConfigured
    ? "OpenRouter"
    : geminiConfigured
      ? "Google Gemini"
      : openaiConfigured
        ? "OpenAI"
        : configured
          ? "Cloudflare Workers AI"
          : "Nenhum provedor configurado";
  const model = openrouterConfigured
    ? process.env.OPENROUTER_MODEL?.trim() || "qwen/qwen3-coder-next"
    : geminiConfigured
      ? "gemini-3.8-flash"
      : openaiConfigured
        ? "gpt-5.6-luna"
        : process.env.CLOUDFLARE_MODEL?.trim() || "@cf/qwen/qwen3-30b-a3b-fp8";

  return NextResponse.json({
    configured,
    openrouterConfigured,
    openaiConfigured,
    geminiConfigured,
    anyProviderConfigured,
    provider,
    model,
    message: anyProviderConfigured
      ? "Pelo menos um provedor está configurado. A conexão será validada na primeira mensagem."
      : "Configure OPENROUTER_API_KEY ou as credenciais de um provedor alternativo na Vercel."
  }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
}
