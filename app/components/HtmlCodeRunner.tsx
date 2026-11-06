"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  content: string;
  onAskFix: (code: string, errors: string[]) => void;
};

function decodeCodeEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function extractHtml(content: string): string | null {
  const fenced = [...content.matchAll(/```(?:html?|HTML?)?\s*\r?\n([\s\S]*?)\`\`\`/g)]
    .map(match => match[1].trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  const candidate = fenced.find(code => /<(?:!doctype\s+html|html|head|body|script|style|div|canvas)\b/i.test(code));
  if (candidate) return decodeCodeEntities(candidate);

  const raw = content.trim();
  if (/^(?:<!doctype\s+html\b|<html\b)/i.test(raw)) return decodeCodeEntities(raw);
  return null;
}

function makeSandboxDocument(code: string) {
  const policy = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src \'none\'; object-src \'none\'; base-uri \'none\'; form-action \'none\'; frame-src \'none\'">';
  const bridge = [
    "<script>",
    "(() => {",
    "  const send = (type, message) => { try { parent.postMessage({ __roboeducRunner: true, type, message: String(message ?? '') }, '*'); } catch {} };",
    "  window.addEventListener('error', (event) => send('error', (event.message || 'Erro JavaScript') + (event.lineno ? ' — linha ' + event.lineno : '')));",
    "  window.addEventListener('unhandledrejection', (event) => send('error', event.reason && (event.reason.stack || event.reason.message) || event.reason || 'Promise rejeitada'));",
    "  const originalError = console.error.bind(console);",
    "  console.error = (...args) => { send('console', args.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')); originalError(...args); };",
    "  window.addEventListener('load', () => send('ready', 'Execução iniciada'));",
    "})();",
    "</script>"
  ].join("");

  let document = code;
  if (/<head\b[^>]*>/i.test(document)) {
    document = document.replace(/<head\b[^>]*>/i, match => match + policy + bridge);
  } else if (/<html\b[^>]*>/i.test(document)) {
    document = document.replace(/<html\b[^>]*>/i, match => match + "<head>" + policy + bridge + "</head>");
  } else {
    document = "<!doctype html><html><head>" + policy + bridge + "</head><body>" + document + "</body></html>";
  }
  if (!/<body\b/i.test(document) && /<\/html\s*>/i.test(document)) {
    document = document.replace(/<\/html\s*>/i, "<body></body></html>");
  }
  return document;
}

export default function HtmlCodeRunner({ content, onAskFix }: Props) {
  const code = useMemo(() => extractHtml(content), [content]);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [running, setRunning] = useState(false);
  const [runId, setRunId] = useState(0);
  const [status, setStatus] = useState("Pronto para executar");
  const [errors, setErrors] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!running) return;
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data as { __roboeducRunner?: boolean; type?: string; message?: string };
      if (!data?.__roboeducRunner) return;
      if (data.type === "ready") setStatus("Executando no navegador");
      if (data.type === "error" || data.type === "console") {
        const message = (data.message || "Erro sem descrição").slice(0, 1200);
        setErrors(previous => previous.includes(message) ? previous : [...previous, message].slice(-8));
        if (data.type === "error") setStatus("Erro detectado durante a execução");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [running, runId]);

  if (!code) return null;

  const run = () => {
    setErrors([]);
    setStatus("Iniciando ambiente isolado...");
    setShowPreview(true);
    setRunning(true);
    setRunId(value => value + 1);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setStatus("Não foi possível copiar automaticamente neste navegador.");
    }
  };

  return (
    <section className="html-runner" aria-label="Executor de HTML">
      <div className="html-runner-head">
        <div>
          <strong>Executar projeto HTML</strong>
          <small>Prévia isolada no navegador · HTML, CSS e JavaScript</small>
        </div>
        <span className="html-runner-tag">SANDBOX</span>
      </div>
      <div className="html-runner-actions">
        <button type="button" className="runner-primary" onClick={run}>▶ Executar</button>
        <button type="button" onClick={run}>↻ Reiniciar</button>
        <button type="button" onClick={copyCode}>{copied ? "Copiado" : "Copiar código"}</button>
        {showPreview && <button type="button" onClick={() => frameRef.current?.requestFullscreen?.()}>Tela cheia</button>}
      </div>
      {showPreview && (
        <div className="runner-preview">
          <div className="runner-preview-bar">
            <span className={errors.some(Boolean) ? "runner-dot error" : "runner-dot"} />
            <span>{status}</span>
          </div>
          <iframe
            key={runId}
            ref={frameRef}
            title="Prévia isolada do código HTML gerado"
            sandbox="allow-scripts"
            allow="fullscreen"
            allowFullScreen
            srcDoc={makeSandboxDocument(code)}
          />
          <div className="runner-security-note">
            O ambiente bloqueia acesso à página principal, cookies, armazenamento, formulários e conexões externas. Recursos externos podem não carregar.
          </div>
          {errors.length > 0 && (
            <div className="runner-errors">
              <strong>Problemas detectados durante a execução</strong>
              <ul>{errors.map((error, index) => <li key={index}>{error}</li>)}</ul>
              <button type="button" onClick={() => onAskFix(code, errors)}>Enviar erros à IA para corrigir</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
