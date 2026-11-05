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

function PlatformGame({gameName,styleId,objectiveId,typeId,onExit}:{gameName:string;styleId:string;objectiveId:string;typeId:string;onExit:()=>void}){
 const canvasRef=useRef<HTMLCanvasElement|null>(null);
 const keys=useRef({left:false,right:false,up:false,down:false,jump:false,action:false});
 const [score,setScore]=useState(0),[lives,setLives]=useState(typeId==="survival"?4:3),[progress,setProgress]=useState(0),[won,setWon]=useState(false),[lost,setLost]=useState(false),[restart,setRestart]=useState(0);
 const voxel=styleId==="minecraft",roblox=styleId==="roblox",fortnite=styleId==="fortnite",sonic=styleId==="sonic";
 const build=objectiveId==="build",battle=objectiveId==="battle",explore=objectiveId==="explore",race=objectiveId==="race";
 useEffect(()=>{
  const canvas=canvasRef.current;if(!canvas)return;const ctx=canvas.getContext("2d");if(!ctx)return;
  const W=960,H=540;let raf=0,frame=0,last=0,camera=0,scoreLocal=0,livesLocal=typeId==="survival"?4:3,done=false,progressLocal=0,elapsed=0;
  const player={x:3.5,z:3.5,y:0,vx:0,vy:0,angle:0,ground:true};
  const grid=Array.from({length:18},(_,z)=>Array.from({length:18},(_,x)=>(x===0||z===0||x===17||z===17)?1:0));
  // Robotics lab landmarks and collectible microchips are present in every world.
  const chips=[{x:5,z:4,taken:false},{x:10,z:5,taken:false},{x:13,z:11,taken:false},{x:4,z:13,taken:false},{x:8,z:9,taken:false},{x:14,z:7,taken:false}];
  const stations=[{x:7,z:7,built:false},{x:12,z:9,built:false},{x:5,z:11,built:false}];
  const bots=Array.from({length:5},(_,i)=>({x:4+i*2.3,z:10+(i%2)*2,alive:true,dir:1}));
  const checkpoints=[{x:5,z:5,on:false},{x:10,z:10,on:false},{x:14,z:14,on:false}];
  let yaw=0,buildCooldown=0,damageCooldown=0;
  const down=(e:KeyboardEvent)=>{const k=e.key.toLowerCase();if(["w","a","s","d"," ","arrowup","arrowdown","arrowleft","arrowright","e","x","f"].includes(k))e.preventDefault();if(k==="w"||k==="arrowup")keys.current.up=true;if(k==="s"||k==="arrowdown")keys.current.down=true;if(k==="a"||k==="arrowleft")keys.current.left=true;if(k==="d"||k==="arrowright")keys.current.right=true;if(k===" ")keys.current.jump=true;if(["e","x","f"].includes(k))keys.current.action=true;};
  const up=(e:KeyboardEvent)=>{const k=e.key.toLowerCase();if(k==="w"||k==="arrowup")keys.current.up=false;if(k==="s"||k==="arrowdown")keys.current.down=false;if(k==="a"||k==="arrowleft")keys.current.left=false;if(k==="d"||k==="arrowright")keys.current.right=false;if(k===" ")keys.current.jump=false;if(["e","x","f"].includes(k))keys.current.action=false;};
  const resize=()=>{const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,r.width*d);canvas.height=Math.max(1,r.height*d);};
  resize();const obs=new ResizeObserver(resize);obs.observe(canvas);window.addEventListener("keydown",down);window.addEventListener("keyup",up);
  const finish=(win:boolean)=>{done=true;setWon(win);setLost(!win);};
  const collect=()=>{chips.forEach(c=>{if(!c.taken&&Math.hypot(player.x-c.x,player.z-c.z)<.8){c.taken=true;progressLocal++;scoreLocal+=100;setProgress(progressLocal);setScore(scoreLocal);}});};
  const update=(dt:number)=>{
   elapsed+=dt/60;buildCooldown=Math.max(0,buildCooldown-dt);damageCooldown=Math.max(0,damageCooldown-dt);
   const move=(Number(keys.current.up)-Number(keys.current.down))*(sonic?0.13:.075);
   if(voxel){yaw+=(Number(keys.current.right)-Number(keys.current.left))*.045*dt;player.x+=Math.sin(yaw)*move*dt;player.z+=Math.cos(yaw)*move*dt;}
   else {player.angle=Math.atan2(Number(keys.current.right)-Number(keys.current.left),Number(keys.current.up)-Number(keys.current.down));player.x+=(Number(keys.current.right)-Number(keys.current.left))*.075*dt;player.z-=(Number(keys.current.up)-Number(keys.current.down))*.075*dt;}
   player.x=Math.max(1.3,Math.min(16.7,player.x));player.z=Math.max(1.3,Math.min(16.7,player.z));
   if(sonic){if(keys.current.jump&&player.ground){player.vy=-.24;player.ground=false;}player.vy+=.012*dt;player.y+=player.vy*dt;if(player.y>=0){player.y=0;player.vy=0;player.ground=true;}}
   collect();
   if(keys.current.action&&build&&buildCooldown===0){const s=stations.find(v=>!v.built&&Math.hypot(player.x-v.x,player.z-v.z)<1.5);if(s){s.built=true;buildCooldown=25;scoreLocal+=150;setScore(scoreLocal);setProgress(v=>v+1);}}
   if(keys.current.action&&battle&&buildCooldown===0){const b=bots.find(v=>v.alive&&Math.hypot(player.x-v.x,player.z-v.z)<1.8);if(b){b.alive=false;buildCooldown=25;scoreLocal+=200;setScore(scoreLocal);setProgress(v=>v+1);}}
   if(keys.current.action&&fortnite&&buildCooldown===0){const bx=Math.round(player.x+Math.sin(player.angle||yaw)*1.5),bz=Math.round(player.z-Math.cos(player.angle||yaw)*1.5);if(bx>0&&bz>0&&bx<17&&bz<17&&grid[bz][bx]===0){grid[bz][bx]=2;buildCooldown=18;scoreLocal+=10;setScore(scoreLocal);}}
   if(!voxel&&!sonic){bots.forEach(b=>{if(!b.alive)return;b.x+=Math.sin(elapsed+b.z)*.003*dt;if(Math.hypot(player.x-b.x,player.z-b.z)<.55&&damageCooldown===0){livesLocal--;setLives(livesLocal);damageCooldown=100;if(livesLocal<=0)finish(false);}});}
   checkpoints.forEach(c=>{if(Math.hypot(player.x-c.x,player.z-c.z)<.9&&!c.on){c.on=true;scoreLocal+=50;setScore(scoreLocal);setProgress(v=>v+1);}});
   if(typeId==="survival"&&Math.floor(elapsed/25)>Math.floor((elapsed-dt/60)/25)&&damageCooldown===0){livesLocal--;setLives(livesLocal);damageCooldown=100;if(livesLocal<=0)finish(false);}
   if(build&&stations.every(s=>s.built)&&player.x>14&&player.z>14)finish(true);
   else if(explore&&chips.filter(c=>c.taken).length>=6&&player.x>14&&player.z>14)finish(true);
   else if(battle&&bots.every(b=>!b.alive)&&player.x>14&&player.z>14)finish(true);
   else if(race&&checkpoints.every(c=>c.on)&&player.x>14&&player.z>14)finish(true);
   else if(!build&&!explore&&!battle&&!race&&player.x>15&&player.z>15)finish(true);
  };
  const drawVoxel=()=>{
   const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,"#78bce8");sky.addColorStop(1,"#d5edfa");ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
   const horizon=H*.48;ctx.fillStyle="#5a9c4c";ctx.fillRect(0,horizon,W,H-horizon);
   const fov=Math.PI/2.8;
   for(let col=0;col<W;col+=3){const angle=yaw+(col/W-.5)*fov;let dist=0,hit=0;while(dist<22){dist+=.045;const x=Math.floor(player.x+Math.sin(angle)*dist),z=Math.floor(player.z+Math.cos(angle)*dist);if(x<0||z<0||x>=18||z>=18||grid[z][x]){hit=grid[Math.max(0,Math.min(17,z))][Math.max(0,Math.min(17,x))]||1;break;}}
    const corrected=dist*Math.cos((col/W-.5)*fov),height=Math.min(H,260/Math.max(.1,corrected));ctx.fillStyle=hit===2?"#b68b55":(Math.floor(dist*2)%2?"#7eaf54":"#689747");ctx.fillRect(col,horizon-height/2,3,height);ctx.fillStyle="#ffffff22";ctx.fillRect(col,horizon-height/2,3,3);
   }
   // Floating circuit chips and robot workbench markers
   chips.forEach(c=>{if(c.taken)return;const dx=c.x-player.x,dz=c.z-player.z,depth=dx*Math.sin(yaw)+dz*Math.cos(yaw),side=dx*Math.cos(yaw)-dz*Math.sin(yaw);if(depth>.3&&Math.abs(side/depth)<.8){const x=W/2+side/depth*W*.7,y=horizon-depth*22,size=Math.max(5,30/depth);ctx.fillStyle="#ffdc42";ctx.fillRect(x-size/2,y-size/2,size,size);ctx.fillStyle="#fff";ctx.fillRect(x-size/5,y-size/5,size/2,size/2);}});
   ctx.fillStyle="#222";ctx.fillRect(W/2-3,H-95,6,18);ctx.fillStyle="#f4c542";ctx.fillRect(W/2-14,H-78,28,28);ctx.fillStyle="#303b4a";ctx.fillRect(W/2-10,H-50,20,50);
   ctx.fillStyle="#ffffffdd";ctx.font="bold 17px sans-serif";ctx.fillText("WASD mover · mouse/← → olhar · E interagir · F bloco",24,H-24);
  };
  const drawThird=()=>{
   const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,fortnite?"#899fd0":"#83d8ed");sky.addColorStop(1,"#e5f5f7");ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
   ctx.fillStyle=fortnite?"#728096":"#62b96a";ctx.fillRect(0,300,W,240);
   // Isometric-looking floor grid
   for(let i=0;i<20;i++){ctx.strokeStyle="#ffffff35";ctx.beginPath();ctx.moveTo(i*60-camera%60,300);ctx.lineTo(i*60-camera%60-130,540);ctx.stroke();}
   const project=(x:number,z:number)=>({x:W/2+(x-player.x)*42-(z-player.z)*23,y:370+(x-player.x)*16+(z-player.z)*16});
   for(let z=1;z<17;z++)for(let x=1;x<17;x++){if(grid[z][x]){const p=project(x,z);ctx.fillStyle="#9c9c9c";ctx.fillRect(p.x-20,p.y-32,40,42);ctx.fillStyle="#c4c4c4";ctx.fillRect(p.x-20,p.y-36,40,7);}}
   chips.forEach(c=>{if(c.taken)return;const p=project(c.x,c.z);ctx.fillStyle="#ffdc35";ctx.beginPath();ctx.arc(p.x,p.y-22,10,0,Math.PI*2);ctx.fill();ctx.fillStyle="#fff";ctx.fillRect(p.x-3,p.y-25,6,6);});
   stations.forEach(s=>{const p=project(s.x,s.z);ctx.fillStyle=s.built?"#65c94d":"#b67a40";ctx.fillRect(p.x-18,p.y-28,36,28);ctx.fillStyle="#5ddcf5";ctx.fillRect(p.x-11,p.y-45,22,18);ctx.fillStyle="#fff";ctx.fillRect(p.x-5,p.y-40,10,5);});
   bots.forEach(b=>{if(!b.alive)return;const p=project(b.x,b.z);ctx.fillStyle="#e15b55";ctx.fillRect(p.x-12,p.y-38,24,32);ctx.fillStyle="#e8c79e";ctx.fillRect(p.x-10,p.y-54,20,18);ctx.fillStyle="#62e8f5";ctx.fillRect(p.x-6,p.y-48,12,5);});
   checkpoints.forEach(c=>{const p=project(c.x,c.z);ctx.fillStyle=c.on?"#8cf35a":"#fff";ctx.fillRect(p.x-3,p.y-100,6,100);ctx.fillStyle="#ffb83d";ctx.fillRect(p.x+3,p.y-100,30,20);});
   // Third-person robot explorer
   const px=W/2,py=380;ctx.fillStyle="#243c57";ctx.fillRect(px-18,py-10,36,42);ctx.fillStyle="#e7b88c";ctx.fillRect(px-14,py-42,28,28);ctx.fillStyle="#243c57";ctx.fillRect(px-16,py-45,32,8);ctx.fillStyle="#4ee8fa";ctx.fillRect(px-9,py-32,18,7);ctx.fillStyle="#343e55";ctx.fillRect(px-16,py+30,12,17);ctx.fillRect(px+4,py+30,12,17);
   if(fortnite){ctx.fillStyle="#d7b078";ctx.fillRect(px+23,py-5,14,35);}
   ctx.fillStyle="#fff";ctx.font="bold 17px sans-serif";ctx.fillText(fortnite?"WASD mover · E construir · F interagir":"WASD mover · E interagir",24,H-24);
  };
  const drawSonic=()=>{
   const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,"#45a9ee");sky.addColorStop(1,"#d8f5ff");ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
   ctx.fillStyle="#4bb85b";ctx.fillRect(0,420,W,120);ctx.fillStyle="#a66b3d";ctx.fillRect(0,435,W,105);
   for(let i=0;i<18;i++){const x=i*80-camera%80;ctx.fillStyle="#5dcc6a";ctx.beginPath();ctx.arc(x,415,35,Math.PI,0);ctx.fill();}
   chips.forEach(c=>{if(c.taken)return;const x=140+(c.x*75-camera)%1500,y=330-(c.z%4)*30;ctx.fillStyle="#ffd43b";ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.fill();ctx.fillStyle="#fff";ctx.fillRect(x-3,y-5,6,10);});
   stations.forEach(s=>{const x=200+s.x*80-camera%1500;ctx.fillStyle=s.built?"#4caf50":"#a96d3c";ctx.fillRect(x,370,38,50);ctx.fillStyle="#54e5f2";ctx.fillRect(x+7,350,24,20);});
   const x=180,y=350-player.y*70;ctx.fillStyle="#0876d5";ctx.beginPath();ctx.arc(x,y,25,0,Math.PI*2);ctx.fill();ctx.fillStyle="#f4d0a4";ctx.beginPath();ctx.ellipse(x+9,y+8,12,8,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#fff";ctx.fillRect(x+9,y-11,12,13);ctx.fillStyle="#d83e3e";ctx.fillRect(x-26,y+19,24,8);ctx.fillRect(x+10,y+19,24,8);
   ctx.fillStyle="#fff";ctx.font="bold 17px sans-serif";ctx.fillText("← → mover · ESPAÇO pular · E interagir",24,H-24);
  };
  const draw=()=>{const dt=Math.min(last?(performance.now()-last)/16.67:1,2);last=performance.now();frame++;ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);if(!done)update(dt);if(voxel)drawVoxel();else if(sonic)drawSonic();else drawThird();raf=requestAnimationFrame(draw);};
  raf=requestAnimationFrame(draw);
  return()=>{cancelAnimationFrame(raf);obs.disconnect();window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);keys.current={left:false,right:false,up:false,down:false,jump:false,action:false};};
 },[restart,styleId,objectiveId,typeId,voxel,roblox,fortnite,sonic,build,battle,explore,race]);
 const pointer=(k:"left"|"right"|"up"|"down"|"jump"|"action",v:boolean)=>{keys.current[k]=v;};
 const restartGame=()=>{setScore(0);setLives(typeId==="survival"?4:3);setProgress(0);setWon(false);setLost(false);setRestart(v=>v+1);};
 return <div className="play-screen"><canvas ref={canvasRef} className="platform-canvas"/><div className="game-hud"><div className="hud-brand"><span className="hud-dot"/> {gameName}</div><div className="hud-stats"><span>⚙ {score}</span><span>♥ {lives}</span><span className="hud-level">{voxel?"LABORATÓRIO VOXEL":roblox?"MISSÃO 3D":fortnite?"ARENA DE CONSTRUÇÃO":"FASE PLATAFORMA"} · Chips {progress}/6</span></div><button className="hud-menu" onClick={onExit}>Ⅱ MENU</button></div><div className="touch-controls"><div className="move-controls"><button onPointerDown={()=>pointer("left",true)} onPointerUp={()=>pointer("left",false)} onPointerLeave={()=>pointer("left",false)}>◀</button><button onPointerDown={()=>pointer("right",true)} onPointerUp={()=>pointer("right",false)} onPointerLeave={()=>pointer("right",false)}>▶</button></div>{sonic&&<button className="jump-control" onPointerDown={()=>pointer("jump",true)} onPointerUp={()=>pointer("jump",false)} onPointerLeave={()=>pointer("jump",false)}>PULAR</button>}<button className="attack-control" onPointerDown={()=>pointer("action",true)} onPointerUp={()=>pointer("action",false)} onPointerLeave={()=>pointer("action",false)}>{build?"CONSTRUIR":battle?"INTERAGIR":"PEGAR CHIP"}</button></div>{(won||lost)&&<div className="game-result"><h2>{won?"MISSÃO CONCLUÍDA!":"FIM DE JOGO"}</h2><p>Peças tecnológicas: {progress} · Pontos: {score}</p><button className="continue-button" onClick={restartGame}>JOGAR NOVAMENTE</button><button className="back-button" onClick={onExit}>VOLTAR</button></div>}</div>;
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
