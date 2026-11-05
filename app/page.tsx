"use client";
import { useEffect, useRef, useState } from "react";

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

function PlatformGame({ gameName, onExit }: { gameName:string; onExit:()=>void }) {
 const canvasRef=useRef<HTMLCanvasElement|null>(null);
 const [score,setScore]=useState(0);
 const [lives,setLives]=useState(3);
 const [won,setWon]=useState(false);
 const [lost,setLost]=useState(false);
 const keys=useRef({left:false,right:false,jump:false});
 useEffect(()=>{
  const canvas=canvasRef.current;if(!canvas)return;
  const ctx=canvas.getContext("2d");if(!ctx)return;
  const W=960,H=540,worldW=2400;
  let player={x:70,y:370,vx:0,vy:0,w:34,h:46,onGround:false};
  let camera=0,localScore=0,localLives=3,finished=false,dead=false,frame=0;
  const platforms=[{x:0,y:460,w:520,h:100},{x:590,y:420,w:250,h:140},{x:910,y:380,w:300,h:180},{x:1280,y:435,w:260,h:125},{x:1610,y:390,w:300,h:170},{x:1990,y:455,w:410,h:105},
   {x:280,y:380,w:90,h:18},{x:720,y:330,w:100,h:18},{x:1040,y:300,w:110,h:18},{x:1430,y:350,w:100,h:18},{x:1750,y:315,w:100,h:18}];
  const coins=[{x:310,y:340},{x:440,y:410},{x:760,y:290},{x:1080,y:260},{x:1160,y:340},{x:1470,y:310},{x:1790,y:275},{x:2070,y:410},{x:2180,y:410}].map(c=>({...c,taken:false}));
  const enemies=[{x:670,y:388,dir:1,min:620,max:800},{x:1370,y:403,dir:-1,min:1300,max:1500},{x:1810,y:358,dir:1,min:1640,max:1880}];
  const keyDown=(e:KeyboardEvent)=>{if(["ArrowLeft","ArrowRight","ArrowUp"," ","a","d","w","A","D","W"].includes(e.key))e.preventDefault();if(e.key==="ArrowLeft"||e.key.toLowerCase()==="a")keys.current.left=true;if(e.key==="ArrowRight"||e.key.toLowerCase()==="d")keys.current.right=true;if(e.key===" "||e.key==="ArrowUp"||e.key.toLowerCase()==="w")keys.current.jump=true;};
  const keyUp=(e:KeyboardEvent)=>{if(e.key==="ArrowLeft"||e.key.toLowerCase()==="a")keys.current.left=false;if(e.key==="ArrowRight"||e.key.toLowerCase()==="d")keys.current.right=false;if(e.key===" "||e.key==="ArrowUp"||e.key.toLowerCase()==="w")keys.current.jump=false;};
  window.addEventListener("keydown",keyDown);window.addEventListener("keyup",keyUp);
  let raf=0;
  const draw=()=>{
   frame++;ctx.clearRect(0,0,W,H);
   const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,"#75d4ff");sky.addColorStop(1,"#e2f8ff");ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
   ctx.save();ctx.translate(-camera,0);
   // clouds and distant hills
   for(let i=0;i<12;i++){const x=i*235+40;ctx.fillStyle="#ffffffb8";ctx.beginPath();ctx.arc(x,90+(i%3)*28,25,0,Math.PI*2);ctx.arc(x+27,85+(i%3)*28,32,0,Math.PI*2);ctx.arc(x+58,96+(i%3)*28,22,0,Math.PI*2);ctx.fill();}
   for(let i=0;i<9;i++){ctx.fillStyle=i%2?"#8bd69b":"#70c98c";ctx.beginPath();ctx.moveTo(i*310-50,460);ctx.quadraticCurveTo(i*310+100,280,i*310+250,460);ctx.fill();}
   platforms.forEach(p=>{ctx.fillStyle="#8cce58";ctx.fillRect(p.x,p.y,p.w,12);ctx.fillStyle="#a96b3c";ctx.fillRect(p.x,p.y+12,p.w,p.h-12);ctx.fillStyle="#74442f";for(let x=p.x+12;x<p.x+p.w-8;x+=34){ctx.fillRect(x,p.y+25,18,18);}});
   coins.forEach(c=>{if(c.taken)return;ctx.fillStyle="#ffca28";ctx.beginPath();ctx.ellipse(c.x,c.y,11,15,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#fff2a6";ctx.lineWidth=3;ctx.stroke();});
   enemies.forEach(e=>{ctx.fillStyle="#e85c48";ctx.beginPath();ctx.arc(e.x,e.y,17,0,Math.PI*2);ctx.fill();ctx.fillStyle="white";ctx.fillRect(e.x-8,e.y-5,5,6);ctx.fillRect(e.x+4,e.y-5,5,6);ctx.fillStyle="#452d3a";ctx.fillRect(e.x-9,e.y+11,18,4);});
   // finish flag
   ctx.fillStyle="#fff";ctx.fillRect(2320,300,6,160);ctx.fillStyle="#ef476f";ctx.beginPath();ctx.moveTo(2326,302);ctx.lineTo(2390,324);ctx.lineTo(2326,348);ctx.fill();
   // player
   ctx.fillStyle="#3157b7";ctx.fillRect(player.x+5,player.y+18,24,27);ctx.fillStyle="#ffd1a3";ctx.fillRect(player.x+7,player.y,22,22);ctx.fillStyle="#e94c59";ctx.fillRect(player.x+4,player.y-3,27,8);ctx.fillStyle="#222";ctx.fillRect(player.x+21,player.y+8,4,4);ctx.fillStyle="#283b73";ctx.fillRect(player.x+2,player.y+42,13,6);ctx.fillRect(player.x+19,player.y+42,13,6);
   ctx.restore();
   if(!finished&&!dead){
    const oldY=player.y;
    player.vx=(keys.current.right?4.3:0)-(keys.current.left?4.3:0);
    player.x=Math.max(0,Math.min(worldW-player.w,player.x+player.vx));
    if(keys.current.jump&&player.onGround){player.vy=-12.5;player.onGround=false;}
    player.vy=Math.min(13,player.vy+0.58);player.y+=player.vy;player.onGround=false;
    platforms.forEach(p=>{if(player.x+player.w>p.x&&player.x<p.x+p.w&&oldY+player.h<=p.y+8&&player.y+player.h>=p.y&&player.vy>=0){player.y=p.y-player.h;player.vy=0;player.onGround=true;}});
    coins.forEach(c=>{if(!c.taken&&Math.abs((player.x+player.w/2)-c.x)<23&&Math.abs((player.y+player.h/2)-c.y)<28){c.taken=true;localScore+=10;setScore(localScore);}});
    enemies.forEach(e=>{e.x+=e.dir*1.2;if(e.x<e.min||e.x>e.max)e.dir*=-1;if(player.x+player.w>e.x-15&&player.x<e.x+15&&player.y+player.h>e.y-16&&player.y<e.y+16){if(player.vy>1&&player.y+player.h<e.y+12){e.x=-100;player.vy=-8;localScore+=50;setScore(localScore);}else if(frame%40===0){localLives--;setLives(localLives);player.x=Math.max(0,player.x-100);if(localLives<=0){dead=true;setLost(true);}}}});
    if(player.y>H+60){localLives--;setLives(localLives);player={x:70,y:370,vx:0,vy:0,w:34,h:46,onGround:false};if(localLives<=0){dead=true;setLost(true);}}
    camera=Math.max(0,Math.min(worldW-W,player.x-W*0.36));
    if(player.x>2290){finished=true;setWon(true);localScore+=100;setScore(localScore);}
   }
   ctx.fillStyle="#ffffff";ctx.font="bold 22px Arial";ctx.fillText("PONTOS: "+localScore,camera+24,36);ctx.fillText("♥ ".repeat(localLives),camera+24,66);
   if(finished||dead){ctx.fillStyle="#20283dcc";ctx.fillRect(camera,0,W,H);ctx.fillStyle="#fff";ctx.textAlign="center";ctx.font="bold 42px Arial";ctx.fillText(finished?"FASE CONCLUÍDA!":"FIM DE JOGO",camera+W/2,H/2);ctx.font="22px Arial";ctx.fillText("Pontuação: "+localScore,camera+W/2,H/2+42);ctx.textAlign="left";}
   raf=requestAnimationFrame(draw);
  };
  draw();
  return()=>{cancelAnimationFrame(raf);window.removeEventListener("keydown",keyDown);window.removeEventListener("keyup",keyUp);};
 },[]);
 const hold=(key:"left"|"right"|"jump",value:boolean)=>{keys.current[key]=value;};
 return <div className="play-screen">
  <div className="play-top"><button className="back-button" onClick={onExit}>← Menu</button><strong>{gameName}</strong><span>Pontos: {score} · Vidas: {lives}</span></div>
  <canvas ref={canvasRef} width={960} height={540} className="platform-canvas"/>
  <div className="touch-controls">
   <div><button onPointerDown={()=>hold("left",true)} onPointerUp={()=>hold("left",false)} onPointerLeave={()=>hold("left",false)}>◀</button><button onPointerDown={()=>hold("right",true)} onPointerUp={()=>hold("right",false)} onPointerLeave={()=>hold("right",false)}>▶</button></div>
   <button className="jump-control" onPointerDown={()=>hold("jump",true)} onPointerUp={()=>hold("jump",false)} onPointerLeave={()=>hold("jump",false)}>PULAR</button>
  </div>
  {(won||lost)&&<div className="game-result"><h2>{won?"Fase concluída!":"Fim de jogo"}</h2><p>Pontuação: {score}</p><button className="continue-button" onClick={onExit}>Voltar ao menu</button></div>}
 </div>;
}

export default function Home(){
 const [step,setStep]=useState(0);
 const [answers,setAnswers]=useState<Record<number,string>>({});
 const [creating,setCreating]=useState(false);
 const [done,setDone]=useState(false);
 const [naming,setNaming]=useState(false);
 const [playing,setPlaying]=useState(false);
 const [gameName,setGameName]=useState("Minha Aventura");
 const [nameDraft,setNameDraft]=useState("Minha Aventura");
 const [progress,setProgress]=useState(0);
 const q=questions[step];
 function create(){setGameName(nameDraft.trim()||"Minha Aventura");setCreating(true);setProgress(0);let p=0;const timer=window.setInterval(()=>{p+=4;setProgress(p);if(p>=100){window.clearInterval(timer);setCreating(false);setDone(true);}},75);}
 function reset(){setStep(0);setAnswers({});setCreating(false);setDone(false);setNaming(false);setPlaying(false);setProgress(0);setNameDraft("Minha Aventura");setGameName("Minha Aventura");}
 return <main className="robo-app">
  <header className="robo-header"><div className="robo-logo"><div className="robo-word">ROBO</div><div className="educ-word"><b>E</b><b>D</b><b>U</b><b>C</b></div><small>ESCOLA DE PROGRAMAÇÃO E ROBÓTICA</small></div><span className="header-tag">GAME STUDIO</span></header>
  <section className="creator">
   {playing?<PlatformGame gameName={gameName} onExit={()=>setPlaying(false)}/>:creating?<div className="creation"><div className="creation-logo"><span>R</span><span>O</span><span>B</span><span>O</span><b>E</b><b>D</b><b>U</b><b>C</b></div><h1>Construindo seu jogo...</h1><div className="loader-track"><div style={{width:progress+"%"}}/></div><strong>{progress}%</strong><p>{progress<25?"Preparando o personagem...":progress<50?"Montando as plataformas...":progress<75?"Espalhando as moedas...":"Quase pronto!"}</p><div className="loader-spark">✦</div></div>:done?<div className="main-game-menu"><div className="menu-eyebrow">SEU JOGO ESTÁ PRONTO</div><h1>{gameName}</h1><p>Uma aventura de plataforma espera por você.</p><div className="menu-preview"><div className="preview-character">●</div><div className="preview-hills"></div><div className="preview-ground"></div></div><button className="play-button" onClick={()=>setPlaying(true)}>▶ JOGAR</button><button className="back-button" onClick={()=>setPlaying(false)}>Voltar ao menu</button><button className="new-game-link" onClick={reset}>Criar outro jogo</button><div className="chosen-summary">{questions.map((question,i)=><div key={question.title}><span>{question.title}</span><b>{question.options.find(o=>o.id===answers[i])?.name}</b></div>)}</div></div>:naming?<div className="name-screen"><span className="question-count">ÚLTIMO PASSO</span><h1>Qual será o nome do jogo?</h1><p>Esse nome aparecerá no menu principal.</p><input aria-label="Nome do jogo" maxLength={28} value={nameDraft} onChange={e=>setNameDraft(e.target.value)} placeholder="Ex.: Aventura do Robô"/><div className="creator-actions"><button className="back-button" onClick={()=>setNaming(false)}>Voltar</button><button className="continue-button" disabled={!nameDraft.trim()} onClick={create}>Criar meu jogo →</button></div></div>:<><div className="step-dots">{questions.map((_,i)=><span className={i<=step?"active":""} key={i}/>)}</div><div className="question-title"><span className="question-count">PERGUNTA {step+1} DE {questions.length}</span><h1>{q.title}</h1><p>{q.hint}</p></div><div className="game-options">{q.options.map(o=><button key={o.id} className={`game-option ${answers[step]===o.id?"chosen":""}`} onClick={()=>setAnswers({...answers,[step]:o.id})}><img src={o.image} alt={o.name} loading="eager" onError={event=>{const img=event.currentTarget;img.onerror=null;img.classList.add("image-failed");img.removeAttribute("src");}}/><span className="option-name">{o.name}</span><span className="option-check">{answers[step]===o.id?"✓":""}</span></button>)}</div><div className="creator-actions"><button className="back-button" onClick={()=>setStep(Math.max(0,step-1))} disabled={step===0}>Voltar</button><button className="continue-button" disabled={!answers[step]} onClick={()=>step<questions.length-1?setStep(step+1):setNaming(true)}>{step===questions.length-1?"Continuar":"Continuar"} <span>→</span></button></div></>}
  </section>
  {!playing&&<footer className="robo-footer">FEITO PARA APRENDER E CRIAR <span>ROBOEDUC</span></footer>}
 </main>;
}
