/* Fastgas Service NL: text motion. Headings reveal word by word, the ticker loops, the closing slogan rotates,
   cards get a pointer spotlight. Everything degrades to static under prefers-reduced-motion. */
(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = matchMedia('(pointer: fine)').matches;

  /* split a heading into word spans (keeps inline markup such as <b> intact by only splitting text nodes) */
  function split(el) {
    if (el.dataset.split) return; el.dataset.split = '1';
    var i = 0;
    var walk = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var parts = n.nodeValue.split(/(\s+)/), frag = document.createDocumentFragment();
          parts.forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span'); w.className = 'w'; var s = document.createElement('span'); s.textContent = p; s.style.setProperty('--i', i++); w.appendChild(s); frag.appendChild(w);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1 && !n.classList.contains('w')) walk(n);
      });
    };
    walk(el);
  }
  var heads = document.querySelectorAll('h1.t, h2.t');
  if (!reduce) Array.prototype.forEach.call(heads, function (h) {
    split(h);
    if (!h.closest('.rv')) requestAnimationFrame(function () { requestAnimationFrame(function () { h.classList.add('in'); }); });
  });

  /* ticker: duplicate the strip once so translateX(-50%) loops without a seam */
  Array.prototype.forEach.call(document.querySelectorAll('.ticker .tk'), function (tk) {
    if (tk.dataset.dup) return; tk.dataset.dup = '1';
    tk.innerHTML += tk.innerHTML;
  });
  /* tickers only animate while on screen */
  if ('IntersectionObserver' in window) { var tio = new IntersectionObserver(function (es) { es.forEach(function (e) { e.target.classList.toggle('off', !e.isIntersecting); }); }, { rootMargin: '80px 0px' }); Array.prototype.forEach.call(document.querySelectorAll('.ticker'), function (t) { tio.observe(t); }); }

  /* slogan rotator: words fly out, the next slogan flies in */
  var sl = document.getElementById('slogan');
  if (sl && !reduce) {
    var list = (sl.dataset.slogans || '').split('|').map(function (s) { return s.trim(); }).filter(Boolean);
    if (list.length > 1) {
      var idx = 0, timer = null, running = false;
      var show = function (text) { sl.textContent = text; delete sl.dataset.split; split(sl); };
      var next = function () {
        if (document.hidden) return;
        sl.classList.add('out');
        setTimeout(function () { idx = (idx + 1) % list.length; show(list[idx]); sl.classList.remove('out'); void sl.offsetWidth; sl.classList.add('in'); }, 520);
      };
      var start = function () { if (running) return; running = true; timer = setInterval(next, 4200); };
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) start(); else { running = false; clearInterval(timer); } }); }, { threshold: 0.4 });
      io.observe(sl);
    }
  }

  /* spotlight: cards light up where the pointer is */
  if (fine && !reduce) {
    var sel = '.stat, .col, .cc, .tiles a, .reasons li';
    document.addEventListener('pointermove', function (e) {
      var el = e.target.closest && e.target.closest(sel); if (!el) return;
      var r = el.getBoundingClientRect();
      el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
      el.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    }, { passive: true });
  }

  /* floating contact button: tap toggles, desktop hover opens, outside click / Escape closes */
  var fab = document.getElementById('fab'), fabBtn = document.getElementById('fabBtn'), fabMenu = document.getElementById('fabMenu');
  if (fab && fabBtn) {
    var setOpen = function (v) { fab.classList.toggle('open', v); fabBtn.setAttribute('aria-expanded', v ? 'true' : 'false'); fabMenu.setAttribute('aria-hidden', v ? 'false' : 'true'); };
    fabBtn.addEventListener('click', function (e) { e.stopPropagation(); setOpen(!fab.classList.contains('open')); });
    if (fine) { var t; fab.addEventListener('pointerenter', function () { clearTimeout(t); setOpen(true); }); fab.addEventListener('pointerleave', function () { t = setTimeout(function () { setOpen(false); }, 350); }); }
    document.addEventListener('click', function (e) { if (!fab.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
  }

  /* delivery check: place name, district, neighbourhood or 4-digit postcode -> answer with a link */
  var bq = document.getElementById('bcheckQ'), bo = document.getElementById('bcheckOut'), bb = document.getElementById('bcheckBtn'), cdata = document.getElementById('cityData');
  if (bq && bo && cdata) {
    var cities = []; try { cities = JSON.parse(cdata.textContent); } catch (e) {}
    var base = document.body.classList.contains('sub') ? '../' : '';
    var norm = function (t) { return (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); };
    var prov = function (pc) { var n = +pc; if ((n >= 1000 && n <= 1299) || (n >= 1400 && n <= 2199)) return 'Noord-Holland'; if ((n >= 1300 && n <= 1399) || (n >= 8200 && n <= 8329) || (n >= 3890 && n <= 3899)) return 'Flevoland'; if ((n >= 3400 && n <= 3999) || (n >= 4130 && n <= 4139)) return 'Utrecht'; return null; };
    var run = function () {
      var q = norm(bq.value); bo.className = 'bcheck-out'; if (!q) { bo.textContent = 'Typ je plaats of de eerste vier cijfers van je postcode.'; return; }
      var pc = q.match(/^(\d{4})/);
      if (pc) { var p = prov(pc[1]); if (p) { bo.className = 'bcheck-out yes'; bo.innerHTML = 'Ja. Postcode ' + pc[1] + ' ligt in ' + p + ': daar bezorgen we dag en nacht, binnen 20 minuten. <a href="' + base + 'bezorggebieden/">Bekijk alle plaatsen</a> of app je adres.'; } else { bo.className = 'bcheck-out no'; bo.innerHTML = 'Postcode ' + pc[1] + ' ligt buiten Noord-Holland, Flevoland en Utrecht. App je adres: voor evenementen en vaste klanten rijden we vaak toch.'; } return; }
      if (q.length < 3) { bo.textContent = 'Typ minstens drie letters.'; return; }
      var hit = null, via = null;
      for (var i = 0; i < cities.length && !hit; i++) { var c = cities[i]; if (norm(c.n).indexOf(q) === 0 || norm(c.n) === q) hit = c; }
      for (var j = 0; j < cities.length && !hit; j++) { var c2 = cities[j]; if (norm(c2.n).indexOf(q) >= 0) hit = c2; }
      for (var k = 0; k < cities.length && !hit; k++) { var c3 = cities[k]; for (var w = 0; w < (c3.w || []).length; w++) { if (norm(c3.w[w]).indexOf(q) >= 0) { hit = c3; via = c3.w[w]; break; } } }
      if (hit) { bo.className = 'bcheck-out yes'; bo.innerHTML = 'Ja. ' + (via ? via + ' (' + hit.n + ')' : hit.n) + ': binnen 20 minuten op locatie, dag en nacht. <a href="' + base + hit.s + '/">Naar lachgas bezorgen ' + hit.n + '</a>.'; }
      else { bo.className = 'bcheck-out no'; bo.innerHTML = 'Niet gevonden in onze lijst. Ligt het in Noord-Holland, Flevoland of Utrecht, dan rijden we vrijwel zeker: <a href="#" data-ph="whatsapp">app je adres</a> en je hoort het direct.'; }
    };
    bb.addEventListener('click', run); bq.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); run(); } }); bq.addEventListener('input', function () { if (bq.value.length >= 4) run(); });
  }
})();
