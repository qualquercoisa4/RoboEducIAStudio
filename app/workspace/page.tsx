"use client";

import "./workspace.css";
import { useEffect, useMemo, useState } from "react";

type ProjectFile = { path: string; content: string; updatedAt: number };
type Project = { name: string; files: ProjectFile[] };
type Tab = "chat" | "code" | "preview";
const STORAGE_KEY = "roboeduc-workspace-v1";
const starterFiles: ProjectFile[] = [
 {path:"index.html",content:"<!doctype html>\n<html lang=\"pt-BR\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n<title>Meu projeto</title>\n<link rel=\"stylesheet\" href=\"src/style.css\">\n</head>\n<body>\n<main id=\"app\"><h1>Meu projeto</h1><p>Peça à IA para começar.</p></main>\n<script src=\"src/main.js\"></script>\n</body>\n</html>",updatedAt:Date.now()},
 {path:"src/style.css",content:"body{margin:0;min-height:100vh;font-family:system-ui,sans-serif;background:#f4f7fb;color:#343044}main{max-width:900px;margin:auto;padding:32px}h1{color:#4598d1}",updatedAt:Date.now()},
 {path:"src/main.js",content:"const app=document.querySelector('#app');\nconsole.log('Projeto iniciado',app);",updatedAt:Date.now()}
];
function parsePatch(raw:string){
 const cleaned=raw.replace(/```(?:json)?/gi,"").replace(/```/g,"").trim();
 const start=cleaned.indexOf("{"),end=cleaned.lastIndexOf("}");
 if(start<0||end<=start)throw new Error("A IA não retornou um JSON válido. Tente novamente.");
 const data=JSON.parse(cleaned.slice(start,end+1));
 const source=Array.isArray(data.changes)?data.changes:(Array.isArray(data.files)?data.files:[]);
 const changes=source.filter((item:any)=>item&&typeof item.path==="string"&&typeof item.content==="string");
 const deletes=Array.isArray(data.deletes)?data.deletes.filter((item:unknown)=>typeof item==="string"):[];
 if(!changes.length&&!deletes.length)throw new Error(typeof data.summary==="string"?data.summary:"A IA não retornou alterações aplicáveis.");
 return {summary:typeof data.summary==="string"?data.summary:"Alterações aplicadas.",changes,deletes};
}
function makePreview(html:string,files:ProjectFile[]){
 let result=html;
 for(const file of files){
  if(file.path.endsWith(".css"))result=result.replace('<link rel="stylesheet" href="'+file.path+'">',"<style>\n"+file.content+"\n</style>");
  if(file.path.endsWith(".js"))result=result.replace('<script src="'+file.path+'"></script>',"<script>\n"+file.content+"\n<\\/script>");
 }
 return result;
}
export default function WorkspacePage(){
 const [project,setProject]=useState<Project>({name:"Meu projeto",files:starterFiles});
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
 useEffect(()=>{try{const raw=localStorage.getItem(STORAGE_KEY);if(raw){const parsed=JSON.parse(raw);if(parsed&&Array.isArray(parsed.files)&&parsed.files.length)setProject(parsed)}}catch{localStorage.removeItem(STORAGE_KEY)}},[]);
 useEffect(()=>{localStorage.setItem(STORAGE_KEY,JSON.stringify(project))},[project]);
 function updateSelected(value:string){if(!selected)return;setProject(old=>({...old,files:old.files.map(f=>f.path===selected.path?{...f,content:value,updatedAt:Date.now()}:f)}))}
 function addFile(){const raw=window.prompt("Caminho do novo arquivo (ex.: src/player.js)");if(!raw)return;const path=raw.trim().replace(/^\/+/, "").replace(/\\/g,"/");if(!path||path.split("/").includes("..")||files.some(f=>f.path===path)){setStatus("Caminho inválido ou arquivo já existente.");return}setProject(old=>({...old,files:[...old.files,{path,content:"",updatedAt:Date.now()}]}));setSelectedPath(path);setTab("code")}
 function removeFile(){if(!selected||!window.confirm("Excluir "+selected.path+"?"))return;const next=files.filter(f=>f.path!==selected.path);setProject(old=>({...old,files:next}));setSelectedPath(next[0]?.path||"")}
 function exportFiles(){const text=files.map(f=>"===== "+f.path+" =====\n"+f.content).join("\n\n");const url=URL.createObjectURL(new Blob([text],{type:"text/plain"}));const a=document.createElement("a");a.href=url;a.download="projeto-roboeduc.txt";a.click();URL.revokeObjectURL(url)}
 async function askAI(){
  const request=prompt.trim();if(!request||busy)return;setBusy(true);setStatus("Analisando os arquivos do projeto...");setHistory(old=>[...old,{role:"user",text:request}]);
  try{
   const snapshot=files.map(f=>({path:f.path,content:f.content}));
   const systemInstruction="Você é um agente de engenharia de software. Modifique o projeto existente de forma incremental. Preserve tudo que não precisa mudar. Não recrie o projeto inteiro. Retorne exclusivamente JSON válido neste formato: {\"summary\":\"resumo\",\"changes\":[{\"path\":\"arquivo.ext\",\"content\":\"conteúdo COMPLETO final\"}],\"deletes\":[]} . Inclua apenas arquivos novos ou alterados. deletes pode ser [] se não houver exclusões. Não retorne diffs, placeholders ou texto fora do JSON. Projeto: "+project.name;
   const messages=[...history.slice(-8).map(item=>({role:item.role==="assistant"?"assistant" as const:"user" as const,content:item.text})),{role:"user" as const,content:"PEDIDO ATUAL:\n"+request+"\n\nESTADO ATUAL DOS ARQUIVOS (fonte de verdade):\n"+JSON.stringify(snapshot)}];
   const response=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json",Accept:"text/event-stream"},body:JSON.stringify({messages,systemInstruction,mode,model,webSearch:false})});
   if(!response.ok){const error=await response.json().catch(()=>null);throw new Error(error?.error||"Falha HTTP "+response.status)}
   if(!response.body)throw new Error("O servidor não retornou o fluxo.");
   const reader=response.body.getReader(),decoder=new TextDecoder();let buffer="",answer="";
   const parseEvent=(event:string)=>{for(const line of event.split(/\r?\n/)){if(!line.startsWith("data:"))continue;let data:any;try{data=JSON.parse(line.slice(5).trim())}catch{continue}if(data.type==="token")answer+=data.response||"";if(data.type==="reset")answer="";if(data.type==="error")throw new Error(data.error||"Falha na geração.");if(data.type==="status"&&data.detail)setStatus(data.detail)}};
   while(true){const part=await reader.read();if(part.done)break;buffer+=decoder.decode(part.value,{stream:true});const events=buffer.split(/\r?\n\r?\n/);buffer=events.pop()||"";for(const event of events)parseEvent(event)}
   buffer+=decoder.decode();if(buffer.trim())parseEvent(buffer);
   if(!answer.trim())throw new Error("A IA encerrou sem retornar alterações.");
   const patch=parsePatch(answer);
   setProject(old=>{const map=new Map(old.files.map(f=>[f.path,f]));for(const path of patch.deletes)map.delete(path);for(const item of patch.changes){const path=item.path.trim().replace(/^\/+/, "").replace(/\\/g,"/");if(!path||path.split("/").includes(".."))continue;map.set(path,{path,content:item.content,updatedAt:Date.now()})}return {...old,files:[...map.values()].sort((a,b)=>a.path.localeCompare(b.path))}});
   if(patch.changes.length){setSelectedPath(patch.changes[0].path);setTab("preview")}
   setHistory(old=>[...old,{role:"assistant",text:patch.summary}]);setPrompt("");setStatus(patch.summary+" · "+patch.changes.length+" arquivo(s) alterado(s).");
  }catch(error){const message=error instanceof Error?error.message:"Falha ao aplicar alterações.";setStatus(message);setHistory(old=>[...old,{role:"assistant",text:"Não consegui aplicar as alterações: "+message}])}finally{setBusy(false)}
 }
 return <main className="studio-shell">
  <header className="studio-topbar"><a href="/" className="studio-back">←</a><div className="studio-project"><b>{project.name}</b><small>RoboEduc AI Studio</small></div><button onClick={exportFiles}>Exportar</button><button onClick={()=>{const name=window.prompt("Nome do projeto",project.name);if(name?.trim())setProject(old=>({...old,name:name.trim()}))}}>Renomear</button></header>
  <nav className="studio-main-tabs"><button className={tab==="chat"?"selected":""} onClick={()=>setTab("chat")}>✦ Chat</button><button className={tab==="code"?"selected":""} onClick={()=>setTab("code")}>‹/› Código <small>{files.length}</small></button><button className={tab==="preview"?"selected":""} onClick={()=>setTab("preview")}>◉ Prévia</button></nav>
  {tab==="chat"&&<section className="studio-chat-view"><div className="studio-chat-history">{history.length===0&&<div className="studio-chat-intro"><div>✦</div><h1>O que vamos construir?</h1><p>Descreva o que deseja. A IA vai analisar e editar os arquivos do projeto.</p></div>}{history.map((item,i)=><article key={i} className={"studio-message "+item.role}><b>{item.role==="user"?"Você":"RoboEduc AI"}</b><p>{item.text}</p></article>)}{busy&&<article className="studio-message assistant"><b>RoboEduc AI</b><p className="studio-thinking">{status}</p></article>}</div><div className="studio-chat-composer"><textarea value={prompt} onChange={e=>setPrompt(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void askAI()}}} placeholder="Descreva o que deseja criar ou modificar..." disabled={busy}/><div className="studio-controls"><select value={model} onChange={e=>setModel(e.target.value)} disabled={busy}><option value="openrouter:qwen/qwen3-coder-next">Qwen3 Coder Next</option><option value="openrouter:qwen/qwen-2.5-coder-32b-instruct">Qwen2.5 Coder 32B (teste)</option><option value="gemini:gemini-3.8-flash">Gemini 3.8 Flash</option><option value="cloudflare">Cloudflare Workers AI</option><option value="google/gemma-4-31b-it:free">Gemma 4 31B</option><option value="cohere/north-mini-code:free">North Mini Code</option></select><select value={mode} onChange={e=>setMode(e.target.value)} disabled={busy}><option value="complete">Completo</option><option value="deep">Profundo</option><option value="fast">Rápido</option></select><button onClick={()=>void askAI()} disabled={busy||!prompt.trim()}>{busy?"Gerando...":"Enviar ↑"}</button></div><small>Enter envia · Shift + Enter quebra linha</small></div></section>}
  {tab==="code"&&<section className="studio-code-view"><aside className="studio-file-rail"><div className="studio-file-heading"><b>ARQUIVOS</b><button onClick={addFile}>＋</button></div>{files.map(f=><button key={f.path} className={selected?.path===f.path?"active":""} onClick={()=>setSelectedPath(f.path)}>{f.path}</button>)}<div className="studio-file-footer"><button onClick={exportFiles}>Exportar</button><button onClick={removeFile} disabled={!selected}>Excluir</button></div></aside><div className="studio-editor-pane"><div className="studio-editor-title">{selected?.path||"Nenhum arquivo"}</div><textarea className="studio-editor" spellCheck={false} value={selected?.content||""} onChange={e=>updateSelected(e.target.value)}/></div></section>}
  {tab==="preview"&&<section className="studio-preview-view"><div className="studio-preview-toolbar"><span>◉ Prévia do projeto</span><button onClick={()=>setTab("code")}>‹/› Código</button></div>{html?<iframe title="Prévia do projeto" className="studio-preview-frame" sandbox="allow-scripts" srcDoc={preview}/>:<div className="studio-empty-preview">Projeto sem index.html. <button onClick={()=>setTab("chat")}>Criar com IA</button></div>}</section>}
  <footer className="studio-statusbar"><span>● Projeto local</span><span>{files.length} arquivos</span><span>{status}</span></footer>
 </main>;
}
