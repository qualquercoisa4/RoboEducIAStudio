"use client";
import { useState } from "react";

type Choice = { id: string; title: string; description: string; visual: string; accent: string };
type Step = { title: string; subtitle: string; question: string; choices: Choice[] };
const steps: Step[] = [
 { title: "Estilo visual", subtitle: "A aparência define a identidade do seu mundo.", question: "Qual será o estilo do seu jogo?", choices: [
  {id:"voxel",title:"Mundo de blocos",description:"Construção, exploração e liberdade.",visual:"voxel",accent:"#65c99a"},
  {id:"obby",title:"Colorido e divertido",description:"Personagens e fases cheias de obstáculos.",visual:"obby",accent:"#8b83ff"},
  {id:"battle",title:"Ação cinematográfica",description:"Um mundo intenso, com muita aventura.",visual:"battle",accent:"#f19b65"},
  {id:"pixel",title:"Pixel art 2D",description:"Visual retrô e personalidade própria.",visual:"pixel",accent:"#e5bd63"}
 ]},
 { title: "Objetivo principal", subtitle: "O que o jogador precisa fazer para vencer?", question: "Qual será o objetivo do jogo?", choices: [
  {id:"explore",title:"Explorar um mundo",description:"Descobrir lugares, segredos e recursos.",visual:"explore",accent:"#65c99a"},
  {id:"survive",title:"Sobreviver",description:"Resistir a perigos e ficar cada vez mais forte.",visual:"survive",accent:"#f19b65"},
  {id:"build",title:"Construir",description:"Criar estruturas e transformar o cenário.",visual:"build",accent:"#8b83ff"},
  {id:"challenge",title:"Completar desafios",description:"Superar fases, obstáculos e missões.",visual:"challenge",accent:"#e5bd63"}
 ]},
 { title: "Tipo de jogo", subtitle: "Escolha a estrutura principal da experiência.", question: "Que tipo de jogo vamos criar?", choices: [
  {id:"platform",title:"Plataforma",description:"Pular, correr e atravessar fases.",visual:"platform",accent:"#65c99a"},
  {id:"adventure",title:"Aventura",description:"Explorar, coletar itens e cumprir missões.",visual:"adventure",accent:"#8b83ff"},
  {id:"defense",title:"Tower defense",description:"Defender sua base de ondas de inimigos.",visual:"defense",accent:"#f19b65"},
  {id:"simulator",title:"Simulador",description:"Controlar sistemas e evoluir seu espaço.",visual:"simulator",accent:"#e5bd63"}
 ]}
];
const buildTasks = ["Interpretando suas escolhas","Montando o conceito do jogo","Preparando o mundo e os cenários","Configurando as mecânicas","Finalizando seu projeto"];
function Visual({kind}:{kind:string}) {
 return <div className={`visual visual-${kind}`} aria-hidden="true"><div className="sun"/><div className="mountain mountain-a"/><div className="mountain mountain-b"/><div className="ground"/><div className="scene-object object-a"/><div className="scene-object object-b"/><div className="scene-object object-c"/><div className="scene-glow"/></div>;
}
export default function Home() {
 const [step,setStep]=useState(0);
 const [selected,setSelected]=useState<Record<number,string>>({});
 const [building,setBuilding]=useState(false);
 const [buildProgress,setBuildProgress]=useState(0);
 const [finished,setFinished]=useState(false);
 const [projectName,setProjectName]=useState("Meu primeiro jogo");
 const current=steps[step];
 function startBuild(){setBuilding(true);setBuildProgress(0);setFinished(false);let n=0;const timer=window.setInterval(()=>{n+=1;setBuildProgress(n);if(n>=100){window.clearInterval(timer);setBuilding(false);setFinished(true);}},85);}
 function restart(){setStep(0);setSelected({});setBuilding(false);setFinished(false);setBuildProgress(0);}
 return <main className="builder-shell">
  <header className="builder-header"><div className="builder-brand"><div className="brand-mark">✳</div><div><strong>RoboEduc <span>Game Studio</span></strong><small>LABORATÓRIO DE CRIAÇÃO</small></div></div><div className="header-right"><span className="live-dot"/> EXPERIÊNCIA INTERATIVA <div className="avatar">R</div></div></header>
  <div className="builder-layout">
   <aside className="progress-panel"><div className="panel-label">SEU PROJETO</div><div className="project-icon">◈</div><h3>{projectName}</h3><p>Vamos transformar suas ideias em um jogo.</p><div className="steps-list">{steps.map((s,i)=><div className={`step-item ${i===step&&!finished?"active":selected[i]?"done":""}`} key={s.title}><div className="step-number">{selected[i]?"✓":String(i+1).padStart(2,"0")}</div><div><strong>{s.title}</strong><small>{selected[i]?"Escolhido":i===step?"Em andamento":"A seguir"}</small></div></div>)}<div className={`step-item ${finished?"done":""}`}><div className="step-number">✦</div><div><strong>Construção</strong><small>{finished?"Concluído":"Etapa final"}</small></div></div></div><div className="sidebar-tip"><span>✧ DICA DO ESTÚDIO</span><p>Não existe escolha errada. Você pode experimentar diferentes combinações.</p></div></aside>
   <section className="workspace">
    {!building&&!finished?<><div className="workspace-top"><div><div className="eyebrow">ETAPA {step+1} <span>/</span> {steps.length}</div><div className="progress-track"><div style={{width:`${(step/steps.length)*100+8}%`}}/></div></div><span className="autosave">● PROJETO SALVO</span></div><div className="question-heading"><div className="spark">✳</div><div><h1>{current.question}</h1><p>{current.subtitle}</p></div></div><div className="choice-grid">{current.choices.map((choice,i)=><button key={choice.id} className={`choice-card ${selected[step]===choice.id?"selected":""}`} onClick={()=>setSelected({...selected,[step]:choice.id})}><div className="choice-art"><Visual kind={choice.visual}/><span className="choice-index">0{i+1}</span><span className="select-indicator">{selected[step]===choice.id?"✓":"＋"}</span></div><div className="choice-copy"><strong>{choice.title}</strong><p>{choice.description}</p></div></button>)}</div><div className="workspace-footer"><button className="text-button" onClick={()=>step>0&&setStep(step-1)} disabled={step===0}>← Voltar</button><span>{selected[step]?"Seleção pronta":"Selecione uma opção para continuar"}</span><button className="next-button" disabled={!selected[step]} onClick={()=>step<steps.length-1?setStep(step+1):startBuild()}>{step===steps.length-1?"Criar meu jogo":"Continuar"} <span>→</span></button></div></>:building?<div className="build-screen"><div className="build-orbit"><div className="orbit-ring ring-one"/><div className="orbit-ring ring-two"/><div className="orbit-core">✳</div><div className="orbit-dot dot-one"/><div className="orbit-dot dot-two"/><div className="orbit-dot dot-three"/></div><div className="eyebrow">ROBOEDUC AI ENGINE</div><h1>Estamos criando seu jogo<span className="typing-dots">...</span></h1><p>Transformando suas escolhas em uma nova experiência.</p><div className="build-progress"><div><span>CONSTRUINDO SEU MUNDO</span><strong>{buildProgress}%</strong></div><div className="progress-track"><div style={{width:`${buildProgress}%`}}/></div></div><div className="build-task-list">{buildTasks.map((task,i)=><div className={buildProgress>=(i+1)*20?"task complete":buildProgress>=i*20?"task current":"task"} key={task}><span>{buildProgress>=(i+1)*20?"✓":buildProgress>=i*20?"◌":"○"}</span>{task}</div>)}</div></div>:<div className="finished-screen"><div className="finished-icon">✦</div><div className="eyebrow">PROJETO GERADO</div><h1>Seu jogo está tomando forma!</h1><p>A primeira etapa da criação foi concluída. O próximo passo será conectar suas escolhas a um jogo realmente jogável.</p><div className="summary-grid">{steps.map((s,i)=><div className="summary-card" key={s.title}><small>{s.title}</small><strong>{s.choices.find(c=>c.id===selected[i])?.title}</strong></div>)}</div><button className="next-button" onClick={restart}>Criar outro jogo ↗</button></div>}
   </section>
  </div>
  <footer className="builder-footer"><span>ROBOEDUC GAME STUDIO</span><span>IDEIAS → EXPERIÊNCIAS</span></footer>
 </main>;
}
