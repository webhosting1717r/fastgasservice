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
  var NAVY = '#1b2740', BLACK = '#0d1015', YELLOW = '#ead61f';
  var VIEWS = {
    voor: { label: 'Voorkant', az: 0.2, po: 1.3, d: 6.3, ty: 1.6 },
    zij: { label: 'Zijkant', az: Math.PI / 2, po: 1.3, d: 6.3, ty: 1.6 },
    achter: { label: 'Achterkant', az: Math.PI + 0.2, po: 1.3, d: 6.3, ty: 1.6 },
    ventiel: { label: 'Ventiel', az: 0.7, po: 0.75, d: 3.2, ty: 2.95 },
    etiket: { label: 'Etiket', az: 0.1, po: 1.45, d: 3.7, ty: 1.45 }
  };
  var DEFAULT_VIEW = 'voor', RESUME_AFTER = 3500, TWEEN_MS = 750;

  var stage = document.querySelector('.v3d-stage'); if (!stage) return;
  var wrap = stage.querySelector('.v3d-canvas'), ui = document.querySelector('.v3d-ui');
  var viewsBox = ui && ui.querySelector('.v3d-views'), resetBtn = ui && ui.querySelector('.v3d-reset');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
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
  function paintLabel() {
    var W = 2048, H = 1540, cv = document.createElement('canvas'); cv.width = W; cv.height = H; var x = cv.getContext('2d');
    x.clearRect(0, 0, W, H);
    var cx = W * 0.5, white = '#ffffff';
    /* the tonal chevron pattern of the real sleeve: rows of small ">>" marks, a few of them yellow */
    for (var r = -1; r < 20; r++) for (var c = -1; c < 26; c++) { var ppx = c * 82 + (r % 2) * 41, ppy = r * 82 + 20; var yel = (r * 7 + c * 5) % 13 === 0; chevron(x, ppx, ppy, 30, yel ? 'rgba(234,214,31,.22)' : 'rgba(255,255,255,.075)'); chevron(x, ppx + 22, ppy, 30, yel ? 'rgba(234,214,31,.22)' : 'rgba(255,255,255,.075)'); }
    /* wordmark, reading upwards: F (with its dotted tail) > S T G > S ® */
    x.save(); x.translate(cx, H * 0.53); x.rotate(-Math.PI / 2);
    var g = 236, step = 246, seq = ['F', '>', 'S', 'T', 'G', '>', 'S'], x0 = -step * 3;
    seq.forEach(function (ch, i) { var px = x0 + i * step; if (ch === '>') chevron(x, px, 0, g * 0.84, white); else heavyText(x, ch, g, px, 0, white); });
    x.fillStyle = white; x.font = '600 36px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('®', x0 + 6 * step + 118, -92);
    var sq = 22; for (var row = 0; row < 3; row++) for (var col = 0; col < 5 - row; col++) x.fillRect(x0 - g * 0.5 - 44 - col * 34, -g * 0.5 + 8 + row * 34, sq, sq);
    x.restore();
    /* stickers, as on the product: yellow 2000 g, small EU badge, the white quality badge, the yellow QR badge */
    function disc(px, py, r, fill) { x.fillStyle = fill; x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill(); }
    x.save(); x.translate(cx - 232, H * 0.19); x.rotate(-Math.PI / 2); x.fillStyle = YELLOW; x.beginPath(); x.ellipse(0, 0, 64, 40, 0, 0, Math.PI * 2); x.fill(); x.fillStyle = '#111'; x.font = '800 30px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('2000 g', 0, 1); x.restore();
    disc(cx - 222, H * 0.29, 40, '#fff'); disc(cx - 222, H * 0.29, 33, YELLOW); x.fillStyle = '#111'; x.font = '800 24px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('EU', cx - 222, H * 0.29 + 1);
    disc(cx + 218, H * 0.17, 90, '#fff'); ringText(x, cx + 218, H * 0.17, 70, 'SAME GREAT QUALITY · IMPROVED LOOKS · ', '#111', 17);
    x.save(); x.translate(cx + 218, H * 0.17); x.rotate(-Math.PI / 2); [[-26, -14], [-6, -14], [14, -14], [-16, 12], [4, 12]].forEach(function (p) { chevron(x, p[0], p[1], 24, '#111'); }); x.restore();
    disc(cx + 206, H * 0.81, 94, YELLOW); ringText(x, cx + 206, H * 0.81, 74, 'SCAN NOW TO CHECK · BE SURE IT’S ORIGINAL · ', '#111', 16); x.fillStyle = '#fff'; x.fillRect(cx + 206 - 40, H * 0.81 - 40, 80, 80);
    x.fillStyle = '#111'; for (var qy = 0; qy < 7; qy++) for (var qx = 0; qx < 7; qx++) if ((qx * 7 + qy * 3 + qx * qy) % 3 !== 1 || (qx < 3 && qy < 3) || (qx > 3 && qy < 3) || (qx < 3 && qy > 3)) x.fillRect(cx + 206 - 34 + qx * 10, H * 0.81 - 34 + qy * 10, 9, 9);
    /* the small print column on the left side of the sleeve */
    x.save(); x.translate(W * 0.355, H * 0.5); x.rotate(-Math.PI / 2); x.fillStyle = 'rgba(255,255,255,.82)'; x.font = '600 20px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('ORIGINAL NITROUS OXIDE · FOOD GRADE · 2000 g · N2O 99,9% · 165 BAR TESTED · PROFESSIONAL USE ONLY · 18+', 0, 0); x.restore();
    x.save(); x.translate(W * 0.31, H * 0.52); x.rotate(Math.PI / 4); x.fillStyle = '#e8501e'; x.fillRect(-36, -36, 72, 72); x.fillStyle = '#fff'; x.fillRect(-28, -28, 56, 56); x.restore(); x.fillStyle = '#111'; x.font = '800 24px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('N2O', W * 0.31, H * 0.52 + 1);
    var t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t;
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
    /* proportions of the real tank (height about 2.85 x the width): black foot, navy body, yellow band, black cap, brass nozzle */
    var cap = function (r, y0, y1, eb, et) { var p = [new T.Vector2(0, y0)], i, a; if (eb > 0) { for (i = 0; i <= 6; i++) { a = (i / 6) * Math.PI / 2; p.push(new T.Vector2(r - eb + Math.sin(a) * eb, y0 + eb - Math.cos(a) * eb)); } } else p.push(new T.Vector2(r, y0)); if (et > 0) { for (i = 0; i <= 6; i++) { a = (i / 6) * Math.PI / 2; p.push(new T.Vector2(r - et + Math.cos(a) * et, y1 - et + Math.sin(a) * et)); } } else p.push(new T.Vector2(r, y1)); p.push(new T.Vector2(0, y1)); return new T.LatheGeometry(p, SEG); };
    mk(cap(0.55, 0, 0.3, 0.07, 0.015), black, 0);
    mk(new T.CylinderGeometry(R, R, 2.34, SEG, 1, true), navy, 1.47);
    var band = new T.Mesh(new T.CylinderGeometry(R + 0.004, R + 0.004, 0.08, SEG, 1, true), new T.MeshStandardMaterial({ map: paintBand(), metalness: 0.05, roughness: 0.45 })); band.position.y = 2.59; g.add(band);
    mk(cap(0.555, 2.63, 3.0, 0.02, 0.075), black, 0);
    var inner = new T.Mesh(new T.TorusGeometry(0.21, 0.012, 10, 64), new T.MeshStandardMaterial({ color: '#1b1e24', metalness: 0.2, roughness: 0.6 })); inner.rotation.x = Math.PI / 2; inner.position.y = 3.0; g.add(inner);
    var brass = new T.MeshStandardMaterial({ color: '#c9a44a', metalness: 0.95, roughness: 0.32, envMapIntensity: 1.3 });
    mk(new T.CylinderGeometry(0.11, 0.12, 0.06, 48), brass, 3.03);
    mk(new T.CylinderGeometry(0.072, 0.072, 0.16, 48), brass, 3.14);
    mk(new T.CylinderGeometry(0.082, 0.078, 0.11, 48), black, 3.27);
    mk(new T.CylinderGeometry(0.05, 0.05, 0.04, 48), black, 3.34);
    /* label sleeve */
    labelTex = paintLabel();
    var sleeve = new T.Mesh(new T.CylinderGeometry(R + 0.007, R + 0.007, 2.26, SEG, 1, true, -Math.PI, Math.PI * 2), new T.MeshStandardMaterial({ map: labelTex, transparent: true, depthWrite: false, metalness: 0.05, roughness: 0.55 })); sleeve.position.y = 1.42; g.add(sleeve);
    /* carrying strap: a flat band close to the body on the right, clipped to the cap and the foot */
    var path = new T.CatmullRomCurve3([new T.Vector3(0.575, 2.86, 0), new T.Vector3(0.615, 2.7, 0), new T.Vector3(0.655, 2.25, 0), new T.Vector3(0.67, 1.6, 0), new T.Vector3(0.655, 0.95, 0), new T.Vector3(0.615, 0.45, 0), new T.Vector3(0.575, 0.2, 0)]);
    var shape = new T.Shape(); shape.moveTo(-0.06, -0.02); shape.lineTo(0.06, -0.02); shape.lineTo(0.06, 0.02); shape.lineTo(-0.06, 0.02); shape.closePath();
    var strap = new T.Mesh(new T.ExtrudeGeometry(shape, { steps: 60, bevelEnabled: false, extrudePath: path }), black); strap.castShadow = true; g.add(strap);
    [[0.57, 2.8], [0.57, 0.26]].forEach(function (c) { var clip = new T.Mesh(new T.BoxGeometry(0.1, 0.2, 0.19), black); clip.position.set(c[0], c[1], 0); clip.castShadow = true; g.add(clip); var slot = new T.Mesh(new T.BoxGeometry(0.02, 0.05, 0.11), new T.MeshStandardMaterial({ color: '#2a2e36', metalness: 0.2, roughness: 0.6 })); slot.position.set(c[0] + 0.05, c[1] + 0.02, 0); g.add(slot); });
    return g;
  }
  function loadOwnModel() {
    return import(VENDOR + 'GLTFLoader.js').then(function (m) { return new Promise(function (res, rej) { new m.GLTFLoader().load(MODEL_URL, res, undefined, rej); }); }).then(function (gltf) {
      var g = gltf.scene; var box = new T.Box3().setFromObject(g), size = box.getSize(new T.Vector3()), s = 3.3 / Math.max(size.y, 1e-6); g.scale.setScalar(s); box.setFromObject(g); var ctr = box.getCenter(new T.Vector3()); g.position.set(-ctr.x, -box.min.y, -ctr.z);
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
        controls.enableDamping = true; controls.dampingFactor = 0.07; controls.enablePan = false; controls.minDistance = 2.4; controls.maxDistance = 9; controls.minPolarAngle = 0.35; controls.maxPolarAngle = 1.62; controls.rotateSpeed = 0.75; controls.zoomSpeed = 0.8; controls.autoRotateSpeed = 0.9; controls.autoRotate = !reduce.matches;
        renderer.domElement.style.touchAction = 'pan-y';
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
  function spherical() { var v = new T.Vector3().subVectors(camera.position, controls.target); var s = new T.Spherical().setFromVector3(v); return { az: s.theta, po: s.phi, d: s.radius, ty: controls.target.y }; }
  function applyView(v) { controls.target.set(0, v.ty, 0); camera.position.setFromSphericalCoords(v.d, v.po, v.az).add(controls.target); controls.update(); needs = true; }
  function goView(k, user) {
    var v = VIEWS[k]; if (!v) return; markView(k); if (user) { stage.classList.add('touched'); pauseRotate(); scheduleResume(); }
    if (!controls) return;
    if (reduce.matches) { applyView(v); return; }
    var from = spherical(); var dAz = v.az - from.az; dAz = Math.atan2(Math.sin(dAz), Math.cos(dAz));
    tween = { t0: performance.now(), from: from, to: { az: from.az + dAz, po: v.po, d: v.d, ty: v.ty } }; start();
  }
  function stepTween(now) { var t = Math.min(1, (now - tween.t0) / TWEEN_MS), e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, f = tween.from, o = tween.to; applyView({ az: f.az + (o.az - f.az) * e, po: f.po + (o.po - f.po) * e, d: f.d + (o.d - f.d) * e, ty: f.ty + (o.ty - f.ty) * e }); if (t >= 1) tween = null; }
  function pauseRotate() { if (controls) controls.autoRotate = false; clearTimeout(resumeT); }
  function scheduleResume() { clearTimeout(resumeT); if (reduce.matches) return; resumeT = setTimeout(function () { if (controls && !disposed) { controls.autoRotate = true; start(); } }, RESUME_AFTER); }

  /* ---------- render loop: only while the viewer is on screen and the tab is visible ---------- */
  function frame(now) { raf = 0; if (!active || disposed) return; if (tween) stepTween(now); var moved = controls.update(); if (moved || needs || tween) { renderer.render(scene, camera); needs = false; } raf = requestAnimationFrame(frame); }
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
    if (labelTex) labelTex.dispose(); if (pmrem) pmrem.dispose(); if (scene && scene.environment) scene.environment.dispose();
    if (renderer) { renderer.dispose(); renderer.forceContextLoss(); }
  }
  addEventListener('pagehide', dispose);
  buildUI();
})();
