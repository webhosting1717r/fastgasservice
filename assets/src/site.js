(function(){
'use strict';
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v)); const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const menuBtn=document.getElementById('menuBtn'), menu=document.getElementById('menu');
function setMenu(open){ document.body.classList.toggle('menu-open',open); menuBtn.setAttribute('aria-expanded',String(open)); menuBtn.setAttribute('aria-label',open?'Menu sluiten':'Menu openen'); menu.setAttribute('aria-hidden',String(!open)); }
menuBtn.addEventListener('click',()=>setMenu(!document.body.classList.contains('menu-open')));
document.getElementById('menuBg').addEventListener('click',()=>setMenu(false));
addEventListener('keydown',e=>{ if(e.key==='Escape'&&document.body.classList.contains('menu-open')){setMenu(false);menuBtn.focus()} });
const setHdr=()=>document.documentElement.style.setProperty('--hdr',document.getElementById('topbar').offsetHeight+'px'); setHdr(); addEventListener('resize',setHdr,{passive:true});
let solid=false; const hs=()=>{ const s=scrollY>40; if(s!==solid){solid=s;document.body.classList.toggle('scrolled-page',s)} }; addEventListener('scroll',hs,{passive:true}); hs();
document.addEventListener('touchmove',e=>{ if(document.body.classList.contains('menu-open'))e.preventDefault(); },{passive:false});
const GLYPHS='ABCDEFGHKLMNPRSTUVXYZ0123456789<>/\\|=';
function decode(el){ if(reduce.matches||el.dataset.decoded||el.children.length)return; el.dataset.decoded='1'; const text=el.textContent, t0=performance.now(), dur=620; const step=now=>{ const t=clamp((now-t0)/dur,0,1); const n=Math.floor(t*text.length); let out=''; for(let i=0;i<text.length;i++){ const ch=text[i]; out+= i<n||ch===' '?ch:GLYPHS[Math.floor(Math.random()*GLYPHS.length)]; } el.textContent=out; if(t<1)requestAnimationFrame(step); else el.textContent=text; }; requestAnimationFrame(step); }
/* short brand intro on every subpage: the wordmark tracks in and lands on the header title */
const intro=document.getElementById('intro');
if(intro){ if(reduce.matches){intro.remove();document.body.classList.add('intro-done');} else { document.body.classList.add('intro-lock'); document.documentElement.classList.add('intro-lock');
  const fontsReady=(document.fonts&&document.fonts.load)?Promise.race([document.fonts.load('800 1em "Barlow Condensed"'),new Promise(r=>setTimeout(r,700))]):Promise.resolve();
  fontsReady.then(()=>{ document.body.classList.add('fonts');
    /* category graphic: typed label, gauge counter, checklist ticks */
    const lab=document.getElementById('ciLabel'); if(lab){ const text=lab.dataset.text||''; let c=0; const t=()=>{ c++; lab.textContent=text.slice(0,c); if(c<text.length)setTimeout(t,16+Math.random()*22); }; setTimeout(t,750); }
    const gv=document.getElementById('ciVal'); if(gv){ const t0=performance.now()+750; const run=now=>{ const t=clamp((now-t0)/1150,0,1), e=1-Math.pow(1-t,3); gv.textContent=Math.round(165*Math.max(0,e)); if(t<1)requestAnimationFrame(run); }; requestAnimationFrame(run); }
    document.querySelectorAll('.ci-check li').forEach((li,i)=>setTimeout(()=>li.classList.add('on'),950+i*300));
    setTimeout(()=>{ const mark=intro.querySelector('.intro-mark'), hdr=document.getElementById('hdrMark'); intro.classList.add('out');
    document.body.classList.remove('intro-lock'); document.documentElement.classList.remove('intro-lock'); scrollTo(0,0);
    let landed=false; const land=()=>{ if(landed)return; landed=true; document.body.classList.add('mark-landing'); document.body.classList.add('intro-done'); mark.style.opacity='0'; };
    let measured=false; const go=()=>{ if(measured)return; measured=true; let anim=null; try{ const a=mark.getBoundingClientRect(), b=hdr.getBoundingClientRect(); const sc=b.width/a.width, dx=b.left-a.left, dy=(b.top+b.height/2)-(a.top+a.height*sc/2); mark.style.transformOrigin='0 0'; const end='translate('+dx.toFixed(2)+'px,'+dy.toFixed(2)+'px) scale('+sc.toFixed(5)+')'; anim=mark.animate([{transform:'none',opacity:1},{transform:end,opacity:1,offset:.6},{transform:end,opacity:0}],{duration:1050,easing:'cubic-bezier(.6,0,.1,1)',fill:'forwards'}); const tick=()=>{ if(landed||document.body.classList.contains('mark-landing'))return; let pr=null; try{ pr=anim.effect.getComputedTiming().progress; }catch(e){} if(pr!=null&&pr>=0.6) document.body.classList.add('mark-landing'); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); setTimeout(()=>document.body.classList.add('mark-landing'),900); }catch(e){}
      if(anim&&anim.finished) anim.finished.then(land,land); setTimeout(land,1150); }; requestAnimationFrame(()=>requestAnimationFrame(go)); setTimeout(go,120); setTimeout(land,1400);
    setTimeout(()=>intro.remove(),1700); },2400); }); } } else document.body.classList.add('intro-done');
/* Contact form (Formspree): submit in place, show the confirmation, keep the normal POST as fallback */
(function(){ const f=document.getElementById('cform'); if(!f)return; f.addEventListener('submit',e=>{ if(!f.reportValidity())return; if(f._gotcha&&f._gotcha.value)return; e.preventDefault(); const btn=f.querySelector('button[type=submit]'); btn.disabled=true; btn.textContent='Versturen…';
  fetch(f.action,{method:'POST',body:new FormData(f),headers:{'Accept':'application/json'}}).then(r=>{ if(!r.ok)throw new Error('http '+r.status); f.querySelector('.ok').textContent='Dank je, '+(f.naam.value||'').trim()+'. Je bericht is verstuurd; we reageren via WhatsApp of e-mail. Spoed? App of bel, dag en nacht.'; f.classList.add('sent'); })
  .catch(()=>{ btn.disabled=false; btn.textContent='Verstuur bericht'; let er=f.querySelector('.err'); if(!er){ er=document.createElement('p'); er.className='err'; f.querySelector('.f').appendChild(er); } er.textContent='Versturen lukte niet. Probeer het opnieuw of app ons direct.'; }); }); })();
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
const rv=new IntersectionObserver(es=>{ for(const e of es){ if(!e.isIntersecting)continue; e.target.classList.add('in'); (e.target.matches('.kicker')?[e.target]:Array.from(e.target.querySelectorAll('.kicker'))).forEach(decode); rv.unobserve(e.target); } },{threshold:0.15});
document.querySelectorAll('.rv').forEach(el=>rv.observe(el));
})();
