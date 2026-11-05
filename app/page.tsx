"use client";

import { useEffect, useRef, useState } from "react";
import type { MLCEngine } from "@mlc-ai/web-llm";

type Message = { role: "user" | "assistant"; content: string };
const MODEL = "Qwen2-0.5B-Instruct-q4f16_1-MLC";

export default function Home() {
  const engine = useRef<MLCEngine | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [system, setSystem] = useState("Você é um assistente educacional especializado em tecnologia, robótica e programação. Responda em português brasileiro, explique com clareza e forneça exemplos de código quando solicitado.");
  const [status, setStatus] = useState("Modelo ainda não carregado");
  const [progress, setProgress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("roboeducia-messages");
      if (saved) setMessages(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem("roboeducia-messages", JSON.stringify(messages)); } catch {}
  }, [messages]);

  async function loadModel() {
    if (engine.current || busy) return;
    setBusy(true);
    setError("");
    try {
      if (!("gpu" in navigator)) throw new Error("Este navegador não oferece WebGPU. Tente Chrome atualizado em um computador compatível.");
      setStatus("Preparando modelo...");
      const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
      const instance = await CreateMLCEngine(MODEL, {
        initProgressCallback: (p) => setProgress(p.text || "Baixando modelo...")
      });
      engine.current = instance;
      setStatus("IA local pronta");
      setProgress("Modelo carregado neste dispositivo.");
    } catch (e) {
      setStatus("Não foi possível carregar");
      setError(e instanceof Error ? e.message : "Falha ao iniciar a IA local.");
    } finally { setBusy(false); }
  }

  async function send() {
    const prompt = input.trim();
    if (!prompt || !engine.current || busy) return;
    const next = [...messages, { role: "user" as const, content: prompt }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError("");
    try {
      const result = await engine.current.chat.completions.create({
        messages: [
          { role: "system", content: system },
          ...next.slice(-8).map((m) => ({ role: m.role, content: m.content }))
        ],
        temperature: 0.4,
        max_tokens: 700
      });
      const answer = result.choices[0]?.message?.content;
      if (typeof answer !== "string" || !answer.trim()) throw new Error("O modelo retornou uma resposta vazia.");
      setMessages([...next, { role: "assistant", content: answer }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao gerar resposta.");
    } finally { setBusy(false); }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">RoboEduc <span>IA Studio</span></div>
        <p className="muted">Laboratório educacional de IA</p>
        <button className="side-button" onClick={() => { setMessages([]); setError(""); }}>＋ Nova conversa</button>
        <div style={{ marginTop: 32 }}>
          <p className="muted">INSTRUÇÕES DO SISTEMA</p>
          <textarea style={{ minHeight: 190, border: "1px solid #303b55", borderRadius: 10, padding: 10 }} value={system} onChange={(e) => setSystem(e.target.value)} />
        </div>
        <p className="muted">Qwen2 0.5B · Execução local</p>
        <p className="muted">Sem chave de API ou cobrança por requisição</p>
      </aside>
      <main className="main">
        <header className="topbar"><strong>Playground</strong><span className="status">{status}</span></header>
        <section className="content">
          <h1>O que vamos construir hoje?</h1>
          <p className="muted">A IA roda no seu próprio dispositivo. O primeiro carregamento baixa o modelo.</p>
          <div className="messages">
            {messages.length === 0 ? (
              <div className="empty">
                <div style={{ fontSize: 42, marginBottom: 12 }}>✳</div>
                <h2>Seu laboratório de IA</h2>
                <p className="muted">Carregue o modelo para começar a conversar sobre programação, robótica e tecnologia.</p>
                <button className="primary" onClick={loadModel} disabled={busy || !!engine.current}>{busy ? "Carregando..." : engine.current ? "Modelo carregado" : "Carregar IA neste dispositivo"}</button>
                {progress && <p className="muted">{progress}</p>}
              </div>
            ) : messages.map((m, i) => (
              <div className={`bubble ${m.role}`} key={i}>
                <div className="muted" style={{ marginBottom: 8 }}>{m.role === "user" ? "Você" : "Qwen2 · IA local"}</div>
                {m.content}
              </div>
            ))}
            {busy && engine.current && <div className="bubble assistant">Gerando resposta no dispositivo...</div>}
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          {progress && messages.length > 0 && <p className="muted">{progress}</p>}
          {!engine.current && messages.length > 0 && <button className="side-button" onClick={loadModel} disabled={busy}>Carregar modelo de IA</button>}
          <div className="composer">
            <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Pergunte ou descreva um projeto..." disabled={!engine.current || busy} />
            <div className="composer-footer">
              <span className="muted">Enter para enviar · Shift + Enter para nova linha</span>
              <button className="primary" onClick={send} disabled={!engine.current || busy || !input.trim()}>{busy ? "Pensando..." : "Enviar ↑"}</button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
