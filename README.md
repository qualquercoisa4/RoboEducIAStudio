# RoboEduc IA Studio

Aplicação educacional com duas áreas: chatbot RoboEduc IA na página inicial e Game Studio em `/studio`.

## Chatbot

O chatbot usa Cloudflare Workers AI com o modelo `@cf/qwen/qwen3-30b-a3b-fp8`, com transmissão incremental (Server-Sent Events). A chave fica no servidor e não é enviada ao navegador.

Configure estas variáveis no ambiente de execução (por exemplo, Vercel):

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN` (token com permissão para executar Workers AI)

Sem essas credenciais, a interface abre, mas o envio de mensagens retorna um aviso de configuração.

## Game Studio

Acesse `/studio` para usar o criador de jogos existente. O código e o componente de sobrevivência foram preservados.

## Desenvolvimento

```bash
npm install
npm run dev
```

## Privacidade e limites

- O histórico do chatbot é salvo no armazenamento local do navegador.
- As mensagens enviadas ao chatbot são processadas pela Cloudflare Workers AI.
- Há um limite básico por instância de 20 requisições por minuto por IP. Para produção com tráfego público, recomenda-se adicionar rate limiting compartilhado e autenticação.
