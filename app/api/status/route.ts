import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const configured = Boolean(process.env.CLOUDFLARE_ACCOUNT_ID?.trim() && process.env.CLOUDFLARE_API_TOKEN?.trim());
  const openrouterConfigured = Boolean(process.env.OPENROUTER_API_KEY?.trim());
  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
  return NextResponse.json({
    configured,
    openrouterConfigured,
    openaiConfigured,
    provider: "Cloudflare Workers AI",
    model: process.env.CLOUDFLARE_MODEL?.trim() || "@cf/qwen/qwen3-30b-a3b-fp8",
    message: configured ? "Credenciais configuradas. A conexão será validada na primeira mensagem." : "Cadastre CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN nas variáveis de ambiente da Vercel."
  });
}
