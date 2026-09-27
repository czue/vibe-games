import * as THREE from 'three';
import { Bob } from './bob';
import { Thing, rand, pick } from './things';
import type { Squash, FallingCone, Bigfoot } from './enemies';
import { UI } from './ui';
import { Input } from './input';
import { sfx } from './audio';
import { LEVELS, type LevelDef } from './levels';

const GRAVITY = 28;
const SWALLOW_REPEAT = 0.18;
const EAT_TIME = 0.22;

interface Eating {
  thing: Thing;
  t: number;
  from: THREE.Vector3;
}

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  ttl: number;
}

export class Game {
  bob = new Bob();
  things: Thing[] = [];
  levelRoot = new THREE.Group();
  level!: LevelDef;
  levelIndex = 0;
  state: 'title' | 'play' | 'growing' | 'done' = 'title';
  time = 0;

  private eating: Eating[] = [];
  private particles: Particle[] = [];
  private sparkGeo = new THREE.SphereGeometry(0.08, 6, 4);
  private shake = 0;
  private swallowRepeat = 0;
  private growTimer = 0;
  private goalAnnounced = false;
  private clock = 0;
  private camLook = new THREE.Vector3();
  private sun: THREE.DirectionalLight;

  constructor(
    public scene: THREE.Scene,
    public camera: THREE.PerspectiveCamera,
    public ui: UI,
    public input: Input,
  ) {
    scene.add(this.levelRoot, this.bob.group);
    scene.add(new THREE.HemisphereLight(0xdff3ff, 0x4a6b2a, 1.1));
    this.sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 120;
    this.sun.shadow.bias = -0.0005;
    scene.add(this.sun, this.sun.target);
  }

  get bounds(): number {
    return this.level.bounds;
  }

  get startVolume(): number {
    return this.level.startRadius ** 3;
  }

  add<T extends Thing>(t: T): T {
    this.things.push(t);
    this.levelRoot.add(t.group);
    t.sync();
    return t;
  }

  // ---------- Levels ----------

  loadLevel(i: number): void {
    this.levelIndex = i;
    this.level = LEVELS[i];
    this.levelRoot.clear();
    this.things = [];
    this.eating = [];
    this.particles = [];
    this.time = 0;
    this.goalAnnounced = false;
    this.scene.background = new THREE.Color(this.level.sky);
    this.scene.fog = new THREE.Fog(this.level.sky, this.level.fogNear, this.level.fogFar);

    const b = this.bob;
    b.volume = this.startVolume;
    b.stomach = [];
    b.hearts = b.maxHearts;
    b.pos.set(this.level.start[0], 0, this.level.start[1]);
    b.vel.set(0, 0, 0);
    b.squashTimer = 0;
    b.invuln = 0;
    b.visualBoost = 1;
    b.facing = 0;

    this.level.build(this);
    this.ui.setLevelName(`Level ${i + 1}: ${this.level.name}`);
    this.updateCamera(0, true);
  }

  announceLevel(): void {
    this.ui.big(
      `<small>Level ${this.levelIndex + 1}</small>${this.level.name}<small>${this.level.subtitle}</small>`,
      3.5,
    );
  }

  // ---------- Main update ----------

  update(dt: number): void {
    dt = Math.min(dt, 1 / 30);
    this.clock += dt;
    if (this.state === 'play') this.updatePlay(dt);
    else if (this.state === 'growing') this.updateGrowing(dt);

    for (const t of this.things) if (!t.beingEaten) t.sync();
    this.updateParticles(dt);
    this.bob.updateVisual(dt, this.clock);
    this.updateCamera(dt);
    this.updateFades(dt);
    this.ui.update(dt, this.camera);
  }

  private updatePlay(dt: number): void {
    this.time += dt;
    const b = this.bob;
    const inp = this.input;
    b.invuln = Math.max(0, b.invuln - dt);

    if (b.squashTimer > 0) {
      b.squashTimer -= dt;
      b.vel.x = b.vel.z = 0;
      if (b.squashTimer <= 0) {
        b.invuln = 1.5;
        b.vel.y = 7;
        b.grounded = false;
        sfx.boing();
      }
    } else {
      const r = b.radius;
      let ix = (inp.isDown('KeyD', 'ArrowRight') ? 1 : 0) - (inp.isDown('KeyA', 'ArrowLeft') ? 1 : 0);
      let iz = (inp.isDown('KeyS', 'ArrowDown') ? 1 : 0) - (inp.isDown('KeyW', 'ArrowUp') ? 1 : 0);
      const len = Math.hypot(ix, iz);
      if (len > 0) {
        ix /= len;
        iz /= len;
        b.facing = Math.atan2(ix, iz);
      }
      const speed = 3.5 + r * 3;
      const k = Math.min(1, (b.grounded ? 12 : 5) * dt);
      b.vel.x += (ix * speed - b.vel.x) * k;
      b.vel.z += (iz * speed - b.vel.z) * k;

      if (inp.wasPressed('Space') && b.grounded) {
        b.vel.y = Math.sqrt(2 * GRAVITY * (1.3 + r * 1.3));
        b.grounded = false;
        sfx.jump();
      }
      if (inp.wasPressed('KeyE', 'KeyJ')) {
        this.trySwallow(true);
        this.swallowRepeat = SWALLOW_REPEAT;
      } else if (inp.isDown('KeyE', 'KeyJ')) {
        this.swallowRepeat -= dt;
        if (this.swallowRepeat <= 0) {
          this.trySwallow(false);
          this.swallowRepeat = SWALLOW_REPEAT;
        }
      }
      if (inp.wasPressed('KeyQ', 'KeyK')) this.spit();
    }

    this.moveBob(dt);
    for (const t of [...this.things]) {
      if (!t.dead && !t.beingEaten && !t.thrown) t.update(dt, this);
    }
    this.updateThrown(dt);
    this.updatePushables(dt);
    this.updateEating(dt);
    this.cleanup();
    this.level.tick(this, dt);

    const r = b.radius;
    const frac = THREE.MathUtils.clamp(
      (r - this.level.startRadius) / (this.level.targetRadius - this.level.startRadius),
      0,
      1,
    );
    const names = this.level.sizeNames;
    const bigEnough = frac >= 0.999;
    this.ui.setHearts(b.hearts, b.maxHearts);
    this.ui.setMeter(
      frac,
      bigEnough
        ? `Big enough! Now swallow the ${this.level.goalName}!`
        : `Bob is as big as ${names[Math.min(names.length - 1, Math.floor(frac * names.length))]}`,
    );

    if (bigEnough && !this.goalAnnounced) {
      this.goalAnnounced = true;
      sfx.heal();
      this.ui.big(`Bob is big enough!<small>Now go swallow the ${this.level.goalName}!</small><small>(follow the light)</small>`, 4);
    }
  }

  // ---------- Bob physics ----------

  private moveBob(dt: number): void {
    const b = this.bob;
    const r = b.radius;
    b.vel.y -= GRAVITY * dt;
    b.pos.addScaledVector(b.vel, dt);
    const lim = this.bounds - r;
    b.pos.x = THREE.MathUtils.clamp(b.pos.x, -lim, lim);
    b.pos.z = THREE.MathUtils.clamp(b.pos.z, -lim, lim);

    let ground = 0;
    for (const t of this.things) {
      if (!t.solid || t.dead || t.beingEaten || t.thrown) continue;
      const dx = b.pos.x - t.pos.x;
      const dz = b.pos.z - t.pos.z;
      const dist = Math.hypot(dx, dz);
      // Close enough to the top to stand on it (this also lets Bob hop up small steps).
      if (b.pos.y >= t.top - 0.35) {
        if (dist < t.radius * 0.9 + r * 0.3) ground = Math.max(ground, t.top);
        continue;
      }
      if (b.pos.y + r * 1.7 <= t.pos.y) continue;
      const minD = r * 0.9 + t.radius;
      if (dist >= minD) continue;
      const nx = dist > 1e-4 ? dx / dist : 1;
      const nz = dist > 1e-4 ? dz / dist : 0;
      const overlap = minD - dist;
      if (t.pushable) {
        // Bigger Bob = heavier Bob = easier pushing.
        const mb = r ** 3 * 4;
        const share = t.mass / (mb + t.mass);
        b.pos.x += nx * overlap * share;
        b.pos.z += nz * overlap * share;
        t.pos.x -= nx * overlap * (1 - share);
        t.pos.z -= nz * overlap * (1 - share);
      } else {
        b.pos.x += nx * overlap;
        b.pos.z += nz * overlap;
      }
    }

    if (b.pos.y <= ground) {
      if (!b.grounded && b.vel.y < -8) b.landSquish = 1;
      b.pos.y = ground;
      b.vel.y = Math.max(0, b.vel.y);
      b.grounded = true;
    } else if (b.pos.y > ground + 0.05) {
      b.grounded = false;
    }
  }

  /** Keep a walking/hopping thing out of walls, rocks and trees. */
  pushOut(t: Thing): void {
    for (const o of this.things) {
      if (o === t || !o.solid || o.dead || o.beingEaten || o.thrown) continue;
      if (o.kind === 'squash' || o.kind === 'bigfoot') continue;
      const dx = t.pos.x - o.pos.x;
      const dz = t.pos.z - o.pos.z;
      const dist = Math.hypot(dx, dz);
      const minD = t.radius + o.radius;
      if (dist >= minD || dist < 1e-4) continue;
      t.pos.x += (dx / dist) * (minD - dist);
      t.pos.z += (dz / dist) * (minD - dist);
    }
    const lim = this.bounds - t.radius;
    t.pos.x = THREE.MathUtils.clamp(t.pos.x, -lim, lim);
    t.pos.z = THREE.MathUtils.clamp(t.pos.z, -lim, lim);
  }

  private updatePushables(dt: number): void {
    for (const t of this.things) {
      if (!t.pushable || t.dead || t.beingEaten || t.thrown) continue;
      t.pos.addScaledVector(t.vel, dt);
      t.vel.multiplyScalar(Math.exp(-4 * dt));
      for (const o of this.things) {
        if (o === t || !o.solid || o.dead || o.beingEaten || o.thrown) continue;
        if (o.kind === 'squash' || o.kind === 'bigfoot') continue;
        const dx = t.pos.x - o.pos.x;
        const dz = t.pos.z - o.pos.z;
        const dist = Math.hypot(dx, dz);
        const minD = t.radius + o.radius;
        if (dist >= minD || dist < 1e-4) continue;
        const push = (minD - dist) * (o.pushable ? 0.5 : 1);
        t.pos.x += (dx / dist) * push;
        t.pos.z += (dz / dist) * push;
        if (o.pushable) {
          o.pos.x -= (dx / dist) * push;
          o.pos.z -= (dz / dist) * push;
        }
      }
      const lim = this.bounds - t.radius;
      t.pos.x = THREE.MathUtils.clamp(t.pos.x, -lim, lim);
      t.pos.z = THREE.MathUtils.clamp(t.pos.z, -lim, lim);
    }
  }

  /** Things that Bob spat (or dropped when squashed) fly through the air until they land. */
  private updateThrown(dt: number): void {
    for (const t of this.things) {
      if (!t.thrown || t.dead) continue;
      t.vel.y -= GRAVITY * dt;
      t.pos.addScaledVector(t.vel, dt);
      const lim = this.bounds - t.radius;
      if (Math.abs(t.pos.x) > lim) t.vel.x *= -0.5;
      if (Math.abs(t.pos.z) > lim) t.vel.z *= -0.5;
      t.pos.x = THREE.MathUtils.clamp(t.pos.x, -lim, lim);
      t.pos.z = THREE.MathUtils.clamp(t.pos.z, -lim, lim);
      const fast = Math.hypot(t.vel.x, t.vel.z) > 6;

      for (const o of this.things) {
        if (o === t || o.dead || o.beingEaten || o.thrown) continue;
        const dx = t.pos.x - o.pos.x;
        const dz = t.pos.z - o.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > o.radius + t.radius || t.pos.y > o.top || t.pos.y + t.height < o.pos.y) continue;
        if (fast && o.hitBySpit(this)) {
          sfx.boing();
          this.sparkle(t.pos, 0xffee58, 14);
          t.vel.set(-t.vel.x * 0.2, 4, -t.vel.z * 0.2);
          break;
        }
        if (!o.solid || d < 1e-4) continue;
        const nx = dx / d;
        const nz = dz / d;
        const into = t.vel.x * nx + t.vel.z * nz;
        if (into >= 0) continue;
        if (o.pushable) {
          o.vel.x -= nx * into * 0.4;
          o.vel.z -= nz * into * 0.4;
          sfx.thud();
        }
        t.vel.x -= nx * into * 1.3;
        t.vel.z -= nz * into * 1.3;
        break;
      }

      if (t.pos.y <= 0 && t.vel.y < 0) {
        t.pos.y = 0;
        t.vel.set(0, 0, 0);
        t.thrown = false;
      }
    }
  }

  // ---------- Eating ----------

  private trySwallow(announce: boolean): void {
    const b = this.bob;
    const r = b.radius;
    const reach = r * 1.6 + 0.4;
    const fx = Math.sin(b.facing);
    const fz = Math.cos(b.facing);
    const centerY = b.pos.y + r * 0.8;
    let best: Thing | null = null;
    let bestScore = Infinity;
    let tooBig: Thing | null = null;
    let tooBigScore = Infinity;

    for (const t of this.things) {
      if (!t.edible || t.dead || t.beingEaten || t.thrown) continue;
      const dx = t.pos.x - b.pos.x;
      const dz = t.pos.z - b.pos.z;
      const flat = Math.hypot(dx, dz);
      const dist = flat - t.radius;
      if (dist > reach) continue;
      const dy = t.pos.y + t.height / 2 - centerY;
      if (Math.abs(dy) > r + t.height / 2 + 0.5) continue;
      const facingDot = flat > 1e-3 ? (dx * fx + dz * fz) / flat : 1;
      if (facingDot < -0.2 && dist > r * 0.3) continue;
      const score = dist - facingDot * r * 0.5;
      if (t.size < r * 0.85) {
        if (score < bestScore) {
          best = t;
          bestScore = score;
        }
      } else if (score < tooBigScore) {
        tooBig = t;
        tooBigScore = score;
      }
    }

    if (best) {
      best.beingEaten = true;
      this.eating.push({ thing: best, t: 0, from: best.pos.clone() });
      b.gulpTimer = 0.25;
    } else if (announce) {
      b.gulpTimer = 0.15;
      if (tooBig) {
        sfx.tooBig();
        this.bobSay(pick(["Too big! 😅", "Won't fit!", 'Need to be bigger...', 'Mmmph! Nope.']));
      } else {
        sfx.chomp();
      }
    }
  }

  private updateEating(dt: number): void {
    const b = this.bob;
    const r = b.radius;
    const mouth = new THREE.Vector3(
      b.pos.x + Math.sin(b.facing) * r * 0.8,
      b.pos.y + r * 0.7,
      b.pos.z + Math.cos(b.facing) * r * 0.8,
    );
    for (const e of this.eating) {
      e.t += dt / EAT_TIME;
      const k = Math.min(1, e.t);
      e.thing.group.position.lerpVectors(e.from, mouth, k * k);
      e.thing.group.scale.setScalar(Math.max(0.05, 1 - k * 0.9));
      if (e.t >= 1) this.finishEating(e.thing);
    }
    this.eating = this.eating.filter((e) => e.t < 1);
  }

  private finishEating(t: Thing): void {
    const b = this.bob;
    const gain = t.size ** 3 * 1.5 * t.growth + 0.01;
    // Bob can't grow past "big enough" — the only way forward is the goal treat.
    b.volume = Math.min(b.volume + gain, this.level.targetRadius ** 3);
    b.stomach.push({ thing: t, gain });
    b.color.lerp(t.color, 0.12);
    t.dead = true;
    t.beingEaten = false;
    sfx.gulp();
    b.gulpTimer = 0.2;
    b.landSquish = 0.5;

    if (t.isGoal) {
      this.startGrowing();
      return;
    }

    if (t.kind === 'squash') this.bobSay(pick(['Squash is a snack now! 😋', 'Revenge is tasty!']));
    else if (t.kind === 'bug') this.bobSay(pick(['Crunchy bug!', 'Sorry ladybug!']));
    else if (t.kind === 'rock' && Math.random() < 0.4) this.bobSay(pick(['Crunchy!', 'Rocks are good for you!']));
    else if (t.kind === 'log') this.bobSay('Log snack! 🪵');
    else if (t.growth >= 5) this.bobSay('✨ GOLDEN! ✨');
  }

  private spit(): void {
    const b = this.bob;
    const s = b.stomach.pop();
    if (!s) {
      this.bobSay('My tummy is empty!');
      return;
    }
    b.volume = Math.max(this.startVolume, b.volume - s.gain);
    const r = b.radius;
    const fx = Math.sin(b.facing);
    const fz = Math.cos(b.facing);
    const t = s.thing;
    this.reviveThing(t);
    t.pos.set(b.pos.x + fx * (r + t.radius + 0.1), b.pos.y + r * 0.6, b.pos.z + fz * (r + t.radius + 0.1));
    const sp = 11 + r * 3;
    t.vel.set(fx * sp, 3.5, fz * sp);
    t.onSpat();
    this.add(t);
    sfx.spit();
    b.gulpTimer = 0.15;
  }

  private reviveThing(t: Thing): void {
    t.dead = false;
    t.beingEaten = false;
    t.thrown = true;
    t.group.scale.setScalar(1);
  }

  /** Bob loses some of what he ate — it goes flying out of him. */
  private dropStuff(n: number): void {
    const b = this.bob;
    const r = b.radius;
    for (let i = 0; i < n; i++) {
      const s = b.stomach.pop();
      if (!s) break;
      b.volume = Math.max(this.startVolume, b.volume - s.gain);
      const t = s.thing;
      this.reviveThing(t);
      const a = rand(0, Math.PI * 2);
      const sp = rand(2, 4);
      t.pos.set(b.pos.x, b.pos.y + r, b.pos.z);
      t.vel.set(Math.cos(a) * sp, rand(5, 8), Math.sin(a) * sp);
      t.onSpat();
      this.add(t);
    }
  }

  private cleanup(): void {
    if (!this.things.some((t) => t.dead)) return;
    for (const t of this.things) if (t.dead) t.group.removeFromParent();
    this.things = this.things.filter((t) => !t.dead);
  }

  // ---------- Ouch ----------

  squashBob(text: string): void {
    const b = this.bob;
    if (b.invuln > 0 || b.squashTimer > 0 || this.state !== 'play') return;
    b.squashTimer = 1.4;
    b.vel.set(0, 0, 0);
    sfx.splat();
    this.shake = Math.max(this.shake, 0.4);
    this.bobSay(text);
    this.dropStuff(4);
  }

  hurtBob(from: THREE.Vector3, text: string): void {
    const b = this.bob;
    if (b.invuln > 0 || b.squashTimer > 0 || this.state !== 'play') return;
    b.hearts--;
    b.invuln = 1.5;
    sfx.hurt();
    this.shake = Math.max(this.shake, 0.2);
    const dx = b.pos.x - from.x;
    const dz = b.pos.z - from.z;
    const d = Math.hypot(dx, dz) || 1;
    b.vel.set((dx / d) * 7, 5, (dz / d) * 7);
    b.grounded = false;
    if (b.hearts <= 0) this.popBob();
    else this.bobSay(text);
  }

  private popBob(): void {
    const b = this.bob;
    sfx.pop();
    this.sparkle(b.pos.clone().setY(b.pos.y + b.radius), b.color.getHex(), 30, 2);
    this.dropStuff(Math.ceil(b.stomach.length / 2));
    b.pos.set(this.level.start[0], 0, this.level.start[1]);
    b.vel.set(0, 0, 0);
    b.hearts = b.maxHearts;
    b.invuln = 2.5;
    this.bobSay('POP! 💥 ...Bob is back!');
  }

  healBob(): boolean {
    const b = this.bob;
    if (b.hearts >= b.maxHearts) return false;
    b.hearts++;
    sfx.heal();
    this.sparkle(b.pos.clone().setY(b.pos.y + b.radius), 0xff8fc7, 16);
    return true;
  }

  onSquashLand(sq: Squash): void {
    const b = this.bob;
    const d = Math.hypot(b.pos.x - sq.pos.x, b.pos.z - sq.pos.z);
    if (d < 14) sfx.thud();
    if (d < 6) this.shake = Math.max(this.shake, 0.12 * sq.size);
    if (d < sq.radius * 0.9 + b.radius * 0.6 && b.pos.y < sq.height * 0.5) {
      if (b.radius < sq.size * 1.1) {
        this.squashBob(pick(['SPLAT! 🥞', 'Squashed by a squash!', 'Pancake Bob! 🥞']));
      } else {
        b.vel.y = 5;
        this.bobSay('Boing! Ha, too small!');
      }
    }
  }

  onConeLand(cone: FallingCone): void {
    const b = this.bob;
    const d = Math.hypot(b.pos.x - cone.pos.x, b.pos.z - cone.pos.z);
    if (d < 14) sfx.thud();
    if (d < cone.radius + b.radius * 0.8 && b.pos.y < cone.radius * 2) {
      if (b.radius > cone.size * 1.5) this.bobSay('Boink! Didn’t even hurt.');
      else this.hurtBob(cone.pos, pick(['Bonk! Pinecone! 🌲', 'Ow, my head!']));
    }
  }

  onBigfootStomp(bf: Bigfoot): void {
    const b = this.bob;
    sfx.stomp();
    this.shake = Math.max(this.shake, 0.8);
    this.sparkle(bf.pos.clone().setY(0.2), 0x8d6e4a, 24, 2.5);
    const d = Math.hypot(b.pos.x - bf.pos.x, b.pos.z - bf.pos.z);
    if (d < bf.radius + b.radius * 0.6 + 0.4 && b.pos.y < 1 && b.radius < bf.size * 0.8) {
      this.squashBob('BIGFOOT STOMP! 🦶🥞');
    }
  }

  // ---------- Level up ----------

  private startGrowing(): void {
    this.state = 'growing';
    this.growTimer = 0;
    this.bob.vel.set(0, 0, 0);
    this.bob.invuln = 0;
    sfx.levelUp();
    this.ui.big('BOB IS GETTING<br>BIGGER!!', 2.6);
  }

  private updateGrowing(dt: number): void {
    this.growTimer += dt;
    const k = Math.min(1, this.growTimer / 2.2);
    this.bob.visualBoost = 1 + (1 - Math.cos(k * Math.PI)) * 1.2 + Math.sin(this.growTimer * 25) * 0.05 * k;
    this.ui.setFade(THREE.MathUtils.clamp((this.growTimer - 2.2) / 0.6, 0, 1));
    if (this.growTimer < 2.9) return;
    if (this.levelIndex + 1 < LEVELS.length) {
      this.loadLevel(this.levelIndex + 1);
      this.announceLevel();
      this.state = 'play';
    } else {
      this.state = 'done';
      this.ui.showFinale();
    }
    this.ui.setFade(0);
  }

  // ---------- Effects, speech, camera ----------

  sparkle(pos: THREE.Vector3, color: number, n = 12, spread = 1): void {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true });
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.sparkGeo, material);
      m.position.copy(pos);
      m.scale.setScalar(spread * rand(0.8, 1.6));
      const vel = new THREE.Vector3(rand(-3, 3), rand(2, 6), rand(-3, 3)).multiplyScalar(spread);
      this.levelRoot.add(m);
      this.particles.push({ mesh: m, vel, ttl: 0.8 });
    }
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      p.ttl -= dt;
      p.vel.y -= 12 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.scale.multiplyScalar(1 - dt * 2);
      if (p.ttl <= 0) p.mesh.removeFromParent();
    }
    this.particles = this.particles.filter((p) => p.ttl > 0);
  }

  bobSay(text: string): void {
    const b = this.bob;
    this.ui.say(b, () => b.pos.clone().setY(b.pos.y + b.radius * b.visualBoost * 1.9 + 0.2), text, 1.8, 'bob');
  }

  thingSay(t: Thing, text: string): void {
    this.ui.say(t, () => t.pos.clone().setY(t.pos.y + t.height + 0.3), text, 2, 'grumpy');
  }

  private updateCamera(dt: number, snap = false): void {
    const b = this.bob;
    const r = b.radius * b.visualBoost;
    const zoom = 0.55 + r * 0.9;
    const look = new THREE.Vector3(b.pos.x, b.pos.y * 0.5 + r * 0.6, b.pos.z - 1);
    const desired = look.clone().add(new THREE.Vector3(0, 8.5 * zoom, 7.5 * zoom));
    const k = snap ? 1 : 1 - Math.exp(-4 * dt);
    this.camera.position.lerp(desired, k);
    this.camLook.lerp(look, k);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const s = this.shake * 0.6 * zoom;
      this.camera.position.add(new THREE.Vector3(rand(-s, s), rand(-s, s), rand(-s, s)));
    }
    this.camera.lookAt(this.camLook);

    const fog = this.scene.fog as THREE.Fog | null;
    if (fog) {
      fog.near = this.level.fogNear * zoom;
      fog.far = this.level.fogFar * zoom;
    }
    this.sun.position.set(b.pos.x + 10 * zoom, 20 * zoom, b.pos.z + 8 * zoom);
    this.sun.target.position.set(b.pos.x, 0, b.pos.z);
    const sc = this.sun.shadow.camera;
    const extent = 22 * zoom;
    if (sc.right !== extent) {
      sc.left = -extent;
      sc.right = extent;
      sc.top = extent;
      sc.bottom = -extent;
      sc.far = 80 * zoom;
      sc.updateProjectionMatrix();
    }
  }

  /** Tall scenery between the camera and Bob turns see-through so you never lose him. */
  private updateFades(dt: number): void {
    const b = this.bob;
    for (const t of this.things) {
      if (!t.fadeable) continue;
      const dz = t.pos.z - b.pos.z;
      const dx = Math.abs(t.pos.x - b.pos.x);
      const blocking = dz > 0 && dz < t.height * 0.9 + 1 && dx < t.visualRadius + b.radius + 0.5;
      const target = blocking ? 0.3 : 1;
      if (t.fade === target) continue;
      t.fade += (target - t.fade) * Math.min(1, dt * 8);
      if (Math.abs(t.fade - target) < 0.02) t.fade = target;
      const transparent = t.fade < 1;
      t.group.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (m.transparent !== transparent) {
            m.transparent = transparent;
            m.depthWrite = !transparent;
            m.needsUpdate = true;
          }
          m.opacity = t.fade;
        }
      });
    }
  }
}
