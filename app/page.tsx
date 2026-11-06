"use client";
import { useCallback, useEffect, useRef, useState } from "react";
type Message = { role: "user" | "assistant"; content: string };
type Conversation = { id: string; title: string; messages: Message[]; updatedAt: number };
const KEY = "roboeduc-ai-history-v1";
const starters = [
  ["⌘","Programação","Explique como funciona um loop for em JavaScript, com exemplo."],
  ["⚙","Robótica","Como conectar um servo motor ao Arduino Uno com segurança?"],
  ["◈","Projetos","Me ajude a planejar um projeto de robótica para iniciantes."],
  ["▤","Aprender","Explique inteligência artificial de um jeito simples e prático."]
];
const titleOf = (s: string) => s.trim().replace(/\s+/g," ").slice(0,42) || "Nova conversa";
export default function Home() {
 const [items,setItems]=useState<Conversation[]>([]),[activeId,setActiveId]=useState("");
 const [input,setInput]=useState(""),[loading,setLoading]=useState(false),[ready,setReady]=useState<boolean|null>(null);
 const [sidebar,setSidebar]=useState(false),[error,setError]=useState("");
 const bottom=useRef<HTMLDivElement>(null),area=useRef<HTMLTextAreaElement>(null),abort=useRef<AbortController|null>(null);
 const active=items.find(x=>x.id===activeId),messages=active?.messages??[];
 useEffect(()=>{try{const raw=localStorage.getItem(KEY);if(raw){const parsed=JSON.parse(raw) as Conversation[];if(Array.isArray(parsed)){setItems(parsed);setActiveId(parsed[0]?.id??"");}}}catch{} fetch("/api/status").then(r=>r.json()).then(x=>setReady(Boolean(x.configured))).catch(()=>setReady(false));},[]);
 useEffect(()=>{if(items.length)localStorage.setItem(KEY,JSON.stringify(items));else localStorage.removeItem(KEY);},[items]);
 useEffect(()=>{bottom.current?.scrollIntoView({behavior:"smooth",block:"end"});},[messages,loading]);
 const newChat=useCallback(()=>{abort.current?.abort();const id=crypto.randomUUID();setItems(old=>[{id,title:"Nova conversa",messages:[],updatedAt:Date.now()},...old]);setActiveId(id);setInput("");setError("");setSidebar(false);area.current?.focus();},[]);
 const patch=(id:string,msgs:Message[],title?:string)=>setItems(old=>old.map(x=>x.id===id?{...x,messages:msgs,title:title??x.title,updatedAt:Date.now()}:x).sort((a,b)=>b.updatedAt-a.updatedAt));
 async function send(value?:string){
  const text=(value??input).trim();if(!text||loading)return;
  let id=activeId;const existing=items.find(x=>x.id===id);
  if(!existing){id=crypto.randomUUID();setItems(old=>[{id,title:titleOf(text),messages:[],updatedAt:Date.now()},...old]);setActiveId(id);}
  const old=existing?.messages??[],base:Message[]=[...old,{role:"user",content:text}];
  const pending:Message[]=[...base,{role:"assistant",content:""}];patch(id,pending,old.length?undefined:titleOf(text));
  setInput("");setError("");setLoading(true);const controller=new AbortController();abort.current=controller;
  try{
   const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json","Accept":"text/event-stream"},body:JSON.stringify({messages:base}),signal:controller.signal});
   if(!res.ok){const data=await res.json().catch(()=>null);throw new Error(data?.error??`Falha HTTP ${res.status}. Confira as variáveis da API.`);}
   if(!res.body)throw new Error("O navegador não recebeu o fluxo de resposta.");
   const reader=res.body.getReader(),decoder=new TextDecoder();let buffer="",answer="";
   const append=(part:string)=>{answer+=part;patch(id,[...base,{role:"assistant",content:answer}]);};
   while(true){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const chunks=buffer.split("\n\n");buffer=chunks.pop()??"";
    for(const chunk of chunks)for(const line of chunk.split("\n")){if(!line.startsWith("data:"))continue;const raw=line.slice(5).trim();if(!raw||raw==="[DONE]")continue;try{const data=JSON.parse(raw);const token=data.response??data.result?.response??data.choices?.[0]?.delta?.content??data.delta?.response??"";if(typeof token==="string"&&token)append(token);if(data.error)throw new Error(data.error);}catch(e){if(e instanceof SyntaxError)continue;throw e;}}
   }
   if(!answer.trim())throw new Error("A IA encerrou a transmissão sem texto. Tente novamente.");
  }catch(e){if(e instanceof Error&&e.name==="AbortError")return;setError(e instanceof Error?e.message:"Não foi possível conectar à IA.");const latest=items.find(x=>x.id===id)?.messages??pending;if(latest.at(-1)?.role==="assistant"&&!latest.at(-1)?.content)patch(id,latest.slice(0,-1));}
  finally{setLoading(false);abort.current=null;area.current?.focus();}
 }
 const remove=(id:string)=>{const left=items.filter(x=>x.id!==id);setItems(left);if(id===activeId)setActiveId(left[0]?.id??"");};
 return <main className="studio-shell">
  <aside className={`studio-sidebar ${sidebar?"open":""}`}>
   <div className="brand-row"><a className="brand" href="/"><span className="brand-mark">R</span><span>ROBOEDUC <b>IA</b><small>STUDIO</small></span></a><button className="mobile-close" onClick={()=>setSidebar(false)}>×</button></div>
   <button className="new-chat" onClick={newChat}><b>＋</b> Nova conversa</button><div className="history-heading">RECENTES</div>
   <div className="history-list">{items.map(x=><div className={`history-item ${x.id===activeId?"current":""}`} key={x.id}><button onClick={()=>{setActiveId(x.id);setSidebar(false);setError("");}}>◌ <span>{x.title}</span></button><button className="remove-chat" onClick={()=>remove(x.id)} aria-label="Excluir conversa">×</button></div>)}{!items.length&&<p className="no-history">Suas conversas aparecerão aqui.</p>}</div>
   <div className="sidebar-footer"><a className="studio-link" href="/studio">▦　Abrir Game Studio　↗</a><div className="model-status"><i className={ready?"online":""}/><span><b>RoboEduc AI</b><small>{ready===null?"Verificando conexão…":ready?"Cloudflare Workers AI":"API não configurada"}</small></span></div></div>
  </aside>
  {sidebar&&<button className="sidebar-overlay" onClick={()=>setSidebar(false)} aria-label="Fechar menu"/>}
  <section className="chat-main">
   <header className="chat-top"><button className="mobile-menu" onClick={()=>setSidebar(true)} aria-label="Abrir menu">☰</button><div>Assistente inteligente <span>BETA</span></div><a href="/studio">Game Studio ↗</a></header>
   <div className={`chat-content ${messages.length?"has-chat":""}`}>
    {!messages.length?<div className="welcome"><div className="welcome-logo">R<span>✳</span></div><small>SEU LABORATÓRIO DE IDEIAS</small><h1>O que vamos <em>descobrir</em> hoje?</h1><p>Uma IA para aprender, programar e transformar ideias em projetos.</p><div className="starter-grid">{starters.map(([icon,name,desc])=><button key={name} onClick={()=>send(desc)}><span>{icon}</span><b>{name}</b><small>{desc}</small><i>↗</i></button>)}</div></div>:<div className="messages">{messages.map((m,i)=><article className={`message ${m.role}`} key={i}><div className="avatar">{m.role==="assistant"?"R":"V"}</div><div className="message-body"><b>{m.role==="assistant"?"ROBOEDUC AI":"VOCÊ"}</b><div>{m.content||<span className="typing"><i/><i/><i/></span>}</div></div></article>)}<div ref={bottom}/></div>}
   </div>
   <div className="composer-area">{error&&<div className="error-banner">{error}<button onClick={()=>setError("")}>Fechar</button></div>}{ready===false&&<div className="setup-banner">Configure <code>CLOUDFLARE_ACCOUNT_ID</code> e <code>CLOUDFLARE_API_TOKEN</code> nas variáveis de ambiente da Vercel para ativar a IA.</div>}
    <div className="composer"><textarea ref={area} rows={1} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} placeholder="Pergunte qualquer coisa…" disabled={loading}/>{loading?<button className="send stop" onClick={()=>abort.current?.abort()}>■</button>:<button className="send" disabled={!input.trim()} onClick={()=>send()}>↑</button>}</div>
    <div className="composer-help">Enter para enviar · Shift + Enter para nova linha</div><div className="fine-print">A IA pode cometer erros. Verifique informações importantes.</div>
   </div>
  </section>
 </main>;
}
