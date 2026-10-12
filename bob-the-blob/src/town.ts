import * as THREE from 'three';
import { Thing, mat, mesh, rand, pick, angleTo, turnToward } from './things';
import { makeEyes, makeMouth } from './faces';
import { sfx } from './audio';
import type { Game } from './game';

// Everything for level 3: Bob has left the forest and wandered into a roadside snack stop.

function flatDist(a: THREE.Vector3, b: THREE.Vector3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function snack(x: number, z: number, size: number, color: number, growth = 1.3): Thing {
  const t = new Thing('food');
  t.pos.set(x, 0, z);
  t.radius = t.size = t.visualRadius = size;
  t.height = size * 1.6;
  t.edible = true;
  t.growth = growth;
  t.color.set(color);
  t.group.rotation.y = rand(0, Math.PI * 2);
  return t;
}

const smooth = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
  mat(color, { flatShading: false, roughness: 0.5, ...extra });

// ---------- Dropped junk food ----------

export function makePizza(x: number, z: number, s: number): Thing {
  const t = snack(x, z, s, 0xffc94a);
  t.height = s * 0.4;
  const wedge = mesh(new THREE.CylinderGeometry(s * 1.3, s * 1.3, s * 0.18, 12, 1, false, -0.45, 0.9), smooth(0xffc94a));
  wedge.position.set(0, s * 0.1, -s * 0.6);
  const crust = mesh(
    new THREE.CylinderGeometry(s * 1.32, s * 1.32, s * 0.3, 12, 1, true, -0.45, 0.9),
    smooth(0xc98a3c, { side: THREE.DoubleSide }),
  );
  crust.position.copy(wedge.position).setY(s * 0.15);
  t.group.add(wedge, crust);
  const pep = smooth(0xc62828);
  for (const [px, pz] of [
    [0, 0.25],
    [-0.15, -0.15],
    [0.18, -0.25],
  ]) {
    const p = mesh(new THREE.CylinderGeometry(s * 0.14, s * 0.14, s * 0.05, 10), pep);
    p.position.set(px * s, s * 0.21, (pz - 0.1) * s);
    t.group.add(p);
  }
  return t;
}

export function makeBurger(x: number, z: number, s: number): Thing {
  const t = snack(x, z, s, 0xd99a4e, 1.5);
  t.height = s * 1.3;
  const bun = smooth(0xd99a4e);
  const layers: [THREE.BufferGeometry, THREE.Material, number][] = [
    [new THREE.CylinderGeometry(s * 0.9, s * 0.85, s * 0.25, 16), bun, 0.13],
    [new THREE.CylinderGeometry(s * 0.95, s * 0.95, s * 0.25, 16), smooth(0x5d3a1a), 0.38],
    [new THREE.BoxGeometry(s * 1.5, s * 0.06, s * 1.5), smooth(0xffca28), 0.53],
    [new THREE.CylinderGeometry(s * 1.0, s * 1.0, s * 0.08, 10), smooth(0x7cb342), 0.6],
  ];
  for (const [geo, m, y] of layers) {
    const layer = mesh(geo, m);
    layer.position.y = y * s;
    t.group.add(layer);
  }
  const top = mesh(new THREE.SphereGeometry(s * 0.9, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), bun);
  top.scale.y = 0.65;
  top.position.y = s * 0.64;
  t.group.add(top);
  const seedMat = smooth(0xfff3d6);
  for (let i = 0; i < 8; i++) {
    const a = i * 0.8;
    const seed = mesh(new THREE.SphereGeometry(s * 0.06, 6, 4), seedMat);
    seed.position.set(Math.cos(a) * s * 0.45, s * 1.15, Math.sin(a) * s * 0.45);
    seed.scale.set(1, 0.5, 1.6);
    t.group.add(seed);
  }
  return t;
}

export function makeFries(x: number, z: number, s: number): Thing {
  const t = snack(x, z, s, 0xe53935);
  t.height = s * 1.8;
  const box = mesh(new THREE.CylinderGeometry(s * 0.6, s * 0.42, s * 1.0, 4), smooth(0xe53935));
  box.position.y = s * 0.5;
  box.rotation.y = Math.PI / 4;
  t.group.add(box);
  const fry = smooth(0xffd54f);
  for (let i = 0; i < 9; i++) {
    const f = mesh(new THREE.BoxGeometry(s * 0.1, s * 0.9, s * 0.1), fry);
    f.position.set(rand(-0.3, 0.3) * s, s * (1.05 + rand(0, 0.25)), rand(-0.3, 0.3) * s);
    f.rotation.set(rand(-0.2, 0.2), 0, rand(-0.2, 0.2));
    t.group.add(f);
  }
  return t;
}

export function makeHotDog(x: number, z: number, s: number): Thing {
  const t = snack(x, z, s, 0xb5452b);
  t.height = s * 0.7;
  const bun = mesh(new THREE.CapsuleGeometry(s * 0.3, s * 1.2, 4, 10), smooth(0xe0a458));
  bun.rotation.z = Math.PI / 2;
  bun.scale.set(1, 1, 1.3);
  bun.position.y = s * 0.3;
  const dog = mesh(new THREE.CapsuleGeometry(s * 0.2, s * 1.5, 4, 10), smooth(0xb5452b));
  dog.rotation.z = Math.PI / 2;
  dog.position.y = s * 0.55;
  const mustard = mesh(new THREE.BoxGeometry(s * 1.3, s * 0.05, s * 0.07), smooth(0xffeb3b));
  mustard.position.y = s * 0.76;
  t.group.add(bun, dog, mustard);
  return t;
}

export function makeDonut(x: number, z: number, s: number): Thing {
  const icing = pick([0xf48fb1, 0x8d6e63, 0x81d4fa]);
  const t = snack(x, z, s, icing);
  t.height = s * 0.8;
  const dough = mesh(new THREE.TorusGeometry(s * 0.6, s * 0.32, 10, 20), smooth(0xd7a35a));
  dough.rotation.x = Math.PI / 2;
  dough.position.y = s * 0.32;
  const top = mesh(new THREE.TorusGeometry(s * 0.6, s * 0.3, 8, 20, Math.PI * 2), smooth(icing));
  top.rotation.x = Math.PI / 2;
  top.scale.set(1, 1, 0.6);
  top.position.y = s * 0.45;
  t.group.add(dough, top);
  const colors = [0xffeb3b, 0x4caf50, 0x2196f3, 0xffffff];
  for (let i = 0; i < 12; i++) {
    const a = rand(0, Math.PI * 2);
    const r = s * rand(0.4, 0.8);
    const sprinkle = mesh(new THREE.BoxGeometry(s * 0.12, s * 0.04, s * 0.04), smooth(pick(colors)));
    sprinkle.position.set(Math.cos(a) * r, s * 0.64, Math.sin(a) * r);
    sprinkle.rotation.y = rand(0, 3);
    t.group.add(sprinkle);
  }
  return t;
}

export function makeSoda(x: number, z: number, s: number): Thing {
  const color = pick([0xe53935, 0x1e88e5, 0x43a047]);
  const t = snack(x, z, s, color);
  t.height = s * 2.2;
  const cup = mesh(new THREE.CylinderGeometry(s * 0.6, s * 0.45, s * 1.6, 14), smooth(color));
  cup.position.y = s * 0.8;
  const band = mesh(new THREE.CylinderGeometry(s * 0.57, s * 0.55, s * 0.3, 14), smooth(0xffffff));
  band.position.y = s * 0.9;
  const lid = mesh(new THREE.CylinderGeometry(s * 0.64, s * 0.64, s * 0.1, 14), smooth(0xeeeeee));
  lid.position.y = s * 1.62;
  const straw = mesh(new THREE.CylinderGeometry(s * 0.05, s * 0.05, s * 0.9, 6), smooth(0xffffff));
  straw.position.set(s * 0.15, s * 1.95, 0);
  straw.rotation.z = -0.2;
  t.group.add(cup, band, lid, straw);
  return t;
}

export function makeIceCream(x: number, z: number, s: number): Thing {
  const flavor = pick([0xf8bbd0, 0x6d4c41, 0xfff8e1, 0xa5d6a7]);
  const t = snack(x, z, s, flavor, 1.5);
  t.height = s * 1.6;
  // Dropped on its side, because of course it was.
  const holder = new THREE.Group();
  const cone = mesh(new THREE.ConeGeometry(s * 0.4, s * 1.2, 10), smooth(0xd7a35a));
  cone.rotation.x = Math.PI;
  cone.position.y = s * 0.6;
  const scoop = mesh(new THREE.SphereGeometry(s * 0.5, 14, 10), smooth(flavor));
  scoop.position.y = s * 1.3;
  holder.add(cone, scoop);
  holder.rotation.z = Math.PI / 2.3;
  holder.position.set(s * 0.6, s * 0.4, 0);
  t.group.add(holder);
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(s * 0.7, 16), smooth(flavor));
  puddle.rotation.x = -Math.PI / 2;
  puddle.position.set(-s * 0.4, 0.02, 0);
  t.group.add(puddle);
  return t;
}

export function makeTrafficCone(x: number, z: number, s: number): Thing {
  const t = snack(x, z, s, 0xff7043, 1.2);
  t.height = s * 2.2;
  const base = mesh(new THREE.BoxGeometry(s * 1.4, s * 0.12, s * 1.4), mat(0xff5722));
  base.position.y = s * 0.06;
  const cone = mesh(new THREE.ConeGeometry(s * 0.55, s * 2, 14), smooth(0xff7043));
  cone.position.y = s * 1.1;
  const stripe = mesh(new THREE.CylinderGeometry(s * 0.33, s * 0.4, s * 0.3, 14), smooth(0xffffff));
  stripe.position.y = s * 1.15;
  t.group.add(base, cone, stripe);
  return t;
}

export function makeTrashCan(x: number, z: number, s: number): Thing {
  const t = new Thing('rock');
  t.pos.set(x, 0, z);
  t.radius = t.size = t.visualRadius = s;
  t.height = s * 2.1;
  t.solid = true;
  t.pushable = true;
  t.edible = true;
  t.growth = 1.3;
  t.color.set(0x78909c);
  const metal = mat(0x78909c, { metalness: 0.5, roughness: 0.4 });
  const can = mesh(new THREE.CylinderGeometry(s, s * 0.88, s * 1.9, 16), metal);
  can.position.y = s * 0.95;
  const lid = mesh(new THREE.CylinderGeometry(s * 1.08, s * 1.08, s * 0.15, 16), metal);
  lid.position.y = s * 1.95;
  const handle = mesh(new THREE.TorusGeometry(s * 0.25, s * 0.05, 6, 12, Math.PI), metal);
  handle.position.y = s * 2.03;
  t.group.add(can, lid, handle);
  // A banana peel stuck to the side, obviously.
  const peel = mesh(new THREE.ConeGeometry(s * 0.15, s * 0.5, 4), smooth(0xffeb3b));
  peel.position.set(s * 0.8, s * 1.9, s * 0.5);
  peel.rotation.z = -1;
  t.group.add(peel);
  return t;
}

export const SNACK_MAKERS = [makePizza, makeBurger, makeFries, makeHotDog, makeDonut, makeSoda, makeIceCream];

export function makeRandomSnack(x: number, z: number, s: number): Thing {
  return pick(SNACK_MAKERS)(x, z, s);
}

// ---------- Scenery ----------

function wall(x: number, z: number, radius: number, height: number): Thing {
  const t = new Thing('wall');
  t.pos.set(x, 0, z);
  t.radius = t.visualRadius = t.size = radius;
  t.height = height;
  t.solid = true;
  return t;
}

/** A picnic table Bob can jump up on. */
export function makePicnicTable(x: number, z: number): Thing {
  const t = wall(x, z, 1.2, 0.95);
  t.visualRadius = 1.6;
  const wood = mat(0xa1704a);
  const top = mesh(new THREE.BoxGeometry(2.6, 0.12, 1.3), wood);
  top.position.y = 0.9;
  t.group.add(top);
  for (const side of [-1, 1]) {
    const bench = mesh(new THREE.BoxGeometry(2.6, 0.1, 0.4), wood);
    bench.position.set(0, 0.5, side * 1.0);
    const legA = mesh(new THREE.BoxGeometry(0.12, 0.95, 2.4), wood);
    legA.position.set(side * 1.0, 0.45, 0);
    legA.rotation.x = 0.0;
    t.group.add(bench, legA);
  }
  // Checked tablecloth
  const cloth = mesh(new THREE.BoxGeometry(1.6, 0.02, 1.2), mat(0xe53935));
  cloth.position.y = 0.97;
  t.group.add(cloth);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 3; j++) {
      if ((i + j) % 2) continue;
      const sq = mesh(new THREE.BoxGeometry(0.4, 0.025, 0.4), mat(0xffffff));
      sq.position.set(-0.6 + i * 0.4, 0.975, -0.4 + j * 0.4);
      t.group.add(sq);
    }
  }
  t.group.rotation.y = rand(-0.3, 0.3);
  return t;
}

export function makeSnackShack(x: number, z: number): Thing {
  const t = wall(x, z, 2.8, 4.2);
  t.fadeable = true;
  t.visualRadius = 3.2;
  const walls = mesh(new THREE.BoxGeometry(5, 3, 4), mat(0xfff3e0));
  walls.position.y = 1.5;
  const roof = mesh(new THREE.ConeGeometry(3.9, 1.3, 4), mat(0xe53935));
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, 0.8);
  roof.position.y = 3.65;
  const counter = mesh(new THREE.BoxGeometry(3.4, 1.0, 0.5), mat(0x8d6e63));
  counter.position.set(0, 1.4, 2.1);
  const window = mesh(new THREE.BoxGeometry(3.2, 1.0, 0.1), mat(0x37474f));
  window.position.set(0, 2.2, 2.01);
  t.group.add(walls, roof, counter, window);
  // Stripy awning
  for (let i = 0; i < 6; i++) {
    const stripe = mesh(new THREE.BoxGeometry(0.62, 0.06, 1.0), mat(i % 2 ? 0xffffff : 0xe53935));
    stripe.position.set(-1.55 + i * 0.62, 2.85, 2.4);
    stripe.rotation.x = 0.35;
    t.group.add(stripe);
  }
  // Giant burger sign on the roof
  const sign = makeBurger(0, 0, 0.7).group;
  sign.position.set(0, 4.1, 0);
  t.group.add(sign);
  return t;
}

export function makeLampPost(x: number, z: number): Thing {
  const t = wall(x, z, 0.18, 4);
  t.fadeable = true;
  t.visualRadius = 0.6;
  const metal = mat(0x37474f);
  const pole = mesh(new THREE.CylinderGeometry(0.08, 0.12, 4, 8), metal);
  pole.position.y = 2;
  const arm = mesh(new THREE.BoxGeometry(0.08, 0.08, 0.8), metal);
  arm.position.set(0, 3.95, 0.35);
  const lamp = mesh(new THREE.SphereGeometry(0.2, 10, 8), mat(0xfff59d, { emissive: 0xfff59d, emissiveIntensity: 0.6 }));
  lamp.position.set(0, 3.8, 0.7);
  t.group.add(pole, arm, lamp);
  return t;
}

/** A big jagged lump of the cliff along the back edge (where the rock slides start). */
export function makeCliffChunk(x: number, z: number, r: number, h: number): Thing {
  const t = wall(x, z, r, h);
  t.fadeable = true;
  t.visualRadius = r * 1.2;
  const color = pick([0x8d8a85, 0x7d7a74, 0x9a958c]);
  const rock = mesh(new THREE.DodecahedronGeometry(1, 0), mat(color));
  rock.scale.set(r * 1.1, h * 0.6, r);
  rock.position.y = h * 0.45;
  rock.rotation.y = rand(0, 6);
  t.group.add(rock);
  return t;
}

/** Asphalt strip with a dashed yellow center line. */
export function addRoad(game: Game, z: number, width: number): void {
  const len = game.bounds * 2 + 12;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(len, width), new THREE.MeshStandardMaterial({ color: 0x4a4f55, roughness: 0.9 }));
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.03, z);
  road.receiveShadow = true;
  game.levelRoot.add(road);
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xffd54f, roughness: 0.8 });
  for (let x = -len / 2; x < len / 2; x += 2.4) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.18), lineMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(x, 0.04, z);
    game.levelRoot.add(dash);
  }
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.8 });
  for (const side of [-1, 1]) {
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.15), edgeMat);
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(0, 0.04, z + side * (width / 2 - 0.25));
    game.levelRoot.add(edge);
  }
}

// ---------- Cars: like the logs, but with googly eyes and honking ----------

const CAR_COLORS = [0xe53935, 0x1e88e5, 0xfdd835, 0x43a047, 0x8e24aa, 0xff7043, 0x00acc1];

export class Car extends Thing {
  private wheels: THREE.Mesh[] = [];
  private honkCooldown = 0;
  private bounce = rand(0, 6);
  private body = new THREE.Group();

  constructor(
    x: number,
    z: number,
    private dir: 1 | -1,
    private speed: number,
  ) {
    super('car');
    this.pos.set(x, 0, z);
    this.radius = this.size = this.visualRadius = 1.8;
    this.height = 1.7;
    const color = pick(CAR_COLORS);
    this.color.set(color);

    // Built facing +z, then turned to face the way it drives.
    const paint = mat(color, { flatShading: false, roughness: 0.35, metalness: 0.2 });
    const base = mesh(new THREE.BoxGeometry(1.8, 0.7, 3.6), paint);
    base.position.y = 0.6;
    const cabin = mesh(new THREE.BoxGeometry(1.6, 0.7, 2.0), paint);
    cabin.position.set(0, 1.28, -0.25);
    const glass = mat(0x90caf9, { roughness: 0.1, metalness: 0.3 });
    const windshield = mesh(new THREE.BoxGeometry(1.5, 0.55, 0.06), glass);
    windshield.position.set(0, 1.3, 0.77);
    const sideWin = mesh(new THREE.BoxGeometry(1.62, 0.45, 1.6), glass);
    sideWin.position.set(0, 1.32, -0.3);
    this.body.add(base, cabin, sideWin, windshield);

    const eyes = makeEyes(0.22, 0.38);
    eyes.position.set(0, 1.33, 0.82);
    const grin = makeMouth(0.45, 'grin');
    grin.position.set(0, 0.62, 1.81);
    const lightMat = mat(0xfff59d, { emissive: 0xfff59d, emissiveIntensity: 0.8 });
    for (const side of [-1, 1]) {
      const headlight = mesh(new THREE.SphereGeometry(0.16, 10, 8), lightMat);
      headlight.position.set(side * 0.65, 0.72, 1.78);
      this.body.add(headlight);
    }
    this.body.add(eyes, grin);

    const tire = mat(0x212121);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const w = mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 14), tire);
        w.rotation.z = Math.PI / 2;
        w.position.set(sx * 0.9, 0.38, sz * 1.15);
        this.wheels.push(w);
        this.body.add(w);
      }
    }
    this.group.add(this.body);
    this.group.rotation.y = (dir * Math.PI) / 2;
  }

  update(dt: number, game: Game): void {
    this.pos.x += this.dir * this.speed * dt;
    for (const w of this.wheels) w.rotation.x += (this.speed * dt) / 0.38;
    this.bounce += dt * 12;
    this.body.position.y = Math.abs(Math.sin(this.bounce)) * 0.05;
    if (Math.abs(this.pos.x) > game.bounds + 5) {
      this.dead = true;
      return;
    }

    const bob = game.bob;
    const along = (bob.pos.x - this.pos.x) * this.dir;
    const across = bob.pos.z - this.pos.z;
    if (Math.abs(along) < 1.8 + bob.radius * 0.6 && Math.abs(across) < 0.9 + bob.radius * 0.6 && bob.pos.y < 1.5) {
      game.squashBob(pick(['BEEP BEEP! 🚗🥞', 'Run over by a car!', 'Look both ways, Bob!']));
    }
    this.honkCooldown -= dt;
    if (this.honkCooldown <= 0 && along < 0 && along > -8 && Math.abs(across) < 2.2 && bob.squashTimer <= 0) {
      sfx.honk();
      this.honkCooldown = 3;
    }
  }
}

// ---------- Rock slide boulders: roll down off the cliff, then they're just rocks ----------

export class RollingBoulder extends Thing {
  private rolling = true;
  private rock: THREE.Mesh;
  private dustTimer = 0;

  constructor(
    x: number,
    z: number,
    s: number,
    private laneZs: number[],
  ) {
    super('rock');
    this.pos.set(x, 0, z);
    this.radius = this.size = this.visualRadius = s;
    this.height = s * 1.6;
    this.growth = 1;
    const color = pick([0x8a8a8a, 0x7d7a74, 0x9a958c]);
    this.color.set(color);
    this.rock = mesh(new THREE.IcosahedronGeometry(s * 0.95, 0), mat(color));
    this.rock.position.y = s * 0.85;
    this.group.add(this.rock);
    this.vel.set(rand(-1, 1), 0, rand(6, 8.5));
  }

  update(dt: number, game: Game): void {
    if (!this.rolling) return;
    const speed = Math.hypot(this.vel.x, this.vel.z);
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.rock.rotation.x += (this.vel.z * dt) / this.size;
    this.rock.rotation.z -= (this.vel.x * dt) / this.size;
    game.pushOut(this);

    this.dustTimer -= dt;
    if (this.dustTimer <= 0) {
      game.sparkle(this.pos.clone().setY(0.2), 0xbcaaa4, 3, this.size);
      this.dustTimer = 0.15;
    }

    // Slow down — but never stop in the middle of a road.
    const onRoad = this.laneZs.some((lz) => Math.abs(lz - this.pos.z) < 2.6);
    const newSpeed = Math.max(onRoad ? 2 : 0, speed - 1.8 * dt);
    if (speed > 0) this.vel.multiplyScalar(newSpeed / speed);
    if (newSpeed < 0.4 || Math.abs(this.pos.z) > game.bounds - 1.5) {
      this.rolling = false;
      this.solid = true;
      this.pushable = true;
      this.edible = true;
      this.vel.set(0, 0, 0);
      return;
    }

    const bob = game.bob;
    if (flatDist(bob.pos, this.pos) < this.size + bob.radius * 0.8 && bob.pos.y < this.size * 1.4 && bob.radius < this.size * 1.5) {
      game.hurtBob(this.pos, pick(['BONK! Rock slide! 🪨', 'Ow! Rocks!', 'Rocky road!']));
    }
  }
}

// ---------- People (instead of vines): nice picnickers and a grumpy chef ----------

const NICE_LINES = [
  'Aww, a jelly friend!',
  'Want a snack, little guy?',
  'Catch! 🍔',
  "I'll share my lunch!",
  'Is that... a giant gummy?',
];
const NICE_SCARED = ['AAAH! It got HUGE!', 'Take the food! Take it all!', 'Mommy!!'];
const GRUMPY_LINES = ['Shoo! Shoo!', 'Out of my kitchen!', 'No blobs allowed!', 'Hey! That was MY pizza!'];

export class Person extends Thing {
  private body = new THREE.Group();
  private talk = rand(1, 3);
  private toss = rand(2, 5);
  private healCooldown = 0;
  private phase = rand(0, 6);
  private arm: THREE.Group;

  constructor(
    x: number,
    z: number,
    private mood: 'nice' | 'grumpy',
  ) {
    super('person');
    this.pos.set(x, 0, z);
    this.radius = 0.4;
    this.visualRadius = 0.6;
    this.height = 1.9;
    this.solid = true;

    const skin = smooth(pick([0xffd5b5, 0xe0a878, 0xa66b42, 0x7a4a2a]));
    const shirt = smooth(mood === 'grumpy' ? 0xffffff : pick([0x42a5f5, 0xffa726, 0xab47bc, 0x66bb6a]));
    const pants = smooth(mood === 'grumpy' ? 0x37474f : pick([0x1565c0, 0x5d4037, 0x424242]));
    for (const side of [-1, 1]) {
      const leg = mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.8, 8), pants);
      leg.position.set(side * 0.14, 0.4, 0);
      this.body.add(leg);
    }
    const torso = mesh(new THREE.CapsuleGeometry(0.28, 0.45, 4, 10), shirt);
    torso.position.y = 1.15;
    const head = mesh(new THREE.SphereGeometry(0.25, 14, 10), skin);
    head.position.y = 1.65;
    const eyes = makeEyes(0.06, 0.09, mood === 'grumpy');
    eyes.position.set(0, 1.7, 0.22);
    const mouth = makeMouth(0.07, mood === 'grumpy' ? 'frown' : 'smile');
    mouth.position.set(0, mood === 'grumpy' ? 1.55 : 1.6, 0.24);
    this.body.add(torso, head, eyes, mouth);

    const otherArm = mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.6, 6), shirt);
    otherArm.position.set(-0.36, 1.1, 0);
    otherArm.rotation.z = -0.2;
    this.body.add(otherArm);
    this.arm = new THREE.Group();
    this.arm.position.set(0.36, 1.38, 0);
    const armMesh = mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.6, 6), shirt);
    armMesh.position.y = -0.3;
    this.arm.add(armMesh);

    if (mood === 'grumpy') {
      // Chef's hat and a frying pan
      const hatBase = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.2, 12), smooth(0xffffff));
      hatBase.position.y = 1.9;
      const puff = mesh(new THREE.SphereGeometry(0.28, 12, 8), smooth(0xffffff));
      puff.position.y = 2.1;
      const pan = mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.06, 14), smooth(0x263238, { metalness: 0.6 }));
      pan.position.set(0, -0.75, 0.15);
      pan.rotation.x = Math.PI / 2;
      const handle = mesh(new THREE.BoxGeometry(0.05, 0.3, 0.05), smooth(0x263238));
      handle.position.set(0, -0.55, 0.05);
      this.arm.add(pan, handle);
      this.body.add(hatBase, puff);
    } else {
      // Sun hat and a sandwich
      const brim = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 16), smooth(0xfff176));
      brim.position.y = 1.83;
      const crown = mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.2, 14), smooth(0xfff176));
      crown.position.y = 1.94;
      const sandwich = mesh(new THREE.BoxGeometry(0.25, 0.12, 0.25), smooth(0xe0a458));
      sandwich.position.set(0, -0.65, 0.1);
      this.arm.add(sandwich);
      this.body.add(brim, crown);
    }
    this.body.add(this.arm);
    this.group.add(this.body);
  }

  private headPos(): THREE.Vector3 {
    return new THREE.Vector3(this.pos.x, this.pos.y + 2.4, this.pos.z);
  }

  private say(game: Game, text: string): void {
    game.ui.say(this, () => this.headPos(), text, 2.2, this.mood === 'grumpy' ? 'grumpy' : 'happy');
  }

  update(dt: number, game: Game): void {
    const bob = game.bob;
    this.phase += dt;
    this.healCooldown -= dt;
    this.talk -= dt;
    this.toss -= dt;
    this.body.rotation.y = turnToward(this.body.rotation.y, angleTo(this.pos, bob.pos), dt * 4);
    const d = flatDist(bob.pos, this.pos);
    const huge = bob.radius > 1.2;
    this.arm.rotation.x = -Math.abs(Math.sin(this.phase * (this.mood === 'grumpy' && d < 4 ? 10 : 2))) * 0.8;

    if (this.mood === 'grumpy') {
      if (d < this.radius + bob.radius * 0.9 + 0.4 && bob.pos.y < this.height * 0.8) {
        game.hurtBob(this.pos, pick(['SWAT! 🍳', 'Bonked by a frying pan!', 'Ow, hot pan!']));
      }
      if (d < 7 && this.talk <= 0) {
        this.say(game, pick(GRUMPY_LINES));
        this.talk = rand(4, 7);
      }
      return;
    }

    if (d < this.radius + bob.radius + 0.8 && this.healCooldown <= 0 && game.healBob()) {
      this.healCooldown = 8;
      this.say(game, pick(['Aww, here you go! 💖', 'Feel better, blobby!']));
      this.talk = 4;
      return;
    }
    // Toss Bob a snack every so often.
    if (d < 9 && this.toss <= 0) {
      this.toss = rand(6, 10);
      const snackSize = rand(0.18, 0.3);
      const t = makeRandomSnack(this.pos.x, this.pos.z, snackSize);
      t.pos.y = 1.6;
      const toward = new THREE.Vector3(bob.pos.x - this.pos.x, 0, bob.pos.z - this.pos.z);
      const dist = toward.length() || 1;
      // Land a little short of Bob so he has to go get it.
      const flight = Math.min(dist * 0.8, 6);
      toward.normalize().multiplyScalar(flight / 0.8);
      game.launch(t, new THREE.Vector3(toward.x, 6, toward.z));
      if (this.talk <= 1) {
        this.say(game, huge ? pick(NICE_SCARED) : 'Catch! 🍔');
        this.talk = 3;
      }
      return;
    }
    if (d < 7 && this.talk <= 0) {
      this.say(game, pick(huge ? NICE_SCARED : NICE_LINES));
      this.talk = rand(5, 8);
    }
  }
}
