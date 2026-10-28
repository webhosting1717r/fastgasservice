/* Fastgas Service NL: live status. Amsterdam clock in the header pill and the hero line, a day/night message for the 24/7 service,
   and today's row marked in the opening hours. Text only, no layout reads, paused while the tab is hidden. */
(function () {
  'use strict';
  var TZ = 'Europe/Amsterdam', parts, dateFmt;
  try {
    parts = new Intl.DateTimeFormat('nl-NL', { timeZone: TZ, hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'long' });
    dateFmt = new Intl.DateTimeFormat('nl-NL', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
    parts.formatToParts(new Date());
  } catch (e) { return; }
  var WEEK = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'];

  var pill = document.getElementById('liveClock'), pillLink = document.getElementById('livePill');
  var bar = document.getElementById('liveBar'), barTime = document.getElementById('liveTime'), barDay = document.getElementById('liveDay'), barMsg = document.getElementById('liveMsg');
  var rows = document.querySelectorAll('table.hours tbody tr:not(.note)');
  var last = { hm: '', hms: '', day: -1, msg: '' };
  var dayFill = document.getElementById('dayFill');
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* the seconds roll: only characters that changed get a short slide-in, textContent always equals the clock string */
  function setClock(el, s) {
    var kids = el.children, i;
    if (kids.length !== s.length) { el.textContent = ''; for (i = 0; i < s.length; i++) { var c = document.createElement('span'); c.textContent = s.charAt(i); el.appendChild(c); } return; }
    for (i = 0; i < s.length; i++) if (kids[i].textContent !== s.charAt(i)) {
      kids[i].textContent = s.charAt(i);
      if (!calm && kids[i].animate) kids[i].animate([{ transform: 'translateY(60%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 340, easing: 'cubic-bezier(.22,1,.36,1)' });
    }
  }

  function read() {
    var o = {}, p = parts.formatToParts(new Date()), i;
    for (i = 0; i < p.length; i++) o[p[i].type] = p[i].value;
    return { h: +o.hour, m: o.minute, s: o.second, wd: WEEK.indexOf(o.weekday) };
  }

  function paint() {
    var t = read(), hm = (t.h < 10 ? '0' : '') + t.h + ':' + t.m, hms = hm + ':' + t.s;
    if (pill && hm !== last.hm) {
      pill.textContent = hm; pill.setAttribute('datetime', hm);
      if (pillLink) pillLink.setAttribute('aria-label', '24/7 ' + hm + ', Amsterdam. Bekijk de openingstijden');
      last.hm = hm;
    }
    if (barTime && hms !== last.hms) { setClock(barTime, hms); barTime.setAttribute('datetime', hms); last.hms = hms; if (dayFill) dayFill.style.transform = 'scaleX(' + ((t.h * 3600 + (+t.m) * 60 + (+t.s)) / 86400).toFixed(4) + ')'; }
    if (t.wd !== last.day) {
      last.day = t.wd;
      if (barDay) barDay.textContent = dateFmt.format(new Date());
      for (var i = 0; i < rows.length; i++) {
        var on = i === t.wd, tr = rows[i], td = tr.querySelector('td'), tag = td && td.querySelector('.nu');
        tr.classList.toggle('today', on);
        if (on) { tr.setAttribute('aria-current', 'date'); if (td && !tag) { tag = document.createElement('span'); tag.className = 'nu'; tag.innerHTML = '<i class="ldot" aria-hidden="true"></i>vandaag, nu open'; td.appendChild(tag); } }
        else { tr.removeAttribute('aria-current'); if (tag) tag.remove(); }
      }
    }
    var msg = t.h < 6 ? '24/7 nachtbezorging actief' : '24/7 bezorging actief';
    if (barMsg && msg !== last.msg) { barMsg.textContent = msg; last.msg = msg; }
  }

  var timer = 0;
  function loop() { paint(); timer = setTimeout(loop, 1000 - (Date.now() % 1000) + 8); }
  function start() { if (!timer) loop(); }
  function stop() { clearTimeout(timer); timer = 0; }
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
  if (!document.hidden) start();
  window.__fgLive = { paint: paint };
})();
