// Interactive 3D model of the car (The Car page).
// Until the team's real CAD is ready, this builds a concept Baja buggy from
// simple shapes. To use a real model instead, set CAR_MODEL.src in data.js.
import * as THREE from "../assets/vendor/three/three.module.min.js";
import { OrbitControls } from "../assets/vendor/three/controls/OrbitControls.js";
import { GLTFLoader } from "../assets/vendor/three/loaders/GLTFLoader.js";

const viewer = document.getElementById("car-viewer");
const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Units are metres. x = forward, y = up, z = sideways (positive = right side).
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const SIDES = [1, -1];

// The systems visitors can click on, with the sub-team that owns each one
const PARTS = [
  { id: "frame", title: "Roll cage & frame", team: "Frame & Chassis", anchor: V(0.02, 1.3, 0),
    text: "A steel tube space frame that protects the driver and ties every system together. It's designed, analyzed, and welded in-house." },
  { id: "front", title: "Front suspension", team: "Suspension & Steering", anchor: V(0.76, 0.5, 0.5),
    text: "Double A-arms and coilover shocks absorb jumps, rocks, and whoops so the tires stay on the ground." },
  { id: "cockpit", title: "Steering & cockpit", team: "Suspension & Steering", anchor: V(0.42, 0.84, 0),
    text: "Rack-and-pinion steering and a cockpit built around the driver, designed for control and fast egress." },
  { id: "drivetrain", title: "Engine & CVT", team: "Drivetrain", anchor: V(-0.68, 0.86, 0),
    text: "Every team runs the same single-cylinder engine. What we do with that power, through the CVT and gearbox, is up to us." },
  { id: "rear", title: "Rear suspension", team: "Suspension & Steering", anchor: V(-0.62, 0.52, 0.52),
    text: "Trailing arms with camber links keep the rear tires planted under power and over rough ground." },
  { id: "tires", title: "Wheels & tires", team: "Suspension & Steering", anchor: V(0.74, 0.29, 0.8),
    text: "Knobby off-road tires on lightweight rims, chosen for grip in mud, sand, and rock." }
];

if (viewer) start();

function start() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    viewer.querySelector(".viewer-fallback").hidden = false;
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  viewer.prepend(renderer.domElement);
  renderer.domElement.setAttribute("aria-label", "Interactive 3D model of the car. Drag to rotate, scroll or pinch to zoom.");
  renderer.domElement.setAttribute("role", "img");

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 50);
  const HOME_POS = V(3.3, 1.75, 3.5);
  const HOME_TARGET = V(0.05, 0.55, 0);
  camera.position.copy(HOME_POS);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(HOME_TARGET);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 1.6;
  controls.maxDistance = 9;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.autoRotate = !REDUCED_MOTION;
  controls.autoRotateSpeed = 0.8;

  // Lighting
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445544, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.6);
  sun.position.set(3, 5, 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: 0.5, far: 12 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xbfe6b0, 0.9);
  rim.position.set(-3, 2, -3);
  scene.add(rim);

  // Ground: soft shadow plus topographic contour rings
  const shadowMat = new THREE.ShadowMaterial({ opacity: 0.22 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(4, 64), shadowMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const contourMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.35 });
  for (let i = 0; i < 9; i++) {
    const r = 1.45 + i * 0.24;
    const pts = [];
    for (let a = 0; a < 128; a++) {
      const t = (a / 128) * Math.PI * 2;
      const wobble = 0.07 * Math.sin(3 * t + i * 0.7) + 0.05 * Math.cos(5 * t - i * 0.4) + 0.03 * Math.sin(9 * t + i);
      pts.push(V(Math.cos(t) * (r + wobble), 0.003, Math.sin(t) * (r + wobble) * 0.82));
    }
    scene.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), contourMat));
  }

  const car = new THREE.Group();
  scene.add(car);
  const built = buildConceptCar();
  car.add(built.root);
  const explodable = built.explodable;
  const xrayMats = built.xrayMats;
  // Where a part's hotspot is right now (it travels with its part in exploded view)
  const anchorOf = (part, out) => {
    out.copy(part.anchor);
    const g = built.groups[part.id];
    if (g && g.parent) out.add(g.position);
    return out;
  };

  // Optional real model from data.js replaces the concept car
  const modelSrc = typeof CAR_MODEL !== "undefined" && typeof CAR_MODEL.src === "string" && /^models\/[\w\-./]+\.glb$/.test(CAR_MODEL.src) && !CAR_MODEL.src.includes("..")
    ? CAR_MODEL.src : null;
  if (modelSrc) {
    new GLTFLoader().load(modelSrc, (gltf) => {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(V(0, 0, 0));
      model.scale.setScalar(2.4 / Math.max(size.x, size.z));
      box.setFromObject(model);
      const center = box.getCenter(V(0, 0, 0));
      model.position.sub(V(center.x, box.min.y, center.z));
      model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      car.remove(built.root);
      built.groups = {};
      car.add(model);
      explodable.length = 0;
      xrayMats.length = 0;
      viewer.querySelector('[data-tool="explode"]').hidden = true;
      viewer.querySelector('[data-tool="xray"]').hidden = true;
    });
  }

  // Theme colours come from the site's CSS variables
  const applyTheme = () => {
    const css = getComputedStyle(document.documentElement);
    contourMat.color.set(css.getPropertyValue("--champagne").trim() || "#3d8b37");
    const dark = (document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";
    shadowMat.opacity = dark ? 0.45 : 0.22;
    contourMat.opacity = dark ? 0.3 : 0.4;
  };
  applyTheme();
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);

  // Hotspot buttons and the info panel
  const panel = viewer.querySelector(".part-panel");
  const hotspots = PARTS.map((part, i) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "hotspot";
    button.textContent = String(i + 1).padStart(2, "0");
    button.setAttribute("aria-label", part.title);
    button.addEventListener("click", () => select(i));
    viewer.querySelector(".hotspot-layer").append(button);
    return { part, button };
  });

  let focus = null; // { pos, target } camera animation goal
  let selected = -1;
  function select(i) {
    selected = i;
    interacted = true;
    const { part } = hotspots[i];
    hotspots.forEach((h, j) => h.button.classList.toggle("active", j === i));
    panel.querySelector(".part-num").textContent = `${String(i + 1).padStart(2, "0")} / ${String(PARTS.length).padStart(2, "0")}`;
    panel.querySelector("h3").textContent = part.title;
    panel.querySelector(".part-text").textContent = part.text;
    panel.querySelector(".part-team").textContent = part.team;
    panel.hidden = false;
    // Swing the camera round to look at the part from its side of the car
    const anchor = anchorOf(part, V(0, 0, 0));
    const dir = V(anchor.x * 0.9 + 1.2, 0.55, anchor.z === 0 ? 1.4 : Math.sign(anchor.z) * 1.8).normalize();
    const distance = 3.4 * fitScale();
    focus = { target: anchor.clone().lerp(HOME_TARGET, 0.35), pos: anchor.clone().add(dir.multiplyScalar(distance)) };
    setAuto(false);
  }
  panel.querySelector(".part-close").addEventListener("click", () => {
    panel.hidden = true;
    selected = -1;
    hotspots.forEach((h) => h.button.classList.remove("active"));
  });
  panel.querySelector(".part-next").addEventListener("click", () => select((selected + 1) % PARTS.length));

  // Toolbar
  const tools = {};
  viewer.querySelectorAll("[data-tool]").forEach((b) => { tools[b.dataset.tool] = b; });
  const setAuto = (on) => {
    controls.autoRotate = on;
    tools.rotate.setAttribute("aria-pressed", String(on));
  };
  setAuto(controls.autoRotate);
  controls.addEventListener("start", () => { interacted = true; focus = null; setAuto(false); });
  tools.rotate.addEventListener("click", () => setAuto(!controls.autoRotate));

  let explodeGoal = 0;
  let explode = 0;
  tools.explode.addEventListener("click", () => {
    explodeGoal = explodeGoal ? 0 : 1;
    tools.explode.setAttribute("aria-pressed", String(!!explodeGoal));
    if (REDUCED_MOTION) explode = explodeGoal;
  });

  tools.xray.addEventListener("click", () => {
    const on = tools.xray.getAttribute("aria-pressed") !== "true";
    tools.xray.setAttribute("aria-pressed", String(on));
    for (const m of xrayMats) {
      m.transparent = on || m.userData.baseTransparent;
      m.opacity = on ? 0.14 : m.userData.baseOpacity;
      m.depthWrite = !on;
      m.needsUpdate = true;
    }
  });

  tools.reset.addEventListener("click", () => {
    focus = { pos: homePos(), target: HOME_TARGET.clone() };
    panel.querySelector(".part-close").click();
  });

  // Narrow (portrait) screens need the camera further back to fit the car's width
  const fitScale = () => Math.min(1.45, Math.max(1, 1.15 / camera.aspect));
  const homePos = () => HOME_POS.clone().sub(HOME_TARGET).multiplyScalar(fitScale()).add(HOME_TARGET);

  // Sizing
  let interacted = false;
  const resize = () => {
    const { clientWidth: w, clientHeight: h } = viewer;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 640 ? 44 : 34;
    camera.updateProjectionMatrix();
    if (!interacted) camera.position.copy(homePos());
  };
  new ResizeObserver(resize).observe(viewer);
  resize();

  // Only render while the viewer is on screen
  let visible = true;
  new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; }).observe(viewer);

  const projected = V(0, 0, 0);
  const anchorNow = V(0, 0, 0);
  const toCamera = V(0, 0, 0);
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!visible || document.hidden) return;

    if (focus) {
      const k = 1 - Math.pow(0.002, dt);
      camera.position.lerp(focus.pos, k);
      controls.target.lerp(focus.target, k);
      if (camera.position.distanceTo(focus.pos) < 0.01) focus = null;
    }

    if (explode !== explodeGoal) {
      explode += Math.sign(explodeGoal - explode) * dt * 1.6;
      explode = THREE.MathUtils.clamp(explode, 0, 1);
    }
    const e = explode * explode * (3 - 2 * explode); // smoothstep
    for (const g of explodable) g.position.copy(g.userData.explode).multiplyScalar(e);

    controls.update();
    renderer.render(scene, camera);

    // Keep hotspot buttons pinned to their parts; fade ones on the far side
    const w = viewer.clientWidth;
    const h = viewer.clientHeight;
    for (const { part, button } of hotspots) {
      anchorOf(part, anchorNow);
      projected.copy(anchorNow).project(camera);
      toCamera.copy(camera.position).sub(anchorNow).normalize();
      const facing = part.anchor.z === 0 ? 1 : Math.sign(part.anchor.z) * toCamera.z + 0.25;
      button.style.transform = `translate(${(projected.x * 0.5 + 0.5) * w}px, ${(-projected.y * 0.5 + 0.5) * h}px)`;
      button.classList.toggle("faded", facing < 0);
    }
  });
}

// ---------------------------------------------------------------------------
// Concept car
// ---------------------------------------------------------------------------
function buildConceptCar() {
  const root = new THREE.Group();
  const explodable = [];
  const xrayMats = [];

  const mat = (color, opts = {}, xray = false) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.2, ...opts });
    m.userData.baseOpacity = m.opacity;
    m.userData.baseTransparent = m.transparent;
    if (xray) xrayMats.push(m);
    return m;
  };
  const M = {
    frame: mat(0x4aa63a, { roughness: 0.38, metalness: 0.35 }),
    steel: mat(0x2c302e, { roughness: 0.4, metalness: 0.7 }),
    alu: mat(0xb9c0bc, { roughness: 0.28, metalness: 0.85 }),
    rubber: mat(0x1b1d1c, { roughness: 0.92, metalness: 0 }, true),
    seat: mat(0x232725, { roughness: 0.85, metalness: 0 }, true),
    panel: mat(0x1d2622, { roughness: 0.6, metalness: 0.1, side: THREE.DoubleSide }, true),
    plate: mat(0x9aa29e, { roughness: 0.35, metalness: 0.8, side: THREE.DoubleSide }, true),
    engine: mat(0x3a3f3c, { roughness: 0.55, metalness: 0.5 }, true),
    cvt: mat(0xc9cfcc, { roughness: 0.3, metalness: 0.9 }, true),
    spring: mat(0xf2c230, { roughness: 0.35, metalness: 0.5 }),
    red: mat(0xc0392b, { roughness: 0.5, metalness: 0.1 }, true),
    light: new THREE.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xff2010, emissiveIntensity: 1.2 })
  };

  // A part group that slides by `offset` in exploded view
  const part = (offset) => {
    const g = new THREE.Group();
    g.userData.explode = offset;
    explodable.push(g);
    root.add(g);
    return g;
  };

  const add = (group, mesh) => { mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh; };
  const tube = (group, a, b, r, material) => {
    const dir = b.clone().sub(a);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 14), material);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(UP, dir.normalize());
    return add(group, m);
  };
  const box = (group, size, pos, material, rot = [0, 0, 0]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    m.position.copy(pos);
    m.rotation.set(...rot);
    return add(group, m);
  };
  const disk = (group, r, thick, pos, material, axis = "z") => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, thick, 32), material);
    m.position.copy(pos);
    if (axis === "z") m.rotation.x = Math.PI / 2;
    if (axis === "x") m.rotation.z = Math.PI / 2;
    return add(group, m);
  };

  // ---- Frame (roll cage): welded tube space frame, mirrored left/right
  const frame = part(V(0, 0, 0));
  const R = 0.017;
  const nodes = [];
  const member = (a, b) => { tube(frame, a, b, R, M.frame); nodes.push(a, b); };
  const N = (s) => ({
    A: V(-0.30, 0.22, 0.34 * s), // rear roll hoop, bottom
    G: V(-0.32, 0.62, 0.38 * s), // side impact member, rear
    J: V(-0.34, 0.95, 0.34 * s), // rear roll hoop, shoulder
    B: V(-0.36, 1.28, 0.30 * s), // roof, rear
    C: V(0.38, 1.28, 0.30 * s), // roof, front
    E: V(0.98, 0.62, 0.24 * s), // front bulkhead, top
    D: V(1.02, 0.30, 0.22 * s), // front bulkhead, bottom
    F: V(1.20, 0.42, 0.15 * s), // nose
    H: V(-0.95, 0.30, 0.26 * s), // rear box, low
    I: V(-0.92, 0.78, 0.22 * s) // rear box, high
  });
  const L = N(-1);
  const Rt = N(1);
  for (const n of [L, Rt]) {
    member(n.A, n.G); member(n.G, n.J); member(n.J, n.B); // rear roll hoop
    member(n.B, n.C); // roof
    member(n.C, n.E); // front bracing
    member(n.A, n.D); // lower frame side
    member(n.G, n.E); // side impact member
    member(n.D, n.E); member(n.D, n.F); member(n.E, n.F); // front bulkhead and nose
    member(n.A, n.H); member(n.H, n.I); member(n.I, n.J); member(n.G, n.H); // rear box
  }
  for (const k of ["A", "B", "C", "D", "E", "F", "H", "I", "G"]) member(L[k], Rt[k]); // cross members
  member(L.A, Rt.J); // rear hoop diagonal
  member(V(0.36, 0.25, -0.30), V(0.36, 0.25, 0.30)); // floor cross member
  // Welded joints
  const jointGeo = new THREE.SphereGeometry(R * 1.25, 12, 10);
  const seen = new Set();
  for (const p of nodes) {
    const key = p.toArray().map((v) => v.toFixed(2)).join();
    if (seen.has(key)) continue;
    seen.add(key);
    const j = new THREE.Mesh(jointGeo, M.frame);
    j.position.copy(p);
    add(frame, j);
  }
  // Brake light on the roll hoop
  box(frame, [0.04, 0.05, 0.12], V(-0.39, 1.2, 0), M.light);

  // ---- Body panels: floor, firewall, and side panels with the team name
  const body = part(V(0, 0.12, 0));
  box(body, [1.3, 0.01, 0.58], V(0.36, 0.205, 0), M.plate); // floor pan
  box(body, [0.012, 0.7, 0.64], V(-0.305, 0.56, 0), M.plate, [0, 0, 0.02]); // firewall
  const sideTex = makeSideTexture();
  for (const s of SIDES) {
    const sidePanelGroup = part(V(0, 0.05, 0.32 * s));
    const sideMat = mat(0xffffff, { map: sideTex, roughness: 0.55, metalness: 0.1 }, true); // front face only, so the far panel never shows mirrored
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.26, 0.34), sideMat);
    panel.position.set(0.33, 0.44, 0.335 * s);
    panel.rotation.y = s > 0 ? 0.107 : Math.PI - 0.107;
    add(sidePanelGroup, panel);
  }

  // ---- Cockpit: seat, steering wheel, column, pedals
  const cockpit = part(V(0, 0.55, 0));
  box(cockpit, [0.4, 0.07, 0.42], V(0.0, 0.29, 0), M.seat);
  box(cockpit, [0.06, 0.5, 0.4], V(-0.19, 0.56, 0), M.seat, [0, 0, -0.22]);
  for (const s of SIDES) box(cockpit, [0.36, 0.14, 0.05], V(0.0, 0.38, 0.2 * s), M.seat); // bolsters
  const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.016, 12, 40), M.steel);
  wheelRing.position.set(0.42, 0.82, 0);
  wheelRing.rotation.y = Math.PI / 2;
  wheelRing.rotation.x = -0.45;
  add(cockpit, wheelRing);
  tube(cockpit, V(0.41, 0.82, -0.12), V(0.43, 0.82, 0.12), 0.012, M.steel); // spoke
  tube(cockpit, V(0.44, 0.81, 0), V(0.86, 0.44, 0), 0.014, M.alu); // column
  disk(cockpit, 0.03, 0.05, V(0.44, 0.81, 0), M.alu, "x");
  for (const s of SIDES) box(cockpit, [0.03, 0.09, 0.06], V(0.86, 0.35, 0.07 * s), M.alu, [0, 0, 0.3]);

  // ---- Drivetrain: engine, CVT, gearbox, axles, exhaust, fuel tank
  const drive = part(V(-0.45, 0.3, 0));
  box(drive, [0.3, 0.26, 0.28], V(-0.68, 0.48, -0.04), M.engine); // block
  box(drive, [0.2, 0.14, 0.22], V(-0.66, 0.66, -0.04), M.engine, [0, 0, 0.25]); // head
  for (let i = 0; i < 4; i++) box(drive, [0.22, 0.008, 0.24], V(-0.67, 0.6 + i * 0.03, -0.04), M.steel, [0, 0, 0.25]); // cooling fins
  disk(drive, 0.07, 0.12, V(-0.54, 0.72, -0.16), M.steel, "z"); // air filter
  box(drive, [0.18, 0.13, 0.18], V(-0.56, 0.79, 0.12), M.red); // fuel tank
  disk(drive, 0.125, 0.07, V(-0.62, 0.44, 0.17), M.cvt); // CVT drive pulley cover
  disk(drive, 0.1, 0.07, V(-0.87, 0.34, 0.17), M.cvt); // CVT driven pulley cover
  box(drive, [0.25, 0.18, 0.07], V(-0.745, 0.39, 0.17), M.cvt, [0, 0, 0.38]);
  box(drive, [0.16, 0.16, 0.2], V(-0.86, 0.33, 0.02), M.alu); // gearbox
  const exhaust = new THREE.CatmullRomCurve3([V(-0.74, 0.62, -0.16), V(-0.8, 0.7, -0.2), V(-0.9, 0.7, -0.17)]);
  add(drive, new THREE.Mesh(new THREE.TubeGeometry(exhaust, 20, 0.022, 10), M.steel));
  disk(drive, 0.05, 0.16, V(-0.96, 0.7, -0.17), M.steel, "x"); // muffler

  // ---- Wheels
  const tireGeo = makeTireGeometry();
  const lugGeo = new THREE.BoxGeometry(0.03, 0.055, 0.065);
  const groups = { frame, cockpit, drivetrain: drive };
  for (const [x, s] of [[0.74, 1], [0.74, -1], [-0.72, 1], [-0.72, -1]]) {
    const g = part(V(0, 0, 0.42 * s));
    if (x > 0 && s > 0) groups.tires = g;
    const w = new THREE.Group();
    w.position.set(x, 0.29, 0.66 * s);
    w.rotation.y = s > 0 ? 0 : Math.PI;
    g.add(w);
    add(w, new THREE.Mesh(tireGeo, M.rubber));
    const lugs = new THREE.InstancedMesh(lugGeo, M.rubber, 56);
    const tmp = new THREE.Object3D();
    for (let i = 0; i < 28; i++) {
      for (const row of [0, 1]) {
        const a = ((i + row * 0.5) / 28) * Math.PI * 2;
        tmp.position.set(Math.cos(a) * 0.285, Math.sin(a) * 0.285, row ? 0.05 : -0.05);
        tmp.rotation.set(0, 0, a);
        tmp.updateMatrix();
        lugs.setMatrixAt(i * 2 + row, tmp.matrix);
      }
    }
    lugs.castShadow = true;
    w.add(lugs);
    disk(w, 0.155, 0.16, V(0, 0, 0), M.alu); // rim
    const bead = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.009, 8, 40), M.steel);
    bead.position.z = 0.082;
    add(w, bead);
    disk(w, 0.05, 0.18, V(0, 0, 0.01), M.steel); // hub
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      disk(w, 0.009, 0.03, V(Math.cos(a) * 0.035, Math.sin(a) * 0.035, 0.1), M.alu);
    }
  }

  // ---- Suspension, per side
  for (const s of SIDES) {
    // Front: double A-arms, upright, coilover, tie rod
    const front = part(V(0.05, 0, 0.22 * s));
    if (s > 0) groups.front = front;
    const lowBall = V(0.74, 0.23, 0.5 * s);
    const upBall = V(0.74, 0.39, 0.49 * s);
    tube(front, V(0.6, 0.25, 0.2 * s), lowBall, 0.012, M.steel);
    tube(front, V(0.88, 0.26, 0.2 * s), lowBall, 0.012, M.steel);
    tube(front, V(0.62, 0.46, 0.23 * s), upBall, 0.011, M.steel);
    tube(front, V(0.86, 0.46, 0.23 * s), upBall, 0.011, M.steel);
    box(front, [0.06, 0.2, 0.05], V(0.74, 0.31, 0.52 * s), M.alu); // upright
    tube(front, V(0.86, 0.35, 0.16 * s), V(0.82, 0.33, 0.5 * s), 0.008, M.alu); // tie rod
    coilover(front, V(0.74, 0.26, 0.41 * s), V(0.7, 0.92, 0.27 * s));

    // Rear: trailing arm, camber links, coilover, CV axle
    const rear = part(V(-0.05, 0, 0.22 * s));
    if (s > 0) groups.rear = rear;
    const hub = V(-0.72, 0.29, 0.52 * s);
    tube(rear, V(-0.22, 0.28, 0.35 * s), hub, 0.016, M.steel);
    tube(rear, V(-0.86, 0.3, 0.22 * s), V(-0.72, 0.25, 0.5 * s), 0.01, M.steel);
    tube(rear, V(-0.86, 0.56, 0.2 * s), V(-0.72, 0.4, 0.5 * s), 0.01, M.steel);
    box(rear, [0.08, 0.2, 0.05], V(-0.72, 0.31, 0.52 * s), M.alu);
    coilover(rear, V(-0.56, 0.3, 0.46 * s), V(-0.64, 0.87, 0.28 * s));
    tube(rear, V(-0.86, 0.33, 0.1 * s), hub, 0.014, M.steel); // CV axle
    tube(frame, V(-0.34, 0.95, 0.34 * s), V(-0.92, 0.78, 0.22 * s), R, M.frame); // shock tower
  }

  function coilover(group, a, b) {
    const dir = b.clone().sub(a);
    const len = dir.length();
    const g = new THREE.Group();
    g.position.copy(a);
    g.quaternion.setFromUnitVectors(UP, dir.normalize());
    group.add(g);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, len * 0.55, 16), M.steel);
    body.position.y = len * 0.7;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, len * 0.5, 10), M.alu);
    shaft.position.y = len * 0.25;
    add(g, body);
    add(g, shaft);
    const turns = 7;
    const helix = new THREE.Curve();
    helix.getPoint = (t, target = V(0, 0, 0)) =>
      target.set(Math.cos(t * turns * Math.PI * 2) * 0.034, len * (0.12 + t * 0.66), Math.sin(t * turns * Math.PI * 2) * 0.034);
    add(g, new THREE.Mesh(new THREE.TubeGeometry(helix, 160, 0.006, 6), M.spring));
  }

  return { root, explodable, xrayMats, groups };
}

// Rounded tyre profile spun around the axle (axle along z)
function makeTireGeometry() {
  const profile = [
    [0.155, -0.105], [0.235, -0.11], [0.265, -0.095], [0.278, -0.06], [0.28, 0],
    [0.278, 0.06], [0.265, 0.095], [0.235, 0.11], [0.155, 0.105]
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(profile, 48);
  geo.rotateX(Math.PI / 2);
  return geo;
}

// Side panel graphic: dark panel, team name, topo lines
function makeSideTexture() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 276;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  drawSide(c);
  // Redraw once the site fonts have loaded so the lettering matches the site
  Promise.all([document.fonts.load("700 104px Inter"), document.fonts.load("500 44px 'IBM Plex Mono'")])
    .then(() => { drawSide(c); tex.needsUpdate = true; })
    .catch(() => {});
  return tex;
}

function drawSide(c) {
  const g = c.getContext("2d");
  g.fillStyle = "#16201c";
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = "rgba(168, 216, 154, 0.14)";
  g.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    g.beginPath();
    for (let x = 0; x <= c.width; x += 16) {
      const y = 40 + i * 28 + Math.sin(x / 120 + i) * 14 + Math.cos(x / 53 + i * 2) * 6;
      x ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
  }
  g.fillStyle = "#4aa63a";
  g.fillRect(0, c.height - 22, c.width, 22);
  g.fillStyle = "#f4f5f3";
  g.font = "700 104px Inter, system-ui, sans-serif";
  g.textBaseline = "middle";
  g.fillText("USASK", 56, 118);
  g.fillStyle = "#9fd18f";
  g.font = "500 44px 'IBM Plex Mono', ui-monospace, monospace";
  g.fillText("BAJA SAE", 60, 200);
}
