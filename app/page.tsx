"use client";

import { useMemo, useState } from "react";

type Choice = { id: string; title: string; description: string; art: string; tone: string; image: string };
type Answers = {
  style: string;
  objective: string;
  camera: string;
  gameplay: string[];
  difficulty: string;
  extra: string;
  name: string;
};

const styles: Choice[] = [
  { id: "Minecraft", title: "Minecraft", description: "Blocos, construção e sobrevivência", art: "🧱", image: "https://pic.clubic.com/183367e01697572/1414x809/smart/minecraft.png", tone: "mint" },
  { id: "Roblox", title: "Roblox", description: "Obbys, avatares e mundos 3D", art: "🧍", image: "https://fiverr-res.cloudinary.com/images/q_auto%2Cf_auto/gigs/462484368/original/95f90abe92342e3078a40064b12dab30a847827b/record-roblox-parkour-gameplay.png", tone: "blue" },
  { id: "Fortnite", title: "Fortnite", description: "Ação, arenas e desafios", art: "🎯", image: "https://i.insider.com/5a9ee5a25cc41021008b45ce?auto=webp&format=jpeg&width=800", tone: "purple" },
  { id: "Sonic", title: "Sonic", description: "Velocidade, saltos e fases", art: "💨", image: "https://i.guim.co.uk/img/media/180629c53bbca46b14ce0373a389a742d208d7ea/35_0_1067_640/master/1067.jpg?auto=format&fit=max&quality=85&s=ceb8c66b7efdc01ac1b7c1c6bb8f2453&width=700", tone: "yellow" },
  { id: "Corrida", title: "Corrida", description: "Veículos, pistas e desafios", art: "🏎️", image: "https://imag.malavida.com/mvimgbig/download-fs/forza-horizon-5-38804-8.jpg", tone: "orange" },
  { id: "Meu próprio estilo", title: "Inventar um estilo", description: "Criar algo totalmente diferente", art: "✨", image: "https://media.rawg.io/media/screenshots/3a8/3a86566137cc587eec4b2321c451c110.jpg", tone: "pink" },
];
const objectives: Choice[] = [
  { id: "Construir robôs", title: "Construir robôs", description: "Montar máquinas e testar invenções", art: "🤖", image: "https://images.sftcdn.net/images/t_app-cover-l%2Cf_auto/p/02a4872f-2a13-451c-905a-26f9c9206f8f/1043206255/coding-robo-screenshot.png", tone: "blue" },
  { id: "Construir cidades", title: "Construir cidades", description: "Criar casas, ruas e cidades inteligentes", art: "🏙️", image: "https://images.cgames.de/images/gsgp/287/highrise-city_6141338.jpg", tone: "purple" },
  { id: "Aprender robótica", title: "Aprender robótica", description: "Usar sensores, motores e programação", art: "⚙️", image: "https://images.sftcdn.net/images/t_app-cover-l%2Cf_auto/p/02a4872f-2a13-451c-905a-26f9c9206f8f/1043206255/coding-robo-screenshot.png", tone: "mint" },
  { id: "Explorar e sobreviver", title: "Explorar e sobreviver", description: "Descobrir lugares e superar perigos", art: "🧭", image: "https://pic.clubic.com/183367e01697572/1414x809/smart/minecraft.png", tone: "orange" },
  { id: "Resolver desafios", title: "Resolver desafios", description: "Quebra-cabeças, lógica e criatividade", art: "🧩", image: "https://media.rawg.io/media/screenshots/3a8/3a86566137cc587eec4b2321c451c110.jpg", tone: "yellow" },
  { id: "Vencer competições", title: "Vencer competições", description: "Disputar provas e bater recordes", art: "🏆", image: "https://imag.malavida.com/mvimgbig/download-fs/forza-horizon-5-38804-8.jpg", tone: "pink" },
];
const cameras: Choice[] = [
  { id: "Primeira pessoa", title: "Primeira pessoa", description: "Ver pelos olhos do personagem", art: "👁️", image: "https://pic.clubic.com/183367e01697572/1414x809/smart/minecraft.png", tone: "blue" },
  { id: "Terceira pessoa", title: "Terceira pessoa", description: "Ver o personagem por trás", art: "🧍", image: "https://fiverr-res.cloudinary.com/images/q_auto%2Cf_auto/gigs/462484368/original/95f90abe92342e3078a40064b12dab30a847827b/record-roblox-parkour-gameplay.png", tone: "mint" },
  { id: "Visão de cima", title: "Visão de cima", description: "Ver o mapa do alto", art: "🗺️", image: "https://images.cgames.de/images/gsgp/287/highrise-city_6141338.jpg", tone: "yellow" },
  { id: "Lateral 2D", title: "Lateral 2D", description: "Ver o jogo de lado", art: "🎮", image: "https://i.guim.co.uk/img/media/180629c53bbca46b14ce0373a389a742d208d7ea/35_0_1067_640/master/1067.jpg?auto=format&fit=max&quality=85&s=ceb8c66b7efdc01ac1b7c1c6bb8f2453&width=700", tone: "purple" },
];
const gameplays: Choice[] = [
  { id: "Construir e criar", title: "Construir e criar", description: "Montar coisas e inventar", art: "🧱", image: "https://pic.clubic.com/183367e01697572/1414x809/smart/minecraft.png", tone: "mint" },
  { id: "Explorar mapas", title: "Explorar mapas", description: "Descobrir lugares novos", art: "🧭", image: "https://pic.clubic.com/183367e01697572/1414x809/smart/minecraft.png", tone: "blue" },
  { id: "Coletar itens", title: "Coletar itens", description: "Juntar moedas e objetos", art: "💎", image: "https://pic.clubic.com/183367e01697572/1414x809/smart/minecraft.png", tone: "purple" },
  { id: "Enfrentar inimigos", title: "Enfrentar inimigos", description: "Desviar e lutar", art: "🐛", image: "https://i.insider.com/5a9ee5a25cc41021008b45ce?auto=webp&format=jpeg&width=800", tone: "orange" },
  { id: "Programar mecanismos", title: "Programar mecanismos", description: "Controlar máquinas e robôs", art: "⚙️", image: "https://images.sftcdn.net/images/t_app-cover-l%2Cf_auto/p/02a4872f-2a13-451c-905a-26f9c9206f8f/1043206255/coding-robo-screenshot.png", tone: "yellow" },
  { id: "Resolver puzzles", title: "Resolver puzzles", description: "Encontrar soluções", art: "🧩", image: "https://media.rawg.io/media/screenshots/3a8/3a86566137cc587eec4b2321c451c110.jpg", tone: "pink" },
  { id: "Correr e competir", title: "Correr e competir", description: "Chegar em primeiro lugar", art: "🏁", image: "https://imag.malavida.com/mvimgbig/download-fs/forza-horizon-5-38804-8.jpg", tone: "orange" },
  { id: "Jogar em fases", title: "Jogar em fases", description: "Passar por várias etapas", art: "🎯", image: "https://media.rawg.io/media/screenshots/3a8/3a86566137cc587eec4b2321c451c110.jpg", tone: "blue" },
];
const difficulties: Choice[] = [
  { id: "Fácil", title: "Fácil", description: "Para começar", art: "🐣", image: "https://images.sftcdn.net/images/t_app-cover-l%2Cf_auto/p/02a4872f-2a13-451c-905a-26f9c9206f8f/1043206255/coding-robo-screenshot.png", tone: "mint" },
  { id: "Médio", title: "Médio", description: "Um desafio equilibrado", art: "🚀", image: "https://pic.clubic.com/183367e01697572/1414x809/smart/minecraft.png", tone: "blue" },
  { id: "Desafiador", title: "Desafiador", description: "Para quem gosta de desafio", art: "🔥", image: "https://i.insider.com/5a9ee5a25cc41021008b45ce?auto=webp&format=jpeg&width=800", tone: "orange" },
];
function emojiImage(emoji: string) { return emoji; }
const initial: Answers = { style: "", objective: "", camera: "Terceira pessoa", gameplay: ["Explorar mapas", "Construir e criar"], difficulty: "Médio", extra: "", name: "" };
const steps = ["Estilo", "Objetivo", "Como jogar", "Detalhes", "Pronto!"];

export default function Home() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(initial);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const progress = useMemo(() => Math.round(((step + 1) / steps.length) * 100), [step]);

  function update<K extends keyof Answers>(key: K, value: Answers[K]) {
    setAnswers(previous => ({ ...previous, [key]: value }));
  }
  function toggleGameplay(value: string) {
    update("gameplay", answers.gameplay.includes(value)
      ? answers.gameplay.filter(item => item !== value)
      : [...answers.gameplay, value]);
  }
  function reset() {
    setStep(0); setAnswers(initial); setPrompt(""); setError(""); setCopied(false);
  }

  async function generatePrompt() {
    setLoading(true); setError(""); setCopied(false);
    const brief = [
      "Estilo ou referência: " + answers.style,
      "Objetivo principal: " + answers.objective,
      "Câmera: " + answers.camera,
      "Mecânicas escolhidas: " + answers.gameplay.join(", "),
      "Dificuldade: " + answers.difficulty,
      "Nome provisório: " + (answers.name.trim() || "Pode sugerir um nome"),
      "Ideias extras da criança: " + (answers.extra.trim() || "Nenhuma"),
    ].join("\n");
    const systemInstruction = `Você é um designer de jogos educativos que transforma ideias de crianças em instruções excelentes para outra IA programadora. Escreva em português brasileiro, com linguagem clara e objetiva. Sua tarefa é produzir UM PROMPT DE DESENVOLVIMENTO completo, de tamanho médio (aproximadamente 280 a 420 palavras), pronto para copiar e enviar a outra IA. O prompt deve pedir a criação de um jogo REAL em um único arquivo HTML, com CSS e JavaScript embutidos, que funcione ao abrir no navegador, sem frameworks, sem instalação e sem assets externos obrigatórios. Deve especificar gameplay coerente com as escolhas, controles de teclado e toque quando aplicável, objetivo e condição de vitória, interface legível, feedback visual/sonoro opcional, progressão, colisões/física quando necessárias, tela inicial, pausa/reinício e adaptação para celular e computador. A referência a jogos famosos serve apenas para descrever gênero e sensação; não copie personagens, marcas, mapas, músicas ou assets protegidos. Não misture gêneros incompatíveis: respeite a referência selecionada e adapte o objetivo a ela de maneira consistente. Se o tema for robótica ou aprendizagem, integre isso às mecânicas do jogo, não apenas à história. Não inclua explicações sobre o seu processo, nem introdução, nem Markdown em volta: entregue somente o prompt final, em texto simples, com seções curtas e requisitos verificáveis. Não invente multiplayer online ou recursos de servidor.`;
    try {
      const statusResponse = await fetch("/api/status", { cache: "no-store" });
      const providerStatus = await statusResponse.json();
      if (!providerStatus.anyProviderConfigured) {
        throw new Error("A IA na nuvem ainda não está conectada neste ambiente. Configure uma chave de provedor (por exemplo, OPENROUTER_API_KEY) nas variáveis do Railway para ativar a geração.");
      }
      const model = providerStatus.openrouterConfigured
        ? "openrouter:qwen/qwen3-coder-next"
        : providerStatus.geminiConfigured
          ? "gemini:gemini-3.8-flash"
          : providerStatus.openaiConfigured
            ? "openai:gpt-5.6-luna"
            : "cloudflare";
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Crie o prompt de desenvolvimento para este jogo com base nas respostas abaixo.\n\n" + brief }],
          systemInstruction,
          mode: "fast",
          model,
          webSearch: false
        })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || `Não foi possível gerar o prompt (HTTP ${response.status}).`);
      }
      if (!response.body) throw new Error("O servidor não retornou a resposta.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let result = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() || "";
        for (const event of events) {
          for (const line of event.split(/\r?\n/)) {
            if (!line.startsWith("data:")) continue;
            const raw = line.slice(5).trim();
            if (!raw || raw === "[DONE]") continue;
            const data = JSON.parse(raw);
            if (data.type === "error" || data.error) throw new Error(data.error || "Falha ao gerar.");
            if (data.type === "token" && typeof data.response === "string") result += data.response;
            else if (typeof data.response === "string") result += data.response;
          }
        }
      }
      if (buffer.trim()) {
        for (const line of buffer.split(/\r?\n/)) {
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (!raw || raw === "[DONE]") continue;
          const data = JSON.parse(raw);
          if (data.type === "token" && typeof data.response === "string") result += data.response;
        }
      }
      if (!result.trim()) throw new Error("A IA não retornou um prompt. Tente novamente.");
      setPrompt(result.trim());
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ocorreu um erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
    } catch {
      setError("Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.");
    }
  }

  const canContinue = step === 0 ? Boolean(answers.style) : step === 1 ? Boolean(answers.objective) : step === 2 ? Boolean(answers.camera && answers.gameplay.length) : true;

  return (
    <main className="prompt-app">
      <header className="prompt-header">
        <a className="prompt-brand" href="/" aria-label="RoboEduc Game Creator">
          <span className="prompt-brand-robo">ROBO</span><span className="prompt-brand-educ"><i>E</i><i>D</i><i>U</i><i>C</i></span><small>GAME CREATOR</small>
        </a>
        <a className="main-site-link" href="https://poa.roboeduc.com.br/" target="_blank" rel="noreferrer">Site da RoboEduc <span>↗</span></a>
      </header>

      <section className="prompt-content">
        <div className="prompt-intro">
          <span className="prompt-kicker"><span /> SUA IDEIA, SEU JOGO</span>
          <h1>Vamos criar um <em>jogo incrível?</em></h1>
          <p>Escolha suas ideias. A nossa IA vai transformar tudo em um prompt para criar seu jogo!</p>
        </div>

        <div className="wizard-progress">
          <div className="wizard-progress-track"><span style={{ width: progress + "%" }} /></div>
          <div className="wizard-step-label"><span>ETAPA {step + 1} DE 5</span><b>{steps[step]}</b></div>
        </div>

        {step === 0 && <div className="wizard-panel">
          <div className="wizard-question"><span>01</span><div><h2>Qual estilo vai ter o seu jogo?</h2><p>Escolha o tipo de aventura que mais combina com você.</p></div></div>
          <div className="choice-grid style-grid">
            {styles.map((item, index) => <button key={item.id} className={`choice-card ${item.tone} ${answers.style === item.id ? "selected" : ""}`} onClick={() => update("style", item.id)}>
              <span className="choice-art screenshot-art"><img src={item.image} alt={`Imagem de gameplay: ${item.title}`} loading="lazy" /><b>{index === 0 ? "▦ ▦ ▦" : index === 1 ? "◆ ◇ ◆" : index === 2 ? "✦ ✧ ✦" : index === 3 ? "➜ ➜" : index === 4 ? "◉ ◉" : "✧ ✦"}</b></span>
              <span className="choice-copy"><strong>{item.title}</strong><small>{item.description}</small></span><span className="choice-check">✓</span>
            </button>)}
          </div>
        </div>}

        {step === 1 && <div className="wizard-panel">
          <div className="wizard-question"><span>02</span><div><h2>O que você quer fazer no jogo?</h2><p>Qual será a missão mais importante?</p></div></div>
          <div className="choice-grid objective-grid">
            {objectives.map(item => <button key={item.id} className={`choice-card objective-card ${item.tone} ${answers.objective === item.id ? "selected" : ""}`} onClick={() => update("objective", item.id)}>
              <span className="objective-art screenshot-art"><img src={item.image} alt={`Imagem de gameplay: ${item.title}`} loading="lazy" /></span><span className="choice-copy"><strong>{item.title}</strong><small>{item.description}</small></span><span className="choice-check">✓</span>
            </button>)}
          </div>
        </div>}

        {step === 2 && <div className="wizard-panel">
          <div className="wizard-question"><span>03</span><div><h2>Como será a aventura?</h2><p>Escolha a câmera e o que o jogador poderá fazer.</p></div></div>
          <div className="field-block"><h3>Como vamos enxergar o jogo?</h3><div className="visual-option-grid camera-grid">{cameras.map(item => <button key={item.id} className={`visual-option ${answers.camera === item.id ? "active" : ""}`} onClick={() => update("camera", item.id)}><img src={item.image} alt={`Imagem de gameplay: ${item.title}`} loading="lazy" /><strong>{item.title}</strong><small>{item.description}</small></button>)}</div></div>
          <div className="field-block"><h3>O que o jogador poderá fazer?</h3><p className="field-hint">Pode escolher mais de uma opção.</p><div className="visual-option-grid gameplay-grid">{gameplays.map(item => <button key={item.id} className={`visual-option ${answers.gameplay.includes(item.id) ? "active" : ""}`} onClick={() => toggleGameplay(item.id)}><img src={emojiImage(item.art)} alt="" loading="lazy" /><strong>{item.title}</strong><small>{item.description}</small><span className="visual-option-check">{answers.gameplay.includes(item.id) ? "✓" : "+"}</span></button>)}</div></div>
        </div>}

        {step === 3 && <div className="wizard-panel">
          <div className="wizard-question"><span>04</span><div><h2>Vamos personalizar!</h2><p>Mais alguns detalhes para deixar o jogo com a sua cara.</p></div></div>
          <div className="field-block"><h3>Qual será a dificuldade?</h3><div className="visual-option-grid difficulty-grid">{difficulties.map(item => <button key={item.id} className={`visual-option ${answers.difficulty === item.id ? "active" : ""}`} onClick={() => update("difficulty", item.id)}><img src={emojiImage(item.art)} alt="" loading="lazy" /><strong>{item.title}</strong><small>{item.description}</small></button>)}</div></div>
          <div className="field-block"><h3>Como o jogo vai se chamar?</h3><input className="wizard-input" value={answers.name} onChange={e => update("name", e.target.value)} placeholder="Ex.: Aventura dos Robôs (opcional)" maxLength={60} /></div>
          <div className="field-block"><h3>Tem mais alguma ideia?</h3><textarea className="wizard-input wizard-textarea" value={answers.extra} onChange={e => update("extra", e.target.value)} placeholder="Ex.: Quero um robô que consiga voar e coletar cristais..." maxLength={500} rows={3} /></div>
        </div>}

        {step === 4 && <div className="wizard-panel result-panel">
          <div className="result-heading"><span className="result-spark">✦</span><h2>Seu prompt está pronto!</h2><p>A IA organizou suas ideias em instruções para criar o jogo.</p></div>
          <div className="result-summary"><span>{answers.style}</span><i>•</i><span>{answers.objective}</span><i>•</i><span>{answers.camera}</span></div>
          <textarea className="prompt-result" value={prompt} onChange={e => setPrompt(e.target.value)} aria-label="Prompt gerado" />
          <button className={`copy-prompt-button ${copied ? "copied" : ""}`} onClick={copyPrompt}>{copied ? "✓ COPIADO!" : "▢ COPIAR PROMPT"}</button>
          <button className="start-over-button" onClick={reset}>Criar outro jogo</button>
        </div>}

        {error && <div className="prompt-error" role="alert">{error}</div>}
        {step < 4 && <div className="wizard-actions">
          <button className="wizard-back" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0 || loading}>← Voltar</button>
          {step < 3
            ? <button className="wizard-next" onClick={() => setStep(s => s + 1)} disabled={!canContinue}>Continuar <span>→</span></button>
            : <button className="wizard-next generate-button" onClick={generatePrompt} disabled={loading}>{loading ? <><span className="mini-spinner" /> Criando seu prompt...</> : <>Criar meu prompt <span>✦</span></>}</button>}
        </div>}
      </section>
      <footer className="prompt-footer"><span>ROBOEDUC</span> · CRIATIVIDADE, TECNOLOGIA E APRENDIZADO</footer>
    </main>
  );
}
