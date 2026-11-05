"use client";
import { useState } from "react";

type Option = { id: string; name: string; image: string };
const questions = [
 { title:"Qual vai ser o estilo?", hint:"Escolha uma imagem.", options:[
  {id:"minecraft",name:"Minecraft",image:"https://commons.wikimedia.org/wiki/Special:FilePath/Minecraft%20-%201.18%20mountains.jpg"},
  {id:"roblox",name:"Roblox",image:"https://files.vgtimes.com/posts/2026-09/thumbs/1790856330.webp"},
  {id:"fortnite",name:"Fortnite",image:"https://www.unread.today/webroot/files/99acfb757ca3de8b1cee530b776a1da5.jpg"},
  {id:"sonic",name:"Sonic",image:"https://sp-ao.shortpixel.ai/client/to_webp%2Cq_glossy%2Cret_img%2Cw_512%2Ch_384/http%3A/obsoletegamer.com/wp-content/uploads/2011/11/Sonic-the-Hedgehog-Sega-Genesis-Gameplay-Screenshot-5.png"}
 ]},
 { title:"O que o jogador vai fazer?", hint:"Escolha o objetivo do jogo.", options:[
  {id:"explore",name:"Explorar",image:"https://s2-techtudo.glbimg.com/FRncuVVYu-3PBm7ub9HaTh1VDn4%3D/0x0%3A695x391/984x0/smart/filters%3Astrip_icc%28%29/i.s3.glbimg.com/v1/AUTH_08fbf48bc0524877943fe86e43087e7a/internal_photos/bs/2021/w/r/zQS09YRq2yywN0pRjTCQ/2017-02-07-caca.png"},
  {id:"build",name:"Construir",image:"https://pojitora-online.net/wp-content/uploads/2018/01/2018-01-16-16-1024x576.png"},
  {id:"battle",name:"Lutar",image:"https://imagenes.businessinsider.es/files/og_thumbnail/uploads/imagenes/2022/10/11/68bc2bb3b5f6d.jpeg"},
  {id:"race",name:"Superar fases",image:"https://assets.st-note.com/img/1706538065499-itL1UWEhtk.png"}
 ]},
 { title:"Qual tipo de jogo?", hint:"Escolha como será a aventura.", options:[
  {id:"platform",name:"Plataforma",image:"https://assets.st-note.com/img/1706538065499-itL1UWEhtk.png"},
  {id:"adventure",name:"Aventura",image:"https://s2-techtudo.glbimg.com/FRncuVVYu-3PBm7ub9HaTh1VDn4%3D/0x0%3A695x391/984x0/smart/filters%3Astrip_icc%28%29/i.s3.glbimg.com/v1/AUTH_08fbf48bc0524877943fe86e43087e7a/internal_photos/bs/2021/w/r/zQS09YRq2yywN0pRjTCQ/2017-02-07-caca.png"},
  {id:"survival",name:"Sobrevivência",image:"https://pbs.twimg.com/media/FYX0HUSXgAM7Fqo.jpg"},
  {id:"action",name:"Ação",image:"https://www.gamereactor.eu/media/grtv/16/471643_w926.jpg"}
 ]}
];
const stages=["Escolhas","Criação","Pronto!"];
export default function Home(){
 const [step,setStep]=useState(0);
 const [answers,setAnswers]=useState<Record<number,string>>({});
 const [creating,setCreating]=useState(false);
 const [done,setDone]=useState(false);
 const [progress,setProgress]=useState(0);
 const q=questions[step];
 const [voiceStatus,setVoiceStatus]=useState("");
 function speakOption(name:string){
  if(typeof window==="undefined"||!("speechSynthesis" in window)||!("SpeechSynthesisUtterance" in window)){setVoiceStatus("Este navegador não oferece voz automática.");return;}
  const synth=window.speechSynthesis;
  synth.cancel();
  const utterance=new SpeechSynthesisUtterance(name);
  utterance.lang="pt-BR";utterance.rate=0.88;utterance.pitch=1.3;utterance.volume=1;
  const chooseVoice=()=>{
   const voices=synth.getVoices();
   const ptBr=voices.filter(v=>v.lang.toLowerCase()==="pt-br");
   const pt=voices.filter(v=>v.lang.toLowerCase().startsWith("pt"));
   const selected=ptBr.find(v=>/google|brasil|brasileira|francisca|female/i.test(v.name))||ptBr[0]||pt[0];
   if(selected)utterance.voice=selected;
   utterance.onstart=()=>setVoiceStatus("");
   utterance.onerror=()=>setVoiceStatus("Não foi possível reproduzir a voz. Verifique a síntese de voz do Android.");
   synth.resume();
   synth.speak(utterance);
  };
  if(synth.getVoices().length===0){
   let played=false;
   const onVoices=()=>{if(played)return;played=true;synth.removeEventListener("voiceschanged",onVoices);chooseVoice();};
   synth.addEventListener("voiceschanged",onVoices);
   window.setTimeout(()=>{if(!played){played=true;synth.removeEventListener("voiceschanged",onVoices);chooseVoice();}},700);
  }else chooseVoice();
 }\n function create(){setCreating(true);setProgress(0);let p=0;const timer=window.setInterval(()=>{p+=4;setProgress(p);if(p>=100){window.clearInterval(timer);setCreating(false);setDone(true);}},75);}
 function reset(){setStep(0);setAnswers({});setCreating(false);setDone(false);setProgress(0);}
 return <main className="robo-app">
  <header className="robo-header"><div className="robo-logo"><div className="robo-word">ROBO</div><div className="educ-word"><b>E</b><b>D</b><b>U</b><b>C</b></div><small>ESCOLA DE PROGRAMAÇÃO E ROBÓTICA</small></div><div className="header-tools"><button className="voice-test" type="button" onClick={()=>speakOption("Olá! Vamos criar um jogo?")}>🔊 Testar voz</button><span className="header-tag">GAME STUDIO</span></div></header>
  <section className="creator">
   {!creating&&!done?<>{voiceStatus&&<p className="voice-status" role="status">{voiceStatus}</p>}<div className="step-dots">{questions.map((_,i)=><span className={i<=step?"active":""} key={i}/>)}</div><div className="question-title"><span className="question-count">PERGUNTA {step+1} DE {questions.length}</span><h1>{q.title}</h1><p>{q.hint}</p></div><div className="game-options">{q.options.map((o,i)=><button key={o.id} className={`game-option ${answers[step]===o.id?"chosen":""}`} onClick={()=>{setAnswers({...answers,[step]:o.id});speakOption(o.name);}}><img src={o.image} alt={o.name} loading="eager" onError={(event)=>{const img=event.currentTarget;img.onerror=null;img.classList.add("image-failed");img.removeAttribute("src");}}/><span className="option-name">{o.name}</span><span className="option-check">{answers[step]===o.id?"✓":""}</span></button>)}</div><div className="creator-actions"><button className="back-button" onClick={()=>setStep(Math.max(0,step-1))} disabled={step===0}>Voltar</button><button className="continue-button" disabled={!answers[step]} onClick={()=>step<questions.length-1?setStep(step+1):create()}>{step===questions.length-1?"Criar meu jogo":"Continuar"} <span>→</span></button></div></>:creating?<div className="creation"><div className="creation-logo"><span>R</span><span>O</span><span>B</span><span>O</span><b>E</b><b>D</b><b>U</b><b>C</b></div><h1>Construindo seu jogo...</h1><div className="loader-track"><div style={{width:progress+"%"}}/></div><strong>{progress}%</strong><p>{progress<25?"Separando as peças...":progress<50?"Montando o cenário...":progress<75?"Preparando os personagens...":"Quase pronto!"}</p><div className="loader-spark">✦</div></div>:<div className="done-screen"><div className="done-mark">✓</div><h1>Seu jogo está pronto!</h1><p>Suas escolhas foram recebidas.</p><div className="chosen-summary">{questions.map((question,i)=><div key={question.title}><span>{question.title}</span><b>{question.options.find(o=>o.id===answers[i])?.name}</b></div>)}</div><button className="continue-button" onClick={reset}>Criar outro jogo ↻</button></div>}
  </section>
  <footer className="robo-footer">FEITO PARA APRENDER E CRIAR <span>ROBOEDUC</span></footer>
 </main>;
}
