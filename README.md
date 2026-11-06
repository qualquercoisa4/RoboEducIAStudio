# RoboEduc AI Studio

Aplicação educacional com chatbot RoboEduc AI, edição de projetos por IA e Game Studio em `/studio`.

## Chatbot e provedores de IA

O chatbot usa a rota de servidor `/api/chat` para chamar o provedor selecionado. A chave fica no servidor e não é enviada ao navegador.

### Provedor principal

Configure `OPENROUTER_API_KEY` na Vercel para habilitar o modelo padrão **Qwen3 Coder Next** e os modelos alternativos disponíveis no seletor.

### Provedores opcionais

- **Cloudflare Workers AI:** configure `CLOUDFLARE_ACCOUNT_ID` e `CLOUDFLARE_API_TOKEN`.
- **Google Gemini:** configure `GEMINI_API_KEY`.
- **OpenAI:** configure `OPENAI_API_KEY` se for habilitar um modelo OpenAI compatível no cliente e no servidor.

As variáveis devem estar configuradas nos ambientes Vercel que serão usados (`Production`, `Preview` e/ou `Development`). Depois de alterar variáveis, gere um novo deployment para que as funções recebam os valores atualizados.

A rota `/api/status` informa quais provedores estão configurados sem expor chaves ou valores secretos.

## Edição de projetos por IA

O Workspace em `/workspace` envia o snapshot do projeto e as operações planejadas ao servidor. O servidor valida caminhos, operações e conteúdo antes de enviar o conjunto ao editor para aplicação. Os testes automatizados desse protocolo ficam em `tests/workspace-patch.test.mjs`.

## Game Studio

Acesse `/studio` para usar o criador de jogos. O projeto também inclui o jogo de sobrevivência voxel em `/games`.

## Desenvolvimento local

Crie um arquivo `.env.local` com as variáveis do provedor escolhido e execute:

```bash
npm install
npm run dev
```

## Validação

```bash
npm run test:workspace
npm run lint
npm run build
```
