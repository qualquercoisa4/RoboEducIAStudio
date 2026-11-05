"use client";

import { useEffect, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [systemInstruction, setSystemInstruction] = useState("Você é um assistente educacional especializado em tecnologia, robótica e programação. Explique com clareza e forneça códigos completos quando solicitado.");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Verificando conexão...");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/status").then(async (r) => {
      const d = await r.json();
      setStatus(d.connected ? `Conectado · ${d.models.length} modelo(s)` : "Ollama desconectado");
    }).catch(() => setStatus("Ollama desconectado"));
    try {
      const saved = localStorage.getItem("roboeducia-messages");
      if (saved) setMessages(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem("roboeducia-messages", JSON.stringify(messages));
  }, [messages]);

  async function send() {
    const prompt = input.trim();
    if (!prompt || loading) return;
    const next = [...messages, { role: "user" as const, content: prompt }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, systemInstruction })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha na API.");
      setMessages([...next, { role: "assistant", content: data.text }]);
      setStatus("Resposta recebida");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">RoboEduc <span>IA Studio</span></div>
        <p className="muted">Laboratório de inteligência artificial</p>
        <button className="side-button" onClick={() => { setMessages([]); setError(""); }}>＋ Nova conversa</button>
        <div style={{ marginTop: 32 }}>
          <p className="muted">INSTRUÇÕES DO SISTEMA</p>
          <textarea style={{ minHeight: 190, border: "1px solid #303b55", borderRadius: 10, padding: 10 }} value={systemInstruction} onChange={(e) => setSystemInstruction(e.target.value)} />
        </div>
        <p className="muted">Modelo padrão: qwen2.5-coder:3b</p>
      </aside>
      <main className="main">
        <header className="topbar">
          <strong>Playground</strong>
          <span className="status">{status}</span>
        </header>
        <section className="content">
          <h1>O que vamos construir hoje?</h1>
          <p className="muted">Teste ideias, aprenda programação e experimente inteligência artificial.</p>
          <div className="messages">
            {messages.length === 0 ? (
              <div className="empty">
                <div style={{ fontSize: 42, marginBottom: 12 }}>✳</div>
                <h2>Seu laboratório de IA</h2>
                <p className="muted">Envie uma pergunta para começar. Exemplo: “Crie um código Arduino para controlar um servo motor.”</p>
              </div>
            ) : messages.map((m, i) => (
              <div className={`bubble ${m.role}`} key={i}>
                <div className="muted" style={{ marginBottom: 8 }}>{m.role === "user" ? "Você" : "Assistente"}</div>
                {m.content}
              </div>
            ))}
            {loading && <div className="bubble assistant">Gerando resposta...</div>}
          </div>
          {error && <p className="error">{error}</p>}
          <div className="composer">
            <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Pergunte, descreva um projeto ou cole um código..." />
            <div className="composer-footer">
              <span className="muted">Enter para enviar · Shift + Enter para quebrar linha</span>
              <button className="primary" onClick={send} disabled={loading || !input.trim()}>{loading ? "Pensando..." : "Enviar ↑"}</button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
