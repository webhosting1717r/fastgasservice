/* Fastgas Service NL homepage engine (moved out of index.html in v41e). Patches target this file. v51: still first shot, engine wakes on input. */
(function(){
'use strict';
const hero=document.getElementById('hero'), stage=document.getElementById('stage'), video=document.getElementById('video'), canvas=document.getElementById('canvas'), poster=document.getElementById('poster'), ring=document.getElementById('ring'), bar=document.getElementById('progressBar');
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
/* One timeline, 35.9 s: intro, intro reversed at 1.6x, dissolve, transition to the underground, fade, world. Desktop scrubs the video; phones scrub a 12 fps frame set cut from the same portrait master (1080 px wide for the intro, 720 px for the rest, whose sources hold no more detail). */
const VIDEO_URL='assets/journey-scrub.mp4', VIDEO_BYTES=47898083, VIDEO_DURATION=35.8750;
const FRAME_COUNT=431;
const SEG1_FRAMES=192; const SEG1_T=16.0, FPS1=12, FPS2=12; /* first 16 s at 24 fps, rest at 12 fps (frames-v3.js keeps these counts in sync) */
const frameIndex=p=>{ const t=p*VIDEO_DURATION; const f=t<SEG1_T?t*FPS1:SEG1_FRAMES+(t-SEG1_T)*FPS2; return Math.min(FRAME_COUNT-1,Math.max(0,f)); };
let frameDir='assets/frames-webp', frameExt='.webp';
const frameSrc=i=>frameDir+'/p_'+String(i+1).padStart(3,'0')+frameExt;
requestAnimationFrame(()=>document.body.classList.add('ready'));
/* Debug counters for the self-test harness (harmless in production) */
const stats=window.__fg={draws:0,blends:0,misses:0,decodes:0,decodeMs:0,longFrames:0,frames:0};

/* ---------- v51: no intro overlay. The page opens on the still first shot with the intro text, header and contact buttons already in place; the footage engine wakes on the first input, or a few seconds after load on a good connection ---------- */
let posterReady=true;
document.body.classList.add('intro-done');
let awake=false, pendingStart=null;
const whenAwake=fn=>{ if(awake)fn(); else pendingStart=fn; };
function wakeEngine(){ if(awake)return; awake=true; document.documentElement.classList.add('fg-go'); const f=pendingStart; pendingStart=null; if(f)f(); }
['wheel','touchstart','pointerdown','pointermove','keydown','scroll'].forEach(ev=>addEventListener(ev,wakeEngine,{passive:true,once:true}));
(function(){ const con=navigator.connection||{}; const saver=!!con.saveData||/(^|\b)(slow-2g|2g|3g)$/.test(con.effectiveType||'');
  const later=()=>{ if(!saver)setTimeout(()=>{ if(!document.hidden)wakeEngine(); },8000); };
  if(document.readyState==='complete')later(); else addEventListener('load',later,{once:true}); })();

/* ---------- Engine choice: phones and portrait touch devices draw a frame sequence on a canvas; everything else scrubs the video ---------- */
const FRAMES_MQ=['(max-width: 720px) and (orientation: portrait)','(orientation: portrait) and (pointer: coarse)'].map(q=>matchMedia(q));
const useFrames=()=>FRAMES_MQ.some(m=>m.matches);
/* Every iOS browser is WebKit, where createImageBitmap decodes on the main thread; there an <img> with decode() is decoded on a background thread instead. Chromium decodes createImageBitmap off-thread. */
const ua=navigator.userAgent, isWebKit=/\b(iPhone|iPad|iPod)\b/.test(ua)||(/AppleWebKit/.test(ua)&&/Safari/.test(ua)&&!/Chrome|Chromium|CriOS|Android|Edg|OPR|SamsungBrowser/.test(ua))||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1);
const USE_BITMAP=!isWebKit&&typeof createImageBitmap==='function';

/* ---------- Scroll progress: polled every animation frame (Safari's scroll events are not frame-aligned), eased with a short time constant, resting when converged ---------- */
let target=0, shown=0, rafId=null, lastTick=0, heroOnScreen=true, mode='', lastBar=-1, range=1, idleTicks=0;
let heroTop=0;
function measure(){ range=Math.max(1,hero.offsetHeight-stage.clientHeight); heroTop=hero.offsetTop; }   /* both heights are lvh-based, so this does not move when the phone toolbar collapses */
const progress=()=>clamp(-hero.getBoundingClientRect().top/range,0,1);
const EASE=0.30;   /* per 60 fps frame: time constant about 45 ms, enough to smooth the scroll-event cadence without floating behind a thumb */
function tick(now){
  const dt=lastTick?Math.min(100,now-lastTick):16.667; lastTick=now;
  if(dt>34)stats.longFrames++; stats.frames++;
  target=progress();
  shown+=(target-shown)*(1-Math.pow(1-EASE,dt/16.667));
  if(Math.abs(target-shown)<0.00025){shown=target;idleTicks++}else idleTicks=0;
  render(shown);
  if(idleTicks>3&&!needsDraw){rafId=null;lastTick=0;idleTicks=0} else rafId=requestAnimationFrame(tick);
}
let needsDraw=false;
function wake(){ if(rafId===null&&heroOnScreen){lastTick=0;rafId=requestAnimationFrame(tick)} }
function onScroll(){ if(!stage.classList.contains('scrolled')&&scrollY>heroTop+range*0.02)stage.classList.add('scrolled'); wake(); }
new IntersectionObserver(e=>{heroOnScreen=e[0].isIntersecting;if(heroOnScreen)wake()},{threshold:0}).observe(hero);
addEventListener('scroll',onScroll,{passive:true});
addEventListener('pageshow',e=>{if(e.persisted){measure();target=shown=progress();wake()}});
const CHNAMES=['Het magazijn','De Fastgas tank','Onderdelen','Klaar voor bezorging','Uit het magazijn','Onderweg','Bezorggebied']; /* v44 */
const rail=document.getElementById('rail'), teleName=document.getElementById('teleName'), teleScene=document.getElementById('teleScene'), teleTime=document.getElementById('teleTime'), telePct=document.getElementById('telePct');
let teleAt=0, teleLast='';
const SCENES=[0,0.13,0.232,0.315,0.44,0.58,0.875];
function telemetry(p,now){
  const rp=Math.round(p*1000)/10; if(rp!==lastBar){lastBar=rp;rail.style.setProperty('--rp',rp+'%')}
  if(now-teleAt<100)return; teleAt=now;
  let sc=1; for(let i=0;i<SCENES.length;i++) if(p>=SCENES[i]) sc=i+1;
  const s='SCN 0'+sc+'/07|T+'+(p*VIDEO_DURATION).toFixed(1).padStart(4,'0')+'S|'+String(Math.round(p*100)).padStart(3,'0')+'%';
  if(s===teleLast)return; teleLast=s; const parts=s.split('|'); teleScene.textContent=parts[0]; teleTime.textContent=parts[1]; telePct.textContent=parts[2]; if(teleName.dataset.text!==CHNAMES[sc-1]){teleName.textContent=CHNAMES[sc-1]; teleName.dataset.text=CHNAMES[sc-1]; teleName.dataset.decoded=''; decode(teleName);}
}
/* Chapters in footage seconds; w = scroll weight (more scroll per second of footage), hold = extra scroll on the last frame of the chapter. Cumulative table built once. */
const CHAPTERS=[{t0:0,t1:6.0,w:1.0},{t0:6.0,t1:8.8,w:1.45},{t0:8.8,t1:10.04,w:1.2,hold:0.9},{t0:10.04,t1:16.0,w:0.62},{t0:16.0,t1:20.84,w:0.85},{t0:20.84,t1:30.5,w:1.0},{t0:30.5,t1:35.875,w:1.35,hold:2.6}];
const PACE=(()=>{ const rows=[]; let acc=0; for(const c of CHAPTERS){ const len=(c.t1-c.t0)*c.w; rows.push({t0:c.t0,t1:c.t1,s0:acc,s1:acc+len}); acc+=len; if(c.hold){ rows.push({t0:c.t1,t1:c.t1,s0:acc,s1:acc+c.hold}); acc+=c.hold; } } for(const r of rows){ r.s0/=acc; r.s1/=acc; } return rows; })();
const smooth01=t=>t*t*(3-2*t);
function paceMap(p){ /* scroll progress -> footage progress (0..1), eased inside each chapter so speed changes never kink */
  for(const r of PACE){ if(p<=r.s1||r===PACE[PACE.length-1]){ const u=r.s1>r.s0?clamp((p-r.s0)/(r.s1-r.s0),0,1):1; const e=u+(smooth01(u)-u)*0.35; return (r.t0+(r.t1-r.t0)*e)/VIDEO_DURATION; } } return 1; }
const endfade=document.getElementById('endfade'); let lastEnd=-1;
function render(ps){
  let p=paceMap(ps); if(p>0.992)p=1;   /* the last chapter rests on its final frame, so the map hologram always matches the footage */
  const ef=Math.round(clamp((ps-0.988)/0.012,0,1)*20)/20; if(ef!==lastEnd){lastEnd=ef;endfade.style.opacity=ef}
  telemetry(p,performance.now());
  updateBands(p);
  if(mode==='frames') drawFrame(p); else { needsDraw=false; if(mode==='video') requestSeek(p*(video.duration||VIDEO_DURATION)); }
}

/* ---------- Caption bands: smoothstep opacity at both edges, --k settles early in the band; DOM touched only on change ---------- */
let band1Floor=1;
const smoothstep=(p,e0,e1)=>{const t=clamp((p-e0)/(e1-e0),0,1);return t*t*(3-2*t)};
const bands=Array.from(document.querySelectorAll('.band')).map(el=>({el,a:+el.dataset.a,b:+el.dataset.b,first:'first' in el.dataset,last:'last' in el.dataset,cta:'cta' in el.dataset,o:-1,k:-1,on:el.classList.contains('on')}));
function updateBands(p){
  for(const bd of bands){
    const f=Math.min(0.02,(bd.b-bd.a)/3);
    const o=Math.round(100*(bd.first?1:smoothstep(p,bd.a,bd.a+f))*(bd.last?1:(1-smoothstep(p,bd.b-f,bd.b))))/100;
    let k=Math.round(100*clamp((p-bd.a)/Math.min(0.045,(bd.b-bd.a)*0.4),0,1))/100; if(bd.first)k=Math.max(k,band1Floor);
    const on=o>0;
    if(on!==bd.on){bd.on=on;bd.el.classList.toggle('on',on); if(on){const kk=bd.el.querySelector('.kicker'); if(kk)decode(kk);} }
    if(o!==bd.o){bd.o=o;bd.el.style.opacity=o;if(bd.cta)bd.el.classList.toggle('cta-live',o>0.5)}
    if(k!==bd.k&&on){bd.k=k;bd.el.style.setProperty('--k',k)}
  }
}
updateBands(0);
/* ---------- Holographic layers: fit the hotspot plane to the footage (cover fit) and drive them like bands ---------- */
const holos=Array.from(document.querySelectorAll('.holo')).map(el=>({el,fit:el.querySelector('.fit'),a:+el.dataset.a,b:+el.dataset.b,first:false,last:'last' in el.dataset,cta:true,o:-1,k:-1,on:false}));
bands.push(...holos);
function fitHolos(){ const W=stage.clientWidth,H=stage.clientHeight; const ar=useFrames()?1080/2336:1920/1080; const h=Math.max(H,W/ar), w=h*ar; for(const x of holos){ x.fit.style.width=w+'px'; x.fit.style.height=h+'px'; x.fit.style.left=((W-w)/2)+'px'; x.fit.style.top=((H-h)/2)+'px'; } }
fitHolos(); addEventListener('resize',fitHolos,{passive:true}); FRAMES_MQ.forEach(m=>m.addEventListener('change',fitHolos));
document.querySelectorAll('.hs').forEach(b=>{ b.setAttribute('aria-label',(b.querySelector('.nm').dataset.name||b.querySelector('.nm').textContent)+': '+b.querySelector('.ds').textContent); b.addEventListener('click',e=>{ e.preventDefault(); const on=b.classList.contains('active'); document.querySelectorAll('.hs.active').forEach(x=>x.classList.remove('active')); if(!on)b.classList.add('active'); }); });

/* ---------- Pointer light on desktop, decode effect on kickers ---------- */
if(matchMedia('(pointer:fine)').matches){
  const glow=document.getElementById('glow'); let gx=0,gy=0,gp=false;
  stage.addEventListener('pointermove',e=>{ const r=stage.getBoundingClientRect(); gx=e.clientX-r.left; gy=e.clientY-r.top; if(!gp){gp=true;requestAnimationFrame(()=>{gp=false;glow.style.setProperty('--mx',gx+'px');glow.style.setProperty('--my',gy+'px')})} stage.classList.add('pointer'); },{passive:true});
  stage.addEventListener('pointerleave',()=>stage.classList.remove('pointer'));
}
const GLYPHS='ABCDEFGHKLMNPRSTUVXYZ0123456789<>/\\|=';
function decode(el){
  if(reduce.matches||el.dataset.decoded||el.children.length)return; el.dataset.decoded='1';
  const text=el.dataset.text||(el.dataset.text=el.textContent); const t0=performance.now(), dur=620;
  const step=now=>{ const t=clamp((now-t0)/dur,0,1); const n=Math.floor(t*text.length); let out='';
    for(let i=0;i<text.length;i++){ const ch=text[i]; out+= i<n||ch===' '?ch:GLYPHS[Math.floor(Math.random()*GLYPHS.length)]; }
    el.textContent=out; if(t<1)requestAnimationFrame(step); else el.textContent=text; };
  requestAnimationFrame(step);
}
/* ---------- Loading ring ---------- */
let ringLast=0;
let loadFrac=0; const loader=document.getElementById('loader'), introLine=document.querySelector('.intro-line');
function ringSet(frac,now){ loadFrac=Math.max(loadFrac,frac); if(now-ringLast>100||frac>=1){ringLast=now;ring.style.setProperty('--ld',Math.round(126*(1-frac))); if(loader){ const pv=(0.08+0.92*Math.min(1,loadFrac)).toFixed(3); loader.style.setProperty('--p',pv); introLine.style.setProperty('--p',Math.min(1,loadFrac).toFixed(3)); } } if(frac>=1)ring.classList.add('done'); }

/* ---------- Engine A: video scrub (desktop, landscape tablets) ---------- */
let videoInit=false, seekBusy=false, pendingTime=null, videoReady=false, lastSeek=-1;
function requestSeek(t){ if(!videoReady||!isFinite(t))return; if(Math.abs(t-lastSeek)<0.004)return; if(seekBusy){pendingTime=t;return} seekBusy=true; lastSeek=t; video.currentTime=t; }
video.addEventListener('seeked',()=>{seekBusy=false;if(pendingTime!==null){const t=pendingTime;pendingTime=null;requestSeek(t)}});
video.addEventListener('error',()=>{seekBusy=false;pendingTime=null;ring.classList.add('done')});
async function initVideo(){
  if(videoInit)return; videoInit=true;
  /* v37b: stream the file (the host answers range requests), so the first frame is live after the first few hundred KB and a
     seek into an unbuffered part fetches only that part. Loader shows the buffered share. */
  try{
    const onProg=()=>{ try{ const b=video.buffered, d=video.duration||VIDEO_DURATION; let e=0; for(let i=0;i<b.length;i++)e=Math.max(e,b.end(i)); ringSet(Math.min(1,e/d),performance.now()); }catch(e){} };
    video.addEventListener('progress',onProg);
    video.preload='auto'; video.src=VIDEO_URL; video.load();
    await new Promise((res,rej)=>{video.addEventListener('loadedmetadata',res,{once:true});video.addEventListener('error',rej,{once:true})});
    videoReady=true; onProg();
    video.addEventListener('seeked',()=>{if(mode==='video')stage.classList.add('live')},{once:true});
    lastSeek=-1; requestSeek(progress()*video.duration);
  }catch(e){ ring.classList.add('done'); }
}

/* ---------- Engine B: frame sequence on a canvas (phones) ----------
   Every frame is fetched once as a Blob (encoded, small). Only a sliding window around the scroll position is decoded, ahead in
   the direction of travel, so drawing never decodes on the main thread and memory stays bounded. Between two frames the canvas
   blends them by the fractional position, so a slow drag moves continuously instead of stepping. */
const ctx=canvas.getContext('2d',{alpha:false,desynchronized:true});
const blobs=new Array(FRAME_COUNT), decoded=new Map(), pending=new Set();
let fullLoad=false, fetchLo=1, fetchHi=0, fetchDir=1, openFull=()=>{};
function prioritiseFrames(pa,pb){ const a=frameIndex(paceMap(pa)), b=frameIndex(paceMap(pb)); fetchLo=Math.floor(Math.min(a,b)); fetchHi=Math.ceil(Math.max(a,b)); fetchDir=b>=a?1:-1; if(window.__pumpFrames)window.__pumpFrames(); }
let framesInit=false, loadedCount=0, cw=0, ch=0, dpr=1, lastKey='', lastDir=1, inflight=0, lastF=0, winLo=0, winHi=0;
let MAX_INFLIGHT=3, WIN_AHEAD=10, WIN_BACK=4, gliding=false;   /* 15 decoded frames at most: about 150 MB at 1080x2336, half that for 720 px frames */
function sizeCanvas(){
  const w=stage.clientWidth, h=stage.clientHeight; dpr=Math.min(1.5,devicePixelRatio||1,1080/Math.max(1,w));   /* v57: a 1.5x canvas is all a 12 fps frame set needs, and it halves the fill cost on phones */
  if(w===cw&&h===ch)return; cw=w; ch=h; canvas.width=Math.round(w*dpr); canvas.height=Math.round(h*dpr); lastKey=''; try{ctx.imageSmoothingQuality=(dpr>=2&&w*dpr<=1300)?'medium':'high'}catch(e){}
}
const dw=d=>d.naturalWidth||d.width, dh=d=>d.naturalHeight||d.height;
function drawCover(d){ const W=canvas.width,H=canvas.height, s=Math.max(W/dw(d),H/dh(d)), w=dw(d)*s, h=dh(d)*s; ctx.drawImage(d,(W-w)/2,(H-h)/2,w,h); }
function nearestDecoded(i){ let best=null,bd=1e9; for(const k of decoded.keys()){const d=Math.abs(k-i); if(d<bd){bd=d;best=k}} return best; }
/* v58: frames are decoded no larger than the canvas needs (cover fit). Chromium resizes while decoding off-thread; WebKit decodes the image on a background thread and we keep a canvas-sized copy instead of the full-size image. */
function frameDims(i){ return i<SEG1_FRAMES?[1080,2336]:[720,1558]; }
function targetSize(i){ if(!cw)sizeCanvas(); const [dw,dh]=frameDims(i); const s=Math.max(canvas.width/dw,canvas.height/dh); return s<0.9?[Math.round(dw*s),Math.round(dh*s)]:null; }
function makeDrawable(i){
  const blob=blobs[i]; const t0=performance.now(); const ts=targetSize(i);
  if(USE_BITMAP) return createImageBitmap(blob).then(b=>{stats.decodeMs+=performance.now()-t0;stats.decodes++;return b});   /* Chromium decodes off-thread at full size; resizing there costs main-thread time */
  const url=URL.createObjectURL(blob); const img=new Image(); img.decoding='async'; img.src=url;
  return img.decode().then(()=>{ URL.revokeObjectURL(url); stats.decodeMs+=performance.now()-t0; stats.decodes++; if(!ts)return img; const c=document.createElement('canvas'); c.width=ts[0]; c.height=ts[1]; c.getContext('2d').drawImage(img,0,0,ts[0],ts[1]); return c; },e=>{URL.revokeObjectURL(url);throw e});
}
function release(i){ const d=decoded.get(i); if(!d)return; decoded.delete(i); if(d.close)d.close(); else if(d.getContext){d.width=0;d.height=0;} }
function ensureWindow(f){
  const c=Math.round(f), dir=f>lastF+1e-6?1:f<lastF-1e-6?-1:lastDir; lastF=f; lastDir=dir;
  winLo=clamp(c-(dir>0?WIN_BACK:WIN_AHEAD),0,FRAME_COUNT-1); winHi=clamp(c+(dir>0?WIN_AHEAD:WIN_BACK),0,FRAME_COUNT-1);
  for(const k of Array.from(decoded.keys())) if(k<winLo||k>winHi) release(k);
  for(let k=0;k<=WIN_AHEAD&&inflight<MAX_INFLIGHT;k++){
    for(const i of (k?[c+k*dir,c-k*dir]:[c])){
      if(i<winLo||i>winHi||!blobs[i]||decoded.has(i)||pending.has(i))continue;
      pending.add(i); inflight++;
      makeDrawable(i).then(d=>{ pending.delete(i); inflight--; if(i>=winLo&&i<=winHi&&mode==='frames'){decoded.set(i,d); needsDraw=true; wake();} else if(d.close)d.close(); if(mode==='frames')ensureWindow(lastF); },
        ()=>{ pending.delete(i); inflight--; });
      if(inflight>=MAX_INFLIGHT)break;
    }
  }
}
function drawFrame(p){
  sizeCanvas(); needsDraw=false;
  const f=frameIndex(p), i0=Math.floor(f), i1=Math.min(FRAME_COUNT-1,i0+1), a=f-i0;
  ensureWindow(f);
  const d0=decoded.get(i0), d1=decoded.get(i1);
  let key;
  if(!gliding&&d0&&d1&&a>0.02&&a<0.98){ key=i0+':'+Math.round(a*48); if(key===lastKey)return; drawCover(d0); ctx.globalAlpha=a; drawCover(d1); ctx.globalAlpha=1; stats.blends++; }
  else { let i=a<0.5?i0:i1; let d=decoded.get(i)||decoded.get(a<0.5?i1:i0); if(!d){const n=nearestDecoded(i); if(n===null)return; d=decoded.get(n); i=n; stats.misses++;} key='s'+i; if(key===lastKey)return; drawCover(d); }
  lastKey=key; stats.draws++;
  if(!stage.classList.contains('live')&&mode==='frames')stage.classList.add('live');
}
function webpSupported(){ return new Promise(r=>{const i=new Image(); i.onload=()=>r(i.width===1); i.onerror=()=>r(false); i.src='data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA=='}); }
const webpOK=webpSupported();
async function initFrames(){
  if(framesInit)return; framesInit=true;
  if(!(await webpOK)){ ring.classList.add('done'); return; }
  /* Load order: first frame, last frame, then the timeline subdivided coarse to fine, so scrubbing during the load is even and refines instead of jumping. Frames inside the current decode window jump the queue. */
  const order=[0,FRAME_COUNT-1]; const seen=new Set(order); let queue=[[0,FRAME_COUNT-1]];
  while(queue.length){ const nextQ=[]; for(const [a,b] of queue){ const m=(a+b)>>1; if(m!==a&&m!==b&&!seen.has(m)){seen.add(m);order.push(m)} if(b-a>1){nextQ.push([a,m]);nextQ.push([m,b])} } queue=nextQ; }
  const requested=new Set(); let next=0;
  /* v41: budget: scenes 1-2 plus every 12th frame first; everything on first interaction, on a glide, or after 12 s (not on Save-Data / 2G-3G) */
  const INITIAL_END=Math.ceil(6.3*FPS2)+2; const con=navigator.connection||{}; const slow=!!con.saveData||/(^|\b)(slow-2g|2g|3g)$/.test(con.effectiveType||'');
  const allowed=i=>fullLoad||i<=INITIAL_END||i%12===0||i===FRAME_COUNT-1||(i>=fetchLo&&i<=fetchHi);
  const pick=()=>{ for(let i=winLo;i<=winHi;i++) if(!requested.has(i)&&allowed(i))return i; if(fetchHi>=fetchLo){ const a=fetchDir>=0?fetchLo:fetchHi, b=fetchDir>=0?fetchHi:fetchLo, st=fetchDir>=0?1:-1; for(let i=a;st>0?i<=b:i>=b;i+=st) if(!requested.has(i))return i; } for(let k=next;k<order.length;k++){ const i=order[k]; if(!requested.has(i)&&allowed(i)){ if(k===next)next++; return i; } } return -1; };
  openFull=()=>{ if(fullLoad)return; fullLoad=true; for(let k=0;k<(slow?3:6);k++)pump(); };
  if(!slow) setTimeout(openFull,12000);
  const done=()=>{ loadedCount++; ringSet(loadedCount/FRAME_COUNT,performance.now()); pump(); };
  const pump=()=>{
    const idx=pick(); if(idx<0)return; requested.add(idx);
    fetch(frameSrc(idx),{priority:idx<2?'high':'low'}).then(r=>{ if(!r.ok)throw new Error(r.status); return r.blob(); }).then(b=>{ blobs[idx]=b; if(mode==='frames'){ensureWindow(lastF); if(idx>=winLo&&idx<=winHi){needsDraw=true;wake()}} done(); }, ()=>{ setTimeout(()=>{requested.delete(idx);pump()},1500); done(); });
  };
  const STREAMS=slow?3:6; window.__pumpFrames=()=>{ for(let k=0;k<STREAMS;k++)pump(); };
  const start=()=>{ for(let k=0;k<2;k++)pump(); setTimeout(()=>{ for(let k=2;k<STREAMS;k++)pump(); },2000); }; const t0f=performance.now(); const waitPoster=()=>{ if(posterReady||performance.now()-t0f>900)start(); else setTimeout(waitPoster,60); }; waitPoster();   /* streams start once the poster is on screens under the browser's per-host limit */
}

/* ---------- Mode, decided live on rotate, resize and preference change ---------- */
function applyMode(){
  measure();
  if(reduce.matches){ mode='still'; stage.classList.remove('mode-video','mode-frames','live'); poster.style.backgroundImage="url('"+(useFrames()?'assets/intro-poster-portrait.jpg':'assets/journey-ending.jpg')+"')"; ring.classList.add('done'); return; }
  const m=useFrames()?'frames':'video'; if(m===mode)return; mode=m;
  webpOK.then(ok=>{ const ext=ok?'.webp':'.jpg'; poster.style.backgroundImage="url('"+(m==='frames'?'assets/intro-poster-portrait':'assets/intro-poster')+ext+"')"; });
  stage.classList.toggle('mode-video',m==='video'); stage.classList.toggle('mode-frames',m==='frames');
  stage.classList.remove('live');
  if(m==='frames'){ lastKey=''; whenAwake(initFrames); }
  else { for(const k of Array.from(decoded.keys()))release(k); whenAwake(initVideo); if(videoReady){lastSeek=-1;requestSeek(progress()*video.duration);stage.classList.add('live')} }
  target=shown=progress(); needsDraw=true; render(shown); wake();
}
FRAMES_MQ.forEach(m=>m.addEventListener('change',applyMode));
reduce.addEventListener('change',applyMode);
addEventListener('resize',()=>{ const pBefore=progress(); measure(); const y=hero.offsetTop+pBefore*range; if(Math.abs(scrollY-y)>2&&heroOnScreen)scrollTo(0,y); target=shown=progress(); lastKey=''; needsDraw=true; wake(); },{passive:true});
applyMode();

/* ---------- v37e: scene rests: when scrolling stops inside the journey, the page glides to the nearest scene ---------- */
const RESTS=[{t:0},{t:6.2},{t:10.04,hold:.45},{t:12.9},{t:17.8},{t:25.0},{t:VIDEO_DURATION,hold:.35}]; /* one rest per scene: Aanrijden, Binnenkant, Onderdelen, Terug in de rij, Uit het magazijn, Naar Nederland, Bezorggebied */
function scrollForTime(t,holdFrac){
  if(holdFrac!=null){ const h=PACE.find(r=>r.t0===r.t1&&Math.abs(r.t0-t)<1e-6); if(h) return h.s0+(h.s1-h.s0)*holdFrac; }
  for(const r of PACE){ if(r.t1>r.t0&&t>=r.t0&&t<=r.t1){ let lo=r.s0,hi=r.s1; for(let i=0;i<32;i++){ const mid=(lo+hi)/2; if(paceMap(mid)*VIDEO_DURATION<t)lo=mid; else hi=mid; } return (lo+hi)/2; } }
  return 1;
}
const restPs=RESTS.map(r=>scrollForTime(r.t,r.hold)); window.__rests=restPs;
let settleT=null, settling=null, touching=false;
function cancelSettle(){ if(settling){cancelAnimationFrame(settling.raf);settling=null} if(settleT){clearTimeout(settleT);settleT=null} }
function settle(){
  settleT=null; if(settling||pageAnim||touching||reduce.matches||!heroOnScreen)return;
  const b=document.body.classList; if(b.contains('intro-lock')||b.contains('menu-open'))return;
  const ps=progress(); if(ps<=0||ps>=1)return;
  let best=0,bd=9; for(let i=0;i<restPs.length;i++){ const d=Math.abs(restPs[i]-ps); if(d<bd){bd=d;best=i} }
  if(bd<0.0015)return;
  const y0=scrollY, y1=Math.round(hero.offsetTop+restPs[best]*range); if(Math.abs(y1-y0)<2)return;
  const dur=Math.min(950,Math.max(420,Math.abs(y1-y0)*0.32)), t0=performance.now();
  const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
  const st={raf:0}; settling=st;
  const step=now=>{ if(settling!==st)return; const t=clamp((now-t0)/dur,0,1); scrollTo(0,Math.round(y0+(y1-y0)*ease(t))); if(t<1)st.raf=requestAnimationFrame(step); else settling=null; };
  st.raf=requestAnimationFrame(step);
}
function armSettle(){ if(settling)return; if(settleT)clearTimeout(settleT); settleT=setTimeout(settle,170); }
addEventListener('scroll',()=>{ if(!settling)armSettle(); },{passive:true});
['wheel','keydown','pointerdown'].forEach(ev=>addEventListener(ev,()=>{ cancelSettle(); armSettle(); },{passive:true}));
addEventListener('touchstart',()=>{ touching=true; cancelSettle(); },{passive:true});
addEventListener('touchend',()=>{ touching=false; armSettle(); },{passive:true});
addEventListener('touchcancel',()=>{ touching=false; armSettle(); },{passive:true});

/* ---------- v38: scene paging: one wheel tick / swipe / key = one scene; the footage plays the transition ---------- */
let pageAnim=null, cooldownUntil=0, lastWheelT=0, lastWheelD=0, touchY=null, touchDone=false;
/* cubic-bezier(.3,.1,.7,.98): soft start, floating middle, subtle brake at the end */
const mkBezier=(x1,y1,x2,y2)=>{ const A=(a,b)=>1-3*b+3*a, B=(a,b)=>3*b-6*a, C=a=>3*a; const calc=(t,a,b)=>((A(a,b)*t+B(a,b))*t+C(a))*t; const slope=(t,a,b)=>3*A(a,b)*t*t+2*B(a,b)*t+C(a);
  return x=>{ if(x<=0)return 0; if(x>=1)return 1; let t=x; for(let i=0;i<8;i++){ const s=slope(t,x1,x2); if(Math.abs(s)<1e-6)break; t-=(calc(t,x1,x2)-x)/s; } return calc(t,y1,y2); }; }; const bezierEase=mkBezier(.3,.1,.7,.98), swipeEase=mkBezier(.16,.84,.24,1);   /* swipeEase: quick start and a soft landing, like a vertical feed */
function nearestRestIndex(ps){ let b=0,bd=9; for(let i=0;i<restPs.length;i++){ const d=Math.abs(restPs[i]-ps); if(d<bd){bd=d;b=i} } return b; }
function glide(y1,dur,easeFn){
  cancelSettle(); const y0=scrollY; if(Math.abs(y1-y0)<2)return;
  if(mode==='frames'){ prioritiseFrames(clamp((y0-heroTop)/range,0,1),clamp((y1-heroTop)/range,0,1)); openFull(); }
  /* v38b */ /* v38c */ /* v42 */ /* v43 */ document.documentElement.classList.remove('snap'); const t0=performance.now(), ease=easeFn||bezierEase; const st={raf:0}; pageAnim=st; gliding=true; WIN_AHEAD=16; WIN_BACK=2; MAX_INFLIGHT=4;
  const step=now=>{ if(pageAnim!==st)return; const t=clamp((now-t0)/dur,0,1); scrollTo(0,Math.round(y0+(y1-y0)*ease(t)));
    if(t<1)st.raf=requestAnimationFrame(step); else { pageAnim=null; gliding=false; WIN_AHEAD=10; WIN_BACK=4; MAX_INFLIGHT=3; cooldownUntil=performance.now()+650; document.documentElement.classList.toggle('snap',document.body.classList.contains('scrolled-page')&&finePointer.matches); } };
  st.raf=requestAnimationFrame(step);
}
function pageScene(dir){
  const ps=progress(); const cur=nearestRestIndex(ps); let i=cur;
  if(dir>0&&restPs[i]<=ps+0.002)i++; else if(dir<0&&restPs[i]>=ps-0.002)i--;
  if(i>=restPs.length){ glide(Math.round(hero.offsetTop+range+stage.clientHeight),1900); return true; }   /* out of the journey, into the first block */
  if(i<0)return false;
  const dt=Math.abs(RESTS[i].t-RESTS[cur].t)||2; glide(Math.round(hero.offsetTop+restPs[i]*range),clamp(dt*440,1400,3000)); return true;
}
function pagingActive(dir){
  if(reduce.matches)return false; const b=document.body.classList; if(b.contains('intro-lock')||b.contains('menu-open'))return false;
  const hb=hero.getBoundingClientRect().bottom; if(hb<-1)return false;   /* v43: hero fully above the viewport -> not active */
  const ps=progress(); if(ps>=1&&dir>0)return false; if(ps<=0&&dir<0)return false; return true;
}
/* v42: blocks page per wheel tick on desktop; the hero end and the first block hand over to each other */
const finePointer=matchMedia('(pointer:fine)');
let blockAnim=0, blockList=null;
function currentBlockIndex(){ const secs=blockList||(blockList=Array.from(document.querySelectorAll('main > section:not(#hero)'))); let best=-1,bd=1e9; for(let i=0;i<secs.length;i++){ const d=Math.abs(secs[i].getBoundingClientRect().top); if(d<bd){bd=d;best=i} } return bd<innerHeight*0.5?best:-1; }
/* v55: a block taller than the screen scrolls natively until its edge is on screen; only then does the next swipe, wheel tick or key page to the neighbour */
function roomInDir(dir){ const secs=blockList||(blockList=Array.from(document.querySelectorAll('main > section:not(#hero)'))); const vh=innerHeight, mid=vh*0.5; const gap=(()=>{ const a=document.getElementById('lvhProbe'), b=document.getElementById('svhProbe'); return a&&b?Math.max(0,a.clientHeight-b.clientHeight):0; })(); for(const s of secs){ const r=s.getBoundingClientRect(); if(r.top<=mid&&r.bottom>=mid){ return dir>0?r.bottom>vh+10+gap:r.top<-10; } } return false; }
function pageBlock(dir){
  const i=currentBlockIndex(); if(i<0)return false;
  const b=document.body.classList; if(b.contains('menu-open')||reduce.matches)return false;
  if(dir<0&&i===0){ return pageScene(-1); }
  const target=dir>0?blockList[i+1]:blockList[i-1];
  const foot=document.querySelector('footer');
  const y=target?Math.round(scrollY+target.getBoundingClientRect().top):(dir>0&&foot?Math.min(Math.round(scrollY+foot.getBoundingClientRect().top),document.documentElement.scrollHeight-innerHeight):null);
  if(y===null||Math.abs(y-scrollY)<2)return false;
  /* v43 */ glide(y,640,swipeEase); return true;
}
addEventListener('wheel',e=>{ const dir=e.deltaY>0?1:e.deltaY<0?-1:0; if(!dir||e.ctrlKey)return;
  const now=performance.now(), d=Math.abs(e.deltaY); const accel=d>lastWheelD*1.05||now-lastWheelT>220; lastWheelT=now; lastWheelD=d; /* v42b: also tracked while swallowing, so an inertia tail is never mistaken for a new gesture */
  if(pageAnim||now<cooldownUntil){ e.preventDefault(); return; }               /* a glide or its inertia tail: swallow */
  if(pagingActive(dir)){ e.preventDefault(); if(!accel||d<6)return; pageScene(dir); return; }
  if(finePointer.matches&&document.body.classList.contains('scrolled-page')&&!roomInDir(dir)){ const i=currentBlockIndex(); if(i>=0){ e.preventDefault(); if(!accel||d<6)return; pageBlock(dir); } }
},{passive:false});
addEventListener('touchstart',e=>{ if(mode==='frames'&&heroOnScreen)openFull(); if(e.touches.length!==1){touchY=null;return} touchY=e.touches[0].clientY; touchDone=false; },{passive:true});
document.addEventListener('touchmove',e=>{ if(pageAnim){ e.preventDefault(); return; } if(touchY===null||e.touches.length!==1)return; const dy=touchY-e.touches[0].clientY; const dir=dy>0?1:-1;
  if(Math.abs(dy)<12&&e.target&&e.target.closest&&e.target.closest('a,button'))return;   /* v47: a tap on a link or button (tiny movement) is never swallowed */
  if(pagingActive(dir)){ e.preventDefault(); if(touchDone||Math.abs(dy)<22)return; touchDone=true; pageScene(dir); return; }
  /* v43: blocks page per swipe on touch devices; the footer scrolls natively */
  if(document.body.classList.contains('scrolled-page')&&!document.body.classList.contains('menu-open')&&!roomInDir(dir)){ const i=currentBlockIndex(); if(i>=0){ e.preventDefault(); if(touchDone||Math.abs(dy)<22)return; touchDone=true; pageBlock(dir); return; }
    /* v43b: not aligned (e.g. inside the footer or after a native scroll): a swipe glides to the nearest block in that direction; nothing below -> native */
    const t=nearestBlockInDir(dir); if(t){ e.preventDefault(); if(touchDone||Math.abs(dy)<22)return; touchDone=true; glide(Math.round(scrollY+t.getBoundingClientRect().top),640,swipeEase); } } },{passive:false});
function nearestBlockInDir(dir){ const secs=blockList||(blockList=Array.from(document.querySelectorAll('main > section:not(#hero)'))); let best=null,bd=1e9; for(const s of secs){ const top=s.getBoundingClientRect().top; if(dir>0?top>2:top<-2){ const d=Math.abs(top); if(d<bd){bd=d;best=s} } } return best; }
addEventListener('touchend',()=>{ touchY=null; },{passive:true});
addEventListener('keydown',e=>{ if(e.target&&(e.target.matches('input,textarea,select,button,a')||e.target.isContentEditable))return; const k=e.key; const dir=(k==='ArrowDown'||k==='PageDown'||k===' ')?1:(k==='ArrowUp'||k==='PageUp')?-1:0; if(!dir)return;
  if(pageAnim||performance.now()<cooldownUntil){ e.preventDefault(); return; }
  if(pagingActive(dir)){ e.preventDefault(); pageScene(dir); return; }
  if(document.body.classList.contains('scrolled-page')&&currentBlockIndex()>=0&&!roomInDir(dir)){ e.preventDefault(); pageBlock(dir); } });
/* v42 */
window.__pageScene=pageScene;

/* v41c: deferred start-up tasks */
setTimeout(function(){
/* ---------- Below the journey: reveal on scroll, counters, safety stripe, offerte form (JS-only success; DEPLOY STEP: connect to mail or a form service) ---------- */
const countUp=el=>{ const end=+el.dataset.count, t0=performance.now(), dur=1400; const step=now=>{ const t=clamp((now-t0)/dur,0,1), e=1-Math.pow(1-t,3); el.textContent=String(Math.round(end*e)); if(t<1)requestAnimationFrame(step); }; requestAnimationFrame(step); };
/* v39: space behind the blocks: two image layers crossfade per block; the next block's image is preloaded */
const space=document.getElementById('space'), spA=space?space.querySelector('.sp.a'):null, spB=space?space.querySelector('.sp.b'):null; let spCur='', spActive=null; const spCache={};
const spPortrait=matchMedia('(orientation:portrait)');
function spSrc(name){ return 'assets/space-'+name+(spPortrait.matches?'-p':'-d')+'.webp'; }
spPortrait.addEventListener('change',()=>{ for(const k in spCache)delete spCache[k]; spCur=''; const b=document.querySelector('main > section.in[data-bg]'); if(b)spaceTo(b); });
function preloadSpace(name){ return; if(!name||spCache[name])return; const i=new Image(); i.src=spSrc(name); spCache[name]=i; }
function spaceTo(b){ if(!space||!b.dataset.bg)return; const name=b.dataset.bg; const next=spActive===spA?spB:spA;
  if(name!==spCur){ spCur=name; next.style.setProperty('--pos',b.dataset.pos||'50% 50%'); next.src=spSrc(name);
    const show=()=>{ if(spCur!==name)return; next.classList.add('on'); if(spActive&&spActive!==next)spActive.classList.remove('on'); spActive=next; };
    if(next.complete&&next.naturalWidth)show(); else next.addEventListener('load',show,{once:true}); }
  else if(spActive){ spActive.style.setProperty('--pos',b.dataset.pos||'50% 50%'); }
  const nb=b.nextElementSibling; if(nb&&nb.dataset&&nb.dataset.bg)preloadSpace(nb.dataset.bg); }
setTimeout(()=>{ const first=document.querySelector('main > section[data-bg]'); if(first){ preloadSpace(first.dataset.bg); const s=first.nextElementSibling; if(s&&s.dataset.bg)preloadSpace(s.dataset.bg); } },4500);
/* v37: one coordinated reveal per block (kicker, title, lead, then the items in order), replayed when a block comes back */
const blocks=Array.from(document.querySelectorAll('main > section:not(#hero)'));
/* v55: fit every block on the visible screen. Level 1 and 2 compact the layout, level 3 scales it (never below 76%); whatever still does not fit scrolls natively (roomInDir) */
const svhProbe=document.getElementById('svhProbe'), lvhProbe=document.getElementById('lvhProbe'); const screenH=()=>Math.max(300,(lvhProbe&&lvhProbe.clientHeight)||innerHeight);   /* blocks are as tall as the large viewport; their padding keeps the content inside the small one */
function naturalH(b){ const mh=b.style.minHeight, cv=b.style.contentVisibility; b.style.minHeight='0'; b.style.contentVisibility='visible'; const h=b.getBoundingClientRect().height; b.style.minHeight=mh; b.style.contentVisibility=cv; return h; }
function fitBlock(b){ b.removeAttribute('data-fit'); b.style.removeProperty('--zoom'); const vh=screenH(); let h=naturalH(b); if(h<=vh+2)return;
  for(let lvl=1;lvl<=2;lvl++){ b.setAttribute('data-fit',lvl); h=naturalH(b); if(h<=vh+2)return; }
  b.setAttribute('data-fit','3'); b.style.setProperty('--zoom',Math.max(.76,(vh-2)/h).toFixed(3)); }
function fitAll(){ let i=0; const step=()=>{ const t0=performance.now(); while(i<blocks.length&&performance.now()-t0<8)fitBlock(blocks[i++]); if(i<blocks.length)(window.requestIdleCallback||setTimeout)(step); }; step(); }
(window.requestIdleCallback?requestIdleCallback(fitAll,{timeout:2500}):setTimeout(fitAll,1500));
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>setTimeout(fitAll,400));
let fitT=0; addEventListener('resize',()=>{ clearTimeout(fitT); fitT=setTimeout(fitAll,250); },{passive:true});
blocks.forEach(b=>b.querySelectorAll('.rv').forEach((el,i)=>el.style.setProperty('--i',i)));
const setNum=el=>{ el.querySelectorAll('[data-count]').forEach(reduce.matches?(x=>x.textContent=String(+x.dataset.count)):countUp); };
const blockIO=new IntersectionObserver(es=>{ for(const e of es){ const b=e.target;
  if(e.intersectionRatio>=0.2&&!b.classList.contains('in')){ b.classList.add('in'); spaceTo(b); b.querySelectorAll('.rv').forEach(el=>el.classList.add('in')); b.querySelectorAll('.kicker').forEach(decode); setNum(b); }
  else if(!e.isIntersecting&&b.classList.contains('in')&&!reduce.matches){ b.classList.remove('in'); b.querySelectorAll('.rv').forEach(el=>el.classList.remove('in')); b.querySelectorAll('.kicker').forEach(k=>{ delete k.dataset.decoded; k.textContent=k.dataset.text||k.textContent; }); }
} },{threshold:[0,0.2]});
blocks.forEach(b=>blockIO.observe(b));
/* dots navigation (desktop, past the hero) */
(function(){
  if(!matchMedia('(pointer:fine)').matches||innerWidth<900)return;
  const nav=document.createElement('nav'); nav.className='dots'; nav.setAttribute('aria-label','Secties');
  const home=document.createElement('button'); home.type='button'; home.dataset.for='hero'; home.innerHTML='<i></i><span>Journey · Terug naar boven</span>'; home.addEventListener('click',()=>goTo('#top')); nav.appendChild(home);
  blocks.forEach(b=>{ const h=b.querySelector('h2'); const g=b.querySelector('.bhead b'); const btn=document.createElement('button'); btn.type='button'; btn.dataset.for=b.id; btn.innerHTML='<i></i><span>'+(g?g.textContent+' · ':'')+(h?h.textContent.replace(/\s+/g,' ').trim():b.id)+'</span>'; btn.addEventListener('click',()=>b.scrollIntoView({behavior:'smooth'})); nav.appendChild(btn); });
  document.body.appendChild(nav);
  const act=new IntersectionObserver(es=>{ for(const e of es){ if(e.intersectionRatio>=0.5){ nav.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x.dataset.for===e.target.id)); } } },{threshold:[0.5]});
  blocks.forEach(b=>act.observe(b));
})();
/* phones: the directory folds per province */
if(matchMedia('(max-width:720px)').matches) document.querySelectorAll('.dirp[open]').forEach(d=>d.removeAttribute('open'));
/* chapter index: folded on phones and tablets, one chapter open at a time, the opened list is brought into view */
if(matchMedia('(max-width:900px)').matches) document.querySelectorAll('.chap[open]').forEach(d=>d.removeAttribute('open'));
document.querySelectorAll('.chap').forEach(d=>d.addEventListener('toggle',()=>{ if(!d.open||!matchMedia('(max-width:900px)').matches)return; document.querySelectorAll('.chap[open]').forEach(o=>{ if(o!==d)o.removeAttribute('open'); }); setTimeout(()=>d.scrollIntoView({block:'nearest',behavior:reduce.matches?'auto':'smooth'}),80); }));
/* ---------- Menu, anchors, header state, touch lock ---------- */
const menuBtn=document.getElementById('menuBtn');
function setMenu(open){ const mEl=document.getElementById('menu'); if(open&&!mEl.classList.contains('mounted')){ mEl.classList.add('mounted'); requestAnimationFrame(()=>requestAnimationFrame(()=>setMenu(true))); menuBtn.setAttribute('aria-expanded','true'); return; } document.body.classList.toggle('menu-open',open); menuBtn.setAttribute('aria-expanded',String(open)); menuBtn.setAttribute('aria-label',open?'Menu sluiten':'Menu openen'); document.getElementById('menu').setAttribute('aria-hidden',String(!open)); }
menuBtn.addEventListener('click',()=>setMenu(!document.body.classList.contains('menu-open')));
document.getElementById('menuBg').addEventListener('click',()=>setMenu(false));
const setHdr=()=>document.documentElement.style.setProperty('--hdr',document.getElementById('topbar').offsetHeight+'px'); setHdr(); if('ResizeObserver' in window) new ResizeObserver(()=>setHdr()).observe(document.getElementById('topbar')); else addEventListener('resize',setHdr,{passive:true});
addEventListener('keydown',e=>{ if(e.key==='Escape'&&document.body.classList.contains('menu-open')){setMenu(false);menuBtn.focus()} });
function goTo(hash){ if(hash==='#top'||hash==='#bezorging'){ document.documentElement.classList.remove('snap'); hdrSolid=false; document.body.classList.remove('scrolled-page'); } if(hash==='#top'){scrollTo(0,0);return} if(hash==='#bezorging'){ measure(); scrollTo(0,hero.offsetTop+range*0.94); return } const t=document.querySelector(hash); if(t)t.scrollIntoView(); }
document.querySelectorAll('a[href^="#"]:not([data-ph])').forEach(a=>a.addEventListener('click',e=>{ const hash=a.getAttribute('href'); if(hash.length<2||hash[0]!=='#')return; e.preventDefault();   /* v48: contact buttons (data-ph) get their real href later and must never be swallowed */ const wasOpen=document.body.classList.contains('menu-open'); if(wasOpen)setMenu(false); setTimeout(()=>goTo(hash),wasOpen?260:0); }));
document.addEventListener('touchmove',e=>{ if(document.body.classList.contains('intro-lock'))e.preventDefault(); else if(document.body.classList.contains('menu-open')&&!e.target.closest('.menu-panel'))e.preventDefault(); },{passive:false});
let hdrSolid=false; const hdrState=()=>{ const s=scrollY>heroTop+range-4; if(s!==hdrSolid){hdrSolid=s;document.body.classList.toggle('scrolled-page',s);document.documentElement.classList.toggle('snap',s&&!pageAnim&&finePointer.matches)} }; addEventListener('scroll',hdrState,{passive:true}); hdrState();
document.querySelectorAll('#holoParts .nm[data-name]').forEach(n=>{n.textContent=n.dataset.name});
},0);
setTimeout(function(){
/* ---------- Map HUD: empty until you hover or tap a lit province; then brackets, holographic fill and cities typed in one by one ---------- */
(function(){
  const map=document.getElementById('holoMap'); if(!map)return;
  const pinsAll=Array.from(map.querySelectorAll('.hs')), fills=Array.from(map.querySelectorAll('.provfill')), provs=Array.from(map.querySelectorAll('.prov')), boxes=Array.from(map.querySelectorAll('.provbox'));
  const rt=document.getElementById('readoutText'), readout=document.getElementById('readout'); let wasOn=false;
  const NAMES={nh:'Noord-Holland',fl:'Flevoland',ut:'Utrecht'};
  const fine=matchMedia('(pointer:fine)').matches;
  let hot=null, sticky=false, gen=0, timer=null;
  const clearTimer=()=>{ if(timer){clearTimeout(timer);timer=null} };
  function typeInto(el,text,html,speed,done){ const g=++gen; clearTimer(); let c=0; el.textContent=''; const step=()=>{ if(g!==gen)return; c++; const s=text.slice(0,c); if(html)el.innerHTML=html(s); else el.textContent=s; if(c<text.length)timer=setTimeout(step,speed+Math.random()*speed); else if(done)timer=setTimeout(()=>{ if(g===gen)done(); },90); }; step(); return g; }
  function idle(){ if(reduce.matches){ rt.innerHTML='<b>// scan actief</b> · '+(fine?'beweeg over een provincie':'tik op een provincie'); return; } typeInto(rt,'// scan actief · '+(fine?'beweeg over een oplichtende provincie':'tik op een oplichtende provincie'),s=>s.replace('// scan actief','<b>// scan actief</b>'),14); }
  fills.forEach(f=>{ const l=f.nextElementSibling; if(l&&l.classList.contains('provline')){ l.style.cssText=f.getAttribute('style'); } });
  function paint(){ fills.forEach(f=>{ f.classList.toggle('hot',f.dataset.region===hot); f.classList.toggle('dim',!!hot&&f.dataset.region!==hot); }); boxes.forEach(b=>b.classList.toggle('hot',b.dataset.region===hot)); pinsAll.forEach(p=>{ if(p.dataset.region!==hot){ p.classList.remove('show','typing','active'); p.querySelector('.nm').textContent=''; } }); }
  const stripEl=document.getElementById('cityStrip');
  function strip(r,pins){ /* v37g */ if(!stripEl)return; if(!r){ stripEl.textContent=''; stripEl.classList.remove('on'); return; } stripEl.textContent=''; const h=document.createElement('div'); h.className='cs-h'; h.textContent='// '+NAMES[r]+' · '+pins.length+' plaatsen · tik voor de pagina'; const l=document.createElement('div'); l.className='cs-l'; pins.forEach((p,i)=>{ const a=document.createElement('a'); a.className='cs'; a.style.setProperty('--d',(i*0.05).toFixed(2)); a.href=p.dataset.href||'#'; a.textContent=p.querySelector('.nm').dataset.name||''; l.appendChild(a); }); stripEl.appendChild(h); stripEl.appendChild(l); stripEl.classList.add('on'); }
  function reveal(r){
    const pins=pinsAll.filter(p=>p.dataset.region===r); const count=pins.length; strip(r,pins);
    const line='// '+NAMES[r]+' · '+count+' bezorgplaatsen · 24/7 binnen 20 min';
    if(reduce.matches){ rt.innerHTML=line.replace('// '+NAMES[r],'<b>// '+NAMES[r]+'</b>'); pins.forEach(p=>{p.classList.add('show');p.querySelector('.nm').textContent=p.querySelector('.nm').dataset.name}); return; }
    const g=typeInto(rt,line,s=>s.replace('// '+NAMES[r],'<b>// '+NAMES[r]+'</b>'),11,()=>{
      let i=0; const next=()=>{ if(g!==gen||hot!==r)return; if(i>=pins.length)return; const p=pins[i++], nm=p.querySelector('.nm'), full=nm.dataset.name; p.classList.add('show','typing'); declutter(); let c=0;
        const step=()=>{ if(g!==gen||hot!==r)return; c++; nm.textContent=full.slice(0,c); if(c<full.length)timer=setTimeout(step,22+Math.random()*26); else { p.classList.remove('typing'); timer=setTimeout(next,60); } }; timer=setTimeout(step,40); };
      next(); });
  }
  /* v56: labels of pins that sit close together are pushed apart vertically (left and right labels separately), so no label hides behind another at any screen size */
  function declutter(){ const sides={l:[],r:[]}; for(const p of pinsAll){ p.style.setProperty('--dy','0px'); if(!p.classList.contains('show'))continue; const d=p.querySelector('.dot').getBoundingClientRect(); sides[p.classList.contains('l')?'l':'r'].push({p,x:d.left+d.width/2,y:d.top+d.height/2}); }
    const lb=pinsAll[0]&&pinsAll[0].querySelector('.lbl'); const H=Math.max(24,(lb&&lb.offsetHeight)||0)+4;
    for(const g of [sides.l,sides.r]){ g.sort((a,b)=>a.y-b.y); let lastY=-1e9,lastX=0; for(const it of g){ let y=it.y; if(y-lastY<H&&Math.abs(it.x-lastX)<240)y=lastY+H; it.p.style.setProperty('--dy',(y-it.y).toFixed(1)+'px'); lastY=y; lastX=it.x; } } }
  function setHot(r,stick){ if(stick!==undefined)sticky=stick; if(r===hot)return; hot=r; stats.hot=(stats.hot||0)+1; paint(); if(r)reveal(r); else { idle(); strip(null); } }
  /* pixel-accurate hit test on the province masks (the same images that draw the hologram), so hover and tap follow the real shape */
  const maskPix={}; let maskKey='';
  function loadMasks(){ const key=useFrames()?'p':'d'; if(key===maskKey)return; maskKey=key; for(const r of ['nh','fl','ut']){ const img=new Image(); img.src='assets/mask-'+r+'-'+key+'.png'; const go=()=>{ const w=480, hh=Math.round(img.naturalHeight*w/img.naturalWidth); const c=document.createElement('canvas'); c.width=w; c.height=hh; const x=c.getContext('2d',{willReadFrequently:true}); x.drawImage(img,0,0,w,hh); maskPix[r]={w,h:hh,a:x.getImageData(0,0,w,hh).data}; }; (img.decode?img.decode():new Promise(res=>img.onload=res)).then(go,()=>{ img.onload=go; }); } }
  let masksArmed=false; const armMasks=()=>{ if(masksArmed)return; masksArmed=true; loadMasks(); FRAMES_MQ.forEach(m=>m.addEventListener('change',loadMasks)); };
  function regionAt(clientX,clientY){ const f=map.querySelector('.fit').getBoundingClientRect(); const u=(clientX-f.left)/f.width, v=(clientY-f.top)/f.height; if(u<0||v<0||u>1||v>1)return null; for(const r of ['nh','fl','ut']){ const m=maskPix[r]; if(!m)continue; const px=Math.min(m.w-1,Math.floor(u*m.w)), py=Math.min(m.h-1,Math.floor(v*m.h)); if(m.a[(py*m.w+px)*4+3]>110)return r; } return null; }
  /* one pointer tracker for the whole map: labels count as part of their province, and leaving is debounced so nothing flickers or restarts */
  let leaveT=null;
  if(fine){
    stage.addEventListener('pointermove',e=>{ if(!wasOn)return; const el=e.target.closest('#holoMap .hs'); const r=el?el.dataset.region:regionAt(e.clientX,e.clientY);
      if(r){ if(leaveT){clearTimeout(leaveT);leaveT=null} if(!sticky&&r!==hot)setHot(r); }
      else if(!sticky&&hot&&!leaveT){ leaveT=setTimeout(()=>{ leaveT=null; if(!sticky)setHot(null); },160); } },{passive:true});
    stage.addEventListener('pointerleave',()=>{ if(leaveT){clearTimeout(leaveT);leaveT=null} if(!sticky)setHot(null); });
  }
  provs.forEach(b=>{ b.addEventListener('focus',()=>{ if(!sticky)setHot(b.dataset.region); }); b.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); const r=b.dataset.region; if(sticky&&hot===r)setHot(null,false); else setHot(r,true); } }); b.addEventListener('blur',()=>{ if(!sticky&&!fine)setHot(null); }); });
  pinsAll.forEach(p=>p.addEventListener('click',e=>{ e.stopPropagation(); if(p.classList.contains('show')&&!p.classList.contains('typing')&&p.dataset.href)location.href=p.dataset.href; }));
  stage.addEventListener('click',e=>{ if(!wasOn||e.target.closest('.hs'))return; const r=regionAt(e.clientX,e.clientY); if(r){ if(sticky&&hot===r)setHot(null,false); else setHot(r,true); } else if(sticky)setHot(null,false); });
  /* arrival: provinces ping one by one, the instruction card appears, a cursor ring pulses on Noord-Holland; the cue appears after the first interaction */
  const card=document.getElementById('mapCard'), cue=document.getElementById('mapCue'), ring=document.getElementById('cursorRing');
  let attractTimers=[], interacted=false, cardShown=false;
  const clearAttract=()=>{ attractTimers.forEach(clearTimeout); attractTimers=[]; fills.forEach(f=>f.classList.remove('ping')); boxes.forEach(b=>b.classList.remove('ping')); ring.classList.remove('on'); };
  function placeRing(){ const b=map.querySelector('.provbox[data-region="nh"]'); if(!b)return; const fit=map.querySelector('.fit'); const r=b.getBoundingClientRect(), f=fit.getBoundingClientRect(); ring.style.left=(r.left-f.left+r.width*0.5)+'px'; ring.style.top=(r.top-f.top+r.height*0.55)+'px'; }
  function attract(){ clearAttract(); const order=['nh','fl','ut']; order.forEach((r,i)=>{ attractTimers.push(setTimeout(()=>{ fills.forEach(f=>f.classList.toggle('ping',f.dataset.region===r)); boxes.forEach(b=>b.classList.toggle('ping',b.dataset.region===r)); },500+i*650)); }); attractTimers.push(setTimeout(()=>{ fills.forEach(f=>f.classList.remove('ping')); boxes.forEach(b=>b.classList.remove('ping')); if(!interacted){ placeRing(); ring.classList.add('on'); } },500+3*650)); }
  function showCard(){ if(cardShown||reduce.matches&&false)return; cardShown=true; card.classList.add('on'); attractTimers.push(setTimeout(()=>{ if(!interacted){ card.classList.remove('on'); cue.classList.add('on'); } },7000)); }
  function onInteract(){ if(interacted)return; interacted=true; clearAttract(); card.classList.remove('on'); setTimeout(()=>cue.classList.add('on'),1800); }
  provs.forEach(b=>b.addEventListener('focus',onInteract)); stage.addEventListener('pointermove',e=>{ if(wasOn&&regionAt(e.clientX,e.clientY))onInteract(); },{passive:true}); stage.addEventListener('click',e=>{ if(wasOn&&regionAt(e.clientX,e.clientY))onInteract(); });
  map.querySelector('.fit').appendChild(ring);
  addEventListener('resize',()=>{ if(ring.classList.contains('on'))placeRing(); declutter(); },{passive:true});
  /* the readout types its hint when the map scene arrives, and clears when it leaves */
  const mapBand=bands.find(b=>b.el===map);
  const watch=()=>{ if(!masksArmed&&shown>0.62)armMasks(); if(!heroOnScreen){ setTimeout(watch,250); return; } const on=!!mapBand&&mapBand.on&&mapBand.k>0.3; if(on!==wasOn){ wasOn=on; if(on){ if(!hot)idle(); if(!interacted){ showCard(); attract(); } else cue.classList.add('on'); } else { gen++; clearTimer(); rt.textContent=''; setHot(null,false); clearAttract(); card.classList.remove('on'); cue.classList.remove('on'); cardShown=false; } } requestAnimationFrame(watch); };
  requestAnimationFrame(watch);
})();
/* ---------- Savings calculator ---------- */
const cr=document.getElementById('calcRange');
if(cr){ const o=document.getElementById('calcFills'), P=document.getElementById('calcPatronen'), C=document.getElementById('calcCil'), W=document.getElementById('calcWissel'), A=document.getElementById('calcAfval');
  const fmt=n=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
  const upd=()=>{ const f=+cr.value, m=f*30, c=Math.ceil(m/250); o.textContent=f; P.textContent=fmt(m); C.textContent=c; W.textContent=fmt(m-c); A.textContent=(m*8/1000).toFixed(1).replace('.',','); cr.style.setProperty('--pct',((f-10)/390*100)+'%'); };
  cr.addEventListener('input',upd); upd(); }
/* Contact: phone buttons read the number from <meta name="fg-contact">, WhatsApp buttons from <meta name="fg-whatsapp"> (falls back to fg-contact); until a real number is filled in they keep the placeholder and do nothing */
(function(){ const read=n=>{ const m=document.querySelector('meta[name="'+n+'"]'); const raw=m?m.content.trim():''; let digits=raw.replace(/\D/g,''); if(digits.startsWith('00'))digits=digits.slice(2); else if(digits.startsWith('0'))digits='31'+digits.slice(1); const ok=/^\d{9,15}$/.test(digits)&&!/[A-Za-z\[\]]/.test(raw); return {raw,digits,ok}; };
  const tel=read('fg-contact'); const waM=read('fg-whatsapp'); const wa=waM.ok?waM:tel;
  const disp=tel.ok?tel.raw:'[telefoonnummer]'; const dispW=wa.ok?wa.raw:disp;
  const DEF='Zijn jullie actief?';
  document.querySelectorAll('[data-ph]').forEach(a=>{ const k=a.dataset.ph; const msg=a.dataset.msg||document.body.dataset.waMsg||DEF; const n=k==='whatsapp'?wa:tel;
    if(n.ok){ a.href=k==='whatsapp'?'https://wa.me/'+n.digits+'?text='+encodeURIComponent(msg):'tel:+'+n.digits; if(k==='whatsapp'){a.target='_blank';a.rel='noopener';} }
    else { a.href='#'; a.setAttribute('aria-disabled','true'); a.addEventListener('click',e=>{ e.preventDefault(); a.classList.remove('nudge'); void a.offsetWidth; a.classList.add('nudge'); }); }
    a.querySelectorAll('.ph').forEach(s=>s.textContent=k==='whatsapp'?dispW:disp); a.querySelectorAll('.phw').forEach(s=>s.textContent=dispW); });
  if(tel.ok) document.querySelectorAll('.ph').forEach(s=>{ if(!s.closest('[data-ph]')) s.textContent=disp; });   /* v45: number also in running text */
  if(wa.ok) document.querySelectorAll('.phw').forEach(s=>{ if(!s.closest('[data-ph]')) s.textContent=dispW; });
})();
},30);
})();
