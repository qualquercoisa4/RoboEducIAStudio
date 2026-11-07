"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import HtmlCodeRunner from "../components/HtmlCodeRunner";
import MarkdownMessage from "../components/MarkdownMessage";

type Message = { role: string; content: string };
type Conversation = { id: string; title: string; messages: Message[]; updatedAt: number };
type WorkMode = "fast" | "complete" | "deep";

const KEY = "roboeduc-ai-history-v1";
const starters = [
  ["⌘", "Programação", "Explique como funciona um loop for em JavaScript, com exemplo."],
  ["⚙", "Robótica", "Como conectar um servo motor ao Arduino Uno com segurança?"],
  ["◈", "Projetos", "Me ajude a planejar um projeto de robótica para iniciantes."],
  ["▤", "Aprender", "Explique inteligência artificial de um jeito simples e prático."]
];
const SYSTEM = "Você é o RoboEduc AI, assistente educacional especializado em tecnologia, robótica, eletrônica, programação, ciências e criação de projetos. Responda em português brasileiro, com precisão e exemplos práticos. Ao gerar código, forneça soluções completas, explique onde salvar e como executar. Se não souber, diga que não sabe. Não invente testes ou resultados.";
const titleOf = (s: string) => s.trim().replace(/\s+/g, " ").slice(0, 42) || "Nova conversa";
const conversationHistoryStore = (() => {
  const emptyHistory: Conversation[] = [];
  let cachedRaw: string | null | undefined;
  let cachedHistory: Conversation[] = emptyHistory;

  function getSnapshot(): Conversation[] {
    let raw: string | null;
    try {
      raw = localStorage.getItem(KEY);
    } catch {
      return cachedHistory;
    }
    if (raw === cachedRaw) return cachedHistory;
    cachedRaw = raw;
    if (!raw) {
      cachedHistory = emptyHistory;
      return cachedHistory;
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        cachedHistory = parsed as Conversation[];
        return cachedHistory;
      }
    } catch {
      // Invalid saved history is discarded below.
    }
    try {
      localStorage.removeItem(KEY);
    } catch {
      // Keep the in-memory empty history when browser storage is unavailable.
    }
    cachedRaw = null;
    cachedHistory = emptyHistory;
    return cachedHistory;
  }

  function getServerSnapshot(): Conversation[] {
    return emptyHistory;
  }

  function subscribe(callback: () => void) {
    window.addEventListener("storage", callback);
    window.addEventListener("roboeduc-history-change", callback);
    return () => {
      window.removeEventListener("storage", callback);
      window.removeEventListener("roboeduc-history-change", callback);
    };
  }

  function update(updateValue: Conversation[] | ((previous: Conversation[]) => Conversation[])) {
    const previous = getSnapshot();
    const next = typeof updateValue === "function" ? updateValue(previous) : updateValue;
    const serialized = JSON.stringify(next);
    try {
      if (next.length) localStorage.setItem(KEY, serialized);
      else localStorage.removeItem(KEY);
      cachedRaw = next.length ? serialized : null;
    } catch {
      try {
        cachedRaw = localStorage.getItem(KEY);
      } catch {
        cachedRaw = null;
      }
    }
    cachedHistory = next.length ? next : emptyHistory;
    window.dispatchEvent(new Event("roboeduc-history-change"));
  }

  return { getSnapshot, getServerSnapshot, subscribe, update };
})();
export default function Home() {
  const items = useSyncExternalStore(conversationHistoryStore.subscribe, conversationHistoryStore.getSnapshot, conversationHistoryStore.getServerSnapshot);
  const setItems = conversationHistoryStore.update;
  const [activeId, setActiveId] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<WorkMode>("complete");
  const [selectedModel, setSelectedModel] = useState("openrouter:qwen/qwen3-coder-next");
  const [openRouterReady, setOpenRouterReady] = useState(false);
  const [openAIReady, setOpenAIReady] = useState(false);
  const [geminiReady, setGeminiReady] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [processSteps, setProcessSteps] = useState<string[]>([]);
  const bottom = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const activeConversationId = activeId || items[0]?.id || "";
  const active = items.find(item => item.id === activeConversationId);
  const messages = useMemo(() => active?.messages ?? [], [active]);
  const selectedProviderReady = selectedModel === "cloudflare" ? cloudReady : selectedModel === "openai:gpt-5.6-luna" ? openAIReady : selectedModel.startsWith("gemini:") ? geminiReady : openRouterReady;

  useEffect(() => {
    fetch("/api/status", { cache: "no-store" })
      .then(response => response.json())
      .then(data => { setCloudReady(Boolean(data.configured)); setOpenRouterReady(Boolean(data.openrouterConfigured)); setOpenAIReady(Boolean(data.openaiConfigured)); setGeminiReady(Boolean(data.geminiConfigured)); })
      .catch(() => setCloudReady(false));
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, processSteps]);

  const patch = (id: string, nextMessages: Message[], title?: string) => {
    setItems(old => old.map(item => item.id === id
      ? { ...item, messages: nextMessages, title: title ?? item.title, updatedAt: Date.now() }
      : item
    ).sort((a, b) => b.updatedAt - a.updatedAt));
  };

  const newChat = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setLoading(false);
    setProcessSteps([]);
    const id = crypto.randomUUID();
    setItems(old => [{ id, title: "Nova conversa", messages: [], updatedAt: Date.now() }, ...old]);
    setActiveId(id);
    setInput("");
    setError("");
    setSidebar(false);
    area.current?.focus();
  }, [setItems]);

  async function send(value?: string) {
    const text = (value ?? input).trim();
    if (!text || loading) return;
    if (!selectedProviderReady) {
      const requiredKey = selectedModel === "cloudflare" ? "CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN" : selectedModel === "openai:gpt-5.6-luna" ? "OPENAI_API_KEY" : selectedModel.startsWith("gemini:") ? "GEMINI_API_KEY" : "OPENROUTER_API_KEY";
      setError("O provedor selecionado não está configurado. Adicione " + requiredKey + " nas variáveis de ambiente do servidor.");
      return;
    }

    let id = activeConversationId;
    const existing = items.find(item => item.id === id);
    if (!existing) {
      id = crypto.randomUUID();
      setItems(old => [{ id, title: titleOf(text), messages: [], updatedAt: Date.now() }, ...old]);
      setActiveId(id);
    }

    const oldMessages = existing?.messages ?? [];
    const base: Message[] = [...oldMessages, { role: "user", content: text }];
    const pending: Message[] = [...base, { role: "assistant", content: "" }];
    patch(id, pending, oldMessages.length ? undefined : titleOf(text));
    setInput("");
    setError("");
    setProcessSteps([]);
    setLoading(true);

    const controller = new AbortController();
    controllerRef.current = controller;
    let answer = "";

    try {
      const append = (part: string) => {
        answer += part;
        patch(id, [...base, { role: "assistant", content: answer }]);
      };
      const consumeEvent = (chunk: string) => {
        for (const line of chunk.split(/\r?\n/)) {
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (!raw || raw === "[DONE]") continue;
          let data: {
            type?: string;
            stage?: string;
            detail?: string;
            response?: string;
            error?: string;
            result?: { response?: string };
            choices?: Array<{ delta?: { content?: string } }>;
            delta?: { response?: string };
          };
          try {
            data = JSON.parse(raw);
          } catch {
            continue;
          }
          if (data.type === "reset") {
            answer = "";
            patch(id, [...base, { role: "assistant", content: "" }]);
          } else if (data.type === "status") {
            const detail = data.detail || data.stage || "Processando";
            setProcessSteps(previous => previous.at(-1) === detail ? previous : [...previous, detail].slice(-6));
          } else if (data.type === "error" || data.error) {
            throw new Error(data.error || "Falha durante o processamento.");
          } else if (data.type === "token") {
            if (typeof data.response === "string") append(data.response);
          } else {
            const legacyToken = data.response ?? data.result?.response ?? data.choices?.[0]?.delta?.content ?? data.delta?.response;
            if (typeof legacyToken === "string" && legacyToken) append(legacyToken);
          }
        }
      };

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
        body: JSON.stringify({ messages: base, systemInstruction: SYSTEM, mode, model: selectedModel, webSearch: selectedModel !== "cloudflare" && selectedModel !== "openai:gpt-5.6-luna" && !selectedModel.startsWith("gemini:") && webSearch }),
        signal: controller.signal
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? `Falha HTTP ${response.status}.`);
      }
      if (!response.body) throw new Error("O servidor não retornou um fluxo de resposta.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() ?? "";
        for (const event of events) consumeEvent(event);
      }
      buffer += decoder.decode();
      if (buffer.trim()) consumeEvent(buffer);

      if (!answer.trim()) throw new Error("A IA encerrou a geração sem texto. Tente novamente.");
    } catch (exception) {
      const aborted = exception instanceof Error && exception.name === "AbortError";
      if (!aborted) setError(exception instanceof Error ? exception.message : "Não foi possível gerar uma resposta.");
      patch(id, answer.trim() ? [...base, { role: "assistant", content: answer }] : base);
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      setLoading(false);
      setProcessSteps([]);
      area.current?.focus();
    }
  }

  const stop = () => controllerRef.current?.abort();
  const remove = (id: string) => {
    const remaining = items.filter(item => item.id !== id);
    setItems(remaining);
    if (id === activeConversationId) setActiveId(remaining[0]?.id ?? "");
  };
  const askForCodeFix = (code: string, errors: string[]) => {
    const details = errors.map((item, index) => `${index + 1}. ${item}`).join("\n");
    void send("Analise este código HTML e corrija os erros que apareceram durante a execução no navegador. Preserve o objetivo e as funcionalidades. Explique as correções e entregue o código completo.\n\nErros registrados:\n" + details + "\n\nCódigo atual:\n```html\n" + code + "\n```");
  };

  return (
    <main className="studio-shell">
      <aside className={`studio-sidebar ${sidebar ? "open" : ""}`}>
        <div className="brand-row">
          <Link className="brand" href="/" aria-label="RoboEduc IA Studio"><span className="brand-mark">R</span><span className="brand-wordmark"><span className="brand-robo">ROBO</span><span className="brand-educ"><i>E</i><i>D</i><i>U</i><i>C</i></span><small>IA STUDIO</small></span></Link>
          <button className="mobile-close" onClick={() => setSidebar(false)}>×</button>
        </div>
        <button className="new-chat" onClick={newChat}><b>＋</b> Nova conversa</button>
        <div className="history-heading">RECENTES</div>
        <div className="history-list">
          {items.map(item => (
            <div className={`history-item ${item.id === activeConversationId ? "current" : ""}`} key={item.id}>
              <button onClick={() => { setActiveId(item.id); setSidebar(false); setError(""); }}>
                ◌ <span>{item.title}</span>
              </button>
              <button className="remove-chat" onClick={() => remove(item.id)} aria-label="Excluir conversa">×</button>
            </div>
          ))}
          {!items.length && <p className="no-history">Suas conversas aparecerão aqui.</p>}
        </div>
        <div className="sidebar-footer">
          <a className="studio-link" href="/">▦　Abrir Game Creator　↗</a>
          <div className="model-status">
            <i className={cloudReady ? "online" : ""} />
            <span><b>RoboEduc AI</b><small>{cloudReady ? "IA na nuvem conectada" : "Nuvem não configurada"}</small></span>
          </div>
        </div>
      </aside>

      {sidebar && <button className="sidebar-overlay" onClick={() => setSidebar(false)} aria-label="Fechar menu" />}

      <section className="chat-main">
        <header className="chat-top">
          <button className="mobile-menu" onClick={() => setSidebar(true)} aria-label="Abrir menu">☰</button>
          <div className="chat-heading">RoboEduc <strong>IA Studio</strong></div>
          <a href="/workspace">Área de trabalho ↗</a>
        </header>

        <div className={`chat-content ${messages.length ? "has-chat" : ""}`}>
          {!messages.length ? (
            <div className="welcome">
              <div className="welcome-brand" aria-label="RoboEduc"><span>ROBO</span><strong><i>E</i><i>D</i><i>U</i><i>C</i></strong><small>ESCOLA DE PROGRAMAÇÃO E ROBÓTICA</small></div>
              <small>SEU LABORATÓRIO DE IDEIAS</small>
              <h1>Ideias que viram <em>projetos.</em></h1>
              <div className="starter-grid">
                {starters.map(([icon, name, description]) => (
                  <button key={name} onClick={() => send(description)}>
                    <span>{icon}</span><b>{name}</b><small>{description}</small><i>↗</i>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="messages">
              {messages.map((message, index) => (
                <article className={`message ${message.role}`} key={index}>
                  <div className="avatar">{message.role === "assistant" ? "R" : "V"}</div>
                  <div className="message-body">
                    <b>{message.role === "assistant" ? "ROBOEDUC AI" : "VOCÊ"}</b>
                    <div className="message-text">
                      {message.content ? <MarkdownMessage content={message.content} /> : (loading ? <span className="typing"><i /><i /><i /></span> : null)}
                    </div>
                    {message.role === "assistant" && message.content && (
                      <HtmlCodeRunner content={message.content} onAskFix={askForCodeFix} />
                    )}
                    {message.role === "assistant" && !message.content && loading && index === messages.length - 1 && (
                      <div className="process-card" aria-live="polite">
                        <div className="process-card-head"><span className="process-spinner" /> <strong>RoboEducIA em execução</strong></div>
                        <div className="process-steps">
                          {processSteps.map((step, stepIndex) => (
                            <div className={stepIndex === processSteps.length - 1 ? "current" : "complete"} key={stepIndex}>
                              <i>{stepIndex === processSteps.length - 1 ? "◌" : "✓"}</i><span>{step}</span>
                            </div>
                          ))}
                        </div>
                        {!processSteps.length && <small>Preparando a solicitação...</small>}
                      </div>
                    )}
                  </div>
                </article>
              ))}
              <div ref={bottom} />
            </div>
          )}
        </div>

        <div className="composer-area">
          {error && <div className="error-banner">{error}<button onClick={() => setError("")}>Fechar</button></div>}
          <div className="chat-toolbar">
            <div className="mode-selector" aria-label="Nível de processamento">
              <button type="button" className={mode === "fast" ? "selected" : ""} onClick={() => setMode("fast")} disabled={loading} title="Respostas rápidas">Rápido</button>
              <button type="button" className={mode === "complete" ? "selected" : ""} onClick={() => setMode("complete")} disabled={loading} title="Equilíbrio entre velocidade e qualidade">Completo</button>
              <button type="button" className={mode === "deep" ? "selected" : ""} onClick={() => setMode("deep")} disabled={loading} title="Tarefas complexas">Profundo</button>
            </div>
            <details className="model-settings">
              <summary title="Alterar modelo e opções">
                <span className="settings-symbol" aria-hidden="true">⚙</span>
                <strong>{selectedModel === "openrouter:qwen/qwen3-coder-next" ? "Qwen3 Coder Next" : selectedModel === "cloudflare" ? "Qwen3 30B" : selectedModel.startsWith("gemini:") ? "Gemini" : selectedModel.split("/").at(-1)?.replace(":free", "")}</strong>
                <i aria-hidden="true">⌄</i>
              </summary>
              <div className="model-picker" aria-label="Modelo de inteligência artificial">
                <label htmlFor="model-choice">MODELO DE IA</label>
                <select id="model-choice" value={selectedModel} onChange={event => setSelectedModel(event.target.value)} disabled={loading}>
                  <option value="openrouter:qwen/qwen3-coder-next">Qwen3 Coder Next · Código</option>
                  <option value="cloudflare">Qwen3 30B · Cloudflare</option>
                  <option value="recursive/flint-v1.0:free">Flint · Grátis</option>
                  <option value="cohere/north-mini-code:free">North Mini Code · Grátis</option>
                  <option value="nvidia/nemotron-3-ultra-550b-a55b:free">Nemotron 3 Ultra · Grátis</option>
                  <option value="google/gemma-4-31b-it:free">Gemma 4 31B · Grátis</option>
                  <option value="gemini:gemini-3.8-flash">Gemini 3.8 Flash</option>
                </select>
                {selectedModel !== "cloudflare" && selectedModel !== "openai:gpt-5.6-luna" && !selectedModel.startsWith("gemini:") && (
                  <label className="compact-web-search">
                    <input type="checkbox" checked={webSearch} onChange={event => setWebSearch(event.target.checked)} disabled={loading || !openRouterReady} />
                    Pesquisar na internet
                    <small>Ativa busca para todas as perguntas. Perguntas sobre fatos atuais podem acionar busca automaticamente. O provedor pode cobrar pela pesquisa.</small>
                  </label>
                )}
              </div>
            </details>
          </div>
          <div className="composer">
            <textarea
              ref={area}
              rows={1}
              value={input}
              onChange={event => setInput(event.target.value)}
              onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }}
              placeholder="Pergunte qualquer coisa…"
              disabled={loading}
            />
            {loading
              ? <button className="send stop" onClick={stop} aria-label="Parar geração">■</button>
              : <button className="send" disabled={!input.trim()} onClick={() => void send()} aria-label="Enviar mensagem">↑</button>}
          </div>

        </div>
      </section>
    </main>
  );
}
