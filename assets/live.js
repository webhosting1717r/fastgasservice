/* Fastgas Service NL: live status. Amsterdam clock in the header pill and the hero line, a day/night message for the 24/7 service,
   and today's row marked in the opening hours. Text only, no layout reads, paused while the tab is hidden. */
(function () {
  'use strict';
  var TZ = 'Europe/Amsterdam', parts, dayName;
  try {
    parts = new Intl.DateTimeFormat('nl-NL', { timeZone: TZ, hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'long' });
    parts.formatToParts(new Date());
  } catch (e) { return; }
  var WEEK = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'];

  /* the first text block waits (at most 1.5 s, CSS has its own fail-safe) for the web fonts, so the heading never reflows when they arrive */
  (function () {
    var root = document.documentElement, shown = false, tries = 0;
    var link = document.querySelector('link[href*="fonts.googleapis.com/css2"]');
    function show() { if (!shown) { shown = true; root.classList.add('fgf'); } }
    setTimeout(show, 1500);
    if (!document.fonts || !document.fonts.load) { show(); return; }
    function fonts() { Promise.all([document.fonts.load('800 1em "Barlow Condensed"'), document.fonts.load('400 1em Barlow'), document.fonts.load('500 1em "IBM Plex Mono"')]).then(show, show); }
    (function poll() { if (shown) return; if (!link || (link.rel === 'stylesheet' && link.sheet)) { fonts(); return; } if (++tries < 15) setTimeout(poll, 100); })();
  })();

  var pill = document.getElementById('liveClock'), pillLink = document.getElementById('livePill');
  var bar = document.getElementById('liveBar'), barTime = document.getElementById('liveTime'), barDay = document.getElementById('liveDay'), barMsg = document.getElementById('liveMsg');
  var rows = document.querySelectorAll('table.hours tbody tr:not(.note)');
  var last = { hm: '', hms: '', day: -1, msg: '' };

  function read() {
    var o = {}, p = parts.formatToParts(new Date()), i;
    for (i = 0; i < p.length; i++) o[p[i].type] = p[i].value;
    return { h: +o.hour, m: o.minute, s: o.second, wd: WEEK.indexOf(o.weekday) };
  }

  function paint() {
    var t = read(), hm = (t.h < 10 ? '0' : '') + t.h + ':' + t.m, hms = hm + ':' + t.s;
    if (pill && hm !== last.hm) {
      pill.textContent = hm; pill.setAttribute('datetime', hm);
      if (pillLink) pillLink.setAttribute('aria-label', '24/7 bezorging. Het is nu ' + hm + ' in Amsterdam. Bekijk de openingstijden');
      last.hm = hm;
    }
    if (barTime && hms !== last.hms) { barTime.textContent = hms; barTime.setAttribute('datetime', hms); last.hms = hms; }
    if (t.wd !== last.day) {
      last.day = t.wd;
      if (barDay) barDay.textContent = WEEK[t.wd] || '';
      for (var i = 0; i < rows.length; i++) {
        var on = i === t.wd, tr = rows[i], td = tr.querySelector('td'), tag = td && td.querySelector('.nu');
        tr.classList.toggle('today', on);
        if (on) { tr.setAttribute('aria-current', 'date'); if (td && !tag) { tag = document.createElement('span'); tag.className = 'nu'; tag.innerHTML = '<i class="ldot" aria-hidden="true"></i>vandaag, nu open'; td.appendChild(tag); } }
        else { tr.removeAttribute('aria-current'); if (tag) tag.remove(); }
      }
    }
    var msg = t.h < 6 ? 'nachtbezorging actief' : 'bezorging actief';
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
