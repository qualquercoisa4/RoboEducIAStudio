# RoboEduc IA Studio

Aplicação educacional com chatbot RoboEduc IA na página inicial e Game Studio em `/studio`.

## IA local (sem chave de API)

O chatbot usa WebLLM para executar um modelo Qwen diretamente no navegador via WebGPU. Não exige conta de provedor, token de API ou servidor de inferência. O modelo é baixado no primeiro uso e armazenado em cache pelo navegador.

- Dispositivos com memória reportada até 4 GB: Qwen2 0.5B quantizado.
- Outros dispositivos: Qwen2 1.5B quantizado.
- É necessário navegador compatível com WebGPU (Chrome/Edge atualizado em hardware compatível).
- A primeira inicialização pode baixar centenas de MB ou mais. A geração usa GPU local; velocidade e qualidade variam conforme o dispositivo.
- As conversas ficam no armazenamento local do navegador. Com o modo local ativo, as mensagens não são enviadas a um serviço de inferência.

## IA Cloudflare opcional

Se `CLOUDFLARE_ACCOUNT_ID` e `CLOUDFLARE_API_TOKEN` estiverem configurados na Vercel, a rota de servidor continua disponível como alternativa de modelo maior.

## Game Studio

Acesse `/studio` para usar o criador de jogos existente.

## Desenvolvimento

```bash
npm install
npm run dev
```
