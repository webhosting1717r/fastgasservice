/* Fastgas Service NL: interactive 3D product viewer (subpages only).
   Three.js (assets/vendor/three, MIT) is loaded on demand once the section comes near the screen and the visitor has started
   using the page, so pages stay as light as before.

   HOW TO ADJUST
   - MODEL_URL: leave null for the built-in tank (modelled after the Fastgas tank in the site's own footage), or point it at your
     own .glb/.gltf: put the file in assets/models/ and set MODEL_URL = BASE + 'models/fastgas-tank.glb'. The model is centred
     and scaled to about 3.3 units high.
   - VIEWS: the preset camera angles (az = around the tank, po = from above, d = distance, ty = height the camera looks at).
   - Colours of the built-in tank: NAVY, BLACK and YELLOW below. */
(function () {
  'use strict';
  var script = document.currentScript, BASE = script ? script.src.replace(/viewer3d\.js.*$/, '') : '/assets/';
  var VENDOR = BASE + 'vendor/three/';
  var MODEL_URL = null;
  var STRAP_DEG = 64.0;   /* strap position measured on the product photo (degrees to the right of the label's front centre) */
  var DOPJE = { x: 1.65, z: 1.0 };   /* v67: where the loose dopje stands, in the dopje view only */
  var NAVY = '#1b2740', BLACK = '#0d1015', YELLOW = '#ead61f';
  var VIEWS = {
    voor: { label: 'Voorkant', az: 0.16, po: 1.36, d: 6.9, ty: 1.8 },
    zij: { label: 'Zijkant', az: Math.PI / 2, po: 1.36, d: 6.9, ty: 1.8 },
    achter: { label: 'Achterkant', az: Math.PI - 0.15, po: 1.36, d: 6.9, ty: 1.8 },
    bovenkant: { label: 'Bovenkant', az: 0.7, po: 0.75, d: 3.0, ty: 3.35 },
    etiket: { label: 'Etiket', az: -0.1, po: 1.5, d: 4.8, ty: 1.7 },
    dopje: { label: 'Dopje', az: 2.75, po: 1.2, d: 1.35, ty: 0.3, tx: DOPJE.x, tz: DOPJE.z, min: 0.7, dopje: true }
  };
  var DEFAULT_VIEW = 'voor', RESUME_AFTER = 3500, TWEEN_MS = 750;

  var stage = document.querySelector('.v3d-stage'); if (!stage) return;
  var wrap = stage.querySelector('.v3d-canvas'), ui = document.querySelector('.v3d-ui');
  var viewsBox = ui && ui.querySelector('.v3d-views'), resetBtn = ui && ui.querySelector('.v3d-reset');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  var tankMeshes = [], tankMats = [];   /* v68 */
  var dopje = null, dopjeS = 0, dopjeOn = false, dopjeT = 0, tweenMin = 2.6;
  var T = null, renderer = null, scene = null, camera = null, controls = null, pmrem = null, raf = 0, active = false, visible = false, tween = null, resumeT = 0, started = false, disposed = false, labelTex = null, needs = true;

  function fallback(reason) { stage.classList.add('fallback'); if (ui) ui.hidden = true; var n = document.querySelector('.v3d-note'); if (n) n.textContent = '3D-weergave is op dit apparaat niet beschikbaar; je ziet de foto van de Fastgas tank.'; if (reason && window.console) console.info('3D viewer fallback:', reason); }
  function webglOK() { try { var c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; } }

  /* ---------- UI ---------- */
  function buildUI() {
    if (!ui) return;
    Object.keys(VIEWS).forEach(function (k) { var b = document.createElement('button'); b.type = 'button'; b.textContent = VIEWS[k].label; b.dataset.view = k; b.setAttribute('aria-pressed', String(k === DEFAULT_VIEW)); b.addEventListener('click', function () { goView(k, true); }); viewsBox.appendChild(b); });
    if (resetBtn) resetBtn.addEventListener('click', function () { goView(DEFAULT_VIEW, true); });
  }
  function markView(k) { if (viewsBox) Array.prototype.forEach.call(viewsBox.children, function (b) { b.setAttribute('aria-pressed', String(b.dataset.view === k)); }); }

  /* ---------- the label: F>STG>S wordmark with its dotted tail, the round stickers, the small warning labels ---------- */
  var FONT = '"Barlow", "Barlow Condensed", "Helvetica Neue", Arial, sans-serif';
  function heavyText(x, s, px, cx, cy, color) { x.font = '700 ' + px + 'px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round'; x.lineCap = 'round'; x.strokeStyle = color; x.fillStyle = color; x.lineWidth = px * 0.1; x.strokeText(s, cx, cy); x.fillText(s, cx, cy); }
  function chevron(x, cx, cy, h, color) { var w = h * 0.5, t = h * 0.21; x.strokeStyle = color; x.lineWidth = t; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(cx - w / 2, cy - h / 2); x.lineTo(cx + w / 2, cy); x.lineTo(cx - w / 2, cy + h / 2); x.stroke(); }
  function ringText(x, cx, cy, r, text, color, px) { x.save(); x.translate(cx, cy); x.fillStyle = color; x.font = '600 ' + px + 'px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; var n = text.length; for (var i = 0; i < n; i++) { var a = -Math.PI / 2 + (i / n) * Math.PI * 2; x.save(); x.rotate(a); x.translate(0, -r); x.fillText(text[i], 0, 0); x.restore(); } x.restore(); }
  function paintLabel() {   /* v59 */
    var hi = Math.min(window.devicePixelRatio || 1, 2) >= 2 && !matchMedia('(pointer:coarse)').matches;
    var W = hi ? 3072 : 2048, H = Math.round(W * 1.9 / (Math.PI * 2 * 0.5)), k = W / 2048;   /* texture aspect = circumference : label height, so nothing is stretched */
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H; var x = cv.getContext('2d'); x.clearRect(0, 0, W, H);
    var white = '#ffffff'; var U = function (deg) { return W * (0.5 + deg / 360); };   /* u from the angle around the tank; 0 faces the camera in the front view */
    /* tonal chevron pattern of the real sleeve */
    for (var r = -1; r < 20; r++) for (var c2 = -1; c2 < 30; c2++) { var ppx = (c2 * 74 + (r % 2) * 37) * k, ppy = (r * 74 + 18) * k; var yel = (r * 7 + c2 * 5) % 13 === 0; var col = yel ? 'rgba(234,214,31,.26)' : 'rgba(255,255,255,.085)'; chevron(x, ppx, ppy, 26 * k, col); chevron(x, ppx + 19 * k, ppy, 26 * k, col); }
    /* wordmark F>STG>S, reading upwards, 79% of the label height, 15 degrees left of centre, as in the photo */
    x.save(); x.translate(U(-15), H * 0.53); x.rotate(-Math.PI / 2);
    var g = 214 * k, step = 164 * k, seq = ['F', '>', 'S', 'T', 'G', '>', 'S'], x0 = -step * 3;
    seq.forEach(function (ch, i) { var px = x0 + i * step; if (ch === '>') chevron(x, px, 0, g * 0.62, white); else heavyText(x, ch, g, px, 0, white); });
    x.fillStyle = white; x.font = '600 ' + 30 * k + 'px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('\u00AE', x0 + 6 * step + 86 * k, -84 * k);
    var sq = 17 * k; for (var row = 0; row < 3; row++) for (var col2 = 0; col2 < 4 - row; col2++) x.fillRect(x0 - g * 0.42 - 30 * k - col2 * 27 * k, -g * 0.4 + row * 27 * k, sq, sq);
    x.restore();
    /* stickers where the photo has them */
    function disc(px, py, rr, fill) { x.fillStyle = fill; x.beginPath(); x.arc(px, py, rr, 0, Math.PI * 2); x.fill(); }
    x.save(); x.translate(U(-52), H * 0.12); x.rotate(-Math.PI / 2); x.fillStyle = YELLOW; x.beginPath(); x.ellipse(0, 0, 54 * k, 34 * k, 0, 0, Math.PI * 2); x.fill(); x.fillStyle = '#111'; x.font = '800 ' + 26 * k + 'px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('2000 g', 0, 1); x.restore();
    disc(U(-44), H * 0.215, 34 * k, '#fff'); disc(U(-44), H * 0.215, 28 * k, YELLOW); x.fillStyle = '#111'; x.font = '800 ' + 20 * k + 'px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('EU', U(-44), H * 0.215 + k);
    disc(U(26), H * 0.145, 78 * k, '#fff'); ringText(x, U(26), H * 0.145, 60 * k, 'SAME GREAT QUALITY \u00B7 IMPROVED LOOKS \u00B7 ', '#111', 15 * k);
    x.save(); x.translate(U(26), H * 0.145); x.rotate(-Math.PI / 2); [[-22, -12], [-5, -12], [12, -12], [-14, 10], [3, 10]].forEach(function (p) { chevron(x, p[0] * k, p[1] * k, 20 * k, '#111'); }); x.restore();
    disc(U(19), H * 0.86, 80 * k, YELLOW); ringText(x, U(19), H * 0.86, 63 * k, 'SCAN NOW TO CHECK \u00B7 BE SURE IT\u2019S ORIGINAL \u00B7 ', '#111', 14 * k); x.fillStyle = '#fff'; x.fillRect(U(19) - 34 * k, H * 0.86 - 34 * k, 68 * k, 68 * k);
    x.fillStyle = '#111'; for (var qy = 0; qy < 7; qy++) for (var qx = 0; qx < 7; qx++) if ((qx * 7 + qy * 3 + qx * qy) % 3 !== 1 || (qx < 3 && qy < 3) || (qx > 3 && qy < 3) || (qx < 3 && qy > 3)) x.fillRect(U(19) - 29 * k + qx * 8.5 * k, H * 0.86 - 29 * k + qy * 8.5 * k, 7.5 * k, 7.5 * k);
    /* small print column and warning diamond on the left side */
    x.save(); x.translate(U(-72), H * 0.5); x.rotate(-Math.PI / 2); x.fillStyle = 'rgba(255,255,255,.85)'; x.font = '600 ' + 17 * k + 'px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('ORIGINAL NITROUS OXIDE \u00B7 FOOD GRADE \u00B7 2000 g \u00B7 N2O 99,9% \u00B7 165 BAR TESTED \u00B7 PROFESSIONAL USE ONLY \u00B7 18+', 0, 0); x.restore();
    x.save(); x.translate(U(-95), H * 0.5); x.rotate(Math.PI / 4); x.fillStyle = '#e8501e'; x.fillRect(-32 * k, -32 * k, 64 * k, 64 * k); x.fillStyle = '#fff'; x.fillRect(-25 * k, -25 * k, 50 * k, 50 * k); x.restore(); x.fillStyle = '#111'; x.font = '800 ' + 21 * k + 'px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('N2O', U(-95), H * 0.5 + k);
    var t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy()); return t;
  }
  function paintBand() {
    var cv = document.createElement('canvas'); cv.width = 2048; cv.height = 64; var x = cv.getContext('2d'); x.fillStyle = YELLOW; x.fillRect(0, 0, 2048, 64); x.fillStyle = '#15171c'; x.font = '600 22px ' + FONT; x.textBaseline = 'middle';
    var s = 'FASTGAS ORIGINAL NITROUS OXIDE · FOOD GRADE · 2000 g · N2O · '; var w = x.measureText(s).width; for (var px = 0; px < 2048; px += w + 30) x.fillText(s, px, 33);
    var t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.wrapS = T.RepeatWrapping; return t;
  }

  /* ---------- the tank: straight navy cylinder, black cap and foot, yellow band, nozzle, bowed carrying strap ---------- */
  function buildTank() {
    var g = new T.Group();
    var navy = new T.MeshPhysicalMaterial({ color: NAVY, metalness: 0.2, roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.25, envMapIntensity: 0.9 });
    var black = new T.MeshPhysicalMaterial({ color: BLACK, metalness: 0.1, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.3 });
    var yellow = new T.MeshStandardMaterial({ color: YELLOW, metalness: 0.05, roughness: 0.45 });
    var R = 0.5, SEG = 128;
    var mk = function (geo, mat, y, cast) { var m = new T.Mesh(geo, mat); m.position.y = y; m.castShadow = cast !== false; m.receiveShadow = true; g.add(m); return m; };
    /* v60: proportions measured on the product photo, body diameter = 1: foot 0.42, body 2.57 (band 0.09 at the top), cap 0.43, nozzle 0.20, total 3.62 */
    var cap = function (r, y0, y1, eb, et) { var p = [new T.Vector2(0, y0)], i, a; if (eb > 0) { for (i = 0; i <= 8; i++) { a = (i / 8) * Math.PI / 2; p.push(new T.Vector2(r - eb + Math.sin(a) * eb, y0 + eb - Math.cos(a) * eb)); } } else p.push(new T.Vector2(r, y0)); if (et > 0) { for (i = 0; i <= 8; i++) { a = (i / 8) * Math.PI / 2; p.push(new T.Vector2(r - et + Math.cos(a) * et, y1 - et + Math.sin(a) * et)); } } else p.push(new T.Vector2(r, y1)); p.push(new T.Vector2(0, y1)); return new T.LatheGeometry(p, SEG); };
    mk(cap(0.53, 0, 0.42, 0.07, 0.012), black, 0);
    mk(new T.CylinderGeometry(R, R, 2.57, SEG, 1, true), navy, 1.705);
    var bandMat = new T.MeshStandardMaterial({ color: YELLOW, metalness: 0.05, roughness: 0.45 });
    var band = new T.Mesh(new T.CylinderGeometry(R + 0.004, R + 0.004, 0.09, SEG, 1, true, -Math.PI, Math.PI * 2), bandMat); band.position.y = 2.945; g.add(band);
    mk(cap(0.53, 2.99, 3.42, 0.012, 0.06), black, 0);
    /* v67: the lid as photographed from above: flat, with a round centre plug, a groove ring around it and one small dot near the edge */
    var plugMat = new T.MeshPhysicalMaterial({ color: '#101318', metalness: 0.1, roughness: 0.34, clearcoat: 0.4, clearcoatRoughness: 0.3 });
    mk(new T.CylinderGeometry(0.15, 0.155, 0.016, 64), plugMat, 3.428);
    var groove = new T.Mesh(new T.TorusGeometry(0.185, 0.005, 8, 96), new T.MeshStandardMaterial({ color: '#07090c', roughness: 0.7 })); groove.rotation.x = Math.PI / 2; groove.position.y = 3.421; g.add(groove);
    var dot = new T.Mesh(new T.CylinderGeometry(0.013, 0.013, 0.01, 20), new T.MeshStandardMaterial({ color: '#2a2d33', metalness: 0.6, roughness: 0.4 })); dot.position.set(0.395, 3.423, 0.12); g.add(dot);
    /* label sleeve: the unwrapped product photo; if it cannot load, the painted label takes over */
    var sleeveMat = new T.MeshStandardMaterial({ color: NAVY, metalness: 0.0, roughness: 0.66, envMapIntensity: 0.5 });   /* v63/v67: semi-matte print, no clearcoat (its environment reflection showed as a vertical gloss streak) */
    var sleeve = new T.Mesh(new T.CylinderGeometry(R + 0.007, R + 0.007, 2.48, SEG, 1, true, -Math.PI, Math.PI * 2), sleeveMat); sleeve.position.y = 1.66; g.add(sleeve);
    var loader = new T.TextureLoader(); var prep = function (t) { t.colorSpace = T.SRGBColorSpace; t.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy()); return t; };
    var hiTex = Math.min(window.devicePixelRatio || 1, 2) > 1 && !matchMedia('(pointer:coarse)').matches && renderer.capabilities.maxTextureSize >= 4096;
    loader.load(BASE + (hiTex ? 'tank-label@2x.webp?v=15' : 'tank-label.webp?v=15'), function (t) { labelTex = prep(t); sleeveMat.map = labelTex; sleeveMat.color.set('#ffffff'); sleeveMat.needsUpdate = true; needs = true; start(); }, undefined, function () { labelTex = paintLabel(); sleeveMat.map = labelTex; sleeveMat.transparent = true; sleeveMat.depthWrite = false; sleeveMat.needsUpdate = true; needs = true; start(); });
    loader.load(BASE + 'tank-band.webp?v=15', function (t) { prep(t); t.wrapS = T.RepeatWrapping; bandMat.map = t; bandMat.color.set('#ffffff'); bandMat.needsUpdate = true; needs = true; start(); }, undefined, function () { bandMat.map = paintBand(); bandMat.color.set('#ffffff'); bandMat.needsUpdate = true; needs = true; start(); });
    /* carrying strap: a flat band close to the body on the right, clipped to the cap and the foot */
    var path = new T.CatmullRomCurve3([new T.Vector3(0.555, 3.28, 0), new T.Vector3(0.6, 3.1, 0), new T.Vector3(0.65, 2.55, 0), new T.Vector3(0.67, 1.8, 0), new T.Vector3(0.65, 1.05, 0), new T.Vector3(0.6, 0.55, 0), new T.Vector3(0.555, 0.36, 0)]);
    var shape = new T.Shape(); shape.moveTo(-0.06, -0.02); shape.lineTo(0.06, -0.02); shape.lineTo(0.06, 0.02); shape.lineTo(-0.06, 0.02); shape.closePath();
    var strapMat = new T.MeshStandardMaterial({ color: '#12151a', metalness: 0.0, roughness: 0.9, envMapIntensity: 0.15 });   /* v64: matte webbing, no gloss line */
    var sg = new T.Group(); sg.rotation.y = (STRAP_DEG - 90) * Math.PI / 180; g.add(sg);   /* v62: strap at its measured angle around the tank */
    var strap = new T.Mesh(new T.ExtrudeGeometry(shape, { steps: 60, bevelEnabled: false, extrudePath: path }), strapMat); strap.castShadow = true; sg.add(strap);
    [[0.555, 3.22], [0.555, 0.42]].forEach(function (c) { var clip = new T.Mesh(new T.BoxGeometry(0.1, 0.2, 0.19), strapMat); clip.position.set(c[0], c[1], 0); clip.castShadow = true; sg.add(clip); var slot = new T.Mesh(new T.BoxGeometry(0.02, 0.05, 0.11), new T.MeshStandardMaterial({ color: '#2a2e36', metalness: 0.2, roughness: 0.6 })); slot.position.set(c[0] + 0.05, c[1] + 0.02, 0); sg.add(slot); });
    g.traverse(function (o) { if (o.isMesh) { tankMeshes.push(o); [].concat(o.material).forEach(function (m) { if (tankMats.indexOf(m) < 0) { m.userData.t0 = !!m.transparent; tankMats.push(m); } }); } });   /* v68: collected before the dopje exists */
    dopje = buildDopje(); dopje.position.set(DOPJE.x, 0, DOPJE.z); dopje.visible = false; dopje.scale.setScalar(0.4); g.add(dopje);
    return g;
  }
  /* v67: the loose dopje (body diameter of the tank = 1): grooved stub, ribbed collar, cone with a steel ring and a cross in the opening */
  function buildDopje() {
    var d = new T.Group();
    var plastic = new T.MeshPhysicalMaterial({ color: '#14171c', metalness: 0.05, roughness: 0.46, clearcoat: 0.3, clearcoatRoughness: 0.35 });
    var steel = new T.MeshStandardMaterial({ color: '#c4c9d1', metalness: 1, roughness: 0.28, envMapIntensity: 1.2 });
    var V = function (a) { return a.map(function (p) { return new T.Vector2(p[0], p[1]); }); };
    var m = function (geo, mat, x, y, z) { var o = new T.Mesh(geo, mat); o.position.set(x || 0, y || 0, z || 0); o.castShadow = true; o.receiveShadow = true; d.add(o); return o; };
    /* stub: three shallow grooves */
    m(new T.LatheGeometry(V([[0.001, 0], [0.056, 0], [0.056, 0.026], [0.05, 0.03], [0.056, 0.034], [0.056, 0.062], [0.05, 0.066], [0.056, 0.07], [0.056, 0.098], [0.05, 0.102], [0.056, 0.106], [0.056, 0.13], [0.001, 0.13]]), 64), plastic);
    /* collar with 20 ribs */
    m(new T.CylinderGeometry(0.094, 0.098, 0.078, 64), plastic, 0, 0.169, 0);
    for (var i = 0; i < 20; i++) { var a = i / 20 * Math.PI * 2; var rib = m(new T.BoxGeometry(0.014, 0.07, 0.012), plastic, Math.sin(a) * 0.098, 0.169, Math.cos(a) * 0.098); rib.rotation.y = a; }
    /* shoulder and cone */
    var cone = [[0.098, 0.208], [0.09, 0.216], [0.082, 0.224]]; for (var k = 1; k <= 24; k++) { var t = k / 24; cone.push([0.082 - 0.044 * Math.pow(t, 0.85), 0.224 + 0.366 * t]); } cone.push([0.034, 0.594]); cone.push([0.026, 0.594]);
    m(new T.LatheGeometry(V(cone), 64), plastic);
    /* opening: steel ring, dark well and a cross */
    var ring = m(new T.TorusGeometry(0.03, 0.007, 12, 48), steel, 0, 0.594, 0); ring.rotation.x = Math.PI / 2;
    m(new T.CylinderGeometry(0.026, 0.026, 0.004, 32), new T.MeshStandardMaterial({ color: '#05070a', roughness: 0.9 }), 0, 0.585, 0);
    m(new T.BoxGeometry(0.052, 0.005, 0.007), steel, 0, 0.587, 0); m(new T.BoxGeometry(0.007, 0.005, 0.052), steel, 0, 0.587, 0);
    return d;
  }
  function loadOwnModel() {
    return import(VENDOR + 'GLTFLoader.js').then(function (m) { return new Promise(function (res, rej) { new m.GLTFLoader().load(MODEL_URL, res, undefined, rej); }); }).then(function (gltf) {
      var g = gltf.scene; var box = new T.Box3().setFromObject(g), size = box.getSize(new T.Vector3()), s = 3.6 / Math.max(size.y, 1e-6); g.scale.setScalar(s); box.setFromObject(g); var ctr = box.getCenter(new T.Vector3()); g.position.set(-ctr.x, -box.min.y, -ctr.z);
      g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g;
    });
  }

  /* ---------- scene, camera, lights ---------- */
  function init() {
    if (started) return; started = true;
    if (!webglOK()) return fallback('no WebGL');
    Promise.all([import(VENDOR + 'three.module.min.js'), import(VENDOR + 'OrbitControls.js'), import(VENDOR + 'RoomEnvironment.js'), (document.fonts && document.fonts.load) ? Promise.race([Promise.all([document.fonts.load('700 100px "Barlow"'), document.fonts.load('600 100px "Barlow"')]), new Promise(function (r) { setTimeout(r, 1200); })]) : Promise.resolve()])
      .then(function (mods) {
        T = mods[0]; var OrbitControls = mods[1].OrbitControls, RoomEnvironment = mods[2].RoomEnvironment;
        renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.outputColorSpace = T.SRGBColorSpace;
        wrap.appendChild(renderer.domElement);
        scene = new T.Scene();
        pmrem = new T.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        camera = new T.PerspectiveCamera(32, 1, 0.1, 60);
        /* the warehouse look of the footage: warm key from the top right, cold blue rim from the back left */
        var key = new T.DirectionalLight('#fff1cc', 2.0); key.position.set(3.5, 7, 4); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.camera.near = 1; key.shadow.camera.far = 20; key.shadow.camera.left = key.shadow.camera.bottom = -2.6; key.shadow.camera.right = key.shadow.camera.top = 2.6; key.shadow.bias = -0.0005; key.shadow.radius = 4; scene.add(key);
        var rim = new T.DirectionalLight('#5fb8ff', 1.6); rim.position.set(-4, 3.5, -5); scene.add(rim);
        var fill = new T.DirectionalLight('#dfe8ff', 0.45); fill.position.set(-3, 2, 4); scene.add(fill);
        var ground = new T.Mesh(new T.CircleGeometry(2.6, 64), new T.ShadowMaterial({ opacity: 0.45 })); ground.rotation.x = -Math.PI / 2; ground.position.y = 0.004; ground.receiveShadow = true; scene.add(ground);
        var glowY = new T.Mesh(new T.CircleGeometry(1.5, 64), new T.MeshBasicMaterial({ color: '#2a2a10', transparent: true, opacity: 0.18 })); glowY.rotation.x = -Math.PI / 2; glowY.position.set(0.8, 0.002, 0.4); scene.add(glowY);
        var glowB = new T.Mesh(new T.CircleGeometry(1.5, 64), new T.MeshBasicMaterial({ color: '#0c1e3a', transparent: true, opacity: 0.22 })); glowB.rotation.x = -Math.PI / 2; glowB.position.set(-0.8, 0.002, -0.3); scene.add(glowB);
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true; controls.dampingFactor = 0.07; controls.enablePan = false; controls.minDistance = 2.6; controls.maxDistance = 10; controls.minPolarAngle = 0.35; controls.maxPolarAngle = 1.62; controls.rotateSpeed = matchMedia('(pointer:coarse)').matches ? 1.1 : 0.8; controls.zoomSpeed = 0.9; controls.dampingFactor = 0.09; controls.autoRotateSpeed = 0.9; controls.autoRotate = !reduce.matches;
        renderer.domElement.style.touchAction = 'none';
        controls.addEventListener('start', function () { stage.classList.add('dragging', 'touched'); pauseRotate(); });
        controls.addEventListener('end', function () { stage.classList.remove('dragging'); scheduleResume(); });
        controls.addEventListener('change', function () { needs = true; });
        return (MODEL_URL ? loadOwnModel() : Promise.resolve(buildTank()));
      })
      .then(function (model) {
        if (disposed) return; scene.add(model); applyView(VIEWS[DEFAULT_VIEW]); resize(); needs = true;
        new ResizeObserver(resize).observe(stage); start();
        requestAnimationFrame(function () { requestAnimationFrame(function () { stage.classList.add('ready'); }); });
      })
      .catch(function (e) { fallback(e && e.message); });
  }
  function resize() { if (!renderer) return; var w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); needs = true; }
  function spherical() { var v = new T.Vector3().subVectors(camera.position, controls.target); var s = new T.Spherical().setFromVector3(v); return { az: s.theta, po: s.phi, d: s.radius, ty: controls.target.y, tx: controls.target.x, tz: controls.target.z }; }
  function applyView(v) { controls.target.set(v.tx || 0, v.ty, v.tz || 0); camera.position.setFromSphericalCoords(v.d, v.po, v.az).add(controls.target); controls.update(); needs = true; }
  function goView(k, user) {
    var v = VIEWS[k]; if (!v) return; markView(k); dopjeOn = !!v.dopje; stage.classList.toggle('dopje-mode', dopjeOn); start(); if (user) { stage.classList.add('touched'); pauseRotate(); scheduleResume(); }
    if (!controls) return;
    tweenMin = v.min || 2.6; if (reduce.matches) { applyView(v); controls.minDistance = tweenMin; dopjeS = dopjeOn ? 1 : 0; syncDopje(); return; }
    if (tweenMin < controls.minDistance) controls.minDistance = tweenMin;
    var from = spherical(); var dAz = v.az - from.az; dAz = Math.atan2(Math.sin(dAz), Math.cos(dAz));
    tween = { t0: performance.now(), from: from, to: { az: from.az + dAz, po: v.po, d: v.d, ty: v.ty, tx: v.tx || 0, tz: v.tz || 0 } }; start();
  }
  function stepTween(now) { var t = Math.min(1, (now - tween.t0) / TWEEN_MS), e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, f = tween.from, o = tween.to; applyView({ az: f.az + (o.az - f.az) * e, po: f.po + (o.po - f.po) * e, d: f.d + (o.d - f.d) * e, ty: f.ty + (o.ty - f.ty) * e, tx: f.tx + (o.tx - f.tx) * e, tz: f.tz + (o.tz - f.tz) * e }); if (t >= 1) { tween = null; controls.minDistance = tweenMin; } }
  function syncDopje() { if (!dopje) return; var e = dopjeS * dopjeS * (3 - 2 * dopjeS); dopje.visible = dopjeS > 0.01; dopje.scale.setScalar(0.4 + 0.6 * e); dopje.position.y = (1 - e) * 0.3; var op = 1 - e; tankMats.forEach(function (m) { m.opacity = op; m.transparent = m.userData.t0 || op < 0.999; }); tankMeshes.forEach(function (o) { o.visible = op > 0.01; }); needs = true; }
  function stepDopje(now) { if (!dopje) return false; var dt = Math.min(0.06, (now - dopjeT) / 1000) || 0.016; dopjeT = now; var tgt = dopjeOn ? 1 : 0; if (Math.abs(tgt - dopjeS) < 0.003) { if (dopjeS !== tgt) { dopjeS = tgt; syncDopje(); return true; } return false; } dopjeS += (tgt - dopjeS) * (1 - Math.exp(-dt * 6)); syncDopje(); return true; }
  function pauseRotate() { if (controls) controls.autoRotate = false; clearTimeout(resumeT); }
  function scheduleResume() { clearTimeout(resumeT); if (reduce.matches) return; resumeT = setTimeout(function () { if (controls && !disposed) { controls.autoRotate = true; start(); } }, RESUME_AFTER); }

  /* ---------- render loop: only while the viewer is on screen and the tab is visible ---------- */
  function frame(now) { raf = 0; if (!active || disposed) return; if (tween) stepTween(now); var moved = controls.update(); var dp = stepDopje(now); if (moved || needs || tween || dp) { renderer.render(scene, camera); needs = false; } raf = requestAnimationFrame(frame); }
  function start() { active = visible && !document.hidden && !!renderer; if (active && !raf) raf = requestAnimationFrame(frame); }
  function stop() { active = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
  /* the heavy part (three.js and the scene) loads only once the viewer is near the screen AND the visitor has started using the page (scroll, touch, pointer, key), so the first paint stays as light as before */
  var intent = false; function onIntent() { intent = true; if (visible && !started) init(); }
  ['scroll', 'touchstart', 'pointermove', 'pointerdown', 'keydown', 'wheel'].forEach(function (ev) { addEventListener(ev, onIntent, { passive: true, once: true }); });
  new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) { if (!started && intent) init(); start(); } else stop(); }, { rootMargin: '300px 0px' }).observe(stage);
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });

  /* keyboard: arrows turn, + and - zoom, R resets */
  wrap.addEventListener('keydown', function (e) {
    if (!controls) return; var s = spherical(), k = e.key, step = 0.18;
    if (k === 'ArrowLeft') s.az -= step; else if (k === 'ArrowRight') s.az += step; else if (k === 'ArrowUp') s.po = Math.max(controls.minPolarAngle, s.po - step); else if (k === 'ArrowDown') s.po = Math.min(controls.maxPolarAngle, s.po + step); else if (k === '+' || k === '=') s.d = Math.max(controls.minDistance, s.d - 0.5); else if (k === '-') s.d = Math.min(controls.maxDistance, s.d + 0.5); else if (k === 'r' || k === 'R') { goView(DEFAULT_VIEW, true); e.preventDefault(); return; } else return;
    e.preventDefault(); stage.classList.add('touched'); pauseRotate(); applyView(s); scheduleResume(); start();
  });

  /* ---------- clean-up ---------- */
  function dispose() {
    if (disposed) return; disposed = true; stop(); clearTimeout(resumeT);
    if (controls) controls.dispose();
    if (scene) scene.traverse(function (o) { if (o.geometry) o.geometry.dispose(); var m = o.material; if (m) [].concat(m).forEach(function (x) { if (x.map) x.map.dispose(); x.dispose(); }); });
    if (labelTex) labelTex.dispose(); /* v60 */ if (pmrem) pmrem.dispose(); if (scene && scene.environment) scene.environment.dispose();
    if (renderer) { renderer.dispose(); renderer.forceContextLoss(); }
  }
  addEventListener('pagehide', dispose);
  buildUI();
})();
