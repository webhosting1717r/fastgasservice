/* Fastgas Service NL: technisch overzicht vergroten. Zonder scripting is "Inzoomen" een gewone link naar het grote bestand. */
(function () {
  'use strict';
  var fig = document.querySelector('.ibp');
  if (!fig || typeof HTMLDialogElement === 'undefined') return;
  var link = fig.querySelector('.ibp-zoom');
  var img = fig.querySelector('img');
  if (!link || !img) return;
  var root = document.documentElement;
  var dlg = null;

  function build() {
    dlg = document.createElement('dialog');
    dlg.className = 'bpdlg';
    dlg.setAttribute('aria-label', 'Technisch overzicht van de Fastgas 2 kg tank, vergroot');
    dlg.innerHTML =
      '<div class="bpbar">' +
        '<button type="button" class="bpbtn" data-bp="zoom" aria-pressed="false">Inzoomen</button>' +
        '<button type="button" class="bpbtn pri" data-bp="close">Sluiten</button>' +
      '</div>' +
      '<div class="bpscroll"><img src="' + link.getAttribute('href') + '" alt="' + img.getAttribute('alt').replace(/"/g, '&quot;') + '" width="1536" height="1024" decoding="async"></div>';
    var zoom = dlg.querySelector('[data-bp="zoom"]');
    zoom.addEventListener('click', function () {
      var on = dlg.classList.toggle('zoomed');
      zoom.textContent = on ? 'Uitzoomen' : 'Inzoomen';
      zoom.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    dlg.querySelector('[data-bp="close"]').addEventListener('click', function () { dlg.close(); });
    dlg.querySelector('.bpscroll').addEventListener('click', function (e) {
      if (e.target === e.currentTarget) dlg.close();
    });
    dlg.addEventListener('close', function () {
      root.classList.remove('bp-open');
      dlg.classList.remove('zoomed');
      zoom.textContent = 'Inzoomen';
      zoom.setAttribute('aria-pressed', 'false');
    });
    document.body.appendChild(dlg);
  }

  function open(e) {
    e.preventDefault();
    if (!dlg) build();
    root.classList.add('bp-open');
    dlg.showModal();
  }

  root.classList.add('bp-js');
  link.addEventListener('click', open);
  img.addEventListener('click', open);
})();
