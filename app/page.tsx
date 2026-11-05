"use client";

import { useEffect, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [systemInstruction, setSystemInstruction] = useState(
    "Você é um assistente educacional especializado em tecnologia, robótica e programação. Explique com clareza, dê exemplos e gere códigos completos quando solicitado."
  );
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Verificando configuração...");
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/status")
      .then(async (response) => {
        const data = await response.json();
        setConfigured(Boolean(data.configured));
        setStatus(data.configured ? "API configurada" : "Configuração pendente");
      })
      .catch(() => setStatus("Não foi possível verificar a API"));

    try {
      const saved = localStorage.getItem("roboeducia-messages");
      if (saved) setMessages(JSON.parse(saved));
    } catch {
      // Ignore invalid local history.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("roboeducia-messages", JSON.stringify(messages));
    } catch {
      // Local storage may be unavailable or full.
    }
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
      setConfigured(true);
      setStatus("Conectado · Qwen2.5-Coder 32B");
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">RoboEduc <span>IA Studio</span></div>
        <p className="muted">Laboratório educacional de IA</p>
        <button className="side-button" onClick={() => { setMessages([]); setError(""); }}>
          ＋ Nova conversa
        </button>
        <div style={{ marginTop: 32 }}>
          <p className="muted">INSTRUÇÕES DO SISTEMA</p>
          <textarea
            style={{ minHeight: 190, border: "1px solid #303b55", borderRadius: 10, padding: 10 }}
            value={systemInstruction}
            onChange={(event) => setSystemInstruction(event.target.value)}
            aria-label="Instruções do sistema"
          />
        </div>
        <p className="muted">Modelo: Qwen2.5-Coder 32B</p>
        <p className="muted">Provedor: Cloudflare Workers AI</p>
      </aside>

      <main className="main">
        <header className="topbar">
          <strong>Playground</strong>
          <span className={configured ? "status" : "muted"}>{status}</span>
        </header>

        <section className="content">
          <h1>O que vamos construir hoje?</h1>
          <p className="muted">Teste ideias, aprenda programação e experimente inteligência artificial.</p>

          <div className="messages">
            {messages.length === 0 ? (
              <div className="empty">
                <div style={{ fontSize: 42, marginBottom: 12 }}>✳</div>
                <h2>Seu laboratório de IA</h2>
                <p className="muted">
                  Envie uma pergunta para começar. Exemplo: “Crie um código Arduino para controlar um servo motor.”
                </p>
                {!configured && (
                  <p className="muted">
                    A implantação está aguardando as credenciais secretas do provedor.
                  </p>
                )}
              </div>
            ) : messages.map((message, index) => (
              <div className={`bubble ${message.role}`} key={index}>
                <div className="muted" style={{ marginBottom: 8 }}>
                  {message.role === "user" ? "Você" : "Assistente"}
                </div>
                {message.content}
              </div>
            ))}
            {loading && <div className="bubble assistant">Gerando resposta...</div>}
          </div>

          {error && <p className="error" role="alert">{error}</p>}

          <div className="composer">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              placeholder="Pergunte, descreva um projeto ou cole um código..."
              aria-label="Mensagem para a IA"
            />
            <div className="composer-footer">
              <span className="muted">Enter para enviar · Shift + Enter para nova linha</span>
              <button className="primary" onClick={send} disabled={loading || !input.trim()}>
                {loading ? "Pensando..." : "Enviar ↑"}
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
