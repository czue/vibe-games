import * as THREE from 'three';
import type { Game } from './game';
import {
  mat,
  rand,
  pick,
  makeAcorn,
  makeBerry,
  makeBush,
  makeGiantMushroom,
  makeGoldenBerry,
  makeGrassClump,
  makeMushroom,
  makePebble,
  makePineTree,
  makeRock,
  makeSeed,
  makeStump,
  makeTrunk,
} from './things';
import { Bigfoot, FallingCone, FlowerVine, Ladybug, RollingLog, Squash, ThornVine } from './enemies';

export interface LevelDef {
  name: string;
  subtitle: string;
  bounds: number;
  start: [number, number];
  startRadius: number;
  targetRadius: number;
  sky: number;
  fogNear: number;
  fogFar: number;
  sizeNames: string[];
  build(game: Game): void;
  tick(game: Game, dt: number): void;
}

const BERRY_COLORS = [0xe53935, 0x3949ab, 0x8e24aa, 0xff6f91];
const CAP_COLORS = [0xe53935, 0xff7043, 0xf4b400];

/** A random spot that isn't inside anything solid. */
function freeSpot(game: Game, r: number): [number, number] {
  const lim = game.bounds - 1.5;
  for (let tries = 0; tries < 40; tries++) {
    const x = rand(-lim, lim);
    const z = rand(-lim, lim);
    const blocked = game.things.some((t) => t.solid && Math.hypot(t.pos.x - x, t.pos.z - z) < t.radius + r + 0.4);
    if (!blocked) return [x, z];
  }
  return [rand(-lim, lim), rand(-lim, lim)];
}

function addGround(game: Game, color: number, patchColor: number, tuftColor: number): void {
  const b = game.bounds;
  const size = b * 2 + 80;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ color, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  game.levelRoot.add(ground);

  const patchMat = new THREE.MeshStandardMaterial({ color: patchColor, roughness: 1 });
  for (let i = 0; i < 16; i++) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(rand(1.5, 4), 20), patchMat);
    p.rotation.x = -Math.PI / 2;
    p.position.set(rand(-b, b), 0.01 + i * 0.001, rand(-b, b));
    p.scale.x = rand(0.7, 1.6);
    p.receiveShadow = true;
    game.levelRoot.add(p);
  }

  const count = 900;
  const tufts = new THREE.InstancedMesh(new THREE.ConeGeometry(0.06, 0.35, 3), mat(tuftColor), count);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (let i = 0; i < count; i++) {
    q.setFromEuler(e.set(rand(-0.3, 0.3), rand(0, 6), rand(-0.3, 0.3)));
    m4.compose(new THREE.Vector3(rand(-b - 6, b + 6), 0.15, rand(-b - 6, b + 6)), q, new THREE.Vector3(1, rand(0.6, 1.6), 1));
    tufts.setMatrixAt(i, m4);
  }
  tufts.receiveShadow = true;
  game.levelRoot.add(tufts);
}

function addLane(game: Game, z: number, width: number): void {
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(game.bounds * 2 + 4, width),
    new THREE.MeshStandardMaterial({ color: 0x8b6b43, roughness: 1 }),
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(0, 0.03, z);
  strip.receiveShadow = true;
  game.levelRoot.add(strip);
}

function ringOfRocks(game: Game, cx: number, cz: number, ringR: number, rockR: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    game.add(makeRock(cx + Math.cos(a) * ringR, cz + Math.sin(a) * ringR, rockR));
  }
}

function countSmallFood(game: Game, maxSize: number): number {
  return game.things.filter((t) => t.kind === 'food' && t.size <= maxSize).length;
}

// =====================================================================
// Level 1: tiny Bob on the forest floor
// =====================================================================

const L1_LANE_Z = -1;
let l1ConeTimer = 0;
let l1LogTimer = 0;
let l1FoodTimer = 0;

const level1: LevelDef = {
  name: 'The Forest Floor',
  subtitle: 'Bob is tiny. Everything else is HUGE.',
  bounds: 22,
  start: [0, 17],
  startRadius: 0.5,
  targetRadius: 1.4,
  sky: 0x9fd8ff,
  fogNear: 30,
  fogFar: 75,
  sizeNames: ['an ant', 'a ladybug', 'a grape', 'a strawberry', 'a plum', 'a lemon', 'an apple'],

  build(game) {
    l1ConeTimer = 6;
    l1LogTimer = 2;
    l1FoodTimer = 0;
    const B = this.bounds;
    addGround(game, 0x78b856, 0x8b6b43, 0x9ccc65);
    addLane(game, L1_LANE_Z, 3.2);

    // Border: giant grass at the back and sides, low rocks along the front so the camera can see.
    for (let x = -B - 1; x <= B + 1; x += 1.6) game.add(makeGrassClump(x, -B - 1, rand(6, 10), 1));
    for (let z = -B; z <= B - 6; z += 1.8) {
      game.add(makeGrassClump(-B - 1, z, rand(4, 7), 1));
      game.add(makeGrassClump(B + 1, z, rand(4, 7), 1));
    }
    for (let x = -B; x <= B; x += 1.7) game.add(makeRock(x, B + 1, rand(0.6, 0.9), false));
    for (const side of [-1, 1]) for (let z = B - 6; z <= B; z += 1.7) game.add(makeRock(side * (B + 1), z, rand(0.6, 0.9), false));

    // Big scenery
    game.add(makeTrunk(-13, -16, 3.2, 16));
    game.add(makePineTree(13, -18, 3.5));
    game.add(makePineTree(19, -13, 3));
    game.add(makeGiantMushroom(-18, -6, 2.6, 4.5, 0xe53935, false));
    for (const [x, z, h] of [
      [-6, -7, 5],
      [8, -7, 6],
      [-15, 5, 5],
      [4, 12, 4],
      [-8, 14, 4],
      [17, 16, 4],
    ]) {
      game.add(makeGrassClump(x, z, h, 1.2));
    }

    // Mushroom stairs with golden berries on top
    game.add(makeGiantMushroom(6, 7, 1.4, 0.9, 0xff7043, true));
    game.add(makeGiantMushroom(9, 4.8, 1.2, 2.0, 0xf4b400, true));
    const top = game.add(makeGiantMushroom(12.6, 6.4, 1.4, 3.0, 0xe53935, true));
    game.add(makeGoldenBerry(12.3, 6.2, 0.3, top.top));
    game.add(makeGoldenBerry(13.0, 6.8, 0.3, top.top));

    // Golden berry stash hidden inside a ring of rocks — push them out of the way!
    ringOfRocks(game, -15, 11, 1.9, 0.85, 6);
    game.add(makeGoldenBerry(-15.4, 11, 0.3));
    game.add(makeGoldenBerry(-14.6, 10.6, 0.3));
    game.add(makeGoldenBerry(-14.9, 11.6, 0.3));

    // Loose rocks to push around (and eventually eat)
    for (const [x, z, r] of [
      [2, 5, 1.1],
      [-3, 8, 0.9],
      [15, 11, 1.0],
      [-10, -13, 1.2],
    ]) {
      game.add(makeRock(x, z, r));
    }

    // Log stump — logs roll out of it along the dirt lane
    game.add(makeStump(-B - 0.5, L1_LANE_Z, 1.6, 1.4));

    // Vines
    for (const [x, z] of [
      [3, -10],
      [-10, -6],
      [14, -10],
      [-4, 11],
      [18, 9],
    ]) {
      game.add(new ThornVine(x, z, 1.3));
    }
    for (const [x, z] of [
      [3, 14],
      [-16, -9],
      [18, -5],
    ]) {
      game.add(new FlowerVine(x, z, 1.3));
    }

    // Squashes!
    game.add(new Squash(8, -13, 1.4, 8));
    game.add(new Squash(-4, -15, 1.4, 8));

    // Food
    for (let i = 0; i < 25; i++) game.add(makeSeed(...freeSpot(game, 0.2), rand(0.12, 0.18)));
    for (let c = 0; c < 9; c++) {
      const [cx, cz] = freeSpot(game, 1.4);
      const color = pick(BERRY_COLORS);
      for (let i = 0; i < 5; i++) game.add(makeBerry(cx + rand(-1.2, 1.2), cz + rand(-1.2, 1.2), rand(0.2, 0.28), color));
    }
    for (let i = 0; i < 10; i++) game.add(makePebble(...freeSpot(game, 0.4), rand(0.3, 0.4)));
    for (let i = 0; i < 8; i++) {
      const a = rand(0, Math.PI * 2);
      const d = rand(4.5, 6.5);
      game.add(makeAcorn(-13 + Math.cos(a) * d, Math.min(B - 1, -16 + Math.sin(a) * d + 2), rand(0.42, 0.5)));
    }
    for (let i = 0; i < 6; i++) game.add(makeMushroom(...freeSpot(game, 0.7), rand(0.5, 0.65), pick(CAP_COLORS)));
    for (let i = 0; i < 6; i++) game.add(new Ladybug(...freeSpot(game, 0.3), 0.25));
  },

  tick(game, dt) {
    l1LogTimer -= dt;
    if (l1LogTimer <= 0) {
      l1LogTimer = rand(4, 5.5);
      game.add(new RollingLog(-this.bounds + 1.5, L1_LANE_Z, new THREE.Vector3(1, 0, 0), 0.45, 3, 4.5));
    }

    l1ConeTimer -= dt;
    if (l1ConeTimer <= 0) {
      l1ConeTimer = rand(3.5, 6);
      const landed = game.things.filter((t) => t.kind === 'pinecone').length;
      if (landed < 12) {
        const a = rand(0, Math.PI * 2);
        const d = rand(0, 2.5);
        const lim = this.bounds - 1;
        const x = THREE.MathUtils.clamp(game.bob.pos.x + Math.cos(a) * d, -lim, lim);
        const z = THREE.MathUtils.clamp(game.bob.pos.z + Math.sin(a) * d, -lim, lim);
        game.add(new FallingCone(x, z, 0.55));
      }
    }

    l1FoodTimer -= dt;
    if (l1FoodTimer <= 0) {
      l1FoodTimer = 1.2;
      if (countSmallFood(game, 0.35) < 30) {
        const [x, z] = freeSpot(game, 0.3);
        if (Math.hypot(x - game.bob.pos.x, z - game.bob.pos.z) > 6) {
          game.add(Math.random() < 0.6 ? makeBerry(x, z, rand(0.2, 0.28), pick(BERRY_COLORS)) : makeSeed(x, z, 0.15));
        }
      }
    }
  },
};

// =====================================================================
// Level 2: rabbit-sized Bob in the big woods
// =====================================================================

const L2_LANE_Z = 3;
let l2ConeTimer = 0;
let l2LogTimer = 0;
let l2FoodTimer = 0;

const level2: LevelDef = {
  name: 'The Big Woods',
  subtitle: 'Now the squashes look like snacks...',
  bounds: 24,
  start: [0, 19],
  startRadius: 0.5,
  targetRadius: 1.6,
  sky: 0x8fcbe8,
  fogNear: 30,
  fogFar: 80,
  sizeNames: ['a bunny', 'a cat', 'a dog', 'a pony', 'a hippo', 'a car', 'a HOUSE'],

  build(game) {
    l2ConeTimer = 5;
    l2LogTimer = 2;
    l2FoodTimer = 0;
    const B = this.bounds;
    addGround(game, 0x5e9e48, 0x7a5c3a, 0x7cb342);
    addLane(game, L2_LANE_Z, 2.4);

    // Border: a wall of pine trees, with bushes and rocks along the front
    for (let x = -B - 1; x <= B + 1; x += 2.2) game.add(makePineTree(x + rand(-0.4, 0.4), -B - 1.5, rand(1.2, 1.6)));
    for (let z = -B; z <= B - 6; z += 2.5) {
      game.add(makePineTree(-B - 1.5, z, rand(1.0, 1.3)));
      game.add(makePineTree(B + 1.5, z, rand(1.0, 1.3)));
    }
    for (let x = -B; x <= B; x += 1.8) game.add(makeRock(x, B + 1, rand(0.6, 0.9), false));
    for (const side of [-1, 1]) for (let z = B - 6; z <= B; z += 1.7) game.add(makeRock(side * (B + 1), z, rand(0.6, 0.9), false));

    // Groves inside the woods
    for (const [gx, gz] of [
      [-10, -9],
      [11, -11],
      [-15, 12],
      [13, 13],
      [2, -18],
    ]) {
      for (let i = 0; i < 3; i++) game.add(makePineTree(gx + rand(-2.5, 2.5), gz + rand(-2, 2), rand(1.0, 1.4)));
    }

    game.add(makeStump(-B - 0.5, L2_LANE_Z, 1.1, 1.0));

    // Golden stash in a ring of rocks
    ringOfRocks(game, 17, -3, 1.6, 0.7, 6);
    game.add(makeGoldenBerry(16.7, -3, 0.25));
    game.add(makeGoldenBerry(17.3, -3.3, 0.25));
    game.add(makeGoldenBerry(17.1, -2.5, 0.25));

    for (let i = 0; i < 8; i++) game.add(makeRock(...freeSpot(game, 1.2), rand(0.6, 1.2)));

    for (const [x, z] of [
      [-5, -4],
      [7, -3],
      [-12, 2],
      [5, 11],
    ]) {
      game.add(new ThornVine(x, z, 0.8));
    }
    for (const [x, z] of [
      [-3, 15],
      [15, 6],
      [-17, -3],
    ]) {
      game.add(new FlowerVine(x, z, 0.8));
    }

    for (let i = 0; i < 5; i++) game.add(new Squash(...freeSpot(game, 0.8), 0.5, 7));
    game.add(new Bigfoot(0, -12, 1));

    for (let i = 0; i < 14; i++) game.add(makeBush(...freeSpot(game, 0.7), rand(0.35, 0.65)));
    for (let i = 0; i < 16; i++) game.add(makeMushroom(...freeSpot(game, 0.3), rand(0.15, 0.3), pick(CAP_COLORS)));
    for (let i = 0; i < 10; i++) game.add(makePebble(...freeSpot(game, 0.3), rand(0.2, 0.3)));
    for (let i = 0; i < 10; i++) game.add(new FallingCone(...freeSpot(game, 0.3), 0.22, true));
    for (let i = 0; i < 12; i++) game.add(makeBerry(...freeSpot(game, 0.2), 0.14, pick(BERRY_COLORS)));
  },

  tick(game, dt) {
    l2LogTimer -= dt;
    if (l2LogTimer <= 0) {
      l2LogTimer = rand(3.5, 5);
      game.add(new RollingLog(-this.bounds + 1.2, L2_LANE_Z, new THREE.Vector3(1, 0, 0), 0.3, 1.6, 5));
    }

    l2ConeTimer -= dt;
    if (l2ConeTimer <= 0) {
      l2ConeTimer = rand(4, 6.5);
      if (game.things.filter((t) => t.kind === 'pinecone').length < 16) {
        const a = rand(0, Math.PI * 2);
        const d = rand(0, 2);
        const lim = this.bounds - 1;
        const x = THREE.MathUtils.clamp(game.bob.pos.x + Math.cos(a) * d, -lim, lim);
        const z = THREE.MathUtils.clamp(game.bob.pos.z + Math.sin(a) * d, -lim, lim);
        game.add(new FallingCone(x, z, 0.22));
      }
    }

    l2FoodTimer -= dt;
    if (l2FoodTimer <= 0) {
      l2FoodTimer = 1.5;
      if (countSmallFood(game, 0.7) < 35) {
        const [x, z] = freeSpot(game, 0.6);
        if (Math.hypot(x - game.bob.pos.x, z - game.bob.pos.z) > 8) {
          game.add(Math.random() < 0.5 ? makeBush(x, z, rand(0.35, 0.6)) : makeMushroom(x, z, rand(0.15, 0.3), pick(CAP_COLORS)));
        }
      }
    }
  },
};

export const LEVELS: LevelDef[] = [level1, level2];
