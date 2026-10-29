// garden-scene.js
// Web Component <garden-scene>: bosque isométrico en 3D con Three.js.
// El suelo es un tablero de tierra; cada recompensa plantada ocupa una celda.
//   grass -> cuadrito de pasto     flower -> flor
//   bush  -> arbusto               tree   -> árbol
//   butterfly -> mariposa animada  sakura -> árbol de sakura
// Se reconstruye desde store.garden y reacciona a 'garden:planted'.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { store, TASK_TYPES } from '../store.js';

const GRID = 12;          // celdas por lado
const CELL = 1;           // tamaño de celda
const HALF = (GRID * CELL) / 2;

class GardenScene extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <div class="rounded-2xl bg-slate-900/60 border border-slate-800 p-3 shadow-xl backdrop-blur">
        <div class="flex items-center justify-between px-2 pt-1 pb-3">
          <h2 class="text-lg font-semibold flex items-center gap-2">🌳 Tu jardín</h2>
          <span class="text-xs text-slate-500">arrastra para girar · scroll para zoom</span>
        </div>
        <div id="canvas-wrap" class="relative w-full rounded-xl overflow-hidden"
             style="aspect-ratio: 1 / 0.82; background: linear-gradient(180deg,#0f172a,#0b1020);">
          <div id="empty" class="absolute inset-0 flex items-center justify-center text-slate-600 text-sm pointer-events-none">
            Completa rondas de pomodoro para hacer crecer tu bosque 🌱
          </div>
        </div>
      </div>
    `;

    this.wrap = this.querySelector('#canvas-wrap');
    this.emptyEl = this.querySelector('#empty');
    this.occupied = new Set();   // celdas ocupadas "x,z"
    this.butterflies = [];       // para animarlas

    this.initThree();
    this.buildGround();
    this.replantFromStore();
    this.animate();

    this._onPlanted = (e) => this.plant(e.detail);
    store.addEventListener('garden:planted', this._onPlanted);
    this._onReset = () => this.clearGarden();
    store.addEventListener('garden:reset', this._onReset);

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
  }

  disconnectedCallback() {
    store.removeEventListener('garden:planted', this._onPlanted);
    store.removeEventListener('garden:reset', this._onReset);
    window.removeEventListener('resize', this._onResize);
    cancelAnimationFrame(this.raf);
    this.renderer?.dispose();
  }

  initThree() {
    const rect = this.wrap.getBoundingClientRect();
    const w = rect.width || 480;
    const h = rect.height || 400;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x0b1020, 14, 30);

    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
    this.camera.position.set(11, 10, 11);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.wrap.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 26;
    this.controls.maxPolarAngle = Math.PI / 2.2;
    this.controls.target.set(0, 0.5, 0);

    // Luces
    const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x20351f, 0.9);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2cc, 1.1);
    sun.position.set(8, 14, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 40;
    sun.shadow.camera.left = -HALF - 2;
    sun.shadow.camera.right = HALF + 2;
    sun.shadow.camera.top = HALF + 2;
    sun.shadow.camera.bottom = -HALF - 2;
    this.scene.add(sun);
  }

  buildGround() {
    // Base de tierra (un solo plano) + rejilla sutil de celdas.
    const dirt = new THREE.Mesh(
      new THREE.BoxGeometry(GRID * CELL, 0.6, GRID * CELL),
      new THREE.MeshStandardMaterial({ color: 0x6b4f2a, roughness: 1 })
    );
    dirt.position.y = -0.3;
    dirt.receiveShadow = true;
    this.scene.add(dirt);

    // Borde superior un poco más claro para dar relieve.
    const top = new THREE.Mesh(
      new THREE.PlaneGeometry(GRID * CELL, GRID * CELL),
      new THREE.MeshStandardMaterial({ color: 0x7a5a30, roughness: 1 })
    );
    top.rotation.x = -Math.PI / 2;
    top.position.y = 0.001;
    top.receiveShadow = true;
    this.scene.add(top);

    const grid = new THREE.GridHelper(GRID * CELL, GRID, 0x3b2d18, 0x3b2d18);
    grid.position.y = 0.01;
    grid.material.opacity = 0.35;
    grid.material.transparent = true;
    this.scene.add(grid);
  }

  // Devuelve el centro (x,z) de una celda libre, en espiral desde el centro.
  nextFreeCell() {
    // Recorrido en espiral para que el bosque crezca desde el centro.
    let x = 0, z = 0, dx = 0, dz = -1;
    const limit = GRID * GRID;
    for (let i = 0; i < limit; i++) {
      const cx = x, cz = z;
      if (Math.abs(cx) <= GRID / 2 && Math.abs(cz) <= GRID / 2) {
        const key = `${cx},${cz}`;
        if (!this.occupied.has(key)) {
          this.occupied.add(key);
          return { gx: cx, gz: cz };
        }
      }
      if (x === z || (x < 0 && x === -z) || (x > 0 && x === 1 - z)) {
        [dx, dz] = [-dz, dx];
      }
      x += dx; z += dz;
    }
    // Si se llena, reutiliza una celda al azar.
    const gx = Math.floor(Math.random() * GRID - GRID / 2);
    const gz = Math.floor(Math.random() * GRID - GRID / 2);
    return { gx, gz };
  }

  cellToWorld(gx, gz) {
    return { x: gx * CELL, z: gz * CELL };
  }

  plant(entry) {
    this.emptyEl?.remove();
    const { gx, gz } = this.nextFreeCell();
    const { x, z } = this.cellToWorld(gx, gz);
    const color = TASK_TYPES[entry.type]?.color ?? '#22c55e';
    const group = this.makeReward(entry.reward, color);
    group.position.set(x, 0, z);

    // Aparición con "pop".
    group.scale.setScalar(0.01);
    this.scene.add(group);
    const start = performance.now();
    const popDur = 420;
    const pop = (now) => {
      const t = Math.min(1, (now - start) / popDur);
      const e = 1 - Math.pow(1 - t, 3);          // easeOutCubic
      const overshoot = t < 1 ? 1 + 0.12 * Math.sin(t * Math.PI) : 1;
      group.scale.setScalar(e * overshoot);
      if (t < 1) requestAnimationFrame(pop);
    };
    requestAnimationFrame(pop);
  }

  // Construye la malla de cada tipo de recompensa.
  makeReward(reward, hex) {
    const g = new THREE.Group();
    const col = new THREE.Color(hex);

    const grassMat = new THREE.MeshStandardMaterial({ color: 0x2f9e44, roughness: 0.9 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 1 });
    const leafMat  = new THREE.MeshStandardMaterial({ color: 0x2b8a3e, roughness: 0.8 });
    const accent   = new THREE.MeshStandardMaterial({ color: col, roughness: 0.6, emissive: col.clone().multiplyScalar(0.15) });

    const addShadow = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

    switch (reward) {
      case 'grass': {
        const patch = addShadow(new THREE.Mesh(
          new THREE.BoxGeometry(0.9, 0.18, 0.9), grassMat));
        patch.position.y = 0.09;
        g.add(patch);
        // briznas
        for (let i = 0; i < 4; i++) {
          const blade = new THREE.Mesh(
            new THREE.ConeGeometry(0.05, 0.3, 4), grassMat);
          blade.position.set((Math.random() - 0.5) * 0.6, 0.3, (Math.random() - 0.5) * 0.6);
          g.add(blade);
        }
        break;
      }
      case 'flower': {
        this._base(g, grassMat);
        const stem = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5), leafMat));
        stem.position.y = 0.4;
        g.add(stem);
        const center = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10),
          new THREE.MeshStandardMaterial({ color: 0xffd43b }));
        center.position.y = 0.7;
        g.add(center);
        for (let i = 0; i < 6; i++) {
          const petal = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), accent);
          const a = (i / 6) * Math.PI * 2;
          petal.position.set(Math.cos(a) * 0.17, 0.7, Math.sin(a) * 0.17);
          petal.scale.set(1, 0.6, 1);
          g.add(petal);
        }
        break;
      }
      case 'bush': {
        this._base(g, grassMat);
        for (let i = 0; i < 5; i++) {
          const blob = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), leafMat));
          blob.position.set((Math.random() - 0.5) * 0.5, 0.3 + Math.random() * 0.25, (Math.random() - 0.5) * 0.5);
          g.add(blob);
        }
        const berry = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), accent);
        berry.position.set(0.12, 0.5, 0.05);
        g.add(berry);
        break;
      }
      case 'tree': {
        this._base(g, grassMat);
        const trunk = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.9), trunkMat));
        trunk.position.y = 0.55;
        g.add(trunk);
        const crown = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.1, 10), leafMat));
        crown.position.y = 1.4;
        g.add(crown);
        const crown2 = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.8, 10), leafMat));
        crown2.position.y = 1.9;
        g.add(crown2);
        break;
      }
      case 'sakura': {
        this._base(g, grassMat);
        const trunk = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.0), trunkMat));
        trunk.position.y = 0.6;
        g.add(trunk);
        const pinkMat = new THREE.MeshStandardMaterial({ color: 0xffa6c9, roughness: 0.7,
          emissive: new THREE.Color(0xff8fb8).multiplyScalar(0.12) });
        for (let i = 0; i < 6; i++) {
          const blob = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 12), pinkMat));
          const a = (i / 6) * Math.PI * 2;
          blob.position.set(Math.cos(a) * 0.3, 1.35 + Math.random() * 0.25, Math.sin(a) * 0.3);
          g.add(blob);
        }
        const top = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 12), pinkMat));
        top.position.y = 1.75;
        g.add(top);
        break;
      }
      case 'butterfly': {
        this._base(g, grassMat);
        const body = new THREE.Group();
        const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.2, 4, 8),
          new THREE.MeshStandardMaterial({ color: 0x222 }));
        body.add(torso);
        const wingGeo = new THREE.CircleGeometry(0.22, 16);
        const wingMat = new THREE.MeshStandardMaterial({ color: col, side: THREE.DoubleSide,
          emissive: col.clone().multiplyScalar(0.25), roughness: 0.5 });
        const wl = new THREE.Mesh(wingGeo, wingMat);
        const wr = new THREE.Mesh(wingGeo, wingMat);
        wl.position.x = -0.18; wr.position.x = 0.18;
        wl.scale.set(0.8, 1.2, 1); wr.scale.set(0.8, 1.2, 1);
        body.add(wl); body.add(wr);
        body.position.y = 1.1;
        g.add(body);
        g.userData.butterfly = { body, wl, wr, phase: Math.random() * Math.PI * 2, baseY: 1.1 };
        this.butterflies.push(g);
        break;
      }
      default: {
        this._base(g, grassMat);
      }
    }
    return g;
  }

  _base(group, grassMat) {
    const patch = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.9), grassMat);
    patch.position.y = 0.09;
    patch.castShadow = true; patch.receiveShadow = true;
    group.add(patch);
  }

  replantFromStore() {
    for (const entry of store.garden) this.plant(entry);
  }

  clearGarden() {
    // Quita todo menos suelo/rejilla/luces. Recreamos escena limpia.
    this.butterflies = [];
    this.occupied.clear();
    // Elimina meshes de recompensas (grupos que agregamos).
    const toRemove = [];
    this.scene.traverse((o) => {
      if (o.type === 'Group' && o !== this.scene) toRemove.push(o);
    });
    toRemove.forEach((o) => this.scene.remove(o));
    this.wrap.insertAdjacentHTML('beforeend',
      `<div id="empty" class="absolute inset-0 flex items-center justify-center text-slate-600 text-sm pointer-events-none">Completa rondas de pomodoro para hacer crecer tu bosque 🌱</div>`);
    this.emptyEl = this.querySelector('#empty');
  }

  resize() {
    const rect = this.wrap.getBoundingClientRect();
    if (!rect.width) return;
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(rect.width, rect.height);
  }

  animate() {
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      const t = performance.now() / 1000;
      // Animación de mariposas: aleteo + flotación.
      for (const g of this.butterflies) {
        const b = g.userData.butterfly;
        if (!b) continue;
        const flap = Math.sin(t * 8 + b.phase) * 0.9;
        b.wl.rotation.y = flap;
        b.wr.rotation.y = -flap;
        b.body.position.y = b.baseY + Math.sin(t * 2 + b.phase) * 0.12;
      }
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }
}

customElements.define('garden-scene', GardenScene);
