import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const configured = Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID?.trim() &&
    process.env.CLOUDFLARE_API_TOKEN?.trim()
  );

  return NextResponse.json({
    configured,
    provider: "Cloudflare Workers AI",
    model: "@cf/qwen/qwen2.5-coder-32b-instruct",
    message: configured
      ? "Credenciais configuradas. A conexão será validada na primeira mensagem."
      : "Cadastre as duas variáveis secretas da Cloudflare na Vercel."
  });
}
