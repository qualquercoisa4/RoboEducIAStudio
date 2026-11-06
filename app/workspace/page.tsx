"use client";

import "./workspace.css";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type ProjectFile = { path: string; content: string; updatedAt: number };
type Project = { name: string; files: ProjectFile[] };
type WorkspaceOperation = { path: string; action: "create" | "update" | "delete"; reason: string };
type WorkspaceStreamEvent = { type?: unknown; [key: string]: unknown };
type Tab = "chat" | "code" | "preview";
const STORAGE_KEY = "roboeduc-workspace-v1";
const starterFiles: ProjectFile[] = [
 {path:"index.html",content:"<!doctype html>\n<html lang=\"pt-BR\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n<title>Meu projeto</title>\n<link rel=\"stylesheet\" href=\"src/style.css\">\n</head>\n<body>\n<main id=\"app\"><h1>Meu projeto</h1><p>Peça à IA para começar.</p></main>\n<script src=\"src/main.js\"></script>\n</body>\n</html>",updatedAt:Date.now()},
 {path:"src/style.css",content:"body{margin:0;min-height:100vh;font-family:system-ui,sans-serif;background:#f4f7fb;color:#343044}main{max-width:900px;margin:auto;padding:32px}h1{color:#4598d1}",updatedAt:Date.now()},
 {path:"src/main.js",content:"const app=document.querySelector('#app');\nconsole.log('Projeto iniciado',app);",updatedAt:Date.now()}
];
function makePreview(html:string,files:ProjectFile[]){
 let result=html;
 for(const file of files){
  if(file.path.endsWith(".css"))result=result.replace('<link rel="stylesheet" href="'+file.path+'">',"<style>\n"+file.content+"\n</style>");
  if(file.path.endsWith(".js"))result=result.replace('<script src="'+file.path+'"></script>',"<script>\n"+file.content+"\n</scr"+"ipt>");
 }
 return result;
}
export default function WorkspacePage(){
 const [project,setProject]=useState<Project>({name:"Meu projeto",files:starterFiles});
 const projectRef=useRef(project);
 useEffect(()=>{projectRef.current=project},[project]);
 const [selectedPath,setSelectedPath]=useState("index.html");
 const [prompt,setPrompt]=useState("");
 const [busy,setBusy]=useState(false);
 const [status,setStatus]=useState("Descreva o que deseja construir ou modificar.");
 const [tab,setTab]=useState<Tab>("chat");
 const [model,setModel]=useState("openrouter:qwen/qwen3-coder-next");
 const [mode,setMode]=useState("complete");
 const [history,setHistory]=useState<{role:string;text:string}[]>([]);
 const files=project.files;
 const selected=files.find(file=>file.path===selectedPath)||files[0];
 const html=files.find(file=>file.path==="index.html")?.content||files.find(file=>file.path.toLowerCase().endsWith(".html"))?.content||"";
 const preview=useMemo(()=>makePreview(html,files),[html,files]);
 useEffect(()=>{
  try{
   const raw=localStorage.getItem(STORAGE_KEY);
   if(raw){
    const parsed=JSON.parse(raw);
    if(parsed&&Array.isArray(parsed.files)&&parsed.files.length){
     // Restore persisted workspace after mount to avoid an SSR/localStorage mismatch.
     // eslint-disable-next-line react-hooks/set-state-in-effect
     setProject(parsed);
    }
   }
  }catch{localStorage.removeItem(STORAGE_KEY)}
 },[]);
 useEffect(()=>{localStorage.setItem(STORAGE_KEY,JSON.stringify(project))},[project]);
 function updateSelected(value:string){if(!selected)return;setProject(old=>({...old,files:old.files.map(f=>f.path===selected.path?{...f,content:value,updatedAt:Date.now()}:f)}))}
 function addFile(){const raw=window.prompt("Caminho do novo arquivo (ex.: src/player.js)");if(!raw)return;const path=raw.trim().replace(/^\/+/, "").replace(/\\/g,"/");if(!path||path.split("/").includes("..")||files.some(f=>f.path===path)){setStatus("Caminho inválido ou arquivo já existente.");return}setProject(old=>({...old,files:[...old.files,{path,content:"",updatedAt:Date.now()}]}));setSelectedPath(path);setTab("code")}
 function removeFile(){if(!selected||!window.confirm("Excluir "+selected.path+"?"))return;const next=files.filter(f=>f.path!==selected.path);setProject(old=>({...old,files:next}));setSelectedPath(next[0]?.path||"")}
 function exportFiles(){const text=files.map(f=>"===== "+f.path+" =====\n"+f.content).join("\n\n");const url=URL.createObjectURL(new Blob([text],{type:"text/plain"}));const a=document.createElement("a");a.href=url;a.download="projeto-roboeduc.txt";a.click();URL.revokeObjectURL(url)}
 async function askAI(){
  const request=prompt.trim();
  if(!request||busy)return;
  const snapshot=project.files.map(file=>({path:file.path,content:file.content}));
  setBusy(true);
  setStatus("Analisando os arquivos do projeto...");
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
    body:JSON.stringify({messages,projectFiles:snapshot,systemInstruction,mode,model,webSearch:false,structuredOutput:true})
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
   setProject(nextProject);
   projectRef.current=nextProject;
   const firstChanged=completedApplySignal.operations.find(operation=>operation.action!=="delete");
   if(firstChanged){setSelectedPath(firstChanged.path);setTab("preview")}
   else if(completedApplySignal.operations.length){setSelectedPath(nextProject.files[0]?.path||"");setTab("code")}
   setHistory(old=>[...old,{role:"assistant",text:completedApplySignal.summary}]);
   setPrompt("");
   setStatus(completedApplySignal.summary+" · "+completedApplySignal.operations.filter(operation=>operation.action!=="delete").length+" arquivo(s) gerado(s), "+completedApplySignal.operations.filter(operation=>operation.action==="delete").length+" excluído(s).");
  }catch(error){
   const message=error instanceof Error?error.message:"Falha ao aplicar alterações.";
   setStatus(message);
   setHistory(old=>[...old,{role:"assistant",text:"Não consegui aplicar as alterações: "+message}]);
  }finally{setBusy(false)}
 }
 return <main className="studio-shell">
  <header className="studio-topbar"><Link href="/" className="studio-back">←</Link><div className="studio-project"><b>{project.name}</b><small>RoboEduc AI Studio</small></div><button onClick={exportFiles}>Exportar</button><button disabled={busy} onClick={()=>{const name=window.prompt("Nome do projeto",project.name);if(name?.trim())setProject(old=>({...old,name:name.trim()}))}}>Renomear</button></header>
  <nav className="studio-main-tabs"><button className={tab==="chat"?"selected":""} onClick={()=>setTab("chat")}>✦ Chat</button><button className={tab==="code"?"selected":""} onClick={()=>setTab("code")}>‹/› Código <small>{files.length}</small></button><button className={tab==="preview"?"selected":""} onClick={()=>setTab("preview")}>◉ Prévia</button></nav>
  {tab==="chat"&&<section className="studio-chat-view"><div className="studio-chat-history">{history.length===0&&<div className="studio-chat-intro"><div>✦</div><h1>O que vamos construir?</h1><p>Descreva o que deseja. A IA vai analisar e editar os arquivos do projeto.</p></div>}{history.map((item,i)=><article key={i} className={"studio-message "+item.role}><b>{item.role==="user"?"Você":"RoboEduc AI"}</b><p>{item.text}</p></article>)}{busy&&<article className="studio-message assistant"><b>RoboEduc AI</b><p className="studio-thinking">{status}</p></article>}</div><div className="studio-chat-composer"><textarea value={prompt} onChange={e=>setPrompt(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void askAI()}}} placeholder="Descreva o que deseja criar ou modificar..." disabled={busy}/><div className="studio-controls"><select value={model} onChange={e=>setModel(e.target.value)} disabled={busy}><option value="openrouter:qwen/qwen3-coder-next">Qwen3 Coder Next</option><option value="openrouter:qwen/qwen-2.5-coder-32b-instruct">Qwen2.5 Coder 32B (teste)</option><option value="gemini:gemini-3.8-flash">Gemini 3.8 Flash</option><option value="cloudflare">Cloudflare Workers AI</option><option value="google/gemma-4-31b-it:free">Gemma 4 31B</option><option value="cohere/north-mini-code:free">North Mini Code</option></select><select value={mode} onChange={e=>setMode(e.target.value)} disabled={busy}><option value="complete">Completo</option><option value="deep">Profundo</option><option value="fast">Rápido</option></select><button onClick={()=>void askAI()} disabled={busy||!prompt.trim()}>{busy?"Gerando...":"Enviar ↑"}</button></div><small>Enter envia · Shift + Enter quebra linha</small></div></section>}
  {tab==="code"&&<section className="studio-code-view"><aside className="studio-file-rail"><div className="studio-file-heading"><b>ARQUIVOS</b><button onClick={addFile} disabled={busy}>＋</button></div>{files.map(f=><button key={f.path} className={selected?.path===f.path?"active":""} onClick={()=>setSelectedPath(f.path)}>{f.path}</button>)}<div className="studio-file-footer"><button onClick={exportFiles}>Exportar</button><button onClick={removeFile} disabled={!selected||busy}>Excluir</button></div></aside><div className="studio-editor-pane"><div className="studio-editor-title">{selected?.path||"Nenhum arquivo"}</div><textarea className="studio-editor" spellCheck={false} disabled={busy} value={selected?.content||""} onChange={e=>updateSelected(e.target.value)}/></div></section>}
  {tab==="preview"&&<section className="studio-preview-view"><div className="studio-preview-toolbar"><span>◉ Prévia do projeto</span><button onClick={()=>setTab("code")}>‹/› Código</button></div>{html?<iframe title="Prévia do projeto" className="studio-preview-frame" sandbox="allow-scripts" srcDoc={preview}/>:<div className="studio-empty-preview">Projeto sem index.html. <button onClick={()=>setTab("chat")}>Criar com IA</button></div>}</section>}
  <footer className="studio-statusbar"><span>● Projeto local</span><span>{files.length} arquivos</span><span>{status}</span></footer>
 </main>;
}
