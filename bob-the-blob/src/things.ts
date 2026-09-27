import * as THREE from 'three';
import type { Game } from './game';

export type Kind = 'food' | 'rock' | 'wall' | 'squash' | 'log' | 'pinecone' | 'thorn' | 'flower' | 'bigfoot' | 'bug';

/**
 * Everything in the world that isn't Bob. Positions are "feet" positions:
 * pos.y is the bottom of the thing, and collisions are circles on the ground.
 */
export class Thing {
  group = new THREE.Group();
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  radius = 0.5; // collision circle
  visualRadius = 0.5; // how wide it looks (used for see-through fading)
  size = 0.5; // how big it counts as when Bob tries to swallow it
  height = 1;
  solid = false;
  pushable = false;
  edible = false;
  growth = 1; // multiplier on how much Bob grows from eating it
  color = new THREE.Color(0xffffff);
  fadeable = false;
  fade = 1;
  dead = false;
  beingEaten = false;
  thrown = false;
  isGoal = false; // swallowing this finishes the level

  constructor(public kind: Kind) {}

  get mass(): number {
    return this.pushable ? this.radius ** 3 * 3 : Infinity;
  }

  get top(): number {
    return this.pos.y + this.height;
  }

  update(_dt: number, _game: Game): void {}

  /** Return true if the spit projectile "counts" as a hit (e.g. stuns an enemy). */
  hitBySpit(_game: Game): boolean {
    return false;
  }

  onSpat(): void {}

  sync(): void {
    this.group.position.copy(this.pos);
  }
}

export function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function angleTo(from: THREE.Vector3, to: THREE.Vector3): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

export function turnToward(current: number, target: number, k: number): number {
  let d = target - current;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return current + d * Math.min(1, k);
}

export function mat(color: THREE.ColorRepresentation, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true, ...extra });
}

export function mesh(geo: THREE.BufferGeometry, material: THREE.Material | THREE.Material[]): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ---------- Food ----------

function food(x: number, z: number, size: number, color: THREE.ColorRepresentation, growth = 1): Thing {
  const t = new Thing('food');
  t.pos.set(x, 0, z);
  t.radius = t.size = t.visualRadius = size;
  t.height = size * 2;
  t.edible = true;
  t.growth = growth;
  t.color.set(color);
  return t;
}

export function makeBerry(x: number, z: number, size: number, color: THREE.ColorRepresentation): Thing {
  const t = food(x, z, size, color);
  const berry = mesh(new THREE.SphereGeometry(size, 14, 10), mat(color, { flatShading: false, roughness: 0.35 }));
  berry.position.y = size;
  const leaf = mesh(new THREE.ConeGeometry(size * 0.35, size * 0.5, 5), mat(0x3f8f2f));
  leaf.position.y = size * 2.05;
  t.group.add(berry, leaf);
  return t;
}

export function makeGoldenBerry(x: number, z: number, size: number, y = 0): Thing {
  const t = food(x, z, size, 0xffc400, 6);
  t.pos.y = y;
  const berry = mesh(
    new THREE.SphereGeometry(size, 16, 12),
    mat(0xffc400, { flatShading: false, roughness: 0.2, metalness: 0.3, emissive: 0xff9900, emissiveIntensity: 0.5 }),
  );
  berry.position.y = size;
  const leaf = mesh(new THREE.ConeGeometry(size * 0.35, size * 0.5, 5), mat(0x3f8f2f));
  leaf.position.y = size * 2.05;
  t.group.add(berry, leaf);
  let phase = Math.random() * 6;
  t.update = (dt) => {
    phase += dt;
    t.group.rotation.y += dt * 2;
    berry.position.y = size * (1.1 + Math.sin(phase * 3) * 0.15);
  };
  return t;
}

export function makeSeed(x: number, z: number, size: number): Thing {
  const t = food(x, z, size, 0xd9b77a, 1.5);
  t.height = size;
  const seed = mesh(new THREE.SphereGeometry(size, 10, 8), mat(0xd9b77a));
  seed.scale.set(0.6, 0.5, 1);
  seed.position.y = size * 0.5;
  seed.rotation.y = rand(0, Math.PI);
  t.group.add(seed);
  return t;
}

export function makePebble(x: number, z: number, size: number): Thing {
  const color = pick([0x9e9e9e, 0x8d8a85, 0xb0aca5]);
  const t = food(x, z, size, color);
  t.height = size * 1.3;
  const p = mesh(new THREE.IcosahedronGeometry(size, 0), mat(color));
  p.scale.y = 0.65;
  p.position.y = size * 0.6;
  p.rotation.y = rand(0, 6);
  t.group.add(p);
  return t;
}

export function makeAcorn(x: number, z: number, size: number): Thing {
  const t = food(x, z, size, 0xb07a3c, 1.2);
  const body = mesh(new THREE.SphereGeometry(size * 0.8, 14, 10), mat(0xb07a3c, { flatShading: false }));
  body.scale.y = 1.15;
  body.position.y = size * 0.9;
  const cap = mesh(new THREE.SphereGeometry(size * 0.85, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x6b4a2a));
  cap.position.y = size * 1.3;
  const stem = mesh(new THREE.CylinderGeometry(size * 0.08, size * 0.1, size * 0.4, 5), mat(0x6b4a2a));
  stem.position.y = size * 2.2;
  t.group.add(body, cap, stem);
  t.group.rotation.z = rand(-0.3, 0.3);
  return t;
}

export function makeMushroom(x: number, z: number, size: number, capColor: number): Thing {
  const t = food(x, z, size, capColor);
  t.height = size * 1.8;
  const stem = mesh(new THREE.CylinderGeometry(size * 0.35, size * 0.45, size * 1.1, 8), mat(0xf3ead8));
  stem.position.y = size * 0.55;
  const cap = mesh(new THREE.SphereGeometry(size, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(capColor, { flatShading: false }));
  cap.scale.y = 0.8;
  cap.position.y = size * 1.0;
  t.group.add(stem, cap);
  addCapDots(t.group, size, size * 1.0, 0.8);
  return t;
}

function addCapDots(group: THREE.Group, capR: number, capY: number, squashY: number): void {
  const dotMat = mat(0xffffff, { flatShading: false });
  for (let i = 0; i < 6; i++) {
    const a = i * 2.1;
    const phi = i === 0 ? 0 : 0.7;
    const dot = mesh(new THREE.SphereGeometry(capR * 0.14, 8, 6), dotMat);
    dot.position.set(
      Math.sin(phi) * Math.cos(a) * capR,
      capY + Math.cos(phi) * capR * squashY,
      Math.sin(phi) * Math.sin(a) * capR,
    );
    dot.scale.y = 0.5;
    group.add(dot);
  }
}

export function makeBush(x: number, z: number, size: number): Thing {
  const t = food(x, z, size, 0x4caf50, 1);
  t.height = size * 1.6;
  const greens = [0x4caf50, 0x43a047, 0x66bb6a];
  const blobs: [number, number, number, number][] = [
    [0, 0.6, 0, 0.7],
    [0.45, 0.45, 0.2, 0.5],
    [-0.4, 0.45, 0.15, 0.55],
    [0.05, 0.4, -0.4, 0.5],
  ];
  for (const [bx, by, bz, br] of blobs) {
    const b = mesh(new THREE.IcosahedronGeometry(size * br, 1), mat(pick(greens)));
    b.position.set(bx * size, by * size * 1.3, bz * size);
    t.group.add(b);
  }
  const berryMat = mat(0xe53935, { flatShading: false, roughness: 0.3 });
  for (let i = 0; i < 6; i++) {
    const a = i * 1.05;
    const berry = mesh(new THREE.SphereGeometry(size * 0.1, 8, 6), berryMat);
    berry.position.set(Math.cos(a) * size * 0.65, size * rand(0.5, 1.1), Math.sin(a) * size * 0.65);
    t.group.add(berry);
  }
  return t;
}

export function makeRock(x: number, z: number, size: number, edible = true): Thing {
  const color = pick([0x8a8a8a, 0x7d7a74, 0x9a958c]);
  const t = new Thing(edible ? 'rock' : 'wall');
  t.pos.set(x, 0, z);
  t.radius = t.size = t.visualRadius = size;
  t.height = size * 1.3;
  t.solid = true;
  t.pushable = edible;
  t.edible = edible;
  t.color.set(color);
  const r = mesh(new THREE.IcosahedronGeometry(1, 0), mat(color));
  r.scale.set(size, size * 0.75, size);
  r.position.y = size * 0.6;
  r.rotation.set(rand(-0.2, 0.2), rand(0, 6), rand(-0.2, 0.2));
  t.group.add(r);
  return t;
}

// ---------- Scenery (walls) ----------

function wall(x: number, z: number, radius: number, height: number): Thing {
  const t = new Thing('wall');
  t.pos.set(x, 0, z);
  t.radius = t.visualRadius = t.size = radius;
  t.height = height;
  t.solid = true;
  return t;
}

export function makeGrassClump(x: number, z: number, h: number, spread: number): Thing {
  const t = wall(x, z, spread, h);
  t.fadeable = true;
  t.visualRadius = spread + 0.6;
  const greens = [0x5fa83a, 0x4e9a2f, 0x74b843, 0x3f8a2a];
  const n = 5 + Math.floor(spread * 2);
  for (let i = 0; i < n; i++) {
    const bh = h * rand(0.6, 1);
    const blade = mesh(new THREE.ConeGeometry(h * 0.045, bh, 4), mat(pick(greens)));
    const a = rand(0, Math.PI * 2);
    const d = rand(0, spread * 0.7);
    blade.position.set(Math.cos(a) * d, bh / 2, Math.sin(a) * d);
    blade.rotation.set(rand(-0.15, 0.15), rand(0, 6), rand(-0.15, 0.15));
    t.group.add(blade);
  }
  return t;
}

export function makeGiantMushroom(x: number, z: number, capR: number, h: number, color: number, platform: boolean): Thing {
  const t = wall(x, z, platform ? capR * 0.95 : capR * 0.4, h + capR * 0.45);
  t.visualRadius = capR;
  t.fadeable = h > 2.5;
  const stem = mesh(new THREE.CylinderGeometry(capR * 0.3, capR * 0.4, h, 10), mat(0xf3ead8));
  stem.position.y = h / 2;
  const cap = mesh(new THREE.SphereGeometry(capR, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(color, { flatShading: false }));
  cap.scale.y = 0.5;
  cap.position.y = h;
  t.group.add(stem, cap);
  addCapDots(t.group, capR, h, 0.5);
  return t;
}

export function makeTrunk(x: number, z: number, r: number, h: number): Thing {
  const t = wall(x, z, r, h);
  t.fadeable = true;
  t.visualRadius = r * 1.4;
  const bark = mat(0x6d4c33);
  const trunk = mesh(new THREE.CylinderGeometry(r * 0.85, r, h, 10), bark);
  trunk.position.y = h / 2;
  t.group.add(trunk);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const root = mesh(new THREE.ConeGeometry(r * 0.35, r * 1.4, 5), bark);
    root.position.set(Math.cos(a) * r * 0.95, r * 0.35, Math.sin(a) * r * 0.95);
    root.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
    t.group.add(root);
  }
  return t;
}

export function makePineTree(x: number, z: number, s: number): Thing {
  const t = wall(x, z, 0.4 * s, 5.3 * s);
  t.fadeable = true;
  t.visualRadius = 1.6 * s;
  const trunk = mesh(new THREE.CylinderGeometry(0.25 * s, 0.35 * s, 2 * s, 7), mat(0x6d4c33));
  trunk.position.y = s;
  t.group.add(trunk);
  const leaf = mat(pick([0x2e7d32, 0x33691e, 0x2f6b3a]));
  const layers: [number, number, number][] = [
    [1.6, 2.2, 2.2],
    [1.25, 1.9, 3.4],
    [0.9, 1.6, 4.5],
  ];
  for (const [r, h, y] of layers) {
    const c = mesh(new THREE.ConeGeometry(r * s, h * s, 8), leaf);
    c.position.y = y * s;
    t.group.add(c);
  }
  t.group.rotation.y = rand(0, 6);
  return t;
}

/** holeSide: which way the log hole faces (+1 = +x, -1 = -x, 0 = no hole). */
export function makeStump(x: number, z: number, r: number, h: number, holeSide: 1 | -1 | 0 = 1): Thing {
  const t = wall(x, z, r, h);
  t.visualRadius = r * 1.1;
  t.fadeable = h > 2.5;
  const side = mat(0x6d4c33);
  const top = mat(0xd8b98a);
  const stump = mesh(new THREE.CylinderGeometry(r, r * 1.1, h, 14), [side, top, side]);
  stump.position.y = h / 2;
  t.group.add(stump);
  if (holeSide !== 0) {
    // The dark hole the logs roll out of.
    const hole = mesh(new THREE.CircleGeometry(Math.min(r * 0.6, h * 0.4), 16), mat(0x2a1a0e));
    hole.position.set(holeSide * r * 1.05, h * 0.45, 0);
    hole.rotation.y = (holeSide * Math.PI) / 2;
    t.group.add(hole);
  }
  // Tree rings on top
  const ring = mesh(new THREE.TorusGeometry(r * 0.55, r * 0.03, 4, 24), mat(0xa9855a));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = h + 0.01;
  t.group.add(ring);
  return t;
}
