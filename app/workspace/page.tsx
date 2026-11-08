"use client";

import "./workspace.css";
import Link from "next/link";
import { buildWorkspacePreview } from "@/lib/workspace-preview";
import { MarkdownMessage } from "@/lib/markdown-message";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

type ProjectFile = { path: string; content: string; updatedAt: number };
type Project = { name: string; files: ProjectFile[] };
type WorkspaceOperation = { path: string; action: "create" | "update" | "delete"; reason: string };
type WorkspaceStreamEvent = { type?: unknown; [key: string]: unknown };
type AgentProgress = {index:number;stepType:string;label:string;state:"running"|"completed"};
type TokenUsage = {totalTokens:number;inputTokens:number;outputTokens:number;thoughtTokens:number};
type Tab = "chat" | "code" | "preview";
type AgentSession = { environmentId: string; interactionId: string };
const AGENT_SESSION_KEY = "roboeduc-antigravity-session-v1";
const AGENT_HISTORY_KEY = "roboeduc-workspace-agent-history-v1";
const STORAGE_KEY = "roboeduc-workspace-v1";
const starterFiles: ProjectFile[] = [
 {path:"index.html",content:"<!doctype html>\n<html lang=\"pt-BR\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n<title>Meu projeto</title>\n<link rel=\"stylesheet\" href=\"src/style.css\">\n</head>\n<body>\n<main id=\"app\"><h1>Meu projeto</h1><p>Peça à IA para começar.</p></main>\n<script src=\"src/main.js\"></script>\n</body>\n</html>",updatedAt:Date.now()},
 {path:"src/style.css",content:"body{margin:0;min-height:100vh;font-family:system-ui,sans-serif;background:#f4f7fb;color:#343044}main{max-width:900px;margin:auto;padding:32px}h1{color:#4598d1}",updatedAt:Date.now()},
 {path:"src/main.js",content:"const app=document.querySelector('#app');\nconsole.log('Projeto iniciado',app);",updatedAt:Date.now()}
];
const INITIAL_PROJECT: Project = { name: "Meu projeto", files: starterFiles };
let workspaceCacheRaw: string | null | undefined;
let workspaceCache: Project = INITIAL_PROJECT;

function getWorkspaceSnapshot(): Project {
 let raw: string | null;
 try {
  raw = localStorage.getItem(STORAGE_KEY);
 } catch {
  return INITIAL_PROJECT;
 }
 if (raw === workspaceCacheRaw) return workspaceCache;
 workspaceCacheRaw = raw;
 if (raw) {
  try {
   const parsed = JSON.parse(raw) as Project;
   if (parsed && typeof parsed.name === "string" && Array.isArray(parsed.files) && parsed.files.length > 0) {
    workspaceCache = parsed;
    return workspaceCache;
   }
  } catch {
   localStorage.removeItem(STORAGE_KEY);
  }
 }
 workspaceCache = INITIAL_PROJECT;
 return workspaceCache;
}

function getServerWorkspaceSnapshot(): Project {
 return INITIAL_PROJECT;
}

function subscribeToWorkspace(callback: () => void) {
 window.addEventListener("storage", callback);
 window.addEventListener("roboeduc-workspace-change", callback);
 return () => {
  window.removeEventListener("storage", callback);
  window.removeEventListener("roboeduc-workspace-change", callback);
 };
}

export default function WorkspacePage(){
 const project = useSyncExternalStore(subscribeToWorkspace, getWorkspaceSnapshot, getServerWorkspaceSnapshot);
 const projectRef=useRef(project);
 const previewFrameRef=useRef<HTMLIFrameElement|null>(null);
 const [previewErrors,setPreviewErrors]=useState<string[]>([]);
 const [previewReady,setPreviewReady]=useState(false);
 const [previewTelemetry,setPreviewTelemetry]=useState<Record<string,any>|null>(null);
 const [previewInputLog,setPreviewInputLog]=useState<string[]>([]);
 const [previewReload,setPreviewReload]=useState(0);
 const setProject = (update: Project | ((current: Project) => Project)) => {
  const current = getWorkspaceSnapshot();
  const next = typeof update === "function" ? update(current) : update;
  const serialized = JSON.stringify(next);
  try {
   localStorage.setItem(STORAGE_KEY, serialized);
   workspaceCacheRaw = serialized;
   workspaceCache = next;
   projectRef.current=next;
   window.dispatchEvent(new Event("roboeduc-workspace-change"));
  } catch (error) {
   console.error("Não foi possível salvar o projeto localmente.", error);
  }
 };
 useEffect(()=>{projectRef.current=project},[project]);
 useEffect(()=>{
  const onPreviewMessage=(event:MessageEvent)=>{
   if(event.source!==previewFrameRef.current?.contentWindow)return;
   const data=event.data as {__roboeducWorkspacePreview?:boolean;type?:string;message?:string;event?:string;telemetry?:Record<string,any>;[key:string]:any};
   if(!data?.__roboeducWorkspacePreview)return;
   if(data.type==="ready"){setPreviewReady(true);return}
   if(data.type==="telemetry"&&data.counters){setPreviewTelemetry(data);return}
   if(data.type==="input_event"){
    const label=[data.event,data.pointerType||"sem tipo",data.target||"alvo desconhecido",data.pointerId!=null?"id="+data.pointerId:""].filter(Boolean).join(" · ");
    setPreviewInputLog(previous=>[label,...previous].slice(0,20));return;
   }
   if(data.type==="error"&&typeof data.message==="string"){
    setPreviewErrors(previous=>previous.includes(data.message!.slice(0,1600))?previous:[...previous,data.message!.slice(0,1600)].slice(-12));
   }
  };
  window.addEventListener("message",onPreviewMessage);
  return()=>window.removeEventListener("message",onPreviewMessage);
 },[]);
 const [selectedPath,setSelectedPath]=useState("index.html");
 const [prompt,setPrompt]=useState("");
 const [busy,setBusy]=useState(false);
 const [status,setStatus]=useState("Descreva o que deseja construir ou modificar.");
 const [tab,setTab]=useState<Tab>("preview");
 const [model,setModel]=useState("antigravity");
 const [agentSession,setAgentSession]=useState<AgentSession|null>(null);
 const agentControllerRef=useRef<AbortController|null>(null);
 const [mode,setMode]=useState("fast");
 const [history,setHistory]=useState<{role:string;text:string}[]>([]);
 const [historyReady,setHistoryReady]=useState(false);
 const [agentProgress,setAgentProgress]=useState<AgentProgress[]>([]);
 const [tokenUsage,setTokenUsage]=useState<TokenUsage>({totalTokens:0,inputTokens:0,outputTokens:0,thoughtTokens:0});
 const [lastRunFiles,setLastRunFiles]=useState<WorkspaceOperation[]>([]);
 useEffect(()=>{try{const raw=localStorage.getItem(AGENT_SESSION_KEY);if(raw){const parsed=JSON.parse(raw) as AgentSession;if(typeof parsed.environmentId==="string"&&typeof parsed.interactionId==="string")setAgentSession(parsed)}}catch{localStorage.removeItem(AGENT_SESSION_KEY)}},[]);
 useEffect(()=>{try{const raw=localStorage.getItem(AGENT_HISTORY_KEY);if(raw){const parsed=JSON.parse(raw) as unknown;if(Array.isArray(parsed)){const safe=parsed.filter((item):item is {role:string;text:string}=>Boolean(item&&typeof item==="object"&&(item as {role?:unknown}).role&&(item as {text?:unknown}).text&&["user","assistant"].includes((item as {role:string}).role)&&typeof (item as {text:unknown}).text==="string")).slice(-60);setHistory(safe)}}}catch{localStorage.removeItem(AGENT_HISTORY_KEY)}finally{setHistoryReady(true)}},[]);
 useEffect(()=>{if(!historyReady)return;try{localStorage.setItem(AGENT_HISTORY_KEY,JSON.stringify(history.slice(-60)))}catch{}},[history,historyReady]);
 const files=project.files;
 const selected=files.find(file=>file.path===selectedPath)||files[0];
 const html=files.find(file=>file.path==="index.html")?.content||files.find(file=>file.path.toLowerCase().endsWith(".html"))?.content||"";
 const preview=useMemo(()=>buildWorkspacePreview(html,files),[html,files]);

 function updateSelected(value:string){if(!selected)return;setProject(old=>({...old,files:old.files.map(f=>f.path===selected.path?{...f,content:value,updatedAt:Date.now()}:f)}))}
 function addFile(){if(files.length>=300){setStatus("O projeto atingiu o limite de 300 arquivos.");return}const raw=window.prompt("Caminho do novo arquivo (ex.: src/player.js)");if(!raw)return;const path=raw.trim().replace(/^\/+/, "").replace(/\\/g,"/");if(!path||path.split("/").includes("..")||files.some(f=>f.path===path)){setStatus("Caminho inválido ou arquivo já existente.");return}setProject(old=>({...old,files:[...old.files,{path,content:"",updatedAt:Date.now()}]}));setSelectedPath(path);setTab("code")}
 function removeFile(){if(!selected||!window.confirm("Excluir "+selected.path+"?"))return;const next=files.filter(f=>f.path!==selected.path);setProject(old=>({...old,files:next}));setSelectedPath(next[0]?.path||"")}
 function exportFiles(){const text=files.map(f=>"===== "+f.path+" =====\n"+f.content).join("\n\n");const url=URL.createObjectURL(new Blob([text],{type:"text/plain"}));const a=document.createElement("a");a.href=url;a.download="projeto-roboeduc.txt";a.click();URL.revokeObjectURL(url)}
 async function askAI(overridePrompt?:string){
  const request=(overridePrompt??prompt).trim();
  if(!request||busy)return;
  const snapshot=project.files.map(file=>({path:file.path,content:file.content}));
  setBusy(true);
  setAgentProgress([]);setTokenUsage({totalTokens:0,inputTokens:0,outputTokens:0,thoughtTokens:0});setLastRunFiles([]);
  const controller=new AbortController();
  agentControllerRef.current=controller;
  setStatus(model==="antigravity"?"Iniciando o Antigravity Agent...":"Analisando os arquivos do projeto...");
  setHistory(old=>[...old,{role:"user",text:request}]);
  try{
   const messages=[
    ...history.slice(-8).map(item=>({role:item.role==="assistant"?"assistant" as const:"user" as const,content:item.text})),
    {role:"user" as const,content:request}
   ];
   const systemInstruction="Você é um agente de engenharia de software do RoboEduc AI Studio. Modifique o projeto existente de forma incremental, preserve tudo que não precisa mudar, respeite os requisitos e não invente testes. O servidor planejará e solicitará cada arquivo separadamente.";
   const response=await fetch("/api/chat",{
    method:"POST",
    headers:{"Content-Type":"application/json",Accept:"text/event-stream"},
    body:JSON.stringify({messages,projectFiles:snapshot,systemInstruction,mode,model,webSearch:false,structuredOutput:true,agentSession:model==="antigravity"?agentSession:null}),
    signal:controller.signal
   });
   if(!response.ok){
    const error=await response.json().catch(()=>null);
    throw new Error(error?.error||"Falha HTTP "+response.status);
   }
   if(!response.body)throw new Error("O servidor não retornou o fluxo SSE.");
   const reader=response.body.getReader(),decoder=new TextDecoder();
   let buffer="",plan:{summary:string;operations:WorkspaceOperation[]}|null=null;
   let applySignal:{summary:string;operations:WorkspaceOperation[];fileLengths:Record<string,number>}|null=null;
   let doneReceived=false;
   const pendingFiles=new Map<string,string>();
   const completedFiles=new Map<string,number>();
   const plannedFile=(path:string)=>plan?.operations.some(operation=>operation.path===path&&operation.action!=="delete")??false;

   const parseEvent=(eventText:string)=>{
    const dataLines=eventText.split(/\r?\n/).filter(line=>line.startsWith("data:"));
    if(!dataLines.length)return;
    const payload=dataLines.map(line=>line.slice(5).replace(/^ /,"")).join("\n");
    let event:WorkspaceStreamEvent;
     try{
      const parsed:unknown=JSON.parse(payload);
      if(!parsed||typeof parsed!=="object"||!("type" in parsed)||typeof parsed.type!=="string")throw new Error("Evento sem tipo válido.");
      event=parsed as WorkspaceStreamEvent;
     }catch{throw new Error("O fluxo SSE contém um evento inválido ou truncado. Nenhuma alteração foi aplicada.")}
    if(event.type==="status"&&typeof event.detail==="string"){setStatus(event.detail);return}
    if(event.type==="agent_progress"&&typeof event.index==="number"&&typeof event.label==="string"){setAgentProgress(old=>{const next=[...old];const at=next.findIndex(item=>item.index===event.index);const value={index:event.index as number,stepType:String(event.stepType||"step"),label:event.label as string,state:event.state==="completed"?"completed" as const:"running" as const};if(at>=0)next[at]=value;else next.push(value);return next.sort((a,b)=>a.index-b.index)});return}
    if(event.type==="agent_usage"&&typeof event.totalTokens==="number"){setTokenUsage({totalTokens:event.totalTokens,inputTokens:Number(event.inputTokens)||0,outputTokens:Number(event.outputTokens)||0,thoughtTokens:Number(event.thoughtTokens)||0});return}
    if(event.type==="agent_session"&&typeof event.environmentId==="string"&&typeof event.interactionId==="string"){
     const session={environmentId:event.environmentId,interactionId:event.interactionId};
     setAgentSession(session);
     try{localStorage.setItem(AGENT_SESSION_KEY,JSON.stringify(session))}catch{}
     return;
    }
    if(event.type==="plan"){
     if(plan)throw new Error("O servidor enviou mais de um manifesto para a mesma operação.");
     if(typeof event.summary!=="string"||!Array.isArray(event.operations))throw new Error("Manifesto recebido em formato inválido.");
     plan={summary:event.summary,operations:event.operations as WorkspaceOperation[]};
     return;
    }
    if(event.type==="file_start"){
     if(!plan||typeof event.path!=="string"||!plannedFile(event.path))throw new Error("O servidor iniciou um arquivo fora do manifesto.");
     pendingFiles.set(event.path,"");
     completedFiles.delete(event.path);
     return;
    }
    if(event.type==="file_reset"){
     if(typeof event.path!=="string"||!plannedFile(event.path))throw new Error("O servidor tentou reiniciar um arquivo fora do manifesto.");
     pendingFiles.set(event.path,"");
     completedFiles.delete(event.path);
     return;
    }
    if(event.type==="file_chunk"){
     if(typeof event.path!=="string"||typeof event.chunk!=="string"||!pendingFiles.has(event.path)||!plannedFile(event.path))throw new Error("O fluxo contém conteúdo de arquivo sem início válido.");
     pendingFiles.set(event.path,(pendingFiles.get(event.path)||"")+event.chunk);
     return;
    }
    if(event.type==="file_complete"){
     if(typeof event.path!=="string"||typeof event.contentLength!=="number")throw new Error("Evento de conclusão de arquivo malformado.");
     const content=pendingFiles.get(event.path);
     if(typeof content!=="string"||!plannedFile(event.path)||!Number.isInteger(event.contentLength)||content.length!==event.contentLength){
      throw new Error("O arquivo recebido está incompleto ou diverge do tamanho confirmado pelo servidor: "+event.path+".");
     }
     completedFiles.set(event.path,event.contentLength);
     return;
    }
    if(event.type==="apply"){
     if(!plan||applySignal)throw new Error("A autorização de aplicação está ausente ou duplicada.");
     if(typeof event.summary!=="string"||!Array.isArray(event.operations)||!event.fileLengths||typeof event.fileLengths!=="object")throw new Error("A autorização de aplicação está malformada.");
     const operations=event.operations as WorkspaceOperation[];
     const fileLengths=event.fileLengths as Record<string,number>;
     if(JSON.stringify(operations)!==JSON.stringify(plan.operations))throw new Error("O conjunto de operações mudou durante a geração.");
     for(const operation of plan.operations){
      if(operation.action==="delete")continue;
      const expected=fileLengths[operation.path];
      if(!Number.isInteger(expected)||!completedFiles.has(operation.path)||completedFiles.get(operation.path)!==expected){
       throw new Error("O arquivo "+operation.path+" não foi integralmente recebido e confirmado.");
      }
     }
     if(Object.keys(fileLengths).length!==plan.operations.filter(operation=>operation.action!=="delete").length)throw new Error("A autorização contém arquivos ausentes ou inesperados.");
     applySignal={summary:event.summary,operations,fileLengths};
     return;
    }
    if(event.type==="error")throw new Error(typeof event.error==="string"?event.error:"Falha na geração.");
    if(event.type==="done"){doneReceived=true;return}
   };

   while(true){
    const part=await reader.read();
    if(part.done)break;
    buffer+=decoder.decode(part.value,{stream:true});
    const events=buffer.split(/\r?\n\r?\n/);
    buffer=events.pop()||"";
    for(const eventText of events)parseEvent(eventText);
   }
   buffer+=decoder.decode();
   if(buffer.trim())parseEvent(buffer);
   const completedApplySignal = applySignal as {
    summary:string;
    operations:WorkspaceOperation[];
    fileLengths:Record<string,number>;
   } | null;
   if(!doneReceived||!plan||!completedApplySignal)throw new Error("O fluxo terminou antes da autorização final. Nenhum arquivo foi aplicado.");

   // Compare the editor against the exact snapshot used by the agent.
   const current=projectRef.current;
   const currentMap=new Map(current.files.map(file=>[file.path,file]));
   const snapshotMap=new Map(snapshot.map(file=>[file.path,file]));
   for(const operation of completedApplySignal.operations){
    const existing=currentMap.get(operation.path);
    const original=snapshotMap.get(operation.path);
    if(operation.action==="create"&&existing)throw new Error("O arquivo "+operation.path+" foi criado localmente durante a geração. A aplicação foi cancelada.");
    if((operation.action==="update"||operation.action==="delete")&&(!existing||!original||existing.content!==original.content)){
     throw new Error("O arquivo "+operation.path+" foi alterado durante a geração. A aplicação foi cancelada para preservar sua edição.");
    }
   }

   const nextMap=new Map(current.files.map(file=>[file.path,file]));
   for(const operation of completedApplySignal.operations){
    if(operation.action==="delete"){nextMap.delete(operation.path);continue}
    const content=pendingFiles.get(operation.path);
    if(typeof content!=="string"||content.length!==completedApplySignal.fileLengths[operation.path])throw new Error("Conteúdo final ausente para "+operation.path+".");
    nextMap.set(operation.path,{path:operation.path,content,updatedAt:Date.now()});
   }
   const nextProject={...current,files:[...nextMap.values()].sort((a,b)=>a.path.localeCompare(b.path))};
   setLastRunFiles(completedApplySignal.operations);
   setProject(nextProject);
   projectRef.current=nextProject;
   setPreviewErrors([]);
   setPreviewReady(false);
   setPreviewReload(value=>value+1);
   const firstChanged=completedApplySignal.operations.find(operation=>operation.action!=="delete");
   if(firstChanged){setSelectedPath(firstChanged.path);setTab("preview")}
   else if(completedApplySignal.operations.length){setSelectedPath(nextProject.files[0]?.path||"");setTab("code")}
   setHistory(old=>[...old,{role:"assistant",text:completedApplySignal.summary}]);
   setPrompt("");
   setStatus(completedApplySignal.summary+" · "+completedApplySignal.operations.filter(operation=>operation.action!=="delete").length+" arquivo(s) gerado(s), "+completedApplySignal.operations.filter(operation=>operation.action==="delete").length+" excluído(s).");
  }catch(error){
   const cancelled=error instanceof Error&&error.name==="AbortError";
   const message=cancelled?"Operação cancelada. Nenhuma alteração parcial foi aplicada.":error instanceof Error?error.message:"Falha ao aplicar alterações.";
   setStatus(message);
   setHistory(old=>[...old,{role:"assistant",text:cancelled?message:"Não consegui aplicar as alterações: "+message}]);
  }finally{if(agentControllerRef.current===controller)agentControllerRef.current=null;setBusy(false)}
 }
 function stopAgent(){agentControllerRef.current?.abort()}
 useEffect(()=>()=>agentControllerRef.current?.abort(),[]);
 return <main className="studio-shell">
  <header className="studio-topbar">
   <Link href="/" className="studio-back" aria-label="Voltar ao Game Creator">←</Link>
   <div className="studio-project"><b>{project.name}</b><small>ROBOEDUC AI STUDIO <span>·</span> ÁREA DE TRABALHO</small></div>
   <div className="studio-token-counter" title={"Entrada: "+tokenUsage.inputTokens+" · Saída: "+tokenUsage.outputTokens+" · Pensamento: "+tokenUsage.thoughtTokens}><b>{tokenUsage.totalTokens.toLocaleString("pt-BR")}</b><small>tokens usados</small></div>
   <span className="studio-cloud-state"><i/> Sandbox de código</span>
   <button onClick={exportFiles}>Exportar</button>
   <button disabled={busy} onClick={()=>{const name=window.prompt("Nome do projeto",project.name);if(name?.trim())setProject(old=>({...old,name:name.trim()}))}}>Renomear</button>
  </header>
  <nav className="studio-mobile-tabs" aria-label="Painéis da área de trabalho">
   <button className={tab==="chat"?"selected":""} onClick={()=>setTab("chat")}>✦ Agente</button>
   <button className={tab==="preview"?"selected":""} onClick={()=>setTab("preview")}>◉ Prévia</button>
   <button className={tab==="code"?"selected":""} onClick={()=>setTab("code")}>‹/› Código</button>
  </nav>
  <div className={`studio-workbench mobile-${tab}`}>
   <aside className="studio-agent-panel">
    <div className="studio-agent-header">
     <div className="studio-agent-avatar">✦</div>
     <div><b>Agente de programação</b><small><i/> {busy?"TRABALHANDO NO PROJETO":"PRONTO PARA AJUDAR"}</small></div>
     <button className="agent-history-reset" title="Reiniciar contexto do agente" onClick={()=>{if(!busy){setHistory([]);setAgentSession(null);try{localStorage.removeItem(AGENT_SESSION_KEY)}catch{}}}}>↺</button>
    </div>
    <div className="studio-chat-history">
     {history.length===0&&<div className="studio-chat-intro"><div>✦</div><h1>O que vamos construir?</h1><p>Descreva uma ideia ou peça uma alteração. O agente pesquisa exemplos e bibliotecas, reutiliza código verificado, cria projetos modulares e executa testes na sandbox.</p><div className="studio-agent-capabilities"><span>Até 300 arquivos</span><span>100 alterações por tarefa</span><span>Pesquisar GitHub e docs</span><span>Reutilizar bibliotecas</span><span>Executar e testar</span><span>Protótipos 2D e 3D</span></div></div>}
     {history.map((item,i)=><article key={i} className={"studio-message "+item.role}><b>{item.role==="assistant"?"ROBOEDUC AI":"VOCÊ"}</b>{item.role==="assistant"?<MarkdownMessage content={item.text}/>:<p>{item.text}</p>}{item.role==="assistant"&&i===history.length-1&&lastRunFiles.length>0&&<div className="studio-run-artifacts"><b>Alterações aplicadas</b><small>{lastRunFiles.filter(x=>x.action!=="delete").length} arquivo(s) atualizado(s) · {lastRunFiles.filter(x=>x.action==="delete").length} excluído(s)</small><ul>{lastRunFiles.map(op=><li key={op.path}><span>{op.action==="create"?"＋":op.action==="delete"?"−":"✎"}</span>{op.path}</li>)}</ul></div>}</article>)}
     {busy&&<article className="studio-message assistant agent-live"><b>ANTIGRAVITY AGENT</b><p className="studio-thinking"><span className="studio-spinner"/> {status}</p>{agentProgress.length>0&&<div className="studio-agent-steps"><div className="studio-agent-steps-title">Etapas da execução</div>{agentProgress.slice(-8).map((step)=><div className={"studio-agent-step "+step.state} key={step.index}><span>{step.state==="completed"?"✓":"◌"}</span><div><b>{step.label}</b><small>{step.stepType.replace(/_/g," ")}</small></div></div>)}</div>}<div className="studio-agent-live-usage">{tokenUsage.totalTokens.toLocaleString("pt-BR")} tokens · {tokenUsage.inputTokens.toLocaleString("pt-BR")} entrada · {tokenUsage.outputTokens.toLocaleString("pt-BR")} saída · {tokenUsage.thoughtTokens.toLocaleString("pt-BR")} pensamento</div></article>}
    </div>
    <div className="studio-chat-composer">
     <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void askAI()}}} placeholder="Descreva o que deseja criar ou modificar..." disabled={busy}/>
     <div className="studio-controls">
      <select aria-label="Modelo de IA" value={model} onChange={e=>setModel(e.target.value)} disabled={busy}>
       <option value="antigravity">Antigravity Agent · 3.8 / Flash-Lite Rápido</option>
       <option value="gemini:gemini-3.8-flash">Gemini 3.8 Flash · geração em etapas</option>
       <option value="openrouter:qwen/qwen3-coder-next">Qwen3 Coder Next · geração em etapas</option>
       <option value="openrouter:qwen/qwen-2.5-coder-32b-instruct">Qwen2.5 Coder 32B (teste)</option>
       <option value="cloudflare">Cloudflare Workers AI</option>
      </select>
      <select aria-label="Intensidade de trabalho" value={mode} onChange={e=>setMode(e.target.value)} disabled={busy}>
       <option value="fast">Rápido</option><option value="complete">Completo</option><option value="deep">Profundo</option>
      </select>
      {busy?<button className="agent-stop" onClick={stopAgent}>Parar</button>:<button onClick={()=>void askAI()} disabled={!prompt.trim()}>Executar ↑</button>}
     </div>
     <small>Enter envia · Shift + Enter quebra linha · As alterações são aplicadas após a validação.</small>
    </div>
   </aside>
   <section className="studio-project-view">
    <div className="studio-canvas-toolbar">
     <div className="studio-canvas-left"><span className="studio-live-dot"/><b>Prévia do projeto</b><small className={previewReady?"preview-state ready":"preview-state"}>{previewReady?"EXECUTANDO":"AGUARDANDO"}</small></div>
     <div className="studio-canvas-tabs">
      <button className={tab==="preview"?"selected":""} onClick={()=>setTab("preview")}>◉ Prévia</button>
      <button className={tab==="code"?"selected":""} onClick={()=>setTab("code")}>‹/› Código <small>{files.length}</small></button>
     </div>
     <div className="studio-canvas-actions">
      {tab==="code"&&<button onClick={addFile} disabled={busy}>＋ Arquivo</button>}
      {tab==="code"&&<button onClick={removeFile} disabled={!selected||busy}>Excluir</button>}
      {tab==="preview"&&<button onClick={()=>{setPreviewErrors([]);setPreviewInputLog([]);setPreviewTelemetry(null);setPreviewReady(false);setPreviewReload(value=>value+1)}} disabled={!html}>↻ Atualizar</button>}
      <button onClick={exportFiles}>Exportar</button>
     </div>
    </div>
    {tab==="code"&&<section className="studio-code-view"><aside className="studio-file-rail"><div className="studio-file-heading"><b>EXPLORADOR</b><button onClick={addFile} disabled={busy}>＋</button></div>{files.map(f=><button key={f.path} className={selected?.path===f.path?"active":""} onClick={()=>setSelectedPath(f.path)}><span className="file-type-icon">{f.path.endsWith(".html")?"◇":f.path.endsWith(".css")?"▧":f.path.endsWith(".json")?"{}":"‹›"}</span>{f.path}</button>)}<div className="studio-file-footer"><span>{files.length} / 300 arquivos</span></div></aside><div className="studio-editor-pane"><div className="studio-editor-title"><span>{selected?.path||"Nenhum arquivo"}</span><small>EDITANDO LOCALMENTE</small></div><textarea className="studio-editor" spellCheck={false} disabled={busy} value={selected?.content||""} onChange={e=>updateSelected(e.target.value)}/></div></section>}
    {tab==="preview"&&<section className="studio-preview-view">{html?<><iframe key={previewReload} ref={previewFrameRef} title="Prévia do projeto" className="studio-preview-frame" sandbox="allow-scripts allow-forms allow-pointer-lock" srcDoc={preview}/><section className="studio-preview-diagnostics" aria-label="Diagnóstico do preview"><div className="studio-diagnostics-head"><div><b>Diagnóstico do preview</b><small>{previewReady?"Telemetria recebida do documento do jogo":"Aguardando telemetria do jogo"}</small></div><button onClick={()=>{setPreviewInputLog([]);setPreviewErrors([])}}>Limpar registros</button></div>{previewTelemetry?<><div className="studio-preview-metrics">{Object.entries((previewTelemetry.counters||{}) as Record<string,number>).map(([name,value])=><div key={name}><small>{name}</small><b>{value}</b></div>)}</div><div className="studio-preview-metrics"><div><small>Viewport</small><b>{previewTelemetry.viewport?.innerWidth||0} × {previewTelemetry.viewport?.innerHeight||0}</b></div><div><small>Pixel ratio</small><b>{previewTelemetry.viewport?.devicePixelRatio||0}</b></div><div><small>Foco</small><b>{previewTelemetry.document?.hasFocus?"Ativo":"Inativo"}</b></div><div><small>Visibilidade</small><b>{previewTelemetry.document?.visibilityState||"—"}</b></div><div><small>Iframe</small><b>{previewTelemetry.frame?.isTop?"Top":"Incorporado"}</b></div></div><div><b>Canvas detectados</b>{(previewTelemetry.canvas||[]).length?previewTelemetry.canvas.map((canvas:any,index:number)=><small key={index}>Canvas {index+1}: buffer {canvas.width} × {canvas.height}; CSS {Math.round(canvas.cssWidth)} × {Math.round(canvas.cssHeight)}</small>):<small>Nenhum canvas encontrado</small>}</div></>:<p>Abra a aba Prévia para receber os dados reais do documento incorporado.</p>}{previewInputLog.length>0&&<details><summary>Eventos recentes ({previewInputLog.length})</summary><ul>{previewInputLog.map((item,index)=><li key={index}>{item}</li>)}</ul></details>}{previewErrors.length>0&&<div><b>Erros JavaScript e recursos ({previewErrors.length})</b><ul>{previewErrors.map((error,index)=><li key={index}>{error}</li>)}</ul><button className="diagnostics-fix" onClick={()=>void askAI("Corrija os erros reais detectados na prévia deste projeto. Preserve o objetivo e as funcionalidades existentes. Analise os arquivos atuais e altere somente os necessários.\n\nErros do navegador:\n"+previewErrors.map((error,index)=>(index+1)+". "+error).join("\n"))}>Corrigir com IA</button></div>}</section></>:<div className="studio-empty-preview">Projeto sem index.html. <button onClick={()=>setTab("chat")}>Criar com IA</button></div>}</section>}
   </section>
  </div>
  <footer className="studio-statusbar"><span>● Projeto local</span><span>{files.length} arquivos</span><span>{tokenUsage.totalTokens.toLocaleString("pt-BR")} tokens</span><span>{status}</span></footer>
 </main>;
}
