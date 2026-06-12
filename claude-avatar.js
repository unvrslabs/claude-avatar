#!/usr/bin/env node
/*
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  CLAUDE CODE AVATAR — tutto in un unico file                  ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  Un avatar pixel art di Claude Code che fa le faccine in      ║
 * ║  base a cosa sta facendo Claude mentre lavora.               ║
 * ║                                                              ║
 * ║  USO:                                                        ║
 * ║    1)  node claude-avatar.js                                 ║
 * ║    2)  apri  http://127.0.0.1:4848  in una finestra          ║
 * ║    3)  installa gli hook (premi il bottone "Setup hook"     ║
 * ║        nella pagina, oppure copia il blocco stampato a       ║
 * ║        terminale in  ~/.claude/settings.json)               ║
 * ║                                                              ║
 * ║  Niente da installare: zero dipendenze, solo Node.js.        ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

const http = require('http');
const PORT = 4848;

const SLEEP_AFTER = 90 * 1000;
const CLAIM_TTL = 12 * 1000;
const VALID = new Set([
  'idle','thinking','working','running',
  'success','error','waiting','done','sleeping'
]);

/* Stato PER-SESSIONE: ogni sessione Claude Code ha il suo avatar.
   sessions: sid -> {state,lastTouch,name}; claims: finestra -> {sid,slot} */
const sessions = new Map();
const claims = new Map();
let lastActive = null;

function setState(s, sid, name){
  const key = sid || '_global';
  if(s === 'bye'){ sessions.delete(key); if(lastActive === key) lastActive = null; return; }
  if(!VALID.has(s)) return;
  const cur = sessions.get(key) || {};
  sessions.set(key, { state: s, lastTouch: Date.now(), name: name || cur.name || '' });
  lastActive = key;
  process.stdout.write(`\r[${new Date().toLocaleTimeString()}] ${key.slice(0,8)} → ${s}            `);
}
function getState(sid){
  const key = sid || lastActive || '_global';
  const rec = sessions.get(key);
  if(!rec) return { state: 'sleeping', name: '' };
  if(rec.state !== 'sleeping' && Date.now() - rec.lastTouch > SLEEP_AFTER && (rec.state === 'idle' || rec.state === 'done'))
    rec.state = 'sleeping';
  return rec;
}
function pruneClaims(){
  const now = Date.now();
  for(const [w, c] of claims) if(now - c.last > CLAIM_TTL) claims.delete(w);
}

/* The hook block we print at startup so the user can paste it.
   Gli hook passano da ~/bin/avatar-hook, che estrae session_id e cwd dallo stdin JSON:
   cosi' ogni sessione Claude Code ha il SUO stato sul server. */
const H = s => ({ type:"command", command:`$HOME/.claude-avatar/avatar-hook ${s}` });
const HOOKS = {
  hooks: {
    UserPromptSubmit: [{ hooks: [H('thinking')] }],
    PreToolUse: [
      { matcher:"Edit|Write|MultiEdit|NotebookEdit", hooks:[H('working')] },
      { matcher:"Bash", hooks:[H('running')] },
      { matcher:"Read|Grep|Glob|WebFetch|WebSearch", hooks:[H('thinking')] }
    ],
    PostToolUse: [
      { matcher:"Bash", hooks:[H('bashresult')] }
    ],
    Notification: [{ hooks:[H('waiting')] }],
    Stop: [{ hooks:[H('done')] }],
    SessionEnd: [{ hooks:[H('bye')] }]
  }
};

/* ============================ THE PAGE ============================ */
const PAGE = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Claude Code Avatar</title>
<script>window.onerror=function(m,s,l,c){try{fetch('/log?m='+encodeURIComponent(m+' @'+l+':'+c))}catch(e){}};</script>
<style>
  :root{ --bg:#09090b; --skin:#d87756; }
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{height:100%}
  body{
    background:var(--bg);color:#e8e3da;
    font-family:ui-monospace,"SF Mono",Menlo,monospace;
    display:flex;align-items:center;justify-content:center;flex-direction:column;
    gap:24px;overflow:hidden;user-select:none;-webkit-app-region:drag;
  }
  #stage{width:340px;height:340px;display:flex;align-items:center;justify-content:center;position:relative}
  #tag{position:absolute;bottom:4%;left:0;right:0;text-align:center;font-size:11px;color:#6b6359;letter-spacing:.08em;display:none;z-index:2;pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 8%}
  #stage::before{
    content:"";position:absolute;inset:18%;border-radius:40px;
    background:var(--state-color,transparent);filter:blur(60px);opacity:.22;
    transition:background .5s ease,opacity .5s ease;z-index:0;
  }
  canvas{position:relative;z-index:1;image-rendering:pixelated}
  #label{font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#8c857a;display:flex;align-items:center;gap:10px;transition:color .4s}
  #label .dot{width:7px;height:7px;border-radius:50%;background:var(--state-color,#8c857a);box-shadow:0 0 10px var(--state-color,#8c857a);transition:all .4s}
  #sub{font-size:11px;color:#55504a;letter-spacing:.05em;max-width:300px;text-align:center;height:14px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
  #demo{position:fixed;bottom:14px;left:50%;transform:translateX(-50%);display:flex;gap:6px;flex-wrap:wrap;justify-content:center;max-width:90vw;-webkit-app-region:no-drag}
  #demo button{background:#17171a;border:1px solid #2a2a2e;color:#9c958a;font-family:inherit;font-size:10px;letter-spacing:.06em;padding:6px 9px;border-radius:7px;cursor:pointer;text-transform:uppercase;transition:all .15s}
  #demo button:hover{border-color:var(--skin);color:var(--skin)}
  #demo button.active{background:var(--skin);color:#0a0a0b;border-color:var(--skin)}
  #conn{position:fixed;top:12px;right:14px;font-size:10px;letter-spacing:.08em;color:#55504a;-webkit-app-region:no-drag}
  #conn b{color:#7fb069}
  @media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
  /* finestra mini (~6x6cm): avatar scalato, niente bottoni demo */
  /* finestra mini (~6x6cm): solo Clawd su card nera arrotondata, niente scritte ne' glow */
  @media (max-width:420px),(max-height:420px){
    html,body{background:transparent}
    body{gap:0}
    #stage{width:100vmin;height:100vmin;background:var(--bg);border-radius:26px}
    #stage::before{display:none}
    canvas{width:92%;height:92%}
    #demo,#conn,#sub,#label{display:none}
  }
</style>
</head>
<body>
  <div id="conn">● <span id="conn状态">demo</span></div>
  <div id="stage" data-tauri-drag-region><canvas id="c" width="340" height="340" data-tauri-drag-region></canvas><div id="tag"></div></div>
  <div id="label"><span class="dot"></span><span id="state-name">idle</span></div>
  <div id="sub"></div>
  <div id="demo"></div>
<script>
const cvs=document.getElementById('c'),ctx=cvs.getContext('2d');
/* Clawd pixel-perfect (estratto dal PNG ufficiale Anthropic: griglia 16x10, corpo 12x8,
   occhi = buchi trasparenti 1x2 a col 4/11, 4 gambe 1x2, #d87756, nessuna bocca).
   Le scene di contorno (tastiera, terminale, coriandoli, fumetti...) sono artwork
   originale nostro — concetti ispirati ai desktop pet ma disegno indipendente. */
const UW=16,UH=10,PAD=36;
const U=(cvs.width-PAD*2)/UW, OX=PAD, OY=(cvs.height-(UH+1)*U)/2;
const COL={skin:'#d87756',ok:'#7fb069',err:'#e05a4d',think:'#d9a441',wait:'#5b8fb0',
  key:'#8b97a3',keyDark:'#5b646e',screen:'#16161b',dim:'#3c4754',txt:'#9c958a'};
const STATES={
  idle:{color:null,name:'idle',sub:'in attesa di lavoro',face:'neutral',legs:'stand',bob:.5},
  thinking:{color:COL.think,name:'thinking',sub:'sto ragionando…',face:'look',legs:'stand',bob:.9,wob:true},
  working:{color:COL.skin,name:'working',sub:'sto scrivendo codice',face:'focus',legs:'walk',bob:1.6},
  running:{color:COL.wait,name:'running',sub:'eseguo un comando',face:'focus',legs:'walk',bob:2.2},
  success:{color:COL.ok,name:'success',sub:'fatto! test verdi 🎉',face:'happy',legs:'jump',bob:0,pop:true},
  error:{color:COL.err,name:'error',sub:'qualcosa è andato storto',face:'shock',legs:'stand',bob:0,shake:true},
  waiting:{color:COL.wait,name:'waiting',sub:'aspetto una tua risposta 👀',face:'blinkwait',legs:'stand',bob:.6},
  done:{color:COL.ok,name:'done',sub:'turno completato',face:'content',legs:'stand',bob:.4},
  sleeping:{color:null,name:'sleeping',sub:'zzz…',face:'sleep',legs:'sit',bob:.2,zzz:true},
};
let current='idle',t=0,blink=0,stateStart=0;
function setState(s){if(!STATES[s])return;current=s;stateStart=t;const st=STATES[s];
  document.documentElement.style.setProperty('--state-color',st.color||'#3a3a3e');
  document.getElementById('state-name').textContent=st.name;
  document.getElementById('sub').textContent=st.sub;
  document.querySelectorAll('#demo button').forEach(b=>b.classList.toggle('active',b.dataset.s===s));}
/* --- Clawd --- */
function ru(x,y,w,h,c){ctx.fillStyle=c||COL.skin;ctx.fillRect(OX+x*U,OY+y*U,w*U+.5,h*U+.5);}
function hole(x,y,w,h){ctx.clearRect(OX+x*U-.25,OY+y*U-.25,w*U+.5,h*U+.5);}
function drawBody(){ru(2,0,12,8);ru(0,4,2,2);ru(14,4,2,2);}
function drawLegs(mode,phase){if(mode==='sit')return;const L=[3,5,10,12];
  L.forEach((lx,i)=>{let len=2;
    if(mode==='walk')len=(Math.floor(phase)+i)%2===0?2:1.2;
    else if(mode==='jump')len=2.4;
    ru(lx,8,1,len);});}
/* occhi: buchi 1x2 a col 4/11 riga 2, sempre pieni come idle (tranne occhi chiusi) */
function drawFace(f){const L=4,R=11,Y=2;switch(f){
  case'neutral':case'focus':case'content':hole(L,Y,1,2);hole(R,Y,1,2);break;
  case'look':{const s=Math.sin(t*0.04)>0?.6:-.6;hole(L+s,Y-.3,1,2);hole(R+s,Y-.3,1,2);}break;
  case'happy':hole(L,Y-.4,1,2);hole(R,Y-.4,1,2);break;
  case'shock':hole(L,Y-.5,1.2,3);hole(R-.2,Y-.5,1.2,3);break;
  case'sleep':hole(L,Y+1.4,1,.45);hole(R,Y+1.4,1,.45);break;
  case'blinkwait':{const s=Math.sin(t*0.05)>0?.7:-.7;hole(L+s,Y,1,2);hole(R+s,Y,1,2);}break;}}
/* --- Scene di contorno (artwork originale) --- */
function scThinking(){for(let i=0;i<3;i++){const ph=Math.sin(t*0.07-i*0.9);
  ctx.globalAlpha=.3+.5*Math.max(0,ph);ru(12.6+i*1.4,-1.4-i*1.2,.55+i*.3,.55+i*.3,COL.txt);}
  ctx.globalAlpha=1;}
function drawKeyboard(){
  ru(1.2,10.7,13.6,1.5,COL.keyDark);                                   // tastiera
  for(let r=0;r<2;r++)for(let k=0;k<9;k++){const lit=Math.floor(t/6)%18===r*9+k;
    ru(1.55+k*1.47,10.9+r*.68,1.12,.48,lit?'#cfd8e0':COL.key);}}
function scTyping(){
  drawKeyboard();
  ru(11.2,-4.5,6.4,3.5,COL.screen);                                    // editor
  const wmax=[3.6,2.4,4.4],cols=[COL.ok,COL.wait,COL.think];
  for(let i=0;i<3;i++){const w=Math.min(wmax[i],Math.max(0,((t*0.07)%7)-i*1.4));
    if(w>0)ru(11.7,-4+i*.95,w,.45,cols[i]);}}
function scRunning(){
  drawKeyboard();
  ru(10.6,-4.6,7,3.6,COL.screen);                                      // terminale
  for(let i=0;i<3;i++){if((t*0.05)%4>i+1){ru(11.1,-4.1+i*.95,.5,.45,COL.ok);
    ru(11.8,-4.1+i*.95,2+((i*37)%20)/10,.45,COL.dim);}}
  if(Math.floor(t/18)%2===0)ru(11.1,-1.3,.6,.2,COL.ok);}               // cursore
function scSuccess(){const CONF=[[2,-3,COL.ok],[5,-4.5,COL.think],[8,-3.8,COL.wait],
  [11,-4.6,COL.err],[14,-3.2,COL.skin],[3.5,-1.8,COL.wait],[12.5,-2,COL.ok],
  [6.5,-2.6,COL.err],[9.5,-1.6,COL.think],[.8,-4,COL.skin]];
  CONF.forEach(([x,y,c],i)=>{const yy=y+((t-stateStart)*0.06+i*.4)%9;
    ctx.globalAlpha=.9;ru(x+Math.sin(t*0.05+i)*.4,yy,.45,.45,c);});ctx.globalAlpha=1;}
function scError(){const b=Math.sin(t*0.15)*.2;
  ru(14.5,-4.4+b,1,2.1,COL.err);ru(14.5,-1.7+b,1,.8,COL.err);}         // !
function scWaiting(){
  ru(11.6,-4.7,5.6,3,'#1d1d22');ru(12.4,-1.7,1,.9,'#1d1d22');          // fumetto
  for(let i=0;i<3;i++){const on=Math.floor(t/12)%3===i;
    ru(12.7+i*1.4,-3.5,.8,.8,on?'#e8e3da':'#55504a');}}
function scDone(){for(let i=0;i<5;i++){const xs=[13,13.7,14.4,15.1,15.8],ys=[-2.4,-1.7,-2.4,-3.1,-3.8];
  ru(xs[i],ys[i],.7,.7,COL.ok);}}                                      // spunta
const SCENE={thinking:scThinking,working:scTyping,running:scRunning,success:scSuccess,
  error:scError,waiting:scWaiting,done:scDone};
function drawZ(){ctx.fillStyle='#6b6359';ctx.font=U*1.8+'px ui-monospace,monospace';
  const zx=OX+14.4*U,zy=OY+(0.6+Math.sin(t*0.06)*.4)*U;ctx.fillText('z',zx,zy);
  ctx.font=U*1.2+'px ui-monospace,monospace';ctx.fillText('z',zx+U*1.3,zy-U*1.3);}
function frame(){t++;const st=STATES[current];ctx.clearRect(0,0,cvs.width,cvs.height);ctx.save();
  let dx=0,dy=0,rot=0;dy+=Math.sin(t*0.08*(st.bob||1))*(st.bob?st.bob*1.4:0);
  if(st.wob)rot=Math.sin(t*0.06)*0.04;
  if(st.shake){const d=Math.max(0,1-(t-stateStart)/40);dx+=(Math.random()-.5)*10*d;}
  let scale=1;if(st.pop){const p=Math.max(0,1-(t-stateStart)/22);scale=1+p*0.18;}
  if(st.legs==='jump')dy+=Math.abs(Math.sin(t*0.18))*-12;
  if(st.legs==='sit')dy+=U*1.2;
  ctx.translate(cvs.width/2+dx,cvs.height/2+dy);ctx.rotate(rot);ctx.scale(scale,scale);ctx.translate(-cvs.width/2,-cvs.height/2);
  drawBody();drawLegs(st.legs,t*0.12);
  blink=(blink+1)%220;const bl=blink>214&&st.face!=='sleep'&&st.face!=='happy';
  if(!bl)drawFace(st.face);else{hole(4,3.5,1,.45);hole(11,3.5,1,.45);}
  ctx.restore();
  if(SCENE[current])SCENE[current]();
  if(st.zzz)drawZ();requestAnimationFrame(frame);}
const demo=document.getElementById('demo');
Object.keys(STATES).forEach(s=>{const b=document.createElement('button');b.textContent=s;b.dataset.s=s;b.onclick=()=>setState(s);demo.appendChild(b);});
const connEl=document.getElementById('conn状态'),tagEl=document.getElementById('tag');
/* multi-finestra: in Tauri il lato Rust reclama la sessione e ce la passa via window.__SESSION__ */
let sid='',winId='';
async function poll(){try{
  if(!sid&&window.__SESSION__){
    sid=window.__SESSION__;winId=window.__WIN__||'';
    if(window.__LABEL__){tagEl.textContent=window.__LABEL__;tagEl.style.display='block';}
  }
  const q=sid?('?session='+encodeURIComponent(sid)+'&win='+encodeURIComponent(winId)):'';
  const r=await fetch('/state'+q,{cache:'no-store'});if(r.ok){const j=await r.json();
  connEl.innerHTML='<b>live</b>';connEl.parentElement.firstChild.nodeValue='● ';
  if(j.label&&tagEl.textContent!==j.label){tagEl.textContent=j.label;tagEl.style.display='block';}
  if(j.state&&j.state!==current)setState(j.state);}}catch(e){connEl.textContent='demo';}}
setInterval(poll,600);
setState('idle');frame();
</script>
</body>
</html>`;

/* ============================ THE SERVER ============================ */
const server = http.createServer((req,res)=>{
  const u=new URL(req.url,`http://${req.headers.host}`);
  res.setHeader('Access-Control-Allow-Origin','*');
  if(u.pathname==='/set'){
    setState(u.searchParams.get('state')||'idle', u.searchParams.get('session')||'', u.searchParams.get('cwd')||'');
    res.writeHead(200); return res.end('ok');
  }
  if(u.pathname==='/state'){
    const win = u.searchParams.get('win');
    if(win && claims.has(win)) claims.get(win).last = Date.now();
    const rec = getState(u.searchParams.get('session'));
    res.writeHead(200,{'Content-Type':'application/json'});
    return res.end(JSON.stringify({state:rec.state, label:rec.name||''}));
  }
  if(u.pathname==='/claim'){
    /* una finestra nuova si aggancia alla sessione attiva piu' recente e riceve uno slot di impilamento */
    pruneClaims();
    const win = u.searchParams.get('win') || ('w'+Math.random().toString(36).slice(2));
    const claimed = new Set([...claims.values()].map(c=>c.sid));
    /* preferisci la sessione attiva se libera, poi la piu' recente non reclamata, altrimenti duplica l'attiva */
    let sid = (lastActive && sessions.has(lastActive) && !claimed.has(lastActive)) ? lastActive : null;
    if(!sid){
      let best=null, bt=0;
      for(const [k,v] of sessions){ if(!claimed.has(k) && v.lastTouch>bt){ bt=v.lastTouch; best=k; } }
      sid = best;
    }
    if(!sid) sid = lastActive;
    const used = new Set([...claims.values()].map(c=>c.slot));
    let slot = 0; while(used.has(slot)) slot++;
    claims.set(win, { sid, slot, last: Date.now() });
    const rec = sid ? sessions.get(sid) : null;
    res.writeHead(200,{'Content-Type':'application/json'});
    return res.end(JSON.stringify({ session: sid||'', label: rec ? (rec.name||'') : '', slot }));
  }
  if(u.pathname==='/hooks'){ res.writeHead(200,{'Content-Type':'application/json'}); return res.end(JSON.stringify(HOOKS,null,2)); }
  if(u.pathname==='/log'){
    console.log(`\n[JS] ${u.searchParams.get('m')||''}`);
    res.writeHead(200); return res.end('ok');
  }
  if(u.pathname==='/favicon.ico'){ res.writeHead(204); return res.end(); }
  if(u.pathname==='/'||u.pathname==='/index.html'){ res.writeHead(200,{'Content-Type':'text/html'}); return res.end(PAGE); }
  res.writeHead(404); res.end('not found');
});

server.listen(PORT,'127.0.0.1',()=>{
  const line='─'.repeat(58);
  console.log(`\n┌${line}┐`);
  console.log(`│  CLAUDE CODE AVATAR  🟧                                   │`);
  console.log(`└${line}┘`);
  console.log(`\n  1) Apri l'avatar:   http://127.0.0.1:${PORT}`);
  console.log(`     (su Mac: aprilo in Chrome → ⋮ → "Aggiungi a schermata`);
  console.log(`      Home / Crea scorciatoia → Apri come finestra")`);
  console.log(`\n  2) Incolla questo blocco "hooks" in ~/.claude/settings.json`);
  console.log(`     (oppure scaricalo da  http://127.0.0.1:${PORT}/hooks ):\n`);
  console.log(JSON.stringify(HOOKS,null,2).split('\n').map(l=>'     '+l).join('\n'));
  console.log(`\n  3) Usa  claude  normalmente e guarda l'avatar reagire.\n`);
  console.log(`  Stati: thinking · working · running · success · error ·`);
  console.log(`         waiting · done · sleeping\n`);
  console.log(`  In ascolto…  (Ctrl+C per fermare)\n`);
});
