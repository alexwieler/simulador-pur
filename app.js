/* ===================== Simulador PUR — app.js ===================== */
'use strict';

const $ = id => document.getElementById(id);
const AREAS = ["Pediatría","Cirugía","Clínica Médica","Ginecotocología",
  "Medicina Familiar y Comunitaria","Bioética","Psiquiatría","Medicina Legal"];
const PACE = 110; /* seg por pregunta en cuenta regresiva (4h/130 ≈ 1:51) */

let BANK = [];                       /* todas las preguntas */
const cfg = { area:"Todas", cant:20, modo:"practica",
              cron:"up", shuffle:true, desempate:true, tipo:"todas" };
let ses = null;

/* ---------------- utilidades ---------------- */
function esc(s){
  return (s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
}
function fmt(s){
  s=Math.max(0,Math.round(s));
  const m=Math.floor(s/60), x=s%60;
  return String(m).padStart(2,"0")+":"+String(x).padStart(2,"0");
}
function shuffle(a){
  for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]];}
  return a;
}
function today(){ return new Date().toISOString().slice(0,10); }
function show(name){
  ["home","quiz","result"].forEach(s=>
    $("screen-"+s).classList.toggle("hidden",s!==name));
}
let toastT=null;
function toast(msg){
  const t=$("toast"); t.textContent=msg; t.classList.remove("hidden");
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.add("hidden"),2200);
}

/* ---------------- modal ---------------- */
function ask(title,text,okLabel){
  return new Promise(res=>{
    $("modalTitle").textContent=title;
    $("modalText").textContent=text;
    $("modalYes").textContent=okLabel||"Confirmar";
    $("modalBg").classList.remove("hidden");
    const done=v=>{ $("modalBg").classList.add("hidden");
      $("modalYes").onclick=null; $("modalNo").onclick=null; res(v); };
    $("modalYes").onclick=()=>done(true);
    $("modalNo").onclick=()=>done(false);
  });
}

/* ---------------- tema ---------------- */
function initTheme(){
  let t=localStorage.getItem("pur_theme");
  if(!t) t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
  document.documentElement.setAttribute("data-theme",t);
}
$("themeBtn").onclick=()=>{
  const cur=document.documentElement.getAttribute("data-theme");
  const nx=cur==="dark"?"light":"dark";
  document.documentElement.setAttribute("data-theme",nx);
  localStorage.setItem("pur_theme",nx);
};

/* ---------------- estadísticas ---------------- */
function loadStats(){
  try{return JSON.parse(localStorage.getItem("pur_stats"))||{};}catch(e){return {};}
}
function saveStats(s){ try{localStorage.setItem("pur_stats",JSON.stringify(s));}catch(e){} }
function recordSession(preguntas,resp){
  const s=loadStats();
  s.areas=s.areas||{};
  s.sims=(s.sims||0)+1;
  preguntas.forEach((q,i)=>{
    if(resp[i]==null) return;
    const a=s.areas[q.area]||{ans:0,ok:0};
    a.ans++; if(q.correcta.includes(resp[i])) a.ok++;
    s.areas[q.area]=a;
  });
  /* racha */
  const td=today();
  if(s.lastDay!==td){
    const y=new Date(Date.now()-864e5).toISOString().slice(0,10);
    s.streak = (s.lastDay===y) ? (s.streak||0)+1 : 1;
    s.lastDay=td;
  } else if(!s.streak){ s.streak=1; }
  saveStats(s);
}

/* ---------------- pantalla inicio ---------------- */
function matchTipo(q){
  return cfg.tipo==="todas" || (q.claveTipo||"oficial")===cfg.tipo;
}
function countArea(name){
  return BANK.filter(q=> (name==="Todas"||q.area===name) && matchTipo(q)).length;
}
function barColor(pct,has){
  if(!has) return "var(--soft2)";
  if(pct>=75) return "var(--ok)";
  if(pct>=55) return "var(--primary)";
  if(pct>=40) return "var(--warn)";
  return "var(--bad)";
}
function renderHome(){
  /* areas */
  const list=$("areaList"); list.innerHTML="";
  const mk=(name,label,count)=>{
    const b=document.createElement("button");
    b.type="button";
    b.className="area-btn"+(cfg.area===name?" on":"");
    b.innerHTML='<span>'+esc(label)+'</span><span class="n">'+count+'</span>';
    b.onclick=()=>{cfg.area=name;renderHome();};
    list.appendChild(b);
  };
  mk("Todas","Examen completo (todas)",countArea("Todas"));
  AREAS.forEach(a=>{ const c=countArea(a); if(c) mk(a,a,c); });

  /* cantidad */
  const avail=countArea(cfg.area);
  if(cfg.cant>avail) cfg.cant=avail;
  const opts=[10,20,30,50].filter(n=>n<avail); opts.push(avail);
  const cr=$("cantRow"); cr.innerHTML="";
  opts.forEach(n=>{
    const p=document.createElement("button");
    p.type="button";
    p.className="pill"+(cfg.cant===n?" on":"");
    p.textContent = n===avail ? "Todas ("+n+")" : n;
    p.onclick=()=>{cfg.cant=n;renderHome();};
    cr.appendChild(p);
  });
  renderStats();
}
function renderStats(){
  const s=loadStats(), ar=s.areas||{};
  let tot=0,ok=0;
  AREAS.forEach(a=>{const x=ar[a];if(x){tot+=x.ans;ok+=x.ok;}});
  $("stTot").textContent=tot;
  $("stPct").textContent=tot?Math.round(ok/tot*100)+"%":"—";
  $("stStreak").textContent=s.streak||0;
  const bars=$("areaBars"); bars.innerHTML="";
  AREAS.forEach(a=>{
    const x=ar[a], has=x&&x.ans, pct=has?Math.round(x.ok/x.ans*100):0;
    const d=document.createElement("div"); d.className="abar";
    d.innerHTML='<div class="top"><b>'+esc(a)+'</b><span>'+
      (has?pct+"% · "+x.ok+"/"+x.ans:"sin datos")+
      '</span></div><div class="track"><div class="fill" style="width:'+
      (has?pct:0)+'%;background:'+barColor(pct,has)+'"></div></div>';
    bars.appendChild(d);
  });
}

/* ---------------- comenzar simulacro ---------------- */
function comenzar(){
  let pool=BANK.filter(q=> (cfg.area==="Todas"||q.area===cfg.area) && matchTipo(q));
  if(!cfg.desempate) pool=pool.filter(q=>!q.desempate);
  if(!pool.length){ toast("No hay preguntas con esa configuración"); return; }
  pool = cfg.shuffle ? shuffle(pool.slice()) : pool.slice();
  const preguntas=pool.slice(0,Math.min(cfg.cant,pool.length));
  ses={
    preguntas, idx:0,
    resp:Array(preguntas.length).fill(null),
    locked:Array(preguntas.length).fill(false),
    flags:Array(preguntas.length).fill(false),
    start:Date.now(), elapsed:0, timer:null,
    durLimit: cfg.cron==="down" ? preguntas.length*PACE : 0,
    revErr:false
  };
  show("quiz");
  if(cfg.cron!=="off"){
    $("qTimer").style.display="";
    tick(); ses.timer=setInterval(tick,1000);
  } else { $("qTimer").style.display="none"; }
  renderPregunta();
  window.scrollTo({top:0});
}
function tick(){
  const el=Math.floor((Date.now()-ses.start)/1000);
  ses.elapsed=el;
  const t=$("qTimer");
  if(cfg.cron==="down"){
    const left=ses.durLimit-el;
    t.textContent=fmt(left);
    t.classList.toggle("warn",left<=60);
    if(left<=0){ clearInterval(ses.timer); toast("Se acabó el tiempo"); finalizar("forced"); }
  } else {
    t.textContent=fmt(el);
  }
}

/* ---------------- render pregunta ---------------- */
function renderPregunta(){
  const i=ses.idx, q=ses.preguntas[i], locked=ses.locked[i];
  $("qArea").textContent=q.area;
  $("qProg").textContent=(i+1)+" / "+ses.preguntas.length;
  $("qFill").style.width=(i/ses.preguntas.length*100)+"%";
  $("qDesem").classList.toggle("hidden",!q.desempate);
  const esOf=(q.claveTipo||"oficial")==="oficial";
  const tEl=$("qTipo");
  tEl.textContent=esOf?"PUR 2025":"Práctica";
  tEl.className="tag-tipo "+(esOf?"of":"pr");

  /* flag */
  const fb=$("flagBtn");
  fb.setAttribute("aria-pressed",ses.flags[i]?"true":"false");

  /* caso */
  if(q.caso){
    $("qCaso").classList.remove("hidden");
    $("qCasoTx").textContent=q.caso;
  } else $("qCaso").classList.add("hidden");
  $("qText").textContent=q.pregunta;

  /* opciones */
  const box=$("qOpts"); box.innerHTML="";
  const chosen=ses.resp[i];
  q.opciones.forEach(o=>{
    const b=document.createElement("button");
    b.type="button"; b.className="opt"; b.setAttribute("role","radio");
    b.dataset.l=o.l;
    let mk="";
    if(cfg.modo==="practica" && locked){
      b.disabled=true;
      if(q.correcta.includes(o.l)){ b.classList.add("ok"); mk="✓"; }
      else if(o.l===chosen){ b.classList.add("bad"); mk="✗"; }
      b.setAttribute("aria-checked", o.l===chosen?"true":"false");
    } else {
      if(o.l===chosen){ b.classList.add("sel"); }
      b.setAttribute("aria-checked", o.l===chosen?"true":"false");
      b.onclick=()=>elegir(o.l);
    }
    b.innerHTML='<span class="lt">'+o.l+'</span>'+
      '<span class="ot">'+esc(o.t)+'</span>'+
      '<span class="mk">'+mk+'</span>';
    box.appendChild(b);
  });

  /* feedback (solo práctica) */
  const fbk=$("qFb");
  if(cfg.modo==="practica" && locked){
    const acerto=q.correcta.includes(chosen);
    fbk.className="fb show "+(acerto?"good":"wrong");
    $("qFbH").textContent=acerto?"✓ Correcto":"✗ Incorrecto";
    const corr=q.correcta.map(l=>l.toUpperCase()).join(" o ");
    $("qFbX").innerHTML='<span class="corr">Respuesta correcta: '+corr+'.</span> '+esc(q.explicacion);
  } else {
    fbk.className="fb";
  }

  /* navegación */
  $("prevBtn").disabled = i===0;
  const last=i===ses.preguntas.length-1;
  $("nextBtn").textContent = last ? "Finalizar" : "Siguiente →";
  $("nextBtn").disabled = (cfg.modo==="practica" && !locked);
}

function elegir(letter){
  const i=ses.idx;
  ses.resp[i]=letter;
  if(cfg.modo==="practica") ses.locked[i]=true;
  renderPregunta();
}
function next(){
  if(ses.idx<ses.preguntas.length-1){
    ses.idx++; renderPregunta(); window.scrollTo({top:0,behavior:"smooth"});
  } else finalizar("auto");
}
function prev(){
  if(ses.idx>0){ ses.idx--; renderPregunta(); window.scrollTo({top:0,behavior:"smooth"}); }
}
function toggleFlag(){
  ses.flags[ses.idx]=!ses.flags[ses.idx];
  $("flagBtn").setAttribute("aria-pressed",ses.flags[ses.idx]?"true":"false");
  toast(ses.flags[ses.idx]?"Pregunta marcada para revisar":"Marca quitada");
}

/* ---------------- navegador ---------------- */
function openNav(){
  const g=$("navGrid"); g.innerHTML="";
  ses.preguntas.forEach((q,i)=>{
    const c=document.createElement("button");
    c.type="button"; c.className="navcell";
    c.textContent=i+1;
    if(i===ses.idx) c.classList.add("cur");
    const r=ses.resp[i];
    if(r!=null){
      if(cfg.modo==="practica" && ses.locked[i]){
        c.classList.add(q.correcta.includes(r)?"ok":"bad");
      } else c.classList.add("ans");
    }
    if(ses.flags[i]){
      c.classList.add("flag");
      const d=document.createElement("span"); d.className="fdot"; c.appendChild(d);
    }
    c.onclick=()=>{ ses.idx=i; closeNav(); renderPregunta(); window.scrollTo({top:0}); };
    g.appendChild(c);
  });
  $("navDrawerBg").classList.remove("hidden");
}
function closeNav(){ $("navDrawerBg").classList.add("hidden"); }

/* ---------------- finalizar ---------------- */
async function finalizar(mode){
  /* mode: "auto" (fin natural) | "quit" (terminar antes) | "forced" (sin tiempo) */
  if(mode!=="forced"){
    const sinResp=ses.resp.filter(r=>r==null).length;
    if(mode==="quit" || sinResp>0){
      const msg=sinResp>0
        ? "Tenés "+sinResp+" pregunta(s) sin responder. ¿Terminar igual?"
        : "¿Terminar el simulacro y ver tus resultados?";
      const ok=await ask("Terminar simulacro",msg,"Terminar");
      if(!ok) return;
    }
  }
  if(ses.timer) clearInterval(ses.timer);
  ses.elapsed=Math.min(
    Math.floor((Date.now()-ses.start)/1000),
    cfg.cron==="down"?ses.durLimit:1e9);
  recordSession(ses.preguntas,ses.resp);
  renderResultados();
  show("result");
  window.scrollTo({top:0});
}
function renderResultados(){
  let ok=0,bad=0,sin=0,pGan=0,pTot=0;
  ses.preguntas.forEach((q,i)=>{
    pTot+=q.puntos;
    const r=ses.resp[i];
    if(r==null) sin++;
    else if(q.correcta.includes(r)){ ok++; pGan+=q.puntos; }
    else bad++;
  });
  const tot=ses.preguntas.length, pct=Math.round(ok/tot*100);
  $("rPct").textContent=pct+"%";
  $("rFrac").textContent=ok+" / "+tot;
  $("ring").style.setProperty("--deg",(pct*3.6)+"deg");
  $("rOk").textContent=ok;
  $("rBad").textContent=bad+sin;
  $("rTime").textContent=fmt(ses.elapsed);

  let v;
  if(pct>=80) v="Excelente. Muy buen nivel en esta selección.";
  else if(pct>=65) v="Buen desempeño. Reforzá lo que fallaste.";
  else if(pct>=50) v="Vas por buen camino, hay margen de mejora.";
  else v="Conviene repasar a fondo antes de avanzar.";
  $("rVerdict").textContent=v;

  const hayDes=ses.preguntas.some(q=>q.desempate);
  $("rPuntaje").textContent = hayDes
    ? "Puntaje ponderado (desempate incluido): "+pGan+" / "+pTot+" puntos"
    : "";

  /* por area */
  const byA={};
  ses.preguntas.forEach((q,i)=>{
    const a=byA[q.area]||{t:0,o:0}; a.t++;
    if(ses.resp[i]!=null && q.correcta.includes(ses.resp[i])) a.o++;
    byA[q.area]=a;
  });
  const bars=$("rAreaBars"); bars.innerHTML="";
  Object.keys(byA).forEach(a=>{
    const x=byA[a], p=Math.round(x.o/x.t*100);
    const d=document.createElement("div"); d.className="abar";
    d.innerHTML='<div class="top"><b>'+esc(a)+'</b><span>'+p+'% · '+x.o+'/'+x.t+
      '</span></div><div class="track"><div class="fill" style="width:'+p+
      '%;background:'+barColor(p,true)+'"></div></div>';
    bars.appendChild(d);
  });
  renderRevision();
}
function renderRevision(){
  const list=$("revList"); list.innerHTML="";
  let shown=0;
  ses.preguntas.forEach((q,i)=>{
    const mine=ses.resp[i];
    const acerto = mine!=null && q.correcta.includes(mine);
    if(ses.revErr && acerto) return;
    shown++;
    const txt=l=>{const o=q.opciones.find(o=>o.l===l);return o?o.t:"—";};
    const corr=q.correcta.map(l=>l.toUpperCase()+") "+txt(l)).join("  /  ");
    let h='<div class="rq">'+(i+1)+'. '+esc(q.pregunta)+'</div>';
    if(q.caso) h+='<div class="rcaso">'+esc(q.caso)+'</div>';
    if(mine==null){
      h+='<div class="rev-line ln-bad"><span class="b">Sin responder</span></div>';
    } else if(acerto){
      h+='<div class="rev-line ln-ok"><span class="b">✓ Tu respuesta:</span><span>'+
        mine.toUpperCase()+") "+esc(txt(mine))+'</span></div>';
    } else {
      h+='<div class="rev-line ln-bad"><span class="b">✗ Tu respuesta:</span><span>'+
        mine.toUpperCase()+") "+esc(txt(mine))+'</span></div>';
    }
    h+='<div class="rev-line ln-ok"><span class="b">Correcta:</span><span>'+esc(corr)+'</span></div>';
    h+='<div class="rev-expl">'+esc(q.explicacion)+'</div>';
    const meta=[];
    if(q.tema) meta.push("Tema: "+q.tema);
    if(q.fuente) meta.push("Fuente: "+q.fuente);
    meta.push((q.claveTipo||"oficial")==="oficial" ? "PUR 2025 · clave oficial" : "Pregunta de práctica");
    h+='<div class="rev-meta">'+esc(meta.join("  ·  "))+'</div>';
    const it=document.createElement("div"); it.className="rev-item"; it.innerHTML=h;
    list.appendChild(it);
  });
  if(!shown) list.innerHTML='<p class="hint" style="margin-top:10px">No hay errores. ¡Bien ahí!</p>';
}

/* ---------------- teclado ---------------- */
document.addEventListener("keydown",e=>{
  if(!$("modalBg").classList.contains("hidden")) return;
  if($("screen-quiz").classList.contains("hidden")) return;
  if(!$("navDrawerBg").classList.contains("hidden")){
    if(e.key==="Escape") closeNav(); return;
  }
  const k=e.key.toLowerCase();
  const map={a:"a",b:"b",c:"c",d:"d","1":"a","2":"b","3":"c","4":"d"};
  if(map[k]){
    const i=ses.idx;
    if(!(cfg.modo==="practica" && ses.locked[i])) elegir(map[k]);
    e.preventDefault();
  } else if(k==="arrowright"){
    if(!$("nextBtn").disabled){ next(); e.preventDefault(); }
  } else if(k==="enter"){
    if(!$("nextBtn").disabled){ next(); e.preventDefault(); }
  } else if(k==="arrowleft"){
    prev(); e.preventDefault();
  } else if(k==="f"){
    toggleFlag(); e.preventDefault();
  }
});

/* ---------------- eventos ---------------- */
$("startBtn").onclick=comenzar;
$("nextBtn").onclick=next;
$("prevBtn").onclick=prev;
$("flagBtn").onclick=toggleFlag;
$("navBtn").onclick=openNav;
$("navClose").onclick=closeNav;
$("navDrawerBg").onclick=e=>{ if(e.target===$("navDrawerBg")) closeNav(); };
$("quitBtn").onclick=()=>finalizar("quit");
$("homeBtn").onclick=()=>{ renderHome(); show("home"); window.scrollTo({top:0}); };
$("againBtn").onclick=()=>{ renderHome(); show("home"); window.scrollTo({top:0}); };
$("revFilter").onclick=function(){
  ses.revErr=!ses.revErr;
  this.textContent=ses.revErr?"Ver todas":"Ver solo errores";
  renderRevision();
};
$("resetStats").onclick=async()=>{
  if(await ask("Borrar progreso","Se borrará tu historial de aciertos y la racha. ¿Seguro?","Borrar")){
    localStorage.removeItem("pur_stats"); renderStats(); toast("Progreso borrado");
  }
};
document.querySelectorAll("#tipoRow .pill").forEach(p=>{
  p.onclick=()=>{
    document.querySelectorAll("#tipoRow .pill").forEach(x=>x.classList.remove("on"));
    p.classList.add("on"); cfg.tipo=p.dataset.tipo; renderHome();
  };
});
document.querySelectorAll("#modoRow .pill").forEach(p=>{
  p.onclick=()=>{
    document.querySelectorAll("#modoRow .pill").forEach(x=>x.classList.remove("on"));
    p.classList.add("on"); cfg.modo=p.dataset.modo;
  };
});
document.querySelectorAll("#cronRow .pill").forEach(p=>{
  p.onclick=()=>{
    document.querySelectorAll("#cronRow .pill").forEach(x=>x.classList.remove("on"));
    p.classList.add("on"); cfg.cron=p.dataset.cron;
  };
});
document.querySelectorAll("#optRow .pill").forEach(p=>{
  p.onclick=()=>{
    p.classList.toggle("on");
    const on=p.classList.contains("on");
    p.setAttribute("aria-pressed",on?"true":"false");
    cfg[p.dataset.opt]=on;
  };
});

/* ---------------- carga inicial ---------------- */
initTheme();
fetch("preguntas.json")
  .then(r=>{ if(!r.ok) throw new Error("http"); return r.json(); })
  .then(db=>{
    BANK=db.preguntas||[];
    renderHome();
    show("home");
  })
  .catch(()=>{
    $("screen-home").innerHTML=
      '<div class="card"><h2>No se pudo cargar el banco de preguntas</h2>'+
      '<p class="hint">Si abriste el archivo directamente desde el disco, el navegador '+
      'bloquea la carga de datos. Serví la carpeta con un servidor local '+
      '(por ejemplo <b>python3 -m http.server</b>) o publicala en GitHub Pages.</p></div>';
  });
