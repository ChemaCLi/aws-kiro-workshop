// Isla flotante low-poly con una parcela por tarea terminada.
// Three.js se importa de forma dinámica: si el CDN falla, la app sigue funcionando (ver garden-view).
import { TYPE_BY_ID, islandSizeFor, spiralCell } from '../core/rules.js';

const TOP = 0.14; // altura de la cara superior de cada parcela

const hash = (str) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
// Generador pseudoaleatorio con semilla: la misma tarea siempre se ve igual.
const rng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const easeOutBack = (x) => { const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2; };

export async function createGardenScene(container, { onSelect }) {
  const THREE = await import('three');
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  // ---------- renderer, cámara, luces ----------
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none';
  container.prepend(canvas);

  scene.add(new THREE.HemisphereLight(0xfff6e5, 0x7fa98a, 1.5));
  const sun = new THREE.DirectionalLight(0xfff0d0, 2.4);
  sun.position.set(7, 12, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.7;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = 1.38;
  controls.autoRotate = !reduceMotion;
  controls.autoRotateSpeed = 0.7;
  controls.target.set(0, 0.4, 0);

  // ---------- materiales y geometrías compartidas ----------
  const mat = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0, ...extra });
  const M = {
    dirt: mat(0x7c5c3d), rock: mat(0x9a8068),
    grass: mat(0x7acb6a), grassDark: mat(0x5fb356), grassLight: mat(0x9ae485),
    leaf: mat(0x48a35d), leafDark: mat(0x2f8650), trunk: mat(0x8a5a36),
    yellow: mat(0xffd84d), pink: mat(0xffbfd6), pinkDark: mat(0xff98bd),
    cloud: mat(0xffffff, { roughness: 1 }), dark: mat(0x2b2b2b),
    petal: new THREE.MeshBasicMaterial({ color: 0xffc3da, side: THREE.DoubleSide }),
  };
  const typeMats = new Map();
  const typeMat = (hex) => {
    if (!typeMats.has(hex)) {
      typeMats.set(hex, {
        solid: mat(hex),
        wing: mat(hex, { side: THREE.DoubleSide, emissive: hex, emissiveIntensity: 0.18 }),
      });
    }
    return typeMats.get(hex);
  };
  const G = {
    tile: new THREE.BoxGeometry(0.94, 0.14, 0.94),
    pebble: new THREE.BoxGeometry(0.15, 0.1, 0.15),
    blade: new THREE.ConeGeometry(0.045, 1, 4),
    ico: new THREE.IcosahedronGeometry(1, 0),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 6),
    cone: new THREE.ConeGeometry(1, 1, 7),
    petal: new THREE.CircleGeometry(0.045, 5),
    wing: new THREE.PlaneGeometry(0.2, 0.17).rotateX(-Math.PI / 2).translate(0.1, 0, 0),
  };
  const put = (parent, geo, material, pos = [0, 0, 0], scale = [1, 1, 1], shadow = true) => {
    const m = new THREE.Mesh(geo, material);
    m.position.set(...pos);
    m.scale.set(...scale);
    m.castShadow = shadow;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // ---------- constructores de plantas ----------
  const tufts = (g, r, count, minH, maxH, spread) => {
    const mats = [M.grassDark, M.grassLight, M.grass];
    for (let i = 0; i < count; i++) {
      const h = minH + r() * (maxH - minH);
      const m = put(g, G.blade, mats[Math.floor(r() * 3)], [(r() - 0.5) * 2 * spread, TOP + h / 2, (r() - 0.5) * 2 * spread], [1, h, 1], false);
      m.rotation.set((r() - 0.5) * 0.4, r() * Math.PI, (r() - 0.5) * 0.4);
    }
  };

  const flowerAt = (parent, r, ctx, x, z, stemH) => {
    const f = new THREE.Group();
    f.position.set(x, TOP, z);
    put(f, G.cyl, M.leaf, [0, stemH / 2, 0], [0.03, stemH, 0.03]);
    put(f, G.ico, M.leaf, [0.07, stemH * 0.4, 0], [0.09, 0.03, 0.05]);
    const head = new THREE.Group();
    head.position.y = stemH;
    head.rotation.x = -0.25;
    f.add(head);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      put(head, G.ico, ctx.type, [Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12], [0.08, 0.045, 0.08]);
    }
    put(head, G.ico, M.yellow, [0, 0.025, 0], [0.07, 0.06, 0.07]);
    parent.add(f);
  };

  const makeButterfly = (ctx, phase) => {
    const g = new THREE.Group();
    put(g, G.ico, M.dark, [0, 0, 0], [0.03, 0.03, 0.11], false);
    const wing = (side) => {
      const pivot = new THREE.Group();
      const w = new THREE.Mesh(G.wing, ctx.wing);
      w.scale.x = side;
      pivot.add(w);
      g.add(pivot);
      return pivot;
    };
    const right = wing(1);
    const left = wing(-1);
    return (t) => {
      const a1 = t * 0.9 + phase;
      const a2 = t * 1.3 + phase;
      g.position.set(Math.cos(a1) * 0.4, TOP + 0.8 + Math.sin(t * 2.1 + phase) * 0.1, Math.sin(a2) * 0.4);
      g.rotation.y = Math.atan2(-Math.sin(a1) * 0.9 * 0.4, Math.cos(a2) * 1.3 * 0.4);
      const flap = Math.sin(t * 22 + phase) * 0.8 + 0.1;
      right.rotation.z = flap;
      left.rotation.z = -flap;
    };
  };

  const BUILD = {
    grass(g, r) { tufts(g, r, 9, 0.18, 0.38, 0.36); },

    flower(g, r, ctx) {
      tufts(g, r, 4, 0.12, 0.22, 0.38);
      flowerAt(g, r, ctx, (r() - 0.5) * 0.2, (r() - 0.5) * 0.2, 0.5);
    },

    bush(g, r, ctx) {
      [[0, 0.28, 0, 0.34], [-0.22, 0.22, 0.08, 0.26], [0.22, 0.22, -0.05, 0.27], [0.02, 0.2, 0.22, 0.24]]
        .forEach(([x, y, z, s], i) => put(g, G.ico, i % 2 ? M.leaf : M.leafDark, [x, TOP + y, z], [s, s * 0.9, s]));
      for (let i = 0; i < 5; i++) {
        const a = r() * Math.PI * 2;
        const rad = 0.22 + r() * 0.15;
        put(g, G.ico, ctx.type, [Math.cos(a) * rad, TOP + 0.3 + r() * 0.2, Math.sin(a) * rad], [0.05, 0.05, 0.05]);
      }
    },

    tree(g, r) {
      tufts(g, r, 3, 0.1, 0.2, 0.4);
      put(g, G.cyl, M.trunk, [0, TOP + 0.3, 0], [0.09, 0.6, 0.09]);
      [[0.65, 0.5, 0.42], [1.0, 0.42, 0.34], [1.3, 0.34, 0.26]]
        .forEach(([y, h, rad], i) => put(g, G.cone, i % 2 ? M.leaf : M.leafDark, [0, TOP + y, 0], [rad, h, rad]));
    },

    butterfly(g, r, ctx) {
      tufts(g, r, 4, 0.12, 0.24, 0.4);
      flowerAt(g, r, ctx, -0.18, -0.1, 0.36);
      flowerAt(g, r, ctx, 0.2, 0.12, 0.46);
      ctx.anim.push(makeButterfly(ctx, r() * 6));
    },

    sakura(g, r, ctx) {
      tufts(g, r, 3, 0.1, 0.2, 0.4);
      put(g, G.cyl, M.trunk, [0, TOP + 0.4, 0], [0.1, 0.8, 0.1]);
      const branch = put(g, G.cyl, M.trunk, [0.14, TOP + 0.78, 0], [0.05, 0.35, 0.05]);
      branch.rotation.z = -0.7;
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const s = 0.3 + r() * 0.1;
        put(g, G.ico, i % 2 ? M.pink : M.pinkDark, [Math.cos(a) * 0.3, TOP + 1.05 + r() * 0.2, Math.sin(a) * 0.3], [s, s * 0.85, s]);
      }
      put(g, G.ico, M.pink, [0, TOP + 1.35, 0], [0.34, 0.3, 0.34]);
      const petals = Array.from({ length: 8 }, () => {
        const m = new THREE.Mesh(G.petal, M.petal);
        g.add(m);
        return { m, x: (r() - 0.5) * 0.9, z: (r() - 0.5) * 0.9, phase: r(), speed: 0.12 + r() * 0.08 };
      });
      ctx.anim.push((t) => {
        for (const p of petals) {
          const k = (t * p.speed + p.phase) % 1;
          p.m.position.set(p.x + Math.sin(k * 6 + p.phase * 9) * 0.12, TOP + 1.2 - k * 1.1, p.z + Math.cos(k * 5 + p.phase * 7) * 0.12);
          p.m.rotation.set(k * 8, k * 6, 0);
        }
      });
    },
  };

  // ---------- isla ----------
  const world = new THREE.Group();
  scene.add(world);
  let island = null;
  let size = 0;

  const checker = (n) => {
    const c = document.createElement('canvas');
    c.width = c.height = 2;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#93714b'; ctx.fillRect(0, 0, 2, 2);
    ctx.fillStyle = '#86653f'; ctx.fillRect(0, 0, 1, 1); ctx.fillRect(1, 1, 1, 1);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(n / 2, n / 2);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };

  const clouds = [];
  const buildClouds = (n) => {
    for (const c of clouds) scene.remove(c);
    clouds.length = 0;
    for (let i = 0; i < 5; i++) {
      const r = rng(1000 + i);
      const g = new THREE.Group();
      const parts = 3 + Math.floor(r() * 2);
      for (let k = 0; k < parts; k++) {
        put(g, G.ico, M.cloud, [k * 0.6 - parts * 0.28, (r() - 0.5) * 0.15, (r() - 0.5) * 0.3], [0.5 + r() * 0.2, 0.32 + r() * 0.1, 0.42], false);
      }
      g.userData = { angle: (i / 5) * Math.PI * 2, radius: n * 0.85 + 2 + (i % 2) * 1.5, y: -2.4 + (i % 3) * 0.5, speed: 0.04 + r() * 0.03 };
      g.scale.setScalar(1.3);
      scene.add(g);
      clouds.push(g);
    }
  };

  const buildIsland = (n) => {
    if (island) {
      world.remove(island);
      island.traverse((o) => { if (o.isMesh && o.userData.own) { o.geometry.dispose(); [o.material].flat().forEach((m) => { m.map?.dispose(); m.dispose(); }); } });
    }
    size = n;
    island = new THREE.Group();
    const top = new THREE.MeshStandardMaterial({ map: checker(n), roughness: 1 });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(n, 0.5, n), [M.dirt, M.dirt, top, M.dirt, M.dirt, M.dirt]);
    slab.position.y = -0.25;
    slab.receiveShadow = true;
    slab.castShadow = true;
    slab.userData.own = true;
    const h = n * 0.65;
    const rock = new THREE.Mesh(new THREE.ConeGeometry(n * 0.7071, h, 4, 1), M.rock);
    rock.rotation.set(Math.PI, Math.PI / 4, 0);
    rock.position.y = -0.5 - h / 2 + 0.02;
    rock.castShadow = true;
    rock.userData.own = true;
    island.add(slab, rock);
    world.add(island);

    const s = n * 0.8;
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 60 });
    sun.shadow.camera.updateProjectionMatrix();
    buildClouds(n);
    reframe(false);
  };

  // ---------- encuadre ----------
  let desiredDist = 20;
  let needsFrame = false;
  let framed = false;
  const setDistance = (d) => {
    const dir = camera.position.clone().sub(controls.target);
    if (dir.lengthSq() === 0) dir.set(0.55, 0.62, 0.75);
    camera.position.copy(controls.target).addScaledVector(dir.normalize(), d);
  };
  const fitDistance = () => {
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    return (size * 0.5 + 0.9) / Math.sin(Math.min(vfov, hfov) / 2);
  };
  function reframe(snap) {
    desiredDist = fitDistance();
    controls.maxDistance = desiredDist * 1.4;
    controls.minDistance = Math.min(6, desiredDist * 0.4);
    if (snap) {
      const polar = 1.0, az = 0.62;
      camera.position.set(
        controls.target.x + Math.sin(polar) * Math.sin(az),
        controls.target.y + Math.cos(polar),
        controls.target.z + Math.sin(polar) * Math.cos(az),
      );
      setDistance(desiredDist);
    } else {
      needsFrame = framed;
    }
  }
  controls.addEventListener('start', () => { needsFrame = false; controls.autoRotate = false; clearTimeout(resumeSpin); });
  let resumeSpin = 0;
  controls.addEventListener('end', () => {
    clearTimeout(resumeSpin);
    resumeSpin = setTimeout(() => { controls.autoRotate = !reduceMotion; }, 4000);
  });

  // ---------- parcelas ----------
  const entries = new Map();
  let elapsed = 0;
  let selectedId = null;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.6, 4, 1),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, side: THREE.DoubleSide }),
  );
  ring.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
  ring.position.y = TOP + 0.02;
  ring.visible = false;
  world.add(ring);

  const place = (group, index) => {
    const [cx, cz] = spiralCell(index);
    group.position.set(cx, 0, cz);
  };

  function createPlot(plot, index) {
    const r = rng(hash(plot.id));
    const group = new THREE.Group();
    group.userData.plotId = plot.id;
    const pivot = new THREE.Group();
    group.add(pivot);
    put(pivot, G.tile, M.grass, [0, 0.07, 0]);
    const tm = typeMat(TYPE_BY_ID[plot.type]?.color ?? '#4f8ef7');
    put(pivot, G.pebble, tm.solid, [-0.34, TOP + 0.04, 0.34]).rotation.y = r();
    const body = new THREE.Group();
    body.rotation.y = r() * Math.PI * 2;
    pivot.add(body);
    const anim = [];
    BUILD[plot.plant.kind](body, r, { type: tm.solid, wing: tm.wing, anim });
    place(group, index);
    group.scale.setScalar(0.0001);
    return { id: plot.id, key: `${plot.plant.kind}|${plot.type}`, index, group, pivot, anim, pop: null, hop: null };
  }

  function sync(plots) {
    const needed = islandSizeFor(plots.length);
    if (needed !== size) buildIsland(needed);
    const ids = new Set(plots.map((p) => p.id));
    for (const [id, e] of entries) {
      if (!ids.has(id)) { world.remove(e.group); entries.delete(id); if (selectedId === id) setSelected(null); }
    }
    let fresh = 0;
    plots.forEach((plot, i) => {
      let e = entries.get(plot.id);
      if (e && e.key !== `${plot.plant.kind}|${plot.type}`) { world.remove(e.group); entries.delete(plot.id); e = null; }
      if (!e) {
        e = createPlot(plot, i);
        e.pop = { start: elapsed + 0.08 + Math.min(fresh, 24) * 0.07, dur: 0.7 };
        fresh += 1;
        entries.set(plot.id, e);
        world.add(e.group);
      }
      if (e.index !== i) { e.index = i; place(e.group, i); }
    });
  }

  function setSelected(id) {
    selectedId = id;
    ring.visible = Boolean(id);
    const e = id && entries.get(id);
    if (e) e.hop = elapsed;
    onSelect?.(id);
  }

  // ---------- selección por tap ----------
  const raycaster = new THREE.Raycaster();
  let down = null;
  canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!down) return;
    const tap = Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6 && performance.now() - down.t < 400;
    down = null;
    if (!tap) return;
    const rect = canvas.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), camera);
    const hit = raycaster.intersectObjects([...entries.values()].map((x) => x.group), true)[0];
    let node = hit?.object;
    while (node && !node.userData.plotId) node = node.parent;
    setSelected(node?.userData.plotId ?? null);
  });

  // ---------- bucle ----------
  let running = false;
  let sizeOk = false;
  let raf = 0;
  let last = 0;

  function update(dt) {
    elapsed += dt;
    world.position.y = reduceMotion ? 0 : Math.sin(elapsed * 0.9) * 0.1;
    for (const c of clouds) {
      c.userData.angle += c.userData.speed * dt;
      c.position.set(Math.cos(c.userData.angle) * c.userData.radius, c.userData.y, Math.sin(c.userData.angle) * c.userData.radius);
    }
    for (const e of entries.values()) {
      if (e.pop) {
        const k = (elapsed - e.pop.start) / e.pop.dur;
        if (k >= 1) { e.group.scale.setScalar(1); e.pop = null; }
        else e.group.scale.setScalar(k < 0 ? 0.0001 : Math.max(0.0001, easeOutBack(k)));
      }
      for (const fn of e.anim) fn(elapsed);
      if (e.hop != null) {
        const k = (elapsed - e.hop) / 0.4;
        e.pivot.position.y = k >= 1 ? 0 : Math.sin(k * Math.PI) * 0.18;
        if (k >= 1) e.hop = null;
      }
    }
    const sel = selectedId && entries.get(selectedId);
    if (sel) {
      ring.position.x = sel.group.position.x;
      ring.position.z = sel.group.position.z;
      ring.material.opacity = 0.65 + Math.sin(elapsed * 5) * 0.3;
    } else ring.visible = false;
    if (needsFrame) {
      const cur = camera.position.distanceTo(controls.target);
      setDistance(cur + (desiredDist - cur) * Math.min(1, dt * 3));
      if (Math.abs(desiredDist - cur) < 0.05) needsFrame = false;
    }
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    controls.update();
    renderer.render(scene, camera);
  }
  function setRunning(on) {
    if (on && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(loop); }
    else if (!on && running) { running = false; cancelAnimationFrame(raf); }
  }
  const onVisibility = () => setRunning(sizeOk && !document.hidden);
  document.addEventListener('visibilitychange', onVisibility);

  buildIsland(islandSizeFor(0));

  return {
    sync,
    deselect: () => setSelected(null),
    resize(w, h) {
      sizeOk = w > 2 && h > 2;
      if (sizeOk) {
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        reframe(!framed);
        framed = true;
      }
      setRunning(sizeOk && !document.hidden);
    },
    dispose() {
      setRunning(false);
      document.removeEventListener('visibilitychange', onVisibility);
      controls.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
