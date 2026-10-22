// Geometry check for the concept car in js/car.js.
// Run with: node tools/check-car.mjs [travel]
// where travel is an optional suspension position in metres (e.g. 0.1 = fully compressed).
//
// It builds the car without a browser, scatters sample points over every part's
// surface, and reports two kinds of problems:
//   1. Floating parts: groups of parts that don't touch the rest of the car.
//   2. Clipping: parts whose surface passes through the inside of another solid part.

// Minimal browser stand-ins so js/car.js can load in Node
const noop = () => {};
const ctx = new Proxy({}, { get: (_, k) => (k === "createRadialGradient" || k === "createLinearGradient" ? () => ({ addColorStop: noop }) : noop), set: () => true });
globalThis.document = {
  getElementById: () => null,
  createElement: () => ({ width: 0, height: 0, getContext: () => ctx }),
  fonts: { load: () => Promise.resolve() }
};
globalThis.window = { matchMedia: () => ({ matches: false, addEventListener: noop }) };

const THREE = await import("../assets/vendor/three/three.module.min.js");
const { buildConceptCar } = await import("../js/car.js");

const CONTACT = 0.012; // parts closer than this count as touching (12 mm)
const SPACING = 0.009; // average distance between sample points (9 mm)
const MIN_CLIP_POINTS = 4; // ignore tiny overlaps
const END_ZONE = 0.035; // a tube end may sink this far into the part it's welded or bolted to
const CLOSED = new Set(["BoxGeometry", "CylinderGeometry", "CapsuleGeometry", "ExtrudeGeometry", "SphereGeometry", "TorusGeometry"]);

const { root, corners } = buildConceptCar();
const travel = Number(process.argv[2] || 0);
for (const c of corners) c.update(travel);
root.updateMatrixWorld(true);
console.log(`Suspension travel: ${travel} m`);

// Collect every part (instanced tread lugs count as separate parts)
const parts = [];
root.traverse((o) => {
  if (!o.isMesh) return;
  const type = o.geometry.type; // RoundedBoxGeometry reports itself as BoxGeometry
  const closed = CLOSED.has(type) && !(type === "CylinderGeometry" && o.geometry.parameters.openEnded);
  if (o.isInstancedMesh) {
    const m = new THREE.Matrix4();
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m);
      parts.push({ mesh: o, matrix: m.clone().premultiply(o.matrixWorld), type, closed, ends: [], label: `${o.material.name} lug #${i}` });
    }
  } else {
    const ends = (o.userData.ends || []).map((e) => e.clone().applyMatrix4(o.parent.matrixWorld));
    parts.push({ mesh: o, matrix: o.matrixWorld.clone(), type, closed, ends });
  }
});

// World-space triangles and area-weighted sample points for each part
const tri = new THREE.Triangle();
for (const p of parts) {
  const geo = p.mesh.geometry;
  const pos = geo.attributes.position;
  if (!pos) { p.samples = []; continue; }
  const index = geo.index;
  const count = index ? index.count : pos.count;
  const verts = [];
  for (let i = 0; i < count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, index ? index.getX(i) : i).applyMatrix4(p.matrix);
    verts.push(v);
  }
  p.tris = [];
  let total = 0;
  for (let i = 0; i < verts.length; i += 3) {
    tri.set(verts[i], verts[i + 1], verts[i + 2]);
    const area = tri.getArea();
    if (area > 0) { p.tris.push({ a: verts[i], b: verts[i + 1], c: verts[i + 2], area }); total += area; }
  }
  const n = Math.min(6000, Math.max(30, Math.round(total / (SPACING * SPACING))));
  p.samples = [];
  const cumulative = [];
  let acc = 0;
  for (const t of p.tris) { acc += t.area; cumulative.push(acc); }
  for (let k = 0; k < n; k++) {
    const r = ((k + 0.5) / n) * acc;
    let lo = 0;
    let hi = cumulative.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cumulative[mid] < r) lo = mid + 1; else hi = mid; }
    const t = p.tris[lo];
    let u = Math.random();
    let v = Math.random();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    p.samples.push(t.a.clone().addScaledVector(t.b.clone().sub(t.a), u).addScaledVector(t.c.clone().sub(t.a), v));
  }
  p.box = new THREE.Box3().setFromPoints(p.samples);
  p.center = p.box.getCenter(new THREE.Vector3());
  p.label ||= `${p.mesh.material.name} ${p.type.replace("Geometry", "")}`;
}

// Spatial hash of all sample points
const cell = CONTACT;
const grid = new Map();
const key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
parts.forEach((p, id) => {
  for (const s of p.samples) {
    const k = key(s.x, s.y, s.z);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(id, s);
  }
});

// 1. Contact graph and floating islands
const touching = parts.map(() => new Set());
parts.forEach((p, id) => {
  for (const s of p.samples) {
    const cx = Math.floor(s.x / cell), cy = Math.floor(s.y / cell), cz = Math.floor(s.z / cell);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const list = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
      if (!list) continue;
      for (let i = 0; i < list.length; i += 2) {
        const other = list[i];
        if (other !== id && !touching[id].has(other) && list[i + 1].distanceTo(s) < CONTACT) {
          touching[id].add(other);
          touching[other].add(id);
        }
      }
    }
  }
});
const island = new Array(parts.length).fill(-1);
let islands = 0;
for (let i = 0; i < parts.length; i++) {
  if (island[i] >= 0) continue;
  const stack = [i];
  island[i] = islands;
  while (stack.length) for (const j of touching[stack.pop()]) if (island[j] < 0) { island[j] = islands; stack.push(j); }
  islands++;
}
const sizes = new Array(islands).fill(0);
island.forEach((g) => sizes[g]++);
const main = sizes.indexOf(Math.max(...sizes));
const fmt = (v) => `(${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)})`;
let problems = 0;
console.log(`${parts.length} parts checked.\n`);
console.log("FLOATING (not connected to the rest of the car):");
for (let g = 0; g < islands; g++) {
  if (g === main) continue;
  const members = parts.filter((_, i) => island[i] === g);
  if (members.every((m) => m.label.includes("lug"))) continue; // tread lugs sit on the tyre surface
  problems++;
  console.log(`  - ${members.length} part(s): ` + members.slice(0, 6).map((m) => `${m.label} at ${fmt(m.center)}`).join("; "));
}

// 2. Clipping: sample points of one part that sit inside another closed part
const ray = new THREE.Raycaster();
const dir = new THREE.Vector3(0.577, 0.578, 0.577).normalize();
const testMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
const inside = (point, b) => {
  if (!b.box.containsPoint(point)) return false;
  const probe = new THREE.Mesh(b.mesh.geometry, testMat);
  probe.matrixWorld.copy(b.matrix);
  probe.matrixAutoUpdate = false;
  ray.set(point, dir);
  const hits = [];
  probe.raycast(ray, hits);
  return hits.length % 2 === 1;
};
console.log("\nCLIPPING (a part passing through a solid part):");
parts.forEach((a, ia) => {
  parts.forEach((b, ib) => {
    if (ia === ib || !b.closed || a.mesh === b.mesh) return;
    const asmA = a.mesh.userData.asm;
    if (asmA && asmA === b.mesh.userData.asm) return; // parts of one assembly
    if (!a.box.intersectsBox(b.box)) return;
    let n = 0;
    let where = null;
    const nearEnd = (s) => a.ends.some((e) => e.distanceTo(s) < END_ZONE) || b.ends.some((e) => e.distanceTo(s) < END_ZONE);
    for (const s of a.samples) if (!nearEnd(s) && inside(s, b)) { n++; where ||= s; }
    if (n >= MIN_CLIP_POINTS && n / a.samples.length > 0.02) {
      problems++;
      console.log(`  - ${a.label} at ${fmt(a.center)} is inside ${b.label} at ${fmt(b.center)}: ${n} points (${((100 * n) / a.samples.length).toFixed(0)}%), e.g. ${fmt(where)}`);
    }
  });
});
// 3. Anything inside a tyre's rubber (tyres are open shapes, so check them by radius)
console.log("\nINSIDE A TYRE:");
const tyres = parts.filter((p) => p.type === "LatheGeometry");
const inv = new THREE.Matrix4();
const local = new THREE.Vector3();
for (const tyre of tyres) {
  inv.copy(tyre.matrix).invert();
  for (const p of parts) {
    if (p.mesh.userData.asm === tyre.mesh.userData.asm || !p.box.intersectsBox(tyre.box)) continue;
    const n = p.samples.filter((s) => {
      local.copy(s).applyMatrix4(inv);
      const r = Math.hypot(local.x, local.y);
      return r > 0.17 && r < 0.275 && Math.abs(local.z) < 0.1;
    }).length;
    if (n >= MIN_CLIP_POINTS) { problems++; console.log(`  - ${p.label} at ${fmt(p.center)}: ${n} points inside the tyre at ${fmt(tyre.center)}`); }
  }
}
console.log(problems ? `\n${problems} problem(s) found.` : "\nNo problems found.");
process.exitCode = problems ? 1 : 0;
