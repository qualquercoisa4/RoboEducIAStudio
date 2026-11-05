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

function PlatformGame({ gameName, styleId, objectiveId, typeId, onExit }: { gameName:string; styleId:string; objectiveId:string; typeId:string; onExit:()=>void }) {
 const canvasRef=useRef<HTMLCanvasElement|null>(null);
 const [score,setScore]=useState(0),[lives,setLives]=useState(typeId==="survival"?4:3);
 const [won,setWon]=useState(false),[lost,setLost]=useState(false),[progress,setProgress]=useState(0);
 const keys=useRef({left:false,right:false,jump:false,attack:false});
 const [restart,setRestart]=useState(0);
 const isSonic=styleId==="sonic",isMinecraft=styleId==="minecraft",isFortnite=styleId==="fortnite";
 const isBuild=objectiveId==="build",isExplore=objectiveId==="explore",isBattle=objectiveId==="battle",isRace=objectiveId==="race";
 const isSurvival=typeId==="survival",isAction=typeId==="action",isAdventure=typeId==="adventure";
 useEffect(()=>{
  const canvas=canvasRef.current;if(!canvas)return;
  const ctx=canvas.getContext("2d");if(!ctx)return;
  const W=960,H=540,worldW=3000;
  let player={x:70,y:365,vx:0,vy:0,w:34,h:48,onGround:false,invuln:0,attack:0,jumps:0};
  let camera=0,localScore=0,localLives=isSurvival?4:3,done=false,frame=0,lastTime=0,elapsed=0,collectedCount=0,enemyKills=0,jumpWasDown=false;
  const colors=isMinecraft?{sky:"#79bde9",far:"#5e9d74",top:"#78b84c",side:"#8c633f",accent:"#f0c94c",player:"#42a447"}:
   isFortnite?{sky:"#8da9cf",far:"#596b91",top:"#7788a7",side:"#3d4b68",accent:"#ffca4b",player:"#e8a45b"}:
   styleId==="roblox"?{sky:"#71d5f4",far:"#72c6a0",top:"#62c85b",side:"#278e62",accent:"#ffdc43",player:"#e8b13f"}:
   {sky:"#4b9ce8",far:"#176a75",top:"#39b96b",side:"#a65b34",accent:"#ffdb42",player:"#178de0"};
  const floorY=465;
  const platforms=[{x:0,y:floorY,w:500,h:120},{x:570,y:420,w:260,h:120},{x:900,y:380,w:300,h:160},{x:1280,y:430,w:280,h:120},{x:1650,y:390,w:300,h:160},{x:2050,y:430,w:340,h:120},{x:2470,y:floorY,w:530,h:120},
   {x:260,y:365,w:100,h:18},{x:700,y:315,w:110,h:18},{x:1030,y:275,w:115,h:18},{x:1430,y:330,w:110,h:18},{x:1790,y:290,w:110,h:18},{x:2200,y:340,w:110,h:18}];
  const collectibles=Array.from({length:12},(_,i)=>({x:260+i*225,y: i%3===0?330:i%3===1?385:285,taken:false}));
  const enemies=Array.from({length:7},(_,i)=>({x:650+i*340,y:390,dir:i%2? -1:1,min:610+i*340,max:790+i*340,alive:true,hit:0}));
  const checkpoints=[{x:760,active:false},{x:1450,active:false},{x:2180,active:false}];
  const setResult=(win:boolean)=>{done=true;setWon(win);setLost(!win);};
  const keyDown=(e:KeyboardEvent)=>{const k=e.key.toLowerCase();if(["arrowleft","arrowright","arrowup"," ","a","d","w","x","e"].includes(k))e.preventDefault();if(k==="arrowleft"||k==="a")keys.current.left=true;if(k==="arrowright"||k==="d")keys.current.right=true;if(k===" "||k==="arrowup"||k==="w")keys.current.jump=true;if(k==="x"||k==="e")keys.current.attack=true;};
  const keyUp=(e:KeyboardEvent)=>{const k=e.key.toLowerCase();if(k==="arrowleft"||k==="a")keys.current.left=false;if(k==="arrowright"||k==="d")keys.current.right=false;if(k===" "||k==="arrowup"||k==="w")keys.current.jump=false;if(k==="x"||k==="e")keys.current.attack=false;};
  const resize=()=>{const r=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.max(1,Math.round(r.width*dpr));canvas.height=Math.max(1,Math.round(r.height*dpr));};
  resize();const observer=new ResizeObserver(resize);observer.observe(canvas);
  window.addEventListener("keydown",keyDown);window.addEventListener("keyup",keyUp);
  const damage=()=>{if(player.invuln>0)return;localLives--;setLives(localLives);player.invuln=95;player.vy=-6;player.x=Math.max(0,player.x-75);if(localLives<=0)setResult(false);};
  let raf=0;
  const draw=()=>{
   const dt=Math.min((frame&&lastTime?((performance.now()-lastTime)/16.67):1),2);lastTime=performance.now();frame++;
   const sx=canvas.width/W,sy=canvas.height/H;ctx.setTransform(sx,0,0,sy,0,0);ctx.clearRect(0,0,W,H);
   if(!done){
    elapsed+=dt/60;
    const speed=(isSonic?6.4:isFortnite?4.8:4.3)*(isRace?1.18:1);
    player.vx=((keys.current.right?1:0)-(keys.current.left?1:0))*speed;
    const oldY=player.y;player.x=Math.max(0,Math.min(worldW-player.w,player.x+player.vx*dt));
    if(keys.current.jump&&!jumpWasDown&&(player.onGround||(isAdventure&&player.jumps<2))){player.vy=isSonic?-13.5:-12.4;player.onGround=false;player.jumps++;}jumpWasDown=keys.current.jump;
    player.vy=Math.min(14,player.vy+0.58*dt);player.y+=player.vy*dt;player.onGround=false;
    platforms.forEach(p=>{if(player.x+player.w>p.x&&player.x<p.x+p.w&&oldY+player.h<=p.y+10&&player.y+player.h>=p.y&&player.vy>=0){player.y=p.y-player.h;player.vy=0;player.onGround=true;player.jumps=0;}});
    if(player.invuln>0)player.invuln-=dt;if(player.attack>0)player.attack-=dt;
    collectibles.forEach(item=>{if(!item.taken&&Math.abs(player.x+player.w/2-item.x)<27&&Math.abs(player.y+player.h/2-item.y)<34){item.taken=true;collectedCount++;localScore+=isExplore?25:isBuild?15:10;setScore(localScore);setProgress(collectedCount);}});
    enemies.forEach(enemy=>{if(!enemy.alive)return;enemy.x+=enemy.dir*(isAction?1.8:1.25)*dt;if(enemy.x<enemy.min||enemy.x>enemy.max)enemy.dir*=-1;
     const near=Math.abs((player.x+player.w/2)-enemy.x)<43&&Math.abs((player.y+player.h/2)-enemy.y)<40;
     if(keys.current.attack&&near&&player.attack<=0){enemy.alive=false;player.attack=24;localScore+=100;enemyKills++;setScore(localScore);setProgress(enemyKills);}
     else if(near&&player.vy>2&&player.y+player.h<enemy.y+18){enemy.alive=false;player.vy=-8;localScore+=isBattle?150:50;enemyKills++;setScore(localScore);setProgress(enemyKills);}
     else if(near&&player.invuln<=0)damage();
    });
    if(player.y>H+70){damage();player.y=250;player.vy=0;}
    checkpoints.forEach(cp=>{if(player.x>cp.x&&!cp.active){cp.active=true;localScore+=30;setScore(localScore);}});
    if(isSurvival&&elapsed>0&&Math.floor(elapsed)%35===0&&Math.abs(elapsed-Math.floor(elapsed))<dt/60){damage();}
    if(isBuild&&collectedCount>=5&&player.x>2650)setResult(true);
    else if(isExplore&&collectedCount>=6&&player.x>2650)setResult(true);
    else if(isBattle&&enemies.every(e=>!e.alive)&&player.x>2650)setResult(true);
    else if(isRace&&checkpoints.every(cp=>cp.active)&&player.x>2650)setResult(true);
    else if(!isBuild&&!isExplore&&!isBattle&&!isRace&&player.x>2850)setResult(true);
    camera=Math.max(0,Math.min(worldW-W,player.x-W*.38));
   }
   // Background and parallax
   const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,colors.sky);sky.addColorStop(1,isFortnite?"#e7b6a2":"#e3f8ff");ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
   ctx.save();ctx.translate(-camera*.22,0);
   for(let i=0;i<13;i++){const x=i*270+35;ctx.fillStyle="#ffffff99";ctx.beginPath();ctx.arc(x,95+(i%3)*25,24,0,Math.PI*2);ctx.arc(x+28,88+(i%3)*25,32,0,Math.PI*2);ctx.arc(x+58,98+(i%3)*25,22,0,Math.PI*2);ctx.fill();}
   for(let i=0;i<12;i++){ctx.fillStyle=colors.far;ctx.globalAlpha=.75;ctx.beginPath();ctx.moveTo(i*300-40,480);ctx.quadraticCurveTo(i*300+100,260,i*300+260,480);ctx.fill();}ctx.globalAlpha=1;ctx.restore();
   ctx.save();ctx.translate(-camera,0);
   platforms.forEach((p,i)=>{ctx.fillStyle=colors.top;ctx.fillRect(p.x,p.y,p.w,12);ctx.fillStyle=colors.side;ctx.fillRect(p.x,p.y+12,p.w,p.h-12);if(isMinecraft){for(let x=p.x+8;x<p.x+p.w-8;x+=28){ctx.fillStyle="#ffffff18";ctx.fillRect(x,p.y+18,13,13);}}else if(styleId==="roblox"){ctx.fillStyle="#ffffff22";ctx.fillRect(p.x,p.y+12,p.w,5);}});
   collectibles.forEach(item=>{if(item.taken)return;ctx.fillStyle=colors.accent;ctx.beginPath();if(isMinecraft||isBuild)ctx.fillRect(item.x-10,item.y-10,20,20);else ctx.ellipse(item.x,item.y,11,15,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#fff8c7";ctx.lineWidth=3;ctx.stroke();});
   enemies.forEach(e=>{if(!e.alive)return;ctx.fillStyle=isFortnite?"#493d62":isSonic?"#d94a45":"#e85c48";ctx.beginPath();if(isMinecraft)ctx.fillRect(e.x-15,e.y-18,30,30);else ctx.arc(e.x,e.y,17,0,Math.PI*2);ctx.fill();ctx.fillStyle="#fff";ctx.fillRect(e.x-8,e.y-5,5,6);ctx.fillRect(e.x+4,e.y-5,5,6);});
   checkpoints.forEach(cp=>{ctx.fillStyle=cp.active?"#a8ec4d":"#ffffff";ctx.fillRect(cp.x,300,5,165);ctx.fillStyle=cp.active?"#a8ec4d":"#ffb84d";ctx.beginPath();ctx.moveTo(cp.x+5,302);ctx.lineTo(cp.x+55,320);ctx.lineTo(cp.x+5,340);ctx.fill();});
   // Goal gate
   ctx.fillStyle="#fff";ctx.fillRect(2890,280,7,185);ctx.fillStyle="#f04e75";ctx.fillRect(2897,282,60,38);
   // Avatar styles are intentionally distinct
   if(!(player.invuln>0&&Math.floor(frame/5)%2===0)){
    if(isSonic){ctx.fillStyle="#0876d5";ctx.beginPath();ctx.arc(player.x+17,player.y+24,21,0,Math.PI*2);ctx.fill();ctx.fillStyle="#f5d2a2";ctx.beginPath();ctx.ellipse(player.x+21,player.y+27,10,7,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#fff";ctx.fillRect(player.x+20,player.y+12,8,10);}
    else if(isMinecraft){ctx.fillStyle=colors.player;ctx.fillRect(player.x+4,player.y+16,27,28);ctx.fillStyle="#e9b88e";ctx.fillRect(player.x+5,player.y,25,20);ctx.fillStyle="#4b3026";ctx.fillRect(player.x+5,player.y,25,6);}
    else if(styleId==="roblox"){ctx.fillStyle=colors.player;ctx.fillRect(player.x+4,player.y+17,27,27);ctx.fillStyle="#f4c58d";ctx.fillRect(player.x+6,player.y,23,20);ctx.fillStyle="#333";ctx.fillRect(player.x+21,player.y+7,3,3);}
    else {ctx.fillStyle=colors.player;ctx.fillRect(player.x+4,player.y+16,27,28);ctx.fillStyle="#f0c49b";ctx.beginPath();ctx.arc(player.x+17,player.y+10,12,0,Math.PI*2);ctx.fill();ctx.fillStyle="#243a5a";ctx.fillRect(player.x+22,player.y+7,4,4);}
    ctx.fillStyle="#293a69";ctx.fillRect(player.x+2,player.y+43,13,6);ctx.fillRect(player.x+20,player.y+43,13,6);
   }
   ctx.restore();
   if(done){ctx.fillStyle="#07101dcc";ctx.fillRect(0,0,W,H);}
   raf=requestAnimationFrame(draw);
  };
  raf=requestAnimationFrame(draw);
  return()=>{cancelAnimationFrame(raf);observer.disconnect();window.removeEventListener("keydown",keyDown);window.removeEventListener("keyup",keyUp);keys.current={left:false,right:false,jump:false,attack:false};};
 },[restart,styleId,objectiveId,typeId,isSurvival,isAction,isBattle,isBuild,isExplore,isRace,isSonic,isMinecraft,isFortnite]);
 const hold=(key:"left"|"right"|"jump"|"attack",value:boolean)=>{keys.current[key]=value;};
 const restartGame=()=>{setScore(0);setLives(isSurvival?4:3);setProgress(0);setWon(false);setLost(false);setRestart(v=>v+1);};
 const goalText=isBuild?"Colete 5 blocos e alcance a saída":isExplore?"Encontre 6 cristais e alcance a saída":isBattle?"Derrote todos os inimigos e alcance a saída":isRace?"Ative os 3 checkpoints e corra até a saída":"Chegue ao portal no final da fase";
 return <div className="play-screen">
  <canvas ref={canvasRef} width={960} height={540} className="platform-canvas"/>
  <div className="game-hud"><div className="hud-brand"><span className="hud-dot"/> {gameName}</div><div className="hud-stats"><span>★ {score}</span><span>♥ {lives}</span><span className="hud-level">{goalText} · {progress}/{isBuild?5:isExplore?6:isBattle?7:3}</span></div><button className="hud-menu" onClick={onExit}>Ⅱ MENU</button></div>
  <div className="touch-controls"><div className="move-controls"><button aria-label="Mover para esquerda" onPointerDown={()=>hold("left",true)} onPointerUp={()=>hold("left",false)} onPointerCancel={()=>hold("left",false)} onPointerLeave={()=>hold("left",false)}>◀</button><button aria-label="Mover para direita" onPointerDown={()=>hold("right",true)} onPointerUp={()=>hold("right",false)} onPointerCancel={()=>hold("right",false)} onPointerLeave={()=>hold("right",false)}>▶</button></div><button className="jump-control" onPointerDown={()=>hold("jump",true)} onPointerUp={()=>hold("jump",false)} onPointerCancel={()=>hold("jump",false)} onPointerLeave={()=>hold("jump",false)}>PULAR</button>{(isBattle||isAction)&&<button className="attack-control" onPointerDown={()=>hold("attack",true)} onPointerUp={()=>hold("attack",false)} onPointerCancel={()=>hold("attack",false)} onPointerLeave={()=>hold("attack",false)}>ATACAR</button>}</div>
  {(won||lost)&&<div className="game-result"><div className="result-stars">{won?"★ ★ ★":"✦"}</div><h2>{won?"VOCÊ CONSEGUIU!":"FIM DE JOGO"}</h2><p>Pontuação: {score}</p><p>{won?"Objetivo concluído!":"Tente novamente para superar o desafio."}</p><button className="continue-button" onClick={restartGame}>JOGAR NOVAMENTE</button><button className="back-button" onClick={onExit}>VOLTAR AO MENU</button></div>}
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
   {playing?<PlatformGame gameName={gameName} styleId={answers[0]||"minecraft"} objectiveId={answers[1]||"explore"} typeId={answers[2]||"platform"} onExit={()=>setPlaying(false)}/>:creating?<div className="creation"><div className="creation-logo"><span>R</span><span>O</span><span>B</span><span>O</span><b>E</b><b>D</b><b>U</b><b>C</b></div><h1>Construindo seu jogo...</h1><div className="loader-track"><div style={{width:progress+"%"}}/></div><strong>{progress}%</strong><p>{progress<25?"Preparando o personagem...":progress<50?"Montando as plataformas...":progress<75?"Espalhando as moedas...":"Quase pronto!"}</p><div className="loader-spark">✦</div></div>:done?<div className="main-game-menu"><div className="menu-eyebrow">SEU JOGO ESTÁ PRONTO</div><h1>{gameName}</h1><p>{answers[2]==="adventure"?"Explore, descubra caminhos e use o pulo duplo.":answers[2]==="survival"?"Sobreviva, colete recursos e cuide das suas vidas.":answers[2]==="action"?"Enfrente inimigos com velocidade e ataques.":"Corra, pule e complete desafios no seu próprio estilo."}</p><div className="menu-preview" data-style={answers[0]||"minecraft"}><div className="preview-character">●</div><div className="preview-hills"></div><div className="preview-ground"></div></div><button className="play-button" onClick={()=>setPlaying(true)}>▶ JOGAR</button><button className="back-button" onClick={()=>setPlaying(false)}>Voltar ao menu</button><button className="new-game-link" onClick={reset}>Criar outro jogo</button><div className="chosen-summary">{questions.map((question,i)=><div key={question.title}><span>{question.title}</span><b>{question.options.find(o=>o.id===answers[i])?.name}</b></div>)}</div></div>:naming?<div className="name-screen"><span className="question-count">ÚLTIMO PASSO</span><h1>Qual será o nome do jogo?</h1><p>Esse nome aparecerá no menu principal.</p><input aria-label="Nome do jogo" maxLength={28} value={nameDraft} onChange={e=>setNameDraft(e.target.value)} placeholder="Ex.: Aventura do Robô"/><div className="creator-actions"><button className="back-button" onClick={()=>setNaming(false)}>Voltar</button><button className="continue-button" disabled={!nameDraft.trim()} onClick={create}>Criar meu jogo →</button></div></div>:<><div className="step-dots">{questions.map((_,i)=><span className={i<=step?"active":""} key={i}/>)}</div><div className="question-title"><span className="question-count">PERGUNTA {step+1} DE {questions.length}</span><h1>{q.title}</h1><p>{q.hint}</p></div><div className="game-options">{q.options.map(o=><button key={o.id} className={`game-option ${answers[step]===o.id?"chosen":""}`} onClick={()=>setAnswers({...answers,[step]:o.id})}><img src={o.image} alt={o.name} loading="eager" onError={event=>{const img=event.currentTarget;img.onerror=null;img.classList.add("image-failed");img.removeAttribute("src");}}/><span className="option-name">{o.name}</span><span className="option-check">{answers[step]===o.id?"✓":""}</span></button>)}</div><div className="creator-actions"><button className="back-button" onClick={()=>setStep(Math.max(0,step-1))} disabled={step===0}>Voltar</button><button className="continue-button" disabled={!answers[step]} onClick={()=>step<questions.length-1?setStep(step+1):setNaming(true)}>{step===questions.length-1?"Continuar":"Continuar"} <span>→</span></button></div></>}
  </section>
  {!playing&&!done&&<footer className="robo-footer">FEITO PARA APRENDER E CRIAR <span>ROBOEDUC</span></footer>}
 </main>;
}
