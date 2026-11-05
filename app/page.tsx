"use client";
import { useEffect, useRef, useState } from "react";
type Msg = { role: "user" | "assistant"; content: string };
type Run = (messages: {role:string;content:string}[], options: Record<string,unknown>) => Promise<{generated_text: string | {role?:string;content?:string}[]}[]>;
const MODEL = "onnx-community/Qwen2.5-0.5B-Instruct";
export default function Home() {
 const gen=useRef<Run|null>(null);
 const [messages,setMessages]=useState<Msg[]>([]);
 const [input,setInput]=useState("");
 const [system,setSystem]=useState("Você é um assistente educacional especializado em tecnologia, robótica e programação. Responda em português brasileiro.");
 const [status,setStatus]=useState("Modelo ainda não carregado");
 const [progress,setProgress]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 useEffect(()=>{try{const s=localStorage.getItem("roboeducia-messages");if(s)setMessages(JSON.parse(s));}catch{}},[]);
 useEffect(()=>{try{localStorage.setItem("roboeducia-messages",JSON.stringify(messages));}catch{}},[messages]);
 async function loadModel(){
  if(gen.current||busy)return;
  setBusy(true);setError("");setStatus("Preparando modelo para CPU");setProgress("Inicializando WASM...");
  try{
   const {pipeline}=await import("@huggingface/transformers");
   const model=await pipeline("text-generation",MODEL,{device:"wasm",dtype:"q8",progress_callback:(p:{status?:string;file?:string;progress?:number})=>{
    if(p.status==="progress"&&typeof p.progress==="number")setProgress("Baixando "+(p.file||"modelo")+": "+Math.round(p.progress)+"%");
    else if(p.status)setProgress("Preparando: "+p.status);
   }});
   gen.current=model as unknown as Run;setStatus("IA local pronta · CPU/WASM");setProgress("Modelo carregado. Execução pela CPU.");
  }catch(e){setStatus("Falha ao carregar");setError(e instanceof Error?e.message:"Falha ao iniciar.");setProgress("");}
  finally{setBusy(false);}
 }
 async function send(){
  const prompt=input.trim();if(!prompt||!gen.current||busy)return;
  const next=[...messages,{role:"user" as const,content:prompt}];setMessages(next);setInput("");setBusy(true);setError("");
  try{
   const out=await gen.current([{role:"system",content:system},...next.slice(-8)],{max_new_tokens:500,temperature:0.4,do_sample:true,return_full_text:false});
   const g=out[0]?.generated_text;
   const answer=typeof g==="string"?g:Array.isArray(g)?g.filter(x=>x.role==="assistant").at(-1)?.content:undefined;
   if(!answer?.trim())throw new Error("Resposta vazia do modelo.");
   setMessages([...next,{role:"assistant",content:answer.trim()}]);
  }catch(e){setError(e instanceof Error?e.message:"Erro ao gerar resposta.");}finally{setBusy(false);}
 }
 return <div className="shell"><aside className="sidebar"><div className="brand">RoboEduc <span>IA Studio</span></div><p className="muted">Laboratório educacional de IA</p><button className="side-button" onClick={()=>{setMessages([]);setError("");}}>＋ Nova conversa</button><div style={{marginTop:32}}><p className="muted">INSTRUÇÕES DO SISTEMA</p><textarea style={{minHeight:190,border:"1px solid #303b55",borderRadius:10,padding:10}} value={system} onChange={e=>setSystem(e.target.value)}/></div><p className="muted">Qwen2.5 0.5B · Execução local</p><p className="muted">CPU/WASM · Sem chave de API</p></aside><main className="main"><header className="topbar"><strong>Playground</strong><span className="status">{status}</span></header><section className="content"><h1>O que vamos construir hoje?</h1><p className="muted">A IA roda no dispositivo usando CPU. O primeiro carregamento baixa os arquivos do modelo.</p><div className="messages">{messages.length===0?<div className="empty"><div style={{fontSize:42,marginBottom:12}}>✳</div><h2>Seu laboratório de IA</h2><p className="muted">Carregue o modelo para conversar sobre programação, robótica e tecnologia.</p><button className="primary" onClick={loadModel} disabled={busy||!!gen.current}>{busy?"Carregando...":"Carregar IA neste dispositivo"}</button>{progress&&<p className="muted">{progress}</p>}</div>:messages.map((m,i)=><div className={`bubble ${m.role}`} key={i}><div className="muted" style={{marginBottom:8}}>{m.role==="user"?"Você":"Qwen2.5 · IA local"}</div>{m.content}</div>)}</div>{busy&&gen.current&&<div className="bubble assistant">Gerando resposta pela CPU...</div>}{error&&<p className="error" role="alert">{error}</p>}{progress&&messages.length>0&&<p className="muted">{progress}</p>}{!gen.current&&messages.length>0&&<button className="side-button" onClick={loadModel} disabled={busy}>Carregar modelo de IA</button>}<div className="composer"><textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} placeholder="Pergunte ou descreva um projeto..." disabled={!gen.current||busy}/><div className="composer-footer"><span className="muted">Enter para enviar · Shift + Enter para nova linha</span><button className="primary" onClick={send} disabled={!gen.current||busy||!input.trim()}>{busy?"Pensando...":"Enviar ↑"}</button></div></div></section></main></div>;
}