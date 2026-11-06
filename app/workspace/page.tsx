"use client";

import "./workspace.css";

import { useEffect, useMemo, useState } from "react";

type ProjectFile = { path: string; content: string; updatedAt: number };
type Project = { name: string; files: ProjectFile[] };
const STORAGE_KEY = "roboeduc-workspace-v1";
const starterFiles: ProjectFile[] = [
  { path: "index.html", content: "<!doctype html>\n<html lang=\"pt-BR\">\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>Meu projeto RoboEduc</title>\n  <link rel=\"stylesheet\" href=\"src/style.css\">\n</head>\n<body>\n  <main id=\"app\">\n    <h1>Meu projeto</h1>\n    <p>Comece descrevendo o que deseja construir para a IA.</p>\n  </main>\n  <script src=\"src/main.js\"></script>\n</body>\n</html>", updatedAt: Date.now() },
  { path: "src/style.css", content: "body { margin: 0; min-height: 100vh; font-family: system-ui, sans-serif; background: #f4f7fb; color: #343044; }\nmain { max-width: 900px; margin: 0 auto; padding: 32px; }\nh1 { color: #4598d1; }", updatedAt: Date.now() },
  { path: "src/main.js", content: "const app = document.querySelector('#app');\nconsole.log('Projeto RoboEduc iniciado', app);", updatedAt: Date.now() }
];

function parsePatch(raw: string): { summary: string; changes: ProjectFile[]; deletes: string[] } {
  const cleaned = raw.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("A IA não retornou um pacote de alterações JSON válido. Peça para tentar novamente.");
  const data = JSON.parse(cleaned.slice(start, end + 1));
  if (!Array.isArray(data.changes) || !Array.isArray(data.deletes)) throw new Error("O pacote de alterações está incompleto.");
  const changes = data.changes.filter((item: any) => item && typeof item.path === "string" && typeof item.content === "string");
  const deletes = data.deletes.filter((item: unknown) => typeof item === "string");
  if (!changes.length && !deletes.length) throw new Error("A IA não propôs nenhuma alteração de arquivo.");
  return { summary: typeof data.summary === "string" ? data.summary : "Alterações aplicadas.", changes, deletes };
}

export default function WorkspacePage() {
  const [project, setProject] = useState<Project>({ name: "Meu projeto", files: starterFiles });
  const [selectedPath, setSelectedPath] = useState("index.html");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Projeto local pronto");
  const [tab, setTab] = useState<"code" | "preview">("code");
  const [model, setModel] = useState("openrouter:qwen/qwen3-coder-next");
  const [providerReady, setProviderReady] = useState(false);
  const [mode, setMode] = useState("complete");
  const files = project.files;
  const selected = files.find(file => file.path === selectedPath) ?? files[0];
  const html = files.find(file => file.path === "index.html")?.content ?? "";
  const previewHtml = useMemo(() => {
    let result = html;
    for (const file of files) {
      if (file.path.endsWith(".css")) result = result.replace(new RegExp('<link[^>]+href=["\\']' + file.path.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&") + '["\\'][^>]*>', "g"), "<style>\n" + file.content + "\n</style>");
      if (file.path.endsWith(".js")) result = result.replace(new RegExp('<script[^>]+src=["\\']' + file.path.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&") + '["\\'][^>]*><\\/script>', "g"), "<script>\n" + file.content + "\n<\\/script>");
    }
    return result;
  }, [html, files]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Project;
        if (parsed && Array.isArray(parsed.files) && parsed.files.length) setProject(parsed);
      }
    } catch { localStorage.removeItem(STORAGE_KEY); }
    fetch("/api/status", { cache: "no-store" }).then(r => r.json()).then(data => {
      setProviderReady(Boolean(data.openrouterConfigured || data.geminiConfigured || data.configured));
    }).catch(() => setProviderReady(false));
  }, []);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(project)); }, [project]);

  function updateSelected(content: string) {
    if (!selected) return;
    setProject(old => ({ ...old, files: old.files.map(file => file.path === selected.path ? { ...file, content, updatedAt: Date.now() } : file) }));
  }
  function addFile() {
    const path = window.prompt("Caminho do novo arquivo (ex.: src/player.js)");
    if (!path) return;
    const safe = path.trim().replace(/^\/+/, "").replace(/\\/g, "/");
    if (!safe || safe.split("/").some(part => part === "..") || files.some(file => file.path === safe)) {
      setStatus("Caminho inválido ou arquivo já existente.");
      return;
    }
    setProject(old => ({ ...old, files: [...old.files, { path: safe, content: "", updatedAt: Date.now() }] }));
    setSelectedPath(safe);
    setStatus("Arquivo criado: " + safe);
  }
  function deleteSelected() {
    if (!selected || !window.confirm("Excluir " + selected.path + "?")) return;
    const remaining = files.filter(file => file.path !== selected.path);
    setProject(old => ({ ...old, files: remaining }));
    setSelectedPath(remaining[0]?.path ?? "");
  }
  function downloadFile(file: ProjectFile) {
    const blob = new Blob([file.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = file.path.split("/").pop() || "arquivo.txt"; anchor.click();
    URL.revokeObjectURL(url);
  }
  async function askAI() {
    const request = prompt.trim();
    if (!request || busy) return;
    setBusy(true); setStatus("Analisando o projeto e planejando alterações...");
    try {
      const snapshot = files.map(file => ({ path: file.path, content: file.content }));
      const systemInstruction = `Você é o agente de engenharia de software do RoboEduc IA Studio. Trabalhe sobre um projeto com múltiplos arquivos já existentes. NÃO recrie o projeto inteiro. Analise os arquivos recebidos, identifique os arquivos estritamente necessários e devolva somente as alterações incrementais. Preserve funcionalidades, arquitetura, nomes, estilo e decisões existentes. Crie arquivos separados quando isso melhorar a organização. Não remova arquivos sem necessidade. Não use placeholders. Não diga que executou testes.\n\nFORMATO OBRIGATÓRIO: responda exclusivamente com um objeto JSON válido, sem Markdown e sem texto fora dele, neste formato: {"summary":"resumo curto","changes":[{"path":"caminho/arquivo.ext","content":"conteúdo COMPLETO do arquivo alterado"}],"deletes":[]}\n\nInclua em changes somente arquivos novos ou realmente modificados. Para arquivos alterados, envie o conteúdo completo final. Em deletes, liste apenas caminhos cuja remoção foi solicitada ou indispensável. Caminhos relativos, sem .. e sem barra inicial. Se não houver alteração necessária, use changes:[] e deletes:[] e explique em summary.\n\nProjeto atual: ${project.name}. Arquivos e conteúdos serão fornecidos na mensagem do usuário.`;
      const messages = [{ role: "user", content: "SOLICITAÇÃO:\n" + request + "\n\nARQUIVOS ATUAIS (fonte de verdade; preserve o que não precisa mudar):\n" + JSON.stringify(snapshot) }];
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json", Accept: "text/event-stream" }, body: JSON.stringify({ messages, systemInstruction, mode, model, webSearch: false }) });
      if (!response.ok) { const error = await response.json().catch(() => null); throw new Error(error?.error || "Falha HTTP " + response.status); }
      if (!response.body) throw new Error("O servidor não retornou o fluxo de resposta.");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let answer = "";
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/); buffer = events.pop() ?? "";
        for (const event of events) for (const line of event.split(/\r?\n/)) {
          if (!line.startsWith("data:")) continue;
          let data: any; try { data = JSON.parse(line.slice(5).trim()); } catch { continue; }
          if (data.type === "token") answer += data.response || "";
          if (data.type === "reset") answer = "";
          if (data.type === "error") throw new Error(data.error || "Falha na geração.");
          if (data.type === "status" && data.detail) setStatus(data.detail);
        }
      }
      if (!answer.trim()) throw new Error("A IA encerrou sem retornar alterações.");
      const patch = parsePatch(answer);
      setProject(old => {
        const map = new Map(old.files.map(file => [file.path, file]));
        for (const path of patch.deletes) map.delete(path);
        for (const change of patch.changes) {
          const path = change.path.trim().replace(/^\/+/, "").replace(/\\/g, "/");
          if (!path || path.split("/").some(part => part === "..")) continue;
          map.set(path, { path, content: change.content, updatedAt: Date.now() });
        }
        return { ...old, files: [...map.values()].sort((a, b) => a.path.localeCompare(b.path)) };
      });
      if (patch.changes.length) setSelectedPath(patch.changes[0].path);
      setPrompt("");
      setStatus(patch.summary + " · " + patch.changes.length + " arquivo(s) alterado(s), " + patch.deletes.length + " removido(s).");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível alterar o projeto.");
    } finally { setBusy(false); }
  }

  return <main className="workspace-shell">
    <header className="workspace-header">
      <a href="/" className="workspace-back">← Chat RoboEduc</a>
      <div className="workspace-brand"><b>ROBO<span>E</span><i>D</i><em>U</em><strong>C</strong></b><small>ÁREA DE TRABALHO DA IA</small></div>
      <button onClick={() => { const name = window.prompt("Nome do projeto", project.name); if (name?.trim()) setProject(old => ({ ...old, name: name.trim() })); }}>Renomear projeto</button>
    </header>
    <section className="workspace-layout">
      <aside className="workspace-files">
        <div className="workspace-panel-title"><span>EXPLORADOR</span><button onClick={addFile} title="Novo arquivo">＋</button></div>
        <div className="workspace-project-name">▾　{project.name}</div>
        {files.map(file => <button key={file.path} className={"workspace-file " + (selected?.path === file.path ? "active" : "")} onClick={() => { setSelectedPath(file.path); setTab("code"); }}><span>{file.path.includes(".css") ? "◇" : file.path.endsWith(".html") ? "▣" : file.path.endsWith(".js") || file.path.endsWith(".ts") ? "⌘" : "▤"}</span>{file.path}</button>)}
        <div className="workspace-file-actions"><button onClick={() => selected && downloadFile(selected)} disabled={!selected}>Baixar arquivo</button><button onClick={deleteSelected} disabled={!selected}>Excluir</button></div>
      </aside>
      <section className="workspace-editor">
        <div className="workspace-tabs"><button className={tab === "code" ? "active" : ""} onClick={() => setTab("code")}>‹/› Código {selected && <small>{selected.path}</small>}</button><button className={tab === "preview" ? "active" : ""} onClick={() => setTab("preview")}>◉ Prévia</button></div>
        {tab === "code" ? <textarea className="workspace-code" spellCheck={false} value={selected?.content ?? ""} onChange={event => updateSelected(event.target.value)} aria-label="Editor de código" /> : <iframe className="workspace-preview" title="Prévia do projeto" sandbox="allow-scripts" srcDoc={previewHtml} />}
      </section>
      <aside className="workspace-agent">
        <div className="workspace-agent-heading"><span className="agent-orb">✦</span><div><b>RoboEduc AI</b><small>Agente de desenvolvimento</small></div><span className="agent-online">●</span></div>
        <div className="workspace-agent-info"><b>EDIÇÃO INCREMENTAL ATIVA</b><p>A IA recebe os arquivos atuais e devolve apenas os arquivos que precisam mudar. O restante do projeto é preservado.</p></div>
        <label className="workspace-label">MODELO</label>
        <select className="workspace-select" value={model} onChange={event => setModel(event.target.value)} disabled={busy}>
          <option value="openrouter:qwen/qwen3-coder-next">Qwen3 Coder Next</option><option value="gemini:gemini-3.8-flash">Gemini 3.8 Flash</option><option value="cloudflare">Cloudflare Workers AI</option><option value="google/gemma-4-31b-it:free">Gemma 4 31B</option><option value="cohere/north-mini-code:free">North Mini Code</option>
        </select>
        <label className="workspace-label">PROCESSAMENTO</label>
        <select className="workspace-select" value={mode} onChange={event => setMode(event.target.value)} disabled={busy}><option value="complete">Completo</option><option value="deep">Profundo</option><option value="fast">Rápido</option></select>
        <div className="workspace-status" aria-live="polite">{busy && <i />} {status}</div>
        <textarea className="workspace-prompt" value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="Descreva a mudança. Ex.: adicione um sistema de pulo sem alterar os controles atuais." disabled={busy} />
        <button className="workspace-run" onClick={() => void askAI()} disabled={busy || !prompt.trim()}>{busy ? "IA trabalhando..." : "✦ Aplicar alterações"}</button>
        <small className="workspace-footnote">{providerReady ? "A conexão será validada ao enviar." : "Configure uma chave de API em Vercel para usar a IA."} Os arquivos ficam salvos neste navegador.</small>
      </aside>
    </section>
  </main>;
}
