// Interactive 3D model of the car (The Car page).
// Until the team's real CAD is ready, this builds a concept Baja buggy in code.
// To use a real model instead, set CAR_MODEL.src in data.js.
import * as THREE from "../assets/vendor/three/three.module.min.js";
import { OrbitControls } from "../assets/vendor/three/controls/OrbitControls.js";
import { GLTFLoader } from "../assets/vendor/three/loaders/GLTFLoader.js";
import { RoomEnvironment } from "../assets/vendor/three/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "../assets/vendor/three/geometries/RoundedBoxGeometry.js";

const viewer = document.getElementById("car-viewer");
const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Units are metres. x = forward, y = up, z = sideways (positive = right side).
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const SIDES = [1, -1];
const TIRE_R = 0.282;
const DRIVE_SPEED = 3.2; // m/s, for the drive animation

// The systems visitors can click on, with the sub-team that owns each one
const PARTS = [
  { id: "frame", title: "Roll cage & frame", team: "Frame & Chassis", anchor: V(0.02, 1.3, 0),
    text: "A steel tube space frame that protects the driver and ties every system together. It's designed, analyzed, bent, and welded in-house." },
  { id: "front", title: "Front suspension", team: "Suspension & Steering", anchor: V(0.76, 0.5, 0.5),
    text: "Double A-arms and coilover shocks absorb jumps, rocks, and whoops so the tires stay on the ground. Try the bump test." },
  { id: "cockpit", title: "Steering & cockpit", team: "Suspension & Steering", anchor: V(0.42, 0.84, 0),
    text: "Rack-and-pinion steering, a quick-release wheel, and a seat and harness built around the driver for control and fast exit." },
  { id: "drivetrain", title: "Engine & CVT", team: "Drivetrain", anchor: V(-0.68, 0.88, 0),
    text: "Every team runs the same single-cylinder engine. What we do with that power, through the CVT and gearbox, is up to us." },
  { id: "rear", title: "Rear suspension", team: "Suspension & Steering", anchor: V(-0.62, 0.52, 0.52),
    text: "Trailing arms with camber links keep the rear tires planted under power and over rough ground." },
  { id: "tires", title: "Wheels & brakes", team: "Suspension & Steering", anchor: V(0.74, 0.29, 0.8),
    text: "Knobby off-road tires on lightweight rims, with disc brakes at every corner." }
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
  const SMALL = viewer.clientWidth < 700;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, SMALL ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  viewer.prepend(renderer.domElement);
  renderer.domElement.setAttribute("aria-label", "Interactive 3D model of the car. Drag to rotate, scroll or pinch to zoom.");
  renderer.domElement.setAttribute("role", "img");

  const scene = new THREE.Scene();
  // Studio reflections make metal and paint read as real materials
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50);
  const HOME_POS = V(3.4, 1.6, 3.6);
  const HOME_TARGET = V(0.05, 0.5, 0);
  camera.position.copy(HOME_POS);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(HOME_TARGET);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 1.6;
  controls.maxDistance = 9;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.autoRotate = !REDUCED_MOTION;
  controls.autoRotateSpeed = 0.7;

  // Lighting: soft key light with shadows, cool fill, green rim
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a4a40, 0.5));
  const sun = new THREE.DirectionalLight(0xfff6ea, 2.4);
  sun.position.set(2.5, 5, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(SMALL ? 1024 : 2048, SMALL ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -2.2, right: 2.2, top: 2.2, bottom: -2.2, near: 0.5, far: 12 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xbfe6b0, 0.7);
  rim.position.set(-3, 2.5, -3);
  scene.add(rim);

  // Ground: soft shadow plus a topographic contour texture that fades out at the edges
  const shadowMat = new THREE.ShadowMaterial({ opacity: 0.28 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(4.5, 64), shadowMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const contourTex = makeContourTexture("assets/img/topo.svg");
  const contourMat = new THREE.MeshBasicMaterial({ map: contourTex, alphaMap: makeRadialFade(), transparent: true, depthWrite: false });
  const contours = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), contourMat);
  contours.rotation.x = -Math.PI / 2;
  contours.position.y = 0.002;
  scene.add(contours);

  const car = new THREE.Group();
  scene.add(car);
  const built = buildConceptCar();
  car.add(built.root);
  const { explodable, xrayMats, corners } = built;
  const dust = makeDust();
  scene.add(dust.points);

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
      car.add(model);
      built.groups = {};
      explodable.length = 0;
      xrayMats.length = 0;
      corners.length = 0;
      for (const t of ["explode", "xray", "bump"]) viewer.querySelector(`[data-tool="${t}"]`).hidden = true;
      viewer.querySelector(".livery").hidden = true;
    });
  }

  // Theme colours come from the site's CSS variables
  const applyTheme = () => {
    const css = getComputedStyle(document.documentElement);
    contourMat.color.set(css.getPropertyValue("--champagne").trim() || "#3d8b37");
    const dark = (document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";
    shadowMat.opacity = dark ? 0.5 : 0.28;
    contourMat.opacity = dark ? 0.32 : 0.4;
    dust.points.material.color.set(dark ? 0x8a8272 : 0xb8a888);
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

  let focus = null; // camera animation goal: { pos, target }
  let selected = -1;
  let interacted = false;
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
    focus = { target: anchor.clone().lerp(HOME_TARGET, 0.35), pos: anchor.clone().add(dir.multiplyScalar(3.4 * fitScale())) };
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
  const press = (name, on) => tools[name].setAttribute("aria-pressed", String(on));
  const setAuto = (on) => { controls.autoRotate = on; press("rotate", on); };
  setAuto(controls.autoRotate);
  controls.addEventListener("start", () => { interacted = true; focus = null; setAuto(false); });
  tools.rotate.addEventListener("click", () => setAuto(!controls.autoRotate));

  let explodeGoal = 0;
  let explode = 0;
  let driving = false;
  let bumpTime = -1;
  const setDrive = (on) => { driving = on; press("drive", on); };
  tools.explode.addEventListener("click", () => {
    explodeGoal = explodeGoal ? 0 : 1;
    press("explode", !!explodeGoal);
    if (explodeGoal) { setDrive(false); bumpTime = -1; }
    if (REDUCED_MOTION) explode = explodeGoal;
  });
  tools.drive.addEventListener("click", () => {
    setDrive(!driving);
    if (driving && explodeGoal) tools.explode.click();
  });
  tools.bump.addEventListener("click", () => {
    if (explodeGoal) tools.explode.click();
    setDrive(false);
    bumpTime = 0;
  });

  tools.xray.addEventListener("click", () => {
    const on = tools.xray.getAttribute("aria-pressed") !== "true";
    press("xray", on);
    for (const m of xrayMats) {
      m.transparent = on || m.userData.baseTransparent;
      m.opacity = on ? 0.12 : m.userData.baseOpacity;
      m.depthWrite = !on;
      m.needsUpdate = true;
    }
  });

  tools.reset.addEventListener("click", () => {
    focus = { pos: homePos(), target: HOME_TARGET.clone() };
    panel.querySelector(".part-close").click();
  });

  // Frame colour swatches
  viewer.querySelectorAll("[data-livery]").forEach((b) => {
    b.addEventListener("click", () => {
      built.frameMat.color.set(b.dataset.livery);
      viewer.querySelectorAll("[data-livery]").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
    });
  });

  // Narrow (portrait) screens need the camera further back to fit the car's width
  const fitScale = () => Math.min(1.45, Math.max(1, 1.15 / camera.aspect));
  const homePos = () => HOME_POS.clone().sub(HOME_TARGET).multiplyScalar(fitScale()).add(HOME_TARGET);

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = viewer;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 640 ? 42 : 32;
    camera.updateProjectionMatrix();
    if (!interacted) camera.position.copy(homePos());
  };
  new ResizeObserver(resize).observe(viewer);
  resize();

  // Only render while the viewer is on screen
  let visible = true;
  new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; }).observe(viewer);

  // Rolling prairie terrain under the wheels in drive mode (height in metres)
  const terrain = (x) => 0.034 * Math.sin(1.7 * x) + 0.024 * Math.sin(3.9 * x + 1.3) + 0.014 * Math.sin(7.3 * x + 0.4);
  // Damped bump response for the bump test
  const bump = (t) => (t < 0 ? 0 : 0.095 * Math.sin((Math.PI * t) / 0.42) * Math.exp(-2.6 * t));

  const projected = V(0, 0, 0);
  const anchorNow = V(0, 0, 0);
  const toCamera = V(0, 0, 0);
  const clock = new THREE.Clock();
  let distance = 0;
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
      explode = THREE.MathUtils.clamp(explode + Math.sign(explodeGoal - explode) * dt * 1.6, 0, 1);
    }
    const e = explode * explode * (3 - 2 * explode); // smoothstep
    for (const g of explodable) g.position.copy(g.userData.explode).multiplyScalar(e);

    // Suspension: drive over terrain, run the bump test, or settle back to ride height
    if (driving) distance += DRIVE_SPEED * dt;
    if (bumpTime >= 0) {
      bumpTime += dt;
      if (bumpTime > 2.6) bumpTime = -1;
    }
    for (const c of corners) {
      let travel = 0;
      if (driving) travel = terrain(c.x + distance + (c.s < 0 ? 0.9 : 0)) * 1.6;
      else if (bumpTime >= 0) travel = bump(bumpTime - (c.front ? 0 : 0.5));
      c.travel += (THREE.MathUtils.clamp(travel, -0.06, 0.1) - c.travel) * Math.min(1, dt * 18);
      c.update(c.travel);
      if (driving) c.spinner.rotation.z -= (c.s * DRIVE_SPEED * dt) / TIRE_R;
    }
    if (driving) {
      contourTex.offset.x = (distance / 6.4) % 2;
      dust.emit(corners.filter((c) => !c.front), dt);
    }
    dust.update(dt);

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
  const corners = [];

  const mat = (color, opts = {}, xray = false) => {
    const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.5, metalness: 0, ...opts });
    m.userData.baseOpacity = m.opacity;
    m.userData.baseTransparent = m.transparent;
    if (xray) xrayMats.push(m);
    return m;
  };
  const M = {
    frame: mat(0x2c7a2a, { roughness: 0.4, metalness: 0.1, clearcoat: 0.6, clearcoatRoughness: 0.25 }), // powder coat
    arm: mat(0x2b2e2d, { roughness: 0.3, metalness: 0.85, clearcoat: 0.4 }),
    chrome: mat(0xd4d8d6, { roughness: 0.14, metalness: 1 }),
    alu: mat(0xb3b9b6, { roughness: 0.36, metalness: 0.95 }),
    cast: mat(0x9aa19e, { roughness: 0.55, metalness: 0.85 }, true),
    rubber: mat(0x171817, { roughness: 0.82, sheen: 0.4, sheenRoughness: 0.8 }, true),
    seat: mat(0x161918, { roughness: 0.55, clearcoat: 0.2 }, true),
    fabric: mat(0x222624, { roughness: 0.95, sheen: 0.5, sheenColor: 0x3a403d }, true),
    panel: mat(0x121715, { roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.35 }, true),
    plate: mat(0x7d8481, { roughness: 0.55, metalness: 0.85 }, true),
    engine: mat(0x3c403e, { roughness: 0.5, metalness: 0.75 }, true),
    shroud: mat(0x1d1f1e, { roughness: 0.45, clearcoat: 0.6 }, true),
    cvt: mat(0xc2c8c5, { roughness: 0.26, metalness: 1 }, true),
    tank: mat(0xece8dc, { roughness: 0.35, clearcoat: 0.5 }, true),
    spring: mat(0xf0b928, { roughness: 0.28, metalness: 0.3, clearcoat: 1 }),
    red: mat(0xc0281f, { roughness: 0.32, clearcoat: 0.8 }, true),
    belt: mat(0xb3261e, { roughness: 0.9, sheen: 0.5 }, true),
    rotor: mat(0x8c918f, { roughness: 0.3, metalness: 1 }),
    header: mat(0x8a6f55, { roughness: 0.35, metalness: 1, iridescence: 0.6, iridescenceIOR: 1.6 }), // heat-coloured steel
    shield: mat(0xb9bfbc, { roughness: 0.5, metalness: 0.9, side: THREE.DoubleSide }, true),
    soot: mat(0x111111, { roughness: 0.9 }),
    light: new THREE.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xff2010, emissiveIntensity: 1.4 })
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

  // Straight tube between two points, built at unit length so suspension can stretch it
  const unitTube = {};
  const setTube = (mesh, a, b) => {
    const dir = b.clone().sub(a);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.scale.set(1, dir.length(), 1);
    mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  };
  const tube = (group, a, b, r, material) => {
    unitTube[r] ||= new THREE.CylinderGeometry(r, r, 1, 16);
    const m = add(group, new THREE.Mesh(unitTube[r], material));
    setTube(m, a, b);
    return m;
  };
  // Tube through a list of points with smooth bends at each corner, like a CNC tube bender
  const bentTube = (group, pts, r, material, bend = 0.07) => {
    const path = new THREE.CurvePath();
    let from = pts[0].clone();
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i];
      const inDir = p.clone().sub(pts[i - 1]).normalize();
      const outDir = pts[i + 1].clone().sub(p).normalize();
      const b = Math.min(bend, p.distanceTo(pts[i - 1]) * 0.45, p.distanceTo(pts[i + 1]) * 0.45);
      const start = p.clone().addScaledVector(inDir, -b);
      const end = p.clone().addScaledVector(outDir, b);
      path.add(new THREE.LineCurve3(from, start));
      path.add(new THREE.QuadraticBezierCurve3(start, p.clone(), end));
      from = end;
    }
    path.add(new THREE.LineCurve3(from, pts[pts.length - 1].clone()));
    return add(group, new THREE.Mesh(new THREE.TubeGeometry(path, pts.length * 28, r, 14), material));
  };
  const rbox = (group, size, pos, material, rot = [0, 0, 0], radius = 0.012) => {
    const m = add(group, new THREE.Mesh(new RoundedBoxGeometry(...size, 3, Math.min(radius, Math.min(...size) / 2.01)), material));
    m.position.copy(pos);
    m.rotation.set(...rot);
    return m;
  };
  const cyl = (group, r, h, pos, material, axis = "z", seg = 32) => {
    const m = add(group, new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), material));
    m.position.copy(pos);
    if (axis === "z") m.rotation.x = Math.PI / 2;
    if (axis === "x") m.rotation.z = Math.PI / 2;
    return m;
  };
  const capsule = (group, r, len, pos, material, axis = "y") => {
    const m = add(group, new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 8, 20), material));
    m.position.copy(pos);
    if (axis === "z") m.rotation.x = Math.PI / 2;
    if (axis === "x") m.rotation.z = Math.PI / 2;
    return m;
  };
  // Flat sheet-metal plate cut to an outline given as [along, across] points.
  // The top face sits at the mesh origin and the thickness extends below it.
  const plate = (group, outline, thickness, material, pos, tilt) => {
    const shape = new THREE.Shape(outline.map(([u, w]) => new THREE.Vector2(u, w)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
    geo.rotateX(Math.PI / 2); // outline lies flat in x/z, thickness points down
    const m = add(group, new THREE.Mesh(geo, material));
    m.position.copy(pos);
    m.rotation.z = tilt;
    return m;
  };
  const extrude = (group, shape, depth, material, bevel = 0.01) =>
    add(group, new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 24 }), material));

  // ---- Frame (roll cage)
  const frame = part(V(0, 0, 0));
  const R = 0.016;
  const R2 = 0.013;
  const N = (s) => ({
    A: V(-0.30, 0.22, 0.34 * s), // rear roll hoop, bottom
    G: V(-0.32, 0.62, 0.38 * s), // side impact member, rear
    J: V(-0.34, 0.95, 0.35 * s), // rear roll hoop, shoulder
    B: V(-0.36, 1.27, 0.29 * s), // roof, rear
    C: V(0.38, 1.27, 0.29 * s), // roof, front
    E: V(0.98, 0.62, 0.24 * s), // front bulkhead, top
    D: V(1.02, 0.29, 0.22 * s), // front bulkhead, bottom
    F: V(1.2, 0.43, 0.14 * s), // nose
    H: V(-0.95, 0.3, 0.26 * s), // rear box, low
    I: V(-0.92, 0.78, 0.22 * s) // rear box, high
  });
  const L = N(-1);
  const Rt = N(1);
  bentTube(frame, [L.A, L.G, L.J, L.B, Rt.B, Rt.J, Rt.G, Rt.A], R, M.frame, 0.09); // rear roll hoop, one bent tube
  const joints = [];
  for (const n of [L, Rt]) {
    bentTube(frame, [n.B.clone().add(V(0.02, 0, 0)), n.C, n.E], R, M.frame, 0.12); // roof rail into front bracing
    bentTube(frame, [n.A, n.D, n.F], R, M.frame, 0.08); // lower frame side into nose
    bentTube(frame, [n.A, n.H, n.I, n.J], R2, M.frame, 0.06); // rear box
    tube(frame, n.G, n.E, R, M.frame); // side impact member
    tube(frame, n.D, n.E, R2, M.frame);
    tube(frame, n.E, n.F, R2, M.frame);
    tube(frame, n.G, n.H, R2, M.frame);
    tube(frame, n.J, n.I, R2, M.frame); // shock tower
    joints.push(n.G, n.E, n.D, n.H, n.I, n.J);
  }
  for (const k of ["A", "C", "D", "E", "F", "H", "I", "G"]) tube(frame, L[k], Rt[k], R2, M.frame); // cross members
  tube(frame, L.A, Rt.J, R2, M.frame); // rear hoop diagonal
  tube(frame, V(0.36, 0.25, -0.31), V(0.36, 0.25, 0.31), R2, M.frame);
  // Small welds where straight tubes meet
  const weld = new THREE.SphereGeometry(R * 1.12, 14, 10);
  for (const p of joints) add(frame, new THREE.Mesh(weld, M.frame)).position.copy(p);
  // Front bumper
  bentTube(frame, [V(1.16, 0.32, -0.2), V(1.27, 0.36, -0.13), V(1.27, 0.36, 0.13), V(1.16, 0.32, 0.2)], R2, M.frame, 0.05);
  // Brake light, kill switch, fire extinguisher
  rbox(frame, [0.035, 0.05, 0.14], V(-0.39, 1.2, 0), M.light, [0, 0, 0], 0.01);
  cyl(frame, 0.018, 0.03, V(-0.33, 1.02, 0.3), M.red, "x");
  capsule(frame, 0.034, 0.15, V(-0.26, 0.78, -0.27), M.red);

  // ---- Body panels
  const body = part(V(0, 0.12, 0));
  const floorLen = Math.hypot(1.02 - -0.3, 0.29 - 0.22);
  plate(body, [[0, -0.335], [floorLen, -0.215], [floorLen, 0.215], [0, 0.335]], 0.006, M.plate,
    V(-0.3, 0.22 - R - 0.001, 0), Math.atan2(0.29 - 0.22, 1.02 - -0.3)); // floor pan, under the lower rails
  rbox(body, [0.01, 0.68, 0.66], V(-0.305, 0.56, 0), M.plate, [0, 0, 0.02], 0.004); // firewall
  const noseTilt = Math.atan2(0.43 - 0.62, 1.2 - 0.98);
  const noseLen = Math.hypot(1.2 - 0.98, 0.43 - 0.62);
  const noseNormal = V(-Math.sin(noseTilt), Math.cos(noseTilt), 0);
  plate(body, [[0, -0.235], [noseLen, -0.135], [noseLen, 0.135], [0, 0.235]], 0.005, M.panel,
    V(0.98, 0.62, 0).addScaledVector(noseNormal, R + 0.006), noseTilt); // nose panel, on top of the tubes
  const sideTex = makeSideTexture();
  for (const s of SIDES) {
    const g = part(V(0, 0.05, 0.32 * s));
    const graphic = mat(0xffffff, { map: sideTex, roughness: 0.38, clearcoat: 0.8, clearcoatRoughness: 0.25 }, true);
    const face = add(g, new THREE.Mesh(new THREE.PlaneGeometry(1.26, 0.34), graphic)); // front face only, so text never shows mirrored
    face.position.set(0.33, 0.44, 0.338 * s);
    face.rotation.y = s > 0 ? 0.107 : Math.PI - 0.107;
    rbox(g, [1.27, 0.35, 0.008], V(0.33, 0.44, 0.332 * s), M.panel, [0, s > 0 ? 0.107 : -0.107, 0], 0.004);
  }

  // ---- Cockpit: bucket seat, harness, steering
  const cockpit = part(V(0, 0.55, 0));
  const shell = new THREE.Shape();
  shell.moveTo(0.2, 0.27);
  shell.lineTo(-0.08, 0.25);
  shell.quadraticCurveTo(-0.17, 0.24, -0.18, 0.32);
  shell.lineTo(-0.3, 0.88);
  shell.lineTo(-0.25, 0.89);
  shell.lineTo(-0.13, 0.35);
  shell.quadraticCurveTo(-0.11, 0.3, -0.06, 0.3);
  shell.lineTo(0.2, 0.31);
  shell.closePath();
  extrude(cockpit, shell, 0.4, M.seat, 0.014).position.z = -0.2;
  const cushion = new THREE.Shape();
  cushion.moveTo(0.17, 0.31);
  cushion.lineTo(-0.05, 0.31);
  cushion.quadraticCurveTo(-0.09, 0.31, -0.1, 0.37);
  cushion.lineTo(-0.21, 0.86);
  cushion.lineTo(-0.17, 0.86);
  cushion.lineTo(-0.07, 0.41);
  cushion.quadraticCurveTo(-0.05, 0.35, 0.0, 0.35);
  cushion.lineTo(0.17, 0.35);
  cushion.closePath();
  extrude(cockpit, cushion, 0.3, M.fabric, 0.012).position.z = -0.15;
  const strap = (a, b, w) => {
    const m = rbox(cockpit, [w, a.distanceTo(b), 0.004], a.clone().add(b).multiplyScalar(0.5), M.belt, [0, 0, 0], 0.002);
    m.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
  };
  for (const s of SIDES) {
    rbox(cockpit, [0.3, 0.1, 0.045], V(0.03, 0.35, 0.19 * s), M.seat, [0, 0, -0.02], 0.02); // cushion bolster
    rbox(cockpit, [0.045, 0.42, 0.05], V(-0.18, 0.62, 0.19 * s), M.seat, [0, 0, -0.21], 0.02); // back bolster
    strap(V(-0.24, 0.9, 0.08 * s), V(-0.05, 0.42, 0.05 * s), 0.045); // shoulder belt
    strap(V(-0.06, 0.36, 0.19 * s), V(0.05, 0.37, 0.04 * s), 0.045); // lap belt
  }
  rbox(cockpit, [0.05, 0.05, 0.02], V(0.05, 0.38, 0), M.chrome, [0, 0, 0], 0.008); // buckle
  // Steering wheel with three spokes and quick release
  const wheelGroup = new THREE.Group();
  wheelGroup.position.set(0.42, 0.82, 0);
  wheelGroup.rotation.set(0, Math.PI / 2, 0);
  wheelGroup.rotateX(-0.45);
  cockpit.add(wheelGroup);
  add(wheelGroup, new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.017, 16, 64), M.seat));
  for (const a of [Math.PI / 2, Math.PI * 1.17, Math.PI * 1.83]) {
    tube(wheelGroup, V(0, 0, 0), V(Math.cos(a) * 0.125, Math.sin(a) * 0.125, 0), 0.009, M.alu);
  }
  cyl(wheelGroup, 0.03, 0.03, V(0, 0, -0.015), M.alu);
  cyl(wheelGroup, 0.022, 0.03, V(0, 0, -0.045), M.red);
  tube(cockpit, V(0.45, 0.8, 0), V(0.86, 0.42, 0), 0.013, M.chrome); // column
  cyl(cockpit, 0.022, 0.3, V(0.88, 0.37, 0), M.cast); // steering rack
  for (const s of SIDES) cyl(cockpit, 0.017, 0.05, V(0.88, 0.37, 0.17 * s), M.rubber); // rack boots
  for (const s of SIDES) rbox(cockpit, [0.025, 0.09, 0.06], V(0.86, 0.33, 0.08 * s), M.alu, [0, 0, 0.35], 0.006); // pedals

  // ---- Drivetrain
  const drive = part(V(-0.45, 0.3, 0));
  rbox(drive, [0.34, 0.012, 0.36], V(-0.72, 0.33, 0), M.plate, [0, 0, 0], 0.004); // engine plate
  rbox(drive, [0.26, 0.2, 0.26], V(-0.7, 0.45, -0.04), M.engine, [0, 0, 0], 0.025); // crankcase
  const cylinder = new THREE.Group();
  cylinder.position.set(-0.62, 0.57, -0.04);
  cylinder.rotation.z = -0.45;
  drive.add(cylinder);
  cyl(cylinder, 0.055, 0.16, V(0, 0.08, 0), M.engine, "y");
  for (let i = 0; i < 8; i++) cyl(cylinder, 0.085 - i * 0.002, 0.006, V(0, 0.02 + i * 0.018, 0), M.engine, "y", 28); // cooling fins
  rbox(cylinder, [0.16, 0.05, 0.16], V(0, 0.18, 0), M.engine, [0, 0, 0], 0.012); // head
  cyl(cylinder, 0.008, 0.05, V(0.06, 0.2, 0), M.chrome, "x"); // spark plug
  rbox(drive, [0.3, 0.3, 0.06], V(-0.7, 0.5, -0.2), M.shroud, [0, 0, 0], 0.025); // blower shroud
  cyl(drive, 0.07, 0.02, V(-0.7, 0.5, -0.24), M.shroud); // recoil starter
  rbox(drive, [0.07, 0.02, 0.02], V(-0.7, 0.5, -0.26), M.red, [0, 0, 0], 0.006);
  capsule(drive, 0.05, 0.1, V(-0.53, 0.75, -0.12), M.shroud, "z"); // air filter
  rbox(drive, [0.18, 0.12, 0.16], V(-0.56, 0.8, 0.11), M.tank, [0, 0, 0], 0.03); // fuel tank
  cyl(drive, 0.022, 0.03, V(-0.56, 0.87, 0.11), M.red, "y"); // fuel cap
  // Exhaust: header from the cylinder head, over to a muffler, tailpipe out the back
  bentTube(drive, [V(-0.58, 0.68, -0.13), V(-0.62, 0.8, -0.2), V(-0.76, 0.86, -0.27), V(-0.86, 0.86, -0.27)], 0.019, M.header, 0.06);
  const muffler = capsule(drive, 0.062, 0.2, V(-0.98, 0.88, -0.27), M.chrome, "x");
  muffler.rotation.y = 0.08;
  const shield = add(drive, new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.2, 32, 1, true, -0.4, 2.2), M.shield)); // heat shield
  shield.rotation.z = Math.PI / 2;
  shield.position.set(-0.98, 0.88, -0.27);
  for (const dx of [-0.07, 0.07]) {
    const band = add(drive, new THREE.Mesh(new THREE.TorusGeometry(0.069, 0.004, 6, 32), M.engine));
    band.rotation.y = Math.PI / 2;
    band.position.set(-0.98 + dx, 0.88, -0.27);
  }
  bentTube(drive, [V(-1.08, 0.89, -0.27), V(-1.15, 0.9, -0.27), V(-1.2, 0.95, -0.27)], 0.016, M.chrome, 0.04); // tailpipe
  cyl(drive, 0.019, 0.02, V(-1.205, 0.96, -0.27), M.soot, "y", 20); // sooty tip
  for (const s of [-0.06, 0.06]) tube(drive, V(-0.98, 0.84, -0.27 + s), V(-0.93, 0.78, -0.22 + s * 0.5), 0.005, M.engine); // hangers
  // CVT cover: a two-pulley outline, extruded with bevelled edges
  extrude(drive, stadiumShape(-0.62, 0.44, 0.125, -0.87, 0.34, 0.1), 0.05, M.cvt, 0.012).position.z = 0.13;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    cyl(drive, 0.007, 0.012, V(-0.62 + Math.cos(a) * 0.11, 0.44 + Math.sin(a) * 0.11, 0.195), M.engine, "z", 6);
  }
  rbox(drive, [0.17, 0.17, 0.22], V(-0.87, 0.33, 0.0), M.cast, [0, 0, 0], 0.03); // gearbox

  // ---- Wheels
  const groups = { frame, cockpit, drivetrain: drive };
  const tireGeo = makeTireGeometry();
  const lugGeo = new RoundedBoxGeometry(0.026, 0.05, 0.075, 2, 0.008);
  const shoulderGeo = new RoundedBoxGeometry(0.03, 0.045, 0.032, 2, 0.008);
  const rimGeo = makeRimGeometry();
  const wheelParts = {};
  for (const [x, s] of [[0.74, 1], [0.74, -1], [-0.72, 1], [-0.72, -1]]) {
    const g = part(V(0, 0, 0.42 * s));
    if (x > 0 && s > 0) groups.tires = g;
    const w = new THREE.Group(); // follows suspension travel
    w.position.set(x, TIRE_R, 0.66 * s);
    w.rotation.y = s > 0 ? 0 : Math.PI;
    g.add(w);
    const spinner = new THREE.Group(); // turns in drive mode
    w.add(spinner);
    add(spinner, new THREE.Mesh(tireGeo, M.rubber));
    const lugs = new THREE.InstancedMesh(lugGeo, M.rubber, 64);
    const shoulders = new THREE.InstancedMesh(shoulderGeo, M.rubber, 64);
    const tmp = new THREE.Object3D();
    for (let i = 0; i < 32; i++) {
      for (const side of [0, 1]) {
        const a = ((i + side * 0.5) / 32) * Math.PI * 2;
        tmp.position.set(Math.cos(a) * 0.286, Math.sin(a) * 0.286, side ? 0.045 : -0.045);
        tmp.rotation.set(side ? 0.38 : -0.38, 0, a, "ZYX"); // chevron tread
        tmp.updateMatrix();
        lugs.setMatrixAt(i * 2 + side, tmp.matrix);
        const b = ((i + 0.25 + side * 0.5) / 32) * Math.PI * 2;
        tmp.position.set(Math.cos(b) * 0.262, Math.sin(b) * 0.262, side ? 0.1 : -0.1);
        tmp.rotation.set(side ? -0.5 : 0.5, 0, b, "ZYX");
        tmp.updateMatrix();
        shoulders.setMatrixAt(i * 2 + side, tmp.matrix);
      }
    }
    for (const inst of [lugs, shoulders]) { inst.castShadow = true; spinner.add(inst); }
    add(spinner, new THREE.Mesh(rimGeo.barrel, M.alu));
    add(spinner, new THREE.Mesh(rimGeo.face, M.alu)).position.z = 0.05;
    cyl(spinner, 0.045, 0.04, V(0, 0, 0.07), M.cast);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      cyl(spinner, 0.008, 0.02, V(Math.cos(a) * 0.03, Math.sin(a) * 0.03, 0.095), M.chrome, "z", 6);
    }
    cyl(spinner, 0.095, 0.006, V(0, 0, -0.035), M.rotor, "z", 40); // brake rotor
    rbox(w, [0.05, 0.075, 0.035], V(0.02, 0.085, -0.035), M.red, [0, 0, -0.3], 0.01); // caliper
    wheelParts[`${x > 0 ? "f" : "r"}${s}`] = { w, spinner, x };
  }

  // ---- Suspension, per corner. Arm ends on the wheel side move with suspension travel.
  for (const s of SIDES) {
    // Front: double A-arms, upright, coilover, tie rod
    const front = part(V(0.05, 0, 0.22 * s));
    if (s > 0) groups.front = front;
    const fUpright = new THREE.Group();
    front.add(fUpright);
    rbox(fUpright, [0.06, 0.2, 0.05], V(0.74, 0.31, 0.52 * s), M.cast, [0, 0, 0], 0.012);
    const frontArms = [
      [V(0.6, 0.25, 0.2 * s), V(0.74, 0.23, 0.5 * s), 0.012, M.arm],
      [V(0.88, 0.26, 0.2 * s), V(0.74, 0.23, 0.5 * s), 0.012, M.arm],
      [V(0.62, 0.46, 0.23 * s), V(0.74, 0.39, 0.49 * s), 0.012, M.arm],
      [V(0.86, 0.46, 0.23 * s), V(0.74, 0.39, 0.49 * s), 0.012, M.arm],
      [V(0.88, 0.37, 0.19 * s), V(0.82, 0.33, 0.5 * s), 0.008, M.chrome] // tie rod
    ].map(([a, b, r, m]) => ({ mesh: tube(front, a, b, r, m), a, b }));
    const fCoil = coilover(front, V(0.7, 0.92, 0.27 * s), V(0.74, 0.26, 0.41 * s));
    corners.push(makeCorner(s, true, wheelParts[`f${s}`], fUpright, frontArms, fCoil, 0.7));

    // Rear: trailing arm, camber links, coilover, CV axle
    const rear = part(V(-0.05, 0, 0.22 * s));
    if (s > 0) groups.rear = rear;
    const rUpright = new THREE.Group();
    rear.add(rUpright);
    rbox(rUpright, [0.08, 0.2, 0.05], V(-0.72, 0.31, 0.52 * s), M.cast, [0, 0, 0], 0.012);
    const rearArms = [
      [V(-0.22, 0.28, 0.35 * s), V(-0.72, 0.29, 0.52 * s), 0.016, M.arm],
      [V(-0.86, 0.3, 0.22 * s), V(-0.72, 0.25, 0.5 * s), 0.01, M.arm],
      [V(-0.86, 0.56, 0.2 * s), V(-0.72, 0.4, 0.5 * s), 0.01, M.arm],
      [V(-0.86, 0.33, 0.1 * s), V(-0.72, 0.29, 0.52 * s), 0.014, M.engine] // CV axle
    ].map(([a, b, r, m]) => ({ mesh: tube(rear, a, b, r, m), a, b }));
    const rCoil = coilover(rear, V(-0.64, 0.87, 0.28 * s), V(-0.56, 0.3, 0.46 * s));
    corners.push(makeCorner(s, false, wheelParts[`r${s}`], rUpright, rearArms, rCoil, 0.68));
  }

  function makeCorner(s, isFront, wheel, upright, arms, coil, coilRatio) {
    const baseY = wheel.w.position.y;
    const moved = V(0, 0, 0);
    return {
      s, front: isFront, x: wheel.x, spinner: wheel.spinner, travel: 0,
      update(t) {
        wheel.w.position.y = baseY + t;
        upright.position.y = t;
        for (const arm of arms) setTube(arm.mesh, arm.a, moved.copy(arm.b).setY(arm.b.y + t));
        coil.set(moved.copy(coil.lower).setY(coil.lower.y + t * coilRatio));
      }
    };
  }

  // Coilover shock from a fixed top mount to a lower mount on the arm.
  // The spring is rebuilt along the current length, so it visibly compresses.
  function coilover(group, top, lower) {
    const g = new THREE.Group();
    group.add(g);
    const body = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 1, 20), M.arm));
    const reservoir = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 20), M.alu));
    const shaft = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 1, 12), M.chrome));
    const spring = add(g, new THREE.Mesh(new THREE.BufferGeometry(), M.spring));
    const helix = new THREE.Curve();
    let springLen = 0;
    helix.getPoint = (t, target = V(0, 0, 0)) =>
      target.set(Math.cos(t * 8 * Math.PI * 2) * 0.034, springLen * (0.1 + t * 0.62), Math.sin(t * 8 * Math.PI * 2) * 0.034);
    const dir = V(0, 0, 0);
    const api = {
      lower: lower.clone(),
      set(low) {
        dir.copy(top).sub(low);
        const len = dir.length();
        g.position.copy(low);
        g.quaternion.setFromUnitVectors(UP, dir.normalize());
        body.scale.y = len * 0.55;
        body.position.y = len * 0.72;
        reservoir.position.y = len * 0.92;
        shaft.scale.y = len * 0.5;
        shaft.position.y = len * 0.25;
        if (Math.abs(len - springLen) > 0.0015) {
          springLen = len;
          spring.geometry.dispose();
          spring.geometry = new THREE.TubeGeometry(helix, 140, 0.006, 6);
        }
      }
    };
    api.set(lower);
    return api;
  }

  return { root, explodable, xrayMats, groups, corners, frameMat: M.frame };
}

// Outline around two pulleys of different sizes (the classic CVT cover shape)
function stadiumShape(x1, y1, r1, x2, y2, r2) {
  const theta = Math.atan2(y2 - y1, x2 - x1);
  const alpha = Math.acos((r1 - r2) / Math.hypot(x2 - x1, y2 - y1));
  const shape = new THREE.Shape();
  shape.moveTo(x1 + r1 * Math.cos(theta + alpha), y1 + r1 * Math.sin(theta + alpha));
  shape.absarc(x1, y1, r1, theta + alpha, theta - alpha + Math.PI * 2, false);
  shape.lineTo(x2 + r2 * Math.cos(theta - alpha), y2 + r2 * Math.sin(theta - alpha));
  shape.absarc(x2, y2, r2, theta - alpha, theta + alpha, false);
  shape.closePath();
  return shape;
}

// Rounded tyre carcass spun around the axle (axle along z)
function makeTireGeometry() {
  const profile = [
    [0.16, -0.105], [0.22, -0.112], [0.25, -0.106], [0.268, -0.088], [0.278, -0.055], [0.281, 0],
    [0.278, 0.055], [0.268, 0.088], [0.25, 0.106], [0.22, 0.112], [0.16, 0.105]
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(profile, 72);
  geo.rotateX(Math.PI / 2);
  return geo;
}

// Rim: open barrel plus a face with five spoke windows
function makeRimGeometry() {
  const barrel = new THREE.CylinderGeometry(0.152, 0.152, 0.15, 48, 1, true);
  barrel.rotateX(Math.PI / 2);
  const face = new THREE.Shape();
  face.absarc(0, 0, 0.15, 0, Math.PI * 2, false);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const hole = new THREE.Path();
    hole.absarc(Math.cos(a) * 0.097, Math.sin(a) * 0.097, 0.034, 0, Math.PI * 2, true);
    face.holes.push(hole);
  }
  const hub = new THREE.Path();
  hub.absarc(0, 0, 0.03, 0, Math.PI * 2, true);
  face.holes.push(hub);
  const faceGeo = new THREE.ExtrudeGeometry(face, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 3, curveSegments: 40 });
  return { barrel, face: faceGeo };
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
  g.fillStyle = "#121815";
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = "rgba(168, 216, 154, 0.12)";
  g.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    g.beginPath();
    for (let x = 0; x <= c.width; x += 16) {
      const y = 40 + i * 28 + Math.sin(x / 120 + i) * 14 + Math.cos(x / 53 + i * 2) * 6;
      x ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
  }
  g.fillStyle = "#3f8f3a";
  g.fillRect(0, c.height - 18, c.width, 18);
  g.fillStyle = "#f4f5f3";
  g.font = "700 104px Inter, system-ui, sans-serif";
  g.textBaseline = "middle";
  g.fillText("USASK", 56, 112);
  g.fillStyle = "#9fd18f";
  g.font = "500 40px 'IBM Plex Mono', ui-monospace, monospace";
  g.fillText("BAJA SAE", 62, 196);
}

// Ground contours drawn from the site's topographic map (white lines, tinted by the material).
// Mirrored repeat hides the seams when the ground scrolls in drive mode.
function makeContourTexture(src) {
  const c = document.createElement("canvas");
  c.width = 1600;
  c.height = 1000;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.MirroredRepeatWrapping;
  tex.repeat.set(1.4, 2.2);
  tex.anisotropy = 8;
  const img = new Image();
  img.onload = () => {
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0, c.width, c.height);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = "#fff";
    g.fillRect(0, 0, c.width, c.height);
    tex.needsUpdate = true;
  };
  img.src = src;
  return tex;
}

function makeRadialFade() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(128, 128, 30, 128, 128, 128);
  grad.addColorStop(0, "#fff");
  grad.addColorStop(0.55, "#888");
  grad.addColorStop(1, "#000");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

// Dust kicked up by the rear tyres in drive mode
function makeDust() {
  const count = 180;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 4);
  const velocity = new Float32Array(count * 3);
  const life = new Float32Array(count);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 4));
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = 64;
  const sg = sprite.getContext("2d");
  const grad = sg.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  sg.fillStyle = grad;
  sg.fillRect(0, 0, 64, 64);
  const material = new THREE.PointsMaterial({ size: 0.09, map: new THREE.CanvasTexture(sprite), transparent: true, depthWrite: false, vertexColors: true });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  let next = 0;
  let carry = 0;
  return {
    points,
    emit(rearCorners, dt) {
      carry += dt * 90;
      while (carry >= 1) {
        carry -= 1;
        const c = rearCorners[next % rearCorners.length];
        const i = next % count;
        positions.set([c.x - 0.12 + Math.random() * 0.08, 0.03, 0.66 * c.s + (Math.random() - 0.5) * 0.18], i * 3);
        velocity.set([-1.4 - Math.random() * 1.2, 0.25 + Math.random() * 0.55, (Math.random() - 0.5) * 0.5 + 0.2 * c.s], i * 3);
        life[i] = 1;
        next++;
      }
    },
    update(dt) {
      for (let i = 0; i < count; i++) {
        if (life[i] <= 0) { colors[i * 4 + 3] = 0; continue; }
        life[i] -= dt * 0.9;
        for (let j = 0; j < 3; j++) positions[i * 3 + j] += velocity[i * 3 + j] * dt;
        velocity[i * 3 + 1] -= dt * 0.35;
        colors.set([1, 1, 1, Math.max(0, life[i]) * 0.55], i * 4);
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    }
  };
}
