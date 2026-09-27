import * as THREE from 'three';
import { Thing, mat, mesh, rand, pick, angleTo, turnToward } from './things';
import { makeEyes, makeMouth, makeStars } from './faces';
import type { Game } from './game';

const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });

function flatDist(a: THREE.Vector3, b: THREE.Vector3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

// ---------- Squash with a face: hops over and tries to land on Bob ----------

export class Squash extends Thing {
  private body = new THREE.Group();
  private stars = makeStars();
  private state: 'idle' | 'hop' | 'stunned' = 'idle';
  private timer = rand(1, 3);
  private hopT = 0;
  private hopDur = 0.7;
  private hopH = 1;
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private squish = 0;

  constructor(x: number, z: number, s: number, private aggro: number) {
    super('squash');
    this.pos.set(x, 0, z);
    this.radius = this.size = this.visualRadius = s;
    this.height = s * 2.9;
    this.solid = true;
    this.edible = true;
    this.growth = 1.5;
    this.color.set(0xf2a33a);

    const skin = mat(0xf2a33a, { flatShading: false, roughness: 0.5 });
    const bulb = mesh(new THREE.SphereGeometry(1, 20, 14), skin);
    bulb.position.y = 0.95;
    bulb.scale.set(1, 0.95, 1);
    const neck = mesh(new THREE.SphereGeometry(0.62, 16, 12), skin);
    neck.position.y = 2.0;
    neck.scale.set(1, 1.35, 1);
    const stem = mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.5, 6), mat(0x5d7a2a));
    stem.position.y = 2.95;
    stem.rotation.z = 0.3;
    const eyes = makeEyes(0.24, 0.34, true);
    eyes.position.set(0, 1.3, 0.86);
    const mouth = makeMouth(0.32, 'grin');
    mouth.position.set(0, 0.82, 0.97);
    mouth.rotation.x = 0.3;
    for (const side of [-1, 1]) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.05), white);
      tooth.position.set(side * 0.1, 0.76, 0.99);
      this.body.add(tooth);
    }
    this.body.add(bulb, neck, stem, eyes, mouth);
    this.body.scale.setScalar(s);
    this.stars.position.y = this.height + 0.3 * s;
    this.stars.scale.setScalar(s * 1.5);
    this.group.add(this.body, this.stars);
  }

  update(dt: number, game: Game): void {
    const bob = game.bob;
    const s = this.size;
    this.solid = this.state !== 'hop';
    this.group.rotation.y = turnToward(this.group.rotation.y, angleTo(this.pos, bob.pos), dt * 5);
    this.squish = Math.max(0, this.squish - dt * 3);

    if (this.state === 'stunned') {
      this.timer -= dt;
      this.body.rotation.z = 0.6;
      this.stars.visible = true;
      this.stars.rotation.y += dt * 5;
      if (this.timer <= 0) {
        this.state = 'idle';
        this.timer = 1;
        this.body.rotation.z = 0;
        this.stars.visible = false;
      }
      return;
    }

    if (this.state === 'idle') {
      this.timer -= dt;
      const wob = Math.sin(game.time * 6 + this.pos.x) * 0.04;
      const sx = s * (1 + this.squish * 0.3 - wob);
      this.body.scale.set(sx, s * (1 - this.squish * 0.35 + wob), sx);
      if (this.timer <= 0) this.startHop(game);
      return;
    }

    this.hopT += dt / this.hopDur;
    const k = Math.min(1, this.hopT);
    this.pos.x = this.from.x + (this.to.x - this.from.x) * k;
    this.pos.z = this.from.z + (this.to.z - this.from.z) * k;
    this.pos.y = Math.sin(Math.PI * k) * this.hopH;
    const st = 1 + Math.sin(Math.PI * k) * 0.15;
    this.body.scale.set(s / Math.sqrt(st), s * st, s / Math.sqrt(st));
    if (this.hopT >= 1) {
      this.pos.y = 0;
      this.state = 'idle';
      this.timer = rand(0.7, 1.3);
      this.squish = 1;
      game.pushOut(this);
      game.onSquashLand(this);
    }
  }

  private startHop(game: Game): void {
    const bob = game.bob;
    this.from.copy(this.pos);
    if (flatDist(bob.pos, this.pos) < this.aggro && bob.squashTimer <= 0) {
      // Aim where Bob is heading, not where he is.
      const lead = (0.5 + this.size * 0.2) * 0.35;
      this.to.set(bob.pos.x + bob.vel.x * lead, 0, bob.pos.z + bob.vel.z * lead);
      const maxHop = this.size * 3 + 2;
      const dx = this.to.x - this.from.x;
      const dz = this.to.z - this.from.z;
      const len = Math.hypot(dx, dz);
      if (len > maxHop) this.to.set(this.from.x + (dx / len) * maxHop, 0, this.from.z + (dz / len) * maxHop);
    } else {
      const a = rand(0, Math.PI * 2);
      this.to.set(this.from.x + Math.cos(a) * this.size * 1.5, 0, this.from.z + Math.sin(a) * this.size * 1.5);
    }
    const lim = game.bounds - this.radius;
    this.to.x = THREE.MathUtils.clamp(this.to.x, -lim, lim);
    this.to.z = THREE.MathUtils.clamp(this.to.z, -lim, lim);
    this.hopT = 0;
    this.hopDur = 0.5 + this.size * 0.2;
    this.hopH = this.size * 1.5 + 1;
    this.state = 'hop';
  }

  hitBySpit(game: Game): boolean {
    this.state = 'stunned';
    this.timer = 4;
    this.pos.y = 0;
    game.thingSay(this, pick(['Oof! 😵', 'Bonk!', 'My squashy head!']));
    return true;
  }

  onSpat(): void {
    this.state = 'stunned';
    this.timer = 3;
    this.body.scale.setScalar(this.size);
  }
}

// ---------- Rolling log: rolls out of the stump along a lane ----------

export class RollingLog extends Thing {
  private roller = new THREE.Group();
  private dir: THREE.Vector3;

  constructor(x: number, z: number, dir: THREE.Vector3, private logR: number, length: number, private speed: number) {
    super('log');
    this.dir = dir.clone().normalize();
    this.pos.set(x, 0, z);
    this.radius = this.size = this.visualRadius = length / 2;
    this.height = logR * 2;
    this.edible = true;
    this.growth = 1.2;
    this.color.set(0x7a5230);

    const pivot = new THREE.Group();
    pivot.rotation.y = Math.atan2(this.dir.x, this.dir.z);
    this.roller.position.y = logR;
    const bark = mat(0x7a5230);
    const ring = mat(0xd8b98a);
    const cyl = mesh(new THREE.CylinderGeometry(logR, logR, length, 14), [bark, ring, ring]);
    cyl.rotation.z = Math.PI / 2;
    this.roller.add(cyl);
    for (let i = 0; i < 4; i++) {
      const knot = mesh(new THREE.SphereGeometry(logR * 0.2, 6, 4), mat(0x5a3a1e));
      const a = i * 1.7;
      knot.position.set(rand(-length * 0.4, length * 0.4), Math.cos(a) * logR, Math.sin(a) * logR);
      this.roller.add(knot);
    }
    pivot.add(this.roller);
    this.group.add(pivot);
  }

  update(dt: number, game: Game): void {
    this.pos.addScaledVector(this.dir, this.speed * dt);
    this.roller.rotation.x += (this.speed * dt) / this.logR;
    const out = game.bounds + 4;
    if (Math.abs(this.pos.x) > out || Math.abs(this.pos.z) > out) {
      this.dead = true;
      return;
    }
    if (this.speed === 0) return;
    const bob = game.bob;
    const rx = bob.pos.x - this.pos.x;
    const rz = bob.pos.z - this.pos.z;
    const along = rx * this.dir.x + rz * this.dir.z;
    const across = rx * -this.dir.z + rz * this.dir.x;
    if (
      Math.abs(along) < this.logR + bob.radius * 0.7 &&
      Math.abs(across) < this.size + bob.radius * 0.3 &&
      bob.pos.y < this.logR * 1.6 &&
      bob.radius < this.size
    ) {
      game.squashBob('Flattened by a log! 🥞');
    }
  }

  onSpat(): void {
    this.speed = 0;
  }
}

// ---------- Pinecone: falls from above (watch the shadow!), then it's a snack ----------

export class FallingCone extends Thing {
  falling = true;
  private cone = new THREE.Group();
  private shadow: THREE.Mesh;
  private shadowMat: THREE.MeshBasicMaterial;

  constructor(x: number, z: number, s: number, landed = false) {
    super('pinecone');
    this.pos.set(x, 12 + s * 6, z);
    this.radius = this.size = this.visualRadius = s;
    this.height = s * 2;
    this.growth = 1.2;
    this.color.set(0x8a5a2b);

    const brown = mat(0x8a5a2b);
    const dark = mat(0x5e3a1a);
    for (let i = 0; i < 5; i++) {
      const w = 0.62 - Math.abs(i - 1.6) * 0.13;
      const c = mesh(new THREE.ConeGeometry(w, 0.55, 8), i % 2 ? brown : dark);
      c.position.y = 0.35 + i * 0.33;
      c.rotation.x = Math.PI;
      this.cone.add(c);
    }
    this.cone.scale.setScalar(s);
    this.shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false });
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(s * 1.1, 20), this.shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.group.add(this.cone, this.shadow);
    if (landed) {
      this.pos.y = 0;
      this.land();
    }
  }

  update(dt: number, game: Game): void {
    if (!this.falling) return;
    this.vel.y -= 20 * dt;
    this.pos.y += this.vel.y * dt;
    this.cone.rotation.y += dt * 4;
    const k = 1 - Math.min(1, this.pos.y / 14);
    this.shadow.position.y = -this.pos.y + 0.03;
    this.shadow.scale.setScalar(0.3 + 0.7 * k);
    this.shadowMat.opacity = 0.15 + 0.35 * k;
    if (this.pos.y <= 0) {
      this.pos.y = 0;
      this.land();
      game.onConeLand(this);
    }
  }

  private land(): void {
    this.falling = false;
    this.edible = true;
    this.vel.set(0, 0, 0);
    this.group.remove(this.shadow);
    this.height = this.size * 1.2;
    this.cone.rotation.set(0, 0, Math.PI / 2);
    this.cone.position.set(this.size * 0.95, this.size * 0.55, 0);
    this.group.rotation.y = rand(0, 6);
  }
}

// ---------- Ladybug: a snack that runs away ----------

export class Ladybug extends Thing {
  private heading = rand(0, Math.PI * 2);
  private timer = 0;

  constructor(x: number, z: number, s: number) {
    super('bug');
    this.pos.set(x, 0, z);
    this.radius = this.size = this.visualRadius = s;
    this.height = s * 1.2;
    this.edible = true;
    this.growth = 1.5;
    this.color.set(0xe53935);

    const body = new THREE.Group();
    const shell = mesh(
      new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      mat(0xe53935, { flatShading: false, roughness: 0.3 }),
    );
    shell.scale.set(0.9, 0.75, 1.1);
    body.add(shell);
    const black = mat(0x111111, { flatShading: false });
    const dots: [number, number, number][] = [
      [0.45, 0.5, 0.35],
      [-0.45, 0.5, 0.35],
      [0.5, 0.42, -0.4],
      [-0.5, 0.42, -0.4],
      [0.18, 0.7, -0.05],
      [-0.18, 0.7, -0.05],
    ];
    for (const [dx, dy, dz] of dots) {
      const dot = mesh(new THREE.SphereGeometry(0.15, 8, 6), black);
      dot.position.set(dx, dy, dz);
      body.add(dot);
    }
    const head = mesh(new THREE.SphereGeometry(0.4, 12, 8), black);
    head.position.set(0, 0.2, 1.05);
    const eyes = makeEyes(0.12, 0.15);
    eyes.position.set(0, 0.38, 1.35);
    body.add(head, eyes);
    body.scale.setScalar(s);
    this.group.add(body);
  }

  update(dt: number, game: Game): void {
    const bob = game.bob;
    if (flatDist(bob.pos, this.pos) < 2.5 + bob.radius * 2) {
      this.heading = angleTo(bob.pos, this.pos) + Math.sin(game.time * 8) * 0.5;
    } else {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.heading += rand(-1.5, 1.5);
        this.timer = rand(1, 2.5);
      }
    }
    const speed = this.size * 3 + 0.8;
    this.pos.x += Math.sin(this.heading) * speed * dt;
    this.pos.z += Math.cos(this.heading) * speed * dt;
    const lim = game.bounds - 1;
    if (Math.abs(this.pos.x) > lim || Math.abs(this.pos.z) > lim) this.heading += Math.PI;
    game.pushOut(this);
    this.group.rotation.y = turnToward(this.group.rotation.y, this.heading, dt * 10);
  }
}

// ---------- Vines with faces ----------

const GRUMPY = [
  'Hmph! 😠',
  'Go away, blob!',
  'Pokey pokey! Grr!',
  'Nobody hugs a thorn vine...',
  'I am VERY spiky!',
  'Blobs are gross!',
  'Touch me and see what happens!',
];
const HAPPY = [
  'Hi Bob! 🌸',
  'You can do it, Bob!',
  'Looking juicy, Bob!',
  'Nom nom nom!',
  'Watch out for squashes!',
  'Bigger is better!',
  'Stay away from those grumpy thorns!',
];

function vineCurve(): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.3, 0.8, 0.1),
    new THREE.Vector3(-0.25, 1.6, -0.1),
    new THREE.Vector3(0.2, 2.3, 0.05),
    new THREE.Vector3(0, 2.8, 0),
  ]);
}

export class ThornVine extends Thing {
  private sway = new THREE.Group();
  private talk = rand(1, 4);
  private phase = rand(0, 6);

  constructor(x: number, z: number, private s: number) {
    super('thorn');
    this.pos.set(x, 0, z);
    this.radius = 0.5 * s;
    this.visualRadius = s;
    this.height = 3.4 * s;

    const curve = vineCurve();
    const stem = mesh(new THREE.TubeGeometry(curve, 32, 0.13, 7), mat(0x3d5a2a, { flatShading: false }));
    this.sway.add(stem);
    const thornMat = mat(0x9b1b4b);
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 1; i < 12; i++) {
      const p = curve.getPointAt(i / 12);
      const tan = curve.getTangentAt(i / 12);
      const out = new THREE.Vector3(Math.cos(i * 2.4), 0, Math.sin(i * 2.4));
      out.addScaledVector(tan, -out.dot(tan)).normalize();
      const thorn = mesh(new THREE.ConeGeometry(0.07, 0.3, 5), thornMat);
      thorn.position.copy(p).addScaledVector(out, 0.15);
      thorn.quaternion.setFromUnitVectors(up, out);
      this.sway.add(thorn);
    }
    const head = mesh(new THREE.SphereGeometry(0.42, 14, 10), mat(0x6b2d6b, { flatShading: false }));
    head.position.y = 3.0;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spike = mesh(new THREE.ConeGeometry(0.08, 0.3, 5), thornMat);
      const dir = new THREE.Vector3(Math.cos(a) * 0.6, 1, Math.sin(a) * 0.6).normalize();
      spike.position.set(0, 3.0, 0).addScaledVector(dir, 0.45);
      spike.quaternion.setFromUnitVectors(up, dir);
      this.sway.add(spike);
    }
    const eyes = makeEyes(0.12, 0.16, true);
    eyes.position.set(0, 3.08, 0.36);
    const mouth = makeMouth(0.1, 'frown');
    mouth.position.set(0, 2.84, 0.42);
    this.sway.add(head, eyes, mouth);
    this.sway.scale.setScalar(s);
    this.group.add(this.sway);
  }

  private headPos(): THREE.Vector3 {
    return new THREE.Vector3(this.pos.x, this.pos.y + 3.7 * this.s, this.pos.z);
  }

  update(dt: number, game: Game): void {
    const bob = game.bob;
    this.phase += dt;
    this.sway.rotation.z = Math.sin(this.phase * 1.7) * 0.08;
    this.sway.rotation.y = turnToward(this.sway.rotation.y, angleTo(this.pos, bob.pos), dt * 3);
    const d = flatDist(bob.pos, this.pos);
    if (d < this.radius + bob.radius * 0.8 && bob.pos.y < this.height * 0.7) {
      game.hurtBob(this.pos, pick(['Ouch! Thorny! 🌵', 'OW OW OW!', 'Pointy!!']));
    }
    this.talk -= dt;
    if (d < 6 * this.s + 2 && this.talk <= 0) {
      game.ui.say(this, () => this.headPos(), pick(GRUMPY), 2.2, 'grumpy');
      this.talk = rand(5, 9);
    }
  }
}

export class FlowerVine extends Thing {
  private sway = new THREE.Group();
  private talk = rand(0, 2);
  private phase = rand(0, 6);
  private cooldown = 0;

  constructor(x: number, z: number, private s: number) {
    super('flower');
    this.pos.set(x, 0, z);
    this.radius = 0.5 * s;
    this.visualRadius = s;
    this.height = 3.4 * s;

    const curve = vineCurve();
    const green = mat(0x4f9a3a, { flatShading: false });
    this.sway.add(mesh(new THREE.TubeGeometry(curve, 32, 0.12, 7), green));
    for (let i = 1; i < 4; i++) {
      const p = curve.getPointAt(i / 4.5);
      const leaf = mesh(new THREE.SphereGeometry(0.28, 10, 6), green);
      leaf.scale.set(1, 0.25, 0.5);
      const side = i % 2 ? 1 : -1;
      leaf.position.copy(p).add(new THREE.Vector3(side * 0.28, 0, 0));
      leaf.rotation.z = side * 0.4;
      this.sway.add(leaf);
    }
    const center = mesh(new THREE.SphereGeometry(0.28, 14, 10), mat(0xffd23f, { flatShading: false }));
    center.position.y = 3.0;
    this.sway.add(center);
    const petalMat = mat(0xff8fc7, { flatShading: false });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const petal = mesh(new THREE.SphereGeometry(0.2, 10, 6), petalMat);
      petal.scale.set(1, 1, 0.35);
      petal.position.set(Math.cos(a) * 0.42, 3.0 + Math.sin(a) * 0.42, -0.05);
      this.sway.add(petal);
    }
    const eyes = makeEyes(0.08, 0.1);
    eyes.position.set(0, 3.07, 0.24);
    const mouth = makeMouth(0.09, 'smile');
    mouth.position.set(0, 2.98, 0.27);
    this.sway.add(eyes, mouth);
    this.sway.scale.setScalar(s);
    this.group.add(this.sway);
  }

  private headPos(): THREE.Vector3 {
    return new THREE.Vector3(this.pos.x, this.pos.y + 3.7 * this.s, this.pos.z);
  }

  update(dt: number, game: Game): void {
    const bob = game.bob;
    this.phase += dt;
    this.cooldown -= dt;
    const d = flatDist(bob.pos, this.pos);
    const near = d < 4 * this.s + 2;
    this.sway.rotation.z = Math.sin(this.phase * 1.3) * 0.06;
    this.sway.rotation.y = turnToward(this.sway.rotation.y, angleTo(this.pos, bob.pos), dt * 3);
    this.sway.position.y = near ? Math.abs(Math.sin(this.phase * 6)) * 0.1 * this.s : 0;

    if (d < this.radius + bob.radius + 0.8 * this.s && this.cooldown <= 0 && game.healBob()) {
      this.cooldown = 8;
      game.ui.say(this, () => this.headPos(), pick(['Flower power! 💖', 'Have a flower hug!', 'All better! 🌼']), 2.2, 'happy');
      this.talk = 4;
      return;
    }
    this.talk -= dt;
    if (near && this.talk <= 0) {
      game.ui.say(this, () => this.headPos(), pick(HAPPY), 2.2, 'happy');
      this.talk = rand(5, 9);
    }
  }
}

// ---------- Bigfoot: stomps around and leaps at Bob ----------

type BigfootState = 'wander' | 'chase' | 'windup' | 'leap' | 'recover' | 'stunned';

export class Bigfoot extends Thing {
  private state: BigfootState = 'wander';
  private timer = 0;
  private cooldown = 2;
  private target = new THREE.Vector3();
  private leapFrom = new THREE.Vector3();
  private walk = 0;
  private body = new THREE.Group();
  private legs: THREE.Group[] = [];
  private arms: THREE.Group[] = [];
  private stars = makeStars();
  private marker: THREE.Mesh;

  constructor(x: number, z: number, private s: number) {
    super('bigfoot');
    this.pos.set(x, 0, z);
    this.radius = 0.9 * s;
    this.visualRadius = 1.4 * s;
    this.size = 2.4 * s;
    this.height = 4.4 * s;
    this.solid = true;
    this.edible = true;
    this.color.set(0x6b4a2f);

    const fur = mat(0x6b4a2f);
    const light = mat(0xc9a27a);
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.45, 1.3, 0);
      const legMesh = mesh(new THREE.CylinderGeometry(0.3, 0.35, 1.3, 8), fur);
      legMesh.position.y = -0.65;
      const foot = mesh(new THREE.BoxGeometry(0.55, 0.28, 1.0), light);
      foot.position.set(0, -1.16, 0.22);
      leg.add(legMesh, foot);
      this.legs.push(leg);
      this.body.add(leg);

      const arm = new THREE.Group();
      arm.position.set(side * 1.05, 3.05, 0);
      const armMesh = mesh(new THREE.CylinderGeometry(0.22, 0.28, 1.5, 8), fur);
      armMesh.position.y = -0.75;
      const hand = mesh(new THREE.SphereGeometry(0.26, 10, 8), light);
      hand.position.y = -1.55;
      arm.add(armMesh, hand);
      arm.rotation.z = side * 0.15;
      this.arms.push(arm);
      this.body.add(arm);
    }
    const torso = mesh(new THREE.IcosahedronGeometry(1.1, 1), fur);
    torso.position.y = 2.45;
    torso.scale.set(1, 1.2, 0.85);
    const belly = mesh(new THREE.SphereGeometry(0.7, 12, 10), light);
    belly.position.set(0, 2.3, 0.6);
    belly.scale.set(1, 1.2, 0.5);
    const head = mesh(new THREE.IcosahedronGeometry(0.62, 1), fur);
    head.position.y = 3.85;
    const face = mesh(new THREE.SphereGeometry(0.45, 14, 10), light);
    face.position.set(0, 3.8, 0.38);
    face.scale.set(1, 1, 0.55);
    const eyes = makeEyes(0.13, 0.17);
    eyes.position.set(0, 3.93, 0.62);
    const mouth = makeMouth(0.17, 'grin');
    mouth.position.set(0, 3.72, 0.64);
    this.body.add(torso, belly, head, face, eyes, mouth);
    this.body.scale.setScalar(s);

    this.stars.position.y = 4.7 * s;
    this.stars.scale.setScalar(s * 1.5);
    this.group.add(this.body, this.stars);

    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1.15, 28),
      new THREE.MeshBasicMaterial({ color: 0xff3344, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.scale.setScalar(s * 1.2);
    this.marker.visible = false;
  }

  update(dt: number, game: Game): void {
    if (!this.marker.parent) game.levelRoot.add(this.marker);
    const bob = game.bob;
    const s = this.s;
    const dist = flatDist(bob.pos, this.pos);
    this.cooldown -= dt;
    let moving = false;

    switch (this.state) {
      case 'stunned':
        this.timer -= dt;
        this.stars.visible = true;
        this.stars.rotation.y += dt * 5;
        this.body.rotation.z = Math.sin(game.time * 6) * 0.15;
        if (this.timer <= 0) {
          this.state = 'chase';
          this.stars.visible = false;
          this.body.rotation.z = 0;
        }
        break;
      case 'wander':
        if (dist < 10 * s + 2) {
          this.state = 'chase';
          game.thingSay(this, pick(['A BLOB! 👀', 'Ooh, jelly!', 'Hey little guy!']));
          break;
        }
        this.timer -= dt;
        if (this.timer <= 0 || flatDist(this.pos, this.target) < 0.5) {
          const lim = game.bounds * 0.7;
          this.target.set(rand(-lim, lim), 0, rand(-lim, lim));
          this.timer = rand(3, 6);
        }
        moving = this.moveToward(this.target, 1.3 * s, dt);
        break;
      case 'chase':
        if (dist > 16 * s + 4) {
          this.state = 'wander';
          break;
        }
        if (dist < 5 * s + 1.5 && this.cooldown <= 0 && bob.squashTimer <= 0 && bob.radius < this.size * 0.8) {
          this.state = 'windup';
          this.timer = 0.7;
          this.target.set(bob.pos.x, 0, bob.pos.z);
          this.marker.position.set(this.target.x, 0.04, this.target.z);
          this.marker.visible = true;
          game.thingSay(this, pick(['STOMP TIME!', 'Here I come!', 'Big foot, BIG STOMP!']));
          break;
        }
        if (dist > this.radius + bob.radius + 0.3) moving = this.moveToward(bob.pos, 1.9 * s, dt);
        break;
      case 'windup':
        this.timer -= dt;
        this.body.scale.set(s * 1.05, s * 0.85, s * 1.05);
        this.legs[0].rotation.x = -1.1;
        this.marker.scale.setScalar(s * (1.2 + Math.sin(game.time * 20) * 0.1));
        this.group.rotation.y = turnToward(this.group.rotation.y, angleTo(this.pos, this.target), dt * 8);
        if (this.timer <= 0) {
          this.state = 'leap';
          this.timer = 0;
          this.leapFrom.copy(this.pos);
          this.solid = false;
        }
        break;
      case 'leap': {
        this.timer += dt / 0.75;
        const k = Math.min(1, this.timer);
        this.pos.x = this.leapFrom.x + (this.target.x - this.leapFrom.x) * k;
        this.pos.z = this.leapFrom.z + (this.target.z - this.leapFrom.z) * k;
        this.pos.y = Math.sin(Math.PI * k) * 3.5 * s;
        this.body.scale.set(s * 0.95, s * 1.1, s * 0.95);
        this.legs[0].rotation.x = -0.4;
        this.legs[1].rotation.x = 0.4;
        if (this.timer >= 1) {
          this.pos.y = 0;
          this.state = 'recover';
          this.timer = 1.0;
          this.solid = true;
          this.marker.visible = false;
          this.body.scale.set(s * 1.15, s * 0.8, s * 1.15);
          game.onBigfootStomp(this);
          game.pushOut(this);
        }
        break;
      }
      case 'recover':
        this.timer -= dt;
        this.body.scale.lerp(new THREE.Vector3(s, s, s), Math.min(1, dt * 4));
        if (this.timer <= 0) {
          this.state = 'chase';
          this.cooldown = rand(2, 3.5);
        }
        break;
    }

    if (this.state === 'wander' || this.state === 'chase') this.body.scale.setScalar(s);
    if (moving) {
      this.walk += dt * 8;
      this.legs[0].rotation.x = Math.sin(this.walk) * 0.6;
      this.legs[1].rotation.x = -Math.sin(this.walk) * 0.6;
      this.arms[0].rotation.x = -Math.sin(this.walk) * 0.5;
      this.arms[1].rotation.x = Math.sin(this.walk) * 0.5;
      game.pushOut(this);
    } else if (this.state !== 'windup' && this.state !== 'leap') {
      for (const limb of [...this.legs, ...this.arms]) limb.rotation.x *= 1 - Math.min(1, dt * 8);
    }
  }

  private moveToward(p: THREE.Vector3, speed: number, dt: number): boolean {
    const dx = p.x - this.pos.x;
    const dz = p.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.3) return false;
    this.pos.x += (dx / d) * speed * dt;
    this.pos.z += (dz / d) * speed * dt;
    this.group.rotation.y = turnToward(this.group.rotation.y, Math.atan2(dx, dz), dt * 6);
    return true;
  }

  hitBySpit(game: Game): boolean {
    if (this.state === 'leap') return false;
    this.state = 'stunned';
    this.timer = 3;
    this.marker.visible = false;
    this.solid = true;
    this.body.scale.setScalar(this.s);
    game.thingSay(this, pick(['Hey! Rude! 😵', 'Ow, my nose!', 'Bleh! Blob spit!']));
    return true;
  }
}

// ---------- The goal treat: swallow it to finish the level ----------

const TAUNTS = ["Nyah nyah! Can't eat me!", "You're too tiny!", 'Come and get me! 😜', 'Grow up first, blobby!'];
const WORRIED = ['Uh oh...', 'Wait, you got BIG!', 'Eek! 😱', "Let's talk about this!"];

export class GoalTreat extends Thing {
  private body = new THREE.Group();
  private arrow: THREE.Mesh;
  private beamMat: THREE.MeshBasicMaterial;
  private talk = rand(1, 3);
  private phase = 0;

  constructor(x: number, z: number, y: number, size: number, style: 'strawberry' | 'pinecone') {
    super('food');
    this.isGoal = true;
    this.pos.set(x, y, z);
    this.radius = this.size = this.visualRadius = size;
    this.height = size * 1.9;
    this.edible = true;

    if (style === 'strawberry') {
      this.color.set(0xe8283c);
      const profile = [
        [0, 0],
        [0.3, 0.12],
        [0.68, 0.5],
        [0.95, 1.05],
        [0.9, 1.5],
        [0.6, 1.8],
        [0, 1.88],
      ].map(([r, h]) => new THREE.Vector2(r, h));
      const berry = mesh(new THREE.LatheGeometry(profile, 24), mat(0xe8283c, { flatShading: false, roughness: 0.35 }));
      this.body.add(berry);
      const seedMat = mat(0xffe082);
      for (let i = 0; i < 40; i++) {
        const h = rand(0.25, 1.55);
        const a = rand(0, Math.PI * 2);
        // Rough radius of the lathe profile at this height.
        const r = h < 1.05 ? 0.3 + (h / 1.05) * 0.65 : 0.95 - ((h - 1.05) / 0.8) * 0.35;
        const seed = mesh(new THREE.SphereGeometry(0.035, 5, 4), seedMat);
        seed.position.set(Math.cos(a) * r, h, Math.sin(a) * r);
        this.body.add(seed);
      }
      const leafMat = mat(0x3f8f2f);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const leaf = mesh(new THREE.ConeGeometry(0.14, 0.6, 4), leafMat);
        leaf.position.set(Math.cos(a) * 0.3, 1.85, Math.sin(a) * 0.3);
        leaf.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2);
        this.body.add(leaf);
      }
    } else {
      this.color.set(0xffc400);
      const gold = mat(0xffc400, { metalness: 0.4, roughness: 0.3, emissive: 0xff9900, emissiveIntensity: 0.35 });
      const darkGold = mat(0xd49a00, { metalness: 0.4, roughness: 0.3, emissive: 0xaa6600, emissiveIntensity: 0.3 });
      for (let i = 0; i < 5; i++) {
        const w = 0.8 - Math.abs(i - 1.6) * 0.16;
        const c = mesh(new THREE.ConeGeometry(w, 0.5, 8), i % 2 ? gold : darkGold);
        c.position.y = 0.3 + i * 0.33;
        c.rotation.x = Math.PI;
        this.body.add(c);
      }
    }
    const eyes = makeEyes(0.14, 0.2);
    eyes.position.set(0, 1.2, style === 'strawberry' ? 0.84 : 0.62);
    const mouth = makeMouth(0.12, 'grin');
    mouth.position.set(0, 0.95, style === 'strawberry' ? 0.9 : 0.66);
    this.body.add(eyes, mouth);
    this.body.scale.setScalar(size);
    this.group.add(this.body);

    // A beam of light and a bouncing arrow so you always know where to go.
    this.beamMat = new THREE.MeshBasicMaterial({
      color: 0xfff176,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(size * 1.1, size * 1.1, 40, 20, 1, true), this.beamMat);
    beam.position.y = 20;
    this.arrow = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 4), new THREE.MeshBasicMaterial({ color: 0xffeb3b }));
    this.arrow.rotation.x = Math.PI;
    this.group.add(beam, this.arrow);
  }

  update(dt: number, game: Game): void {
    const bob = game.bob;
    const bigEnough = bob.radius * 0.85 > this.size;
    this.phase += dt;
    this.arrow.position.y = this.height + 1.2 + Math.abs(Math.sin(this.phase * 3)) * 0.8;
    this.arrow.rotation.y += dt * 2;
    this.beamMat.opacity = bigEnough ? 0.22 + Math.sin(this.phase * 6) * 0.1 : 0.12;
    this.body.rotation.y = turnToward(this.body.rotation.y, angleTo(this.pos, bob.pos), dt * 4);
    this.body.position.y = Math.abs(Math.sin(this.phase * (bigEnough ? 9 : 3))) * this.size * 0.15;

    const d = flatDist(bob.pos, this.pos);
    this.talk -= dt;
    if (d < 10 && this.talk <= 0) {
      const text = bigEnough ? pick(WORRIED) : pick(TAUNTS);
      game.ui.say(this, () => this.pos.clone().setY(this.pos.y + this.height + 0.4), text, 2.2, 'happy');
      this.talk = rand(4, 7);
    }
  }
}
