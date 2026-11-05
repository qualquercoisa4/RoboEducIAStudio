# RoboEduc IA Studio

MVP educacional construído com Next.js e WebLLM.

## Inferência local

O navegador executa o modelo `Qwen2-0.5B-Instruct-q4f16_1-MLC` com WebGPU. Não exige API key, conta externa ou variável secreta. As mensagens são processadas localmente.

## Primeiro uso

1. Abra o site em navegador e dispositivo compatíveis com WebGPU.
2. Clique em **Carregar IA neste dispositivo**.
3. Aguarde o download inicial do modelo.
4. Envie uma mensagem.

O download é feito uma vez e o navegador pode armazenar o modelo em cache. O modelo é pequeno e sua qualidade é inferior à de modelos de nuvem maiores. A compatibilidade e o desempenho dependem da GPU, memória e navegador. Alguns celulares não oferecem WebGPU.

## Desenvolvimento

```bash
npm install
npm run dev
```

## Privacidade e limitações

- A geração ocorre no próprio navegador; os prompts não são enviados a uma API de IA.
- O primeiro carregamento baixa pesos do modelo de infraestrutura pública MLC/Hugging Face.
- O histórico fica no armazenamento local do navegador.
- É necessário suporte a WebGPU.
- As rotas antigas em `app/api` são legadas e não são usadas pela interface local.
