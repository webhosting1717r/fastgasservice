/* Fastgas Service NL: interactive 3D product viewer (subpages only).
   Three.js (assets/vendor/three, MIT) is loaded on demand once the section comes near the screen, so pages stay as light as before.

   HOW TO ADJUST
   - COLORS: the finishes offered under the model (id, label, body colour, accent colour). The first one is the default.
   - MODEL_URL: leave null for the built-in procedural tank, or point it at your own .glb/.gltf (put the file in assets/models/ and
     set MODEL_URL = BASE + 'models/fastgas-tank.glb'). The model is centred and scaled to about 3.4 units high; the body colour
     is applied to every material named "body" (or, when no such material exists, left as it is in the file).
   - VIEWS: the preset camera angles (az = around the tank, po = from above, d = distance, ty = height the camera looks at). */
(function () {
  'use strict';
  var script = document.currentScript, BASE = script ? script.src.replace(/viewer3d\.js.*$/, '') : '/assets/';
  var VENDOR = BASE + 'vendor/three/';
  var MODEL_URL = null;
  var COLORS = [
    { id: 'fastgas', name: 'Fastgas zwart-geel', body: '#161c27', accent: '#f2d21b' },
    { id: 'nachtblauw', name: 'Nachtblauw', body: '#10264a', accent: '#f2d21b' },
    { id: 'antraciet', name: 'Antraciet', body: '#2c3139', accent: '#f2d21b' },
    { id: 'parelwit', name: 'Parelwit', body: '#e7e9ed', accent: '#f2d21b' }
  ];
  var VIEWS = {
    voor: { label: 'Voorkant', az: 0.18, po: 1.27, d: 6.4, ty: 1.6 },
    zij: { label: 'Zijkant', az: Math.PI / 2, po: 1.27, d: 6.4, ty: 1.6 },
    achter: { label: 'Achterkant', az: Math.PI + 0.18, po: 1.27, d: 6.4, ty: 1.6 },
    ventiel: { label: 'Ventiel', az: 0.7, po: 0.7, d: 3.4, ty: 3.05 },
    etiket: { label: 'Etiket', az: 0.3, po: 1.4, d: 3.9, ty: 1.35 }
  };
  var DEFAULT_VIEW = 'voor', RESUME_AFTER = 3500, TWEEN_MS = 750;

  var stage = document.querySelector('.v3d-stage'); if (!stage) return;
  var wrap = stage.querySelector('.v3d-canvas'), ui = document.querySelector('.v3d-ui');
  var viewsBox = ui && ui.querySelector('.v3d-views'), colorsBox = ui && ui.querySelector('.v3d-colors'), resetBtn = ui && ui.querySelector('.v3d-reset');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  var T = null, renderer = null, scene = null, camera = null, controls = null, pmrem = null, raf = 0, active = false, visible = false, tween = null, resumeT = 0, currentView = DEFAULT_VIEW, started = false, disposed = false, bodyMats = [], accentMats = [], labelTex = null;

  function fallback(reason) { stage.classList.add('fallback'); if (ui) ui.hidden = true; var n = document.querySelector('.v3d-note'); if (n) n.textContent = '3D-weergave is op dit apparaat niet beschikbaar; je ziet de foto van de Fastgas tank.'; if (reason && window.console) console.info('3D viewer fallback:', reason); }
  function webglOK() { try { var c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; } }

  /* ---------- UI (built here so COLORS and VIEWS live in one place) ---------- */
  function buildUI() {
    if (!ui) return;
    Object.keys(VIEWS).forEach(function (k) { var b = document.createElement('button'); b.type = 'button'; b.textContent = VIEWS[k].label; b.dataset.view = k; b.setAttribute('aria-pressed', String(k === DEFAULT_VIEW)); b.addEventListener('click', function () { goView(k, true); }); viewsBox.appendChild(b); });
    COLORS.forEach(function (c, i) { var b = document.createElement('button'); b.type = 'button'; b.dataset.color = c.id; b.style.setProperty('--c', c.body); b.setAttribute('aria-label', c.name); b.title = c.name; b.setAttribute('aria-pressed', String(i === 0)); b.addEventListener('click', function () { setColor(c.id); }); colorsBox.appendChild(b); });
    if (resetBtn) resetBtn.addEventListener('click', function () { goView(DEFAULT_VIEW, true); });
  }
  function markView(k) { currentView = k; if (viewsBox) Array.prototype.forEach.call(viewsBox.children, function (b) { b.setAttribute('aria-pressed', String(b.dataset.view === k)); }); }
  function setColor(id) { var c = COLORS.filter(function (x) { return x.id === id; })[0]; if (!c) return; if (colorsBox) Array.prototype.forEach.call(colorsBox.children, function (b) { b.setAttribute('aria-pressed', String(b.dataset.color === id)); }); if (!T) return; bodyMats.forEach(function (m) { m.color.set(c.body); }); accentMats.forEach(function (m) { m.color.set(c.accent); }); needs = true; }

  /* ---------- the tank ---------- */
  function paintLabel(accent) {
    var cv = document.createElement('canvas'); cv.width = 2048; cv.height = 1240; var x = cv.getContext('2d');
    x.clearRect(0, 0, cv.width, cv.height);
    var cx = cv.width * 0.5, cy = cv.height * 0.5;
    x.save(); x.translate(cx - 70, cy + 40); x.rotate(-Math.PI / 2);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = '#ffffff'; x.font = '800 236px "Barlow Condensed", "Arial Narrow", Impact, sans-serif'; x.fillText('FASTGAS', 0, 0);
    x.fillStyle = accent; x.font = '600 54px "IBM Plex Mono", Menlo, monospace'; x.fillText('2000 G  ·  N2O  ·  99,9%', 0, 170);
    x.restore();
    x.save(); x.translate(cx + 150, cy + 300); x.fillStyle = accent; x.beginPath(); x.arc(0, 0, 92, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#0a0f18'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '800 70px "Barlow Condensed", "Arial Narrow", Impact, sans-serif'; x.fillText('2 KG', 0, -14); x.font = '600 28px "IBM Plex Mono", Menlo, monospace'; x.fillText('LACHGAS', 0, 36); x.restore();
    x.save(); x.translate(cx + 150, cy - 300); x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 6; x.beginPath(); x.arc(0, 0, 70, 0, Math.PI * 2); x.stroke(); x.fillStyle = 'rgba(255,255,255,.9)'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '700 30px "IBM Plex Mono", Menlo, monospace'; x.fillText('165', 0, -12); x.fillText('BAR', 0, 20); x.restore();
    var t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t;
  }
  function buildTank() {
    var g = new T.Group(), c0 = COLORS[0];
    var body = new T.MeshPhysicalMaterial({ color: c0.body, metalness: 0.3, roughness: 0.36, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.1 });
    var accent = new T.MeshPhysicalMaterial({ color: c0.accent, metalness: 0.1, roughness: 0.42, clearcoat: 0.8, clearcoatRoughness: 0.2 });
    var plastic = new T.MeshStandardMaterial({ color: '#15181d', metalness: 0.05, roughness: 0.78 });
    var brass = new T.MeshStandardMaterial({ color: '#c8a862', metalness: 0.95, roughness: 0.28, envMapIntensity: 1.3 });
    var steel = new T.MeshStandardMaterial({ color: '#b9bec6', metalness: 1, roughness: 0.32 });
    bodyMats = [body]; accentMats = [accent];
    /* steel cylinder: one lathe profile from the base plate to the neck */
    var pts = [[0, 0.02], [0.4, 0.02], [0.47, 0.06], [0.5, 0.16], [0.5, 2.24], [0.49, 2.4], [0.44, 2.54], [0.35, 2.64], [0.24, 2.71], [0.15, 2.75], [0.12, 2.8], [0.12, 2.96], [0, 2.96]].map(function (p) { return new T.Vector2(p[0], p[1]); });
    var lathe = new T.Mesh(new T.LatheGeometry(pts, 112), body); lathe.castShadow = true; lathe.receiveShadow = true; g.add(lathe);
    var foot = new T.Mesh(new T.CylinderGeometry(0.47, 0.5, 0.1, 96), plastic); foot.position.y = 0.05; foot.castShadow = true; g.add(foot);
    var collar = new T.Mesh(new T.CylinderGeometry(0.506, 0.506, 0.16, 112, 1, true), accent); collar.position.y = 2.16; g.add(collar);
    var ring = new T.Mesh(new T.CylinderGeometry(0.506, 0.506, 0.05, 112, 1, true), accent); ring.position.y = 0.3; g.add(ring);
    labelTex = paintLabel(c0.accent);
    var sleeve = new T.Mesh(new T.CylinderGeometry(0.509, 0.509, 1.72, 112, 1, true, -Math.PI, Math.PI * 2), new T.MeshStandardMaterial({ map: labelTex, transparent: true, depthWrite: false, metalness: 0.1, roughness: 0.5 })); sleeve.position.y = 1.24; g.add(sleeve);
    /* valve: brass stem and body, steel outlet, yellow cap ring, black handwheel */
    var stem = new T.Mesh(new T.CylinderGeometry(0.1, 0.11, 0.24, 48), brass); stem.position.y = 3.07; stem.castShadow = true; g.add(stem);
    var vb = new T.Mesh(new T.CylinderGeometry(0.17, 0.16, 0.2, 48), brass); vb.position.y = 3.28; vb.castShadow = true; g.add(vb);
    var out = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.34, 32), steel); out.rotation.z = Math.PI / 2; out.position.set(0.3, 3.28, 0); out.castShadow = true; g.add(out);
    var nut = new T.Mesh(new T.CylinderGeometry(0.085, 0.085, 0.09, 6), brass); nut.rotation.z = Math.PI / 2; nut.position.set(0.44, 3.28, 0); g.add(nut);
    var cap = new T.Mesh(new T.CylinderGeometry(0.19, 0.19, 0.05, 48), accent); cap.position.y = 3.4; g.add(cap);
    var wheel = new T.Mesh(new T.TorusGeometry(0.19, 0.04, 20, 64), plastic); wheel.rotation.x = Math.PI / 2; wheel.position.y = 3.55; wheel.castShadow = true; g.add(wheel);
    var hub = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 0.12, 32), plastic); hub.position.y = 3.52; g.add(hub);
    for (var i = 0; i < 3; i++) { var sp = new T.Mesh(new T.CapsuleGeometry(0.022, 0.3, 4, 12), plastic); sp.rotation.z = Math.PI / 2; sp.rotation.y = i * Math.PI / 3; sp.position.y = 3.55; g.add(sp); }
    /* carrying bracket on one side, as on the real tank */
    var post = new T.Mesh(new T.CapsuleGeometry(0.045, 0.78, 6, 16), plastic); post.position.set(-0.47, 2.95, 0); post.castShadow = true; g.add(post);
    var bar = new T.Mesh(new T.CapsuleGeometry(0.045, 0.36, 6, 16), plastic); bar.rotation.z = Math.PI / 2; bar.position.set(-0.27, 3.38, 0); bar.castShadow = true; g.add(bar);
    var base = new T.Mesh(new T.BoxGeometry(0.16, 0.08, 0.2), plastic); base.position.set(-0.43, 2.55, 0); g.add(base);
    return g;
  }
  function loadOwnModel() {
    return import(VENDOR + 'GLTFLoader.js').then(function (m) { return new Promise(function (res, rej) { new m.GLTFLoader().load(MODEL_URL, res, undefined, rej); }); }).then(function (gltf) {
      var g = gltf.scene; var box = new T.Box3().setFromObject(g), size = box.getSize(new T.Vector3()), s = 3.4 / Math.max(size.y, 1e-6); g.scale.setScalar(s); box.setFromObject(g); var ctr = box.getCenter(new T.Vector3()); g.position.set(-ctr.x, -box.min.y, -ctr.z);
      g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material && /body/i.test(o.material.name || '')) bodyMats.push(o.material); } });
      return g;
    });
  }

  /* ---------- scene, camera, lights ---------- */
  var needs = true;
  function init() {
    if (started) return; started = true;
    if (!webglOK()) return fallback('no WebGL');
    Promise.all([import(VENDOR + 'three.module.min.js'), import(VENDOR + 'OrbitControls.js'), import(VENDOR + 'RoomEnvironment.js'), (document.fonts && document.fonts.load) ? Promise.race([document.fonts.load('800 100px "Barlow Condensed"'), new Promise(function (r) { setTimeout(r, 1200); })]) : Promise.resolve()])
      .then(function (mods) {
        T = mods[0]; var OrbitControls = mods[1].OrbitControls, RoomEnvironment = mods[2].RoomEnvironment;
        renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = T.SRGBColorSpace;
        wrap.appendChild(renderer.domElement); renderer.domElement.style.touchAction = 'pan-y';
        scene = new T.Scene();
        pmrem = new T.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        camera = new T.PerspectiveCamera(32, 1, 0.1, 60);
        var key = new T.DirectionalLight('#fff4d6', 2.2); key.position.set(3.5, 7, 4); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.camera.near = 1; key.shadow.camera.far = 20; key.shadow.camera.left = key.shadow.camera.bottom = -2.6; key.shadow.camera.right = key.shadow.camera.top = 2.6; key.shadow.bias = -0.0005; key.shadow.radius = 4; scene.add(key);
        var rim = new T.DirectionalLight('#9fd8ff', 1.1); rim.position.set(-4, 4, -5); scene.add(rim);
        var fill = new T.DirectionalLight('#ffffff', 0.5); fill.position.set(-3, 2, 4); scene.add(fill);
        var ground = new T.Mesh(new T.CircleGeometry(2.6, 64), new T.ShadowMaterial({ opacity: 0.42 })); ground.rotation.x = -Math.PI / 2; ground.position.y = 0.005; ground.receiveShadow = true; scene.add(ground);
        var disc = new T.Mesh(new T.CircleGeometry(1.4, 64), new T.MeshBasicMaterial({ color: '#0b1220', transparent: true, opacity: 0.35 })); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.002; scene.add(disc);
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true; controls.dampingFactor = 0.07; controls.enablePan = false; controls.minDistance = 2.4; controls.maxDistance = 9; controls.minPolarAngle = 0.35; controls.maxPolarAngle = 1.62; controls.rotateSpeed = 0.75; controls.zoomSpeed = 0.8; controls.autoRotateSpeed = 0.9; controls.autoRotate = !reduce.matches;
        renderer.domElement.style.touchAction = 'pan-y';
        controls.addEventListener('start', function () { stage.classList.add('dragging', 'touched'); pauseRotate(); });
        controls.addEventListener('end', function () { stage.classList.remove('dragging'); scheduleResume(); });
        controls.addEventListener('change', function () { needs = true; });
        return (MODEL_URL ? loadOwnModel() : Promise.resolve(buildTank()));
      })
      .then(function (model) {
        if (disposed) return; scene.add(model); setColor(COLORS[0].id); applyView(VIEWS[DEFAULT_VIEW]); resize(); needs = true;
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
    if (reduce.matches) { applyView(v); return; }
    var from = spherical(); var dAz = v.az - from.az; dAz = Math.atan2(Math.sin(dAz), Math.cos(dAz));   /* shortest way round */
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
