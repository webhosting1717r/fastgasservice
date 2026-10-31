/* Fastgas Service NL: iOS layer. Segmented province tabs and the place finder on /lachgas-bezorgen/, and the bottom action bar
   that steps aside while the menu is open. Without scripting every province list stays visible. */
(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.add('js');

  /* segmented control: arrow keys move between tabs, one panel visible at a time */
  var seg = document.querySelector('.iseg');
  if (seg) {
    var tabs = Array.prototype.slice.call(seg.querySelectorAll('[role="tab"]'));
    var select = function (t, focus) {
      tabs.forEach(function (x) {
        var on = x === t, p = document.getElementById(x.getAttribute('aria-controls'));
        x.setAttribute('aria-selected', on ? 'true' : 'false'); x.tabIndex = on ? 0 : -1;
        if (p) p.hidden = !on;
      });
      seg.style.setProperty('--i', tabs.indexOf(t));
      if (focus) t.focus();
    };
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(t); });
      t.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (d) { e.preventDefault(); select(tabs[(i + d + tabs.length) % tabs.length], true); }
      });
    });
    seg.style.setProperty('--n', tabs.length);
    select(tabs[0]);
  }

  /* place finder: filters across all provinces, shows every match at once */
  var q = document.getElementById('placeQ'), none = document.getElementById('placeNone');
  if (q) {
    var norm = function (t) { return (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); };
    var items = Array.prototype.slice.call(document.querySelectorAll('.ipanel li[data-q]'));
    var panels = Array.prototype.slice.call(document.querySelectorAll('.ipanel'));
    var run = function () {
      var v = norm(q.value), hits = 0;
      document.body.classList.toggle('searching', !!v);
      items.forEach(function (li) { var ok = !v || norm(li.dataset.q).indexOf(v) >= 0; li.hidden = !ok; if (ok && v) hits++; });
      if (v) panels.forEach(function (p) { p.hidden = !p.querySelector('li[data-q]:not([hidden])'); });
      else if (seg) { var cur = seg.querySelector('[aria-selected="true"]'); panels.forEach(function (p) { p.hidden = cur && p.id !== cur.getAttribute('aria-controls'); }); }
      if (none) none.hidden = !v || hits > 0;
    };
    q.addEventListener('input', run);
    q.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); var a = document.querySelector('.ipanel li[data-q]:not([hidden]) a'); if (a && q.value) a.click(); } });
  }

  /* bottom bar: hidden while the menu is open and while the page is scrolled to the very top of a hero with its own buttons */
  var bar = document.querySelector('.mbar');
  if (bar && 'MutationObserver' in window) {
    var sync = function () { bar.classList.toggle('away', document.body.classList.contains('menu-open') || root.classList.contains('menu-open')); };
    new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['class'] });
  }
})();
