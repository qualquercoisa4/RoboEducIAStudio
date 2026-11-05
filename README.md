# RoboEduc IA Studio

MVP do playground educacional com Next.js e Cloudflare Workers AI.

## Provedor de IA

A rota `POST /api/chat` usa o modelo `@cf/qwen/qwen2.5-coder-32b-instruct` no Cloudflare Workers AI. A rota `GET /api/status` verifica se as credenciais foram configuradas.

O Workers AI Free disponibiliza uma cota diária de 10.000 Neurons. Ao atingir o limite, as chamadas ficam indisponíveis até o reset; para manter o projeto no plano Free, não habilite upgrade para plano pago.

## Variáveis de ambiente

Cadastre **somente no painel da Vercel** (Settings → Environment Variables), nunca no GitHub:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Crie um token Cloudflare com permissão mínima `Account > Workers AI > Read`. Consulte o guia oficial: https://developers.cloudflare.com/workers-ai/get-started/rest-api/

Marque Production, Preview e Development. Depois de salvar, faça um novo deploy.

## Desenvolvimento local

Crie `.env.local` na raiz:

```env
CLOUDFLARE_ACCOUNT_ID=seu_account_id
CLOUDFLARE_API_TOKEN=seu_token
```

Então execute:

```bash
npm install
npm run dev
```

Abra http://localhost:3000.

## Segurança e limites

- As credenciais são lidas apenas no servidor.
- O endpoint limita o histórico e o tamanho das mensagens.
- Há um limitador simples por instância (20 requisições por minuto por IP). Ele não substitui rate limiting durável ou autenticação; antes de disponibilizar para muitas turmas, adicionar autenticação, limite por usuário e proteção persistente contra abuso.
- Não envie dados pessoais, notas, informações médicas ou dados sensíveis de alunos.
- O histórico atual fica apenas no armazenamento local do navegador.

## Hospedagem

A aplicação é compatível com Vercel. O deploy requer as duas variáveis de ambiente acima. A API não chama Ollama local; a inferência é remota pelo Cloudflare.
