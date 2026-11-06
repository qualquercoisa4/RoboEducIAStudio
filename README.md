# RoboEduc IA Studio

Aplicação educacional com chatbot RoboEduc IA na página inicial e Game Studio em `/studio`.

## IA local sem chave de API

O chatbot executa o modelo aberto `onnx-community/Qwen2.5-Coder-0.5B-Instruct` diretamente no navegador usando Transformers.js e WebGPU quando disponível. Não exige conta de provedor, token de API nem servidor de inferência.

- O modelo é quantizado em 4 bits e baixado no primeiro uso.
- O navegador armazena os arquivos do modelo em cache para usos seguintes.
- Em dispositivos sem WebGPU, o runtime tenta usar CPU/WASM; a geração será mais lenta.
- As mensagens são processadas localmente no dispositivo quando a IA local está ativa.
- O modelo é compacto; não tem a capacidade de modelos grandes hospedados na nuvem.

## IA Cloudflare opcional

Se `CLOUDFLARE_ACCOUNT_ID` e `CLOUDFLARE_API_TOKEN` estiverem configurados na Vercel, a rota de servidor continua disponível como alternativa de maior capacidade.

## Game Studio

Acesse `/studio` para usar o criador de jogos existente.

## Desenvolvimento

```bash
npm install
npm run dev
```
