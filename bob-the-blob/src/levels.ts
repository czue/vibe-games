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
import { Bigfoot, FallingCone, FlowerVine, GoalTreat, Ladybug, RollingLog, Squash, ThornVine } from './enemies';

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
  goalName: string;
  laneZs: number[]; // z of each log lane, so random stuff doesn't get dropped on them
  build(game: Game): void;
  tick(game: Game, dt: number): void;
}

const BERRY_COLORS = [0xe53935, 0x3949ab, 0x8e24aa, 0xff6f91];
const CAP_COLORS = [0xe53935, 0xff7043, 0xf4b400];

/** A random spot that isn't inside anything solid (or on a log lane). */
function freeSpot(game: Game, r: number): [number, number] {
  const lim = game.bounds - 1.5;
  for (let tries = 0; tries < 40; tries++) {
    const x = rand(-lim, lim);
    const z = rand(-lim, lim);
    if (game.level.laneZs.some((lz) => Math.abs(lz - z) < 2 + r)) continue;
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

// ---------- Log lanes ----------

interface Lane {
  z: number;
  dir: 1 | -1;
  speed: number;
  every: [number, number];
  logR: number;
  length: number;
  timer: number;
}

function addLanes(game: Game, lanes: Lane[], stumpR: number, stumpH: number): void {
  const B = game.bounds;
  for (const lane of lanes) {
    addLane(game, lane.z, lane.length + 0.4);
    game.add(makeStump(-lane.dir * (B + 0.5), lane.z, stumpR, stumpH, lane.dir));
  }
}

function tickLanes(game: Game, lanes: Lane[], dt: number): void {
  const B = game.bounds;
  for (const lane of lanes) {
    lane.timer -= dt;
    if (lane.timer > 0) continue;
    lane.timer = rand(...lane.every);
    game.add(
      new RollingLog(-lane.dir * (B - 1.5), lane.z, new THREE.Vector3(lane.dir, 0, 0), lane.logR, lane.length, lane.speed),
    );
  }
}

function dropCone(game: Game, size: number, spread: number): void {
  const a = rand(0, Math.PI * 2);
  const d = rand(0, spread);
  const lim = game.bounds - 1;
  const x = THREE.MathUtils.clamp(game.bob.pos.x + Math.cos(a) * d, -lim, lim);
  const z = THREE.MathUtils.clamp(game.bob.pos.z + Math.sin(a) * d, -lim, lim);
  game.add(new FallingCone(x, z, size));
}

/**
 * The goal treat sits on a tall stump. You can only get up there by jumping
 * step -> step -> top, and the steps are too tall to reach until Bob has grown.
 */
function buildGoalTower(
  game: Game,
  top: [number, number, number, number], // x, z, radius, height
  steps: [number, number, number, number][],
  goal: (y: number) => GoalTreat,
): void {
  for (const [x, z, r, h] of steps) game.add(makeStump(x, z, r, h, 0));
  const [x, z, r, h] = top;
  const tower = game.add(makeStump(x, z, r, h, 0));
  tower.fadeable = false;
  game.add(goal(tower.top));
}

// =====================================================================
// Level 1: tiny Bob on the forest floor
// =====================================================================

let l1Lanes: Lane[] = [];
let l1ConeTimer = 0;
let l1FoodTimer = 0;

const level1: LevelDef = {
  name: 'The Forest Floor',
  subtitle: 'Bob is tiny. Everything else is HUGE.',
  bounds: 22,
  start: [0, 18],
  startRadius: 0.5,
  targetRadius: 1.4,
  sky: 0x9fd8ff,
  fogNear: 30,
  fogFar: 75,
  sizeNames: ['an ant', 'a ladybug', 'a grape', 'a strawberry', 'a plum', 'a lemon', 'an apple'],
  goalName: 'GIANT STRAWBERRY 🍓',
  laneZs: [9, 1, -7],

  build(game) {
    l1Lanes = [
      { z: 9, dir: 1, speed: 4.5, every: [3.2, 5], logR: 0.45, length: 3, timer: 0.5 },
      { z: 1, dir: -1, speed: 5, every: [3, 4.8], logR: 0.45, length: 3, timer: 1.5 },
      { z: -7, dir: 1, speed: 5.5, every: [2.8, 4.5], logR: 0.5, length: 3.2, timer: 1 },
    ];
    l1ConeTimer = 6;
    l1FoodTimer = 0;
    const B = this.bounds;
    addGround(game, 0x78b856, 0x8b6b43, 0x9ccc65);
    addLanes(game, l1Lanes, 1.6, 1.4);

    // Border: giant grass at the back and sides, low rocks along the front so the camera can see.
    for (let x = -B - 1; x <= B + 1; x += 1.6) game.add(makeGrassClump(x, -B - 1, rand(6, 10), 1));
    for (let z = -B; z <= B - 6; z += 1.8) {
      if (this.laneZs.some((lz) => Math.abs(lz - z) < 2)) continue;
      game.add(makeGrassClump(-B - 1, z, rand(4, 7), 1));
      game.add(makeGrassClump(B + 1, z, rand(4, 7), 1));
    }
    for (let x = -B; x <= B; x += 1.7) game.add(makeRock(x, B + 1, rand(0.6, 0.9), false));
    for (const side of [-1, 1]) for (let z = B - 6; z <= B; z += 1.7) game.add(makeRock(side * (B + 1), z, rand(0.6, 0.9), false));

    // The goal: a Giant Strawberry on top of a tall stump at the back.
    // Max jump at full size is ~3.1, so every hop (2.2, 1.7, 1.6) is needed — no skipping.
    buildGoalTower(
      game,
      [0, -16, 2.2, 5.5],
      [
        [-6.5, -12, 1.4, 2.2],
        [-3.9, -14.6, 1.2, 3.9],
      ],
      (y) => new GoalTreat(0, -16, y, this.targetRadius * 0.85 - 0.02, 'strawberry'),
    );

    // Big scenery
    game.add(makeTrunk(-14, -17, 3.2, 16));
    game.add(makePineTree(13, -18, 3.5));
    game.add(makePineTree(19, -13, 3));
    game.add(makeGiantMushroom(-18, -11, 2.4, 4.5, 0xe53935, false));
    for (const [x, z, h] of [
      [-8, -3, 5],
      [8, -3, 6],
      [-15, 5, 5],
      [15, 5, 5],
      [4, 14, 4],
      [-8, 15, 4],
      [18, 17, 4],
      [10, -12, 5],
    ]) {
      game.add(makeGrassClump(x, z, h, 1.2));
    }

    // Mushroom stairs with golden berries on top
    game.add(makeGiantMushroom(9, 13, 1.4, 0.9, 0xff7043, true));
    game.add(makeGiantMushroom(12, 15.2, 1.2, 2.0, 0xf4b400, true));
    const top = game.add(makeGiantMushroom(15, 13, 1.4, 3.0, 0xe53935, true));
    game.add(makeGoldenBerry(14.7, 12.8, 0.3, top.top));
    game.add(makeGoldenBerry(15.4, 13.4, 0.3, top.top));

    // Golden berry stash hidden inside a ring of rocks — push them out of the way!
    ringOfRocks(game, -15, 15, 1.9, 0.85, 6);
    game.add(makeGoldenBerry(-15.4, 15, 0.3));
    game.add(makeGoldenBerry(-14.6, 14.6, 0.3));
    game.add(makeGoldenBerry(-14.9, 15.6, 0.3));

    // Loose rocks to push around (and eventually eat)
    for (const [x, z, r] of [
      [2, 5, 1.1],
      [-3, -3, 0.9],
      [15, -3, 1.0],
      [7, -15, 1.2],
    ]) {
      game.add(makeRock(x, z, r));
    }

    // Vines
    for (const [x, z] of [
      [3, -11],
      [-10, -3],
      [14, -10],
      [-4, 13],
      [18, 4],
      [-2, 5],
    ]) {
      game.add(new ThornVine(x, z, 1.3));
    }
    for (const [x, z] of [
      [3, 16],
      [-17, -2.5],
      [-18, 4],
    ]) {
      game.add(new FlowerVine(x, z, 1.3));
    }

    // Squashes!
    for (const [x, z] of [
      [-4, -10],
      [10, -16],
      [-12, 4],
    ]) {
      game.add(new Squash(x, z, 1.4, 8));
    }

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
      game.add(makeAcorn(-14 + Math.cos(a) * d, Math.max(-B + 1, -17 + Math.sin(a) * d), rand(0.42, 0.5)));
    }
    for (let i = 0; i < 6; i++) game.add(makeMushroom(...freeSpot(game, 0.7), rand(0.5, 0.65), pick(CAP_COLORS)));
    for (let i = 0; i < 6; i++) game.add(new Ladybug(...freeSpot(game, 0.3), 0.25));
  },

  tick(game, dt) {
    tickLanes(game, l1Lanes, dt);

    l1ConeTimer -= dt;
    if (l1ConeTimer <= 0) {
      l1ConeTimer = rand(2.5, 4.5);
      if (game.things.filter((t) => t.kind === 'pinecone').length < 12) dropCone(game, 0.55, 2.5);
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
// Level 2: bunny-sized Bob in the big woods
// =====================================================================

let l2Lanes: Lane[] = [];
let l2ConeTimer = 0;
let l2FoodTimer = 0;

const level2: LevelDef = {
  name: 'The Big Woods',
  subtitle: 'The little squashes look like snacks now...',
  bounds: 24,
  start: [0, 20],
  startRadius: 0.5,
  targetRadius: 1.6,
  sky: 0x8fcbe8,
  fogNear: 30,
  fogFar: 80,
  sizeNames: ['a bunny', 'a cat', 'a dog', 'a pony', 'a hippo', 'a car', 'a HOUSE'],
  goalName: 'GOLDEN PINECONE ✨',
  laneZs: [11, 3, -5],

  build(game) {
    // Logs here are longer than Bob will ever be big, so they stay dangerous the whole level.
    l2Lanes = [
      { z: 11, dir: 1, speed: 5, every: [3.2, 5], logR: 0.6, length: 3.4, timer: 0.5 },
      { z: 3, dir: -1, speed: 6, every: [3, 4.8], logR: 0.6, length: 3.4, timer: 1.5 },
      { z: -5, dir: 1, speed: 6.5, every: [2.8, 4.5], logR: 0.65, length: 3.6, timer: 1 },
    ];
    l2ConeTimer = 5;
    l2FoodTimer = 0;
    const B = this.bounds;
    addGround(game, 0x5e9e48, 0x7a5c3a, 0x7cb342);
    addLanes(game, l2Lanes, 1.4, 1.5);

    // Border: a wall of pine trees, with rocks along the front
    for (let x = -B - 1; x <= B + 1; x += 2.2) game.add(makePineTree(x + rand(-0.4, 0.4), -B - 1.5, rand(1.2, 1.6)));
    for (let z = -B; z <= B - 6; z += 2.5) {
      if (this.laneZs.some((lz) => Math.abs(lz - z) < 2)) continue;
      game.add(makePineTree(-B - 1.5, z, rand(1.0, 1.3)));
      game.add(makePineTree(B + 1.5, z, rand(1.0, 1.3)));
    }
    for (let x = -B; x <= B; x += 1.8) game.add(makeRock(x, B + 1, rand(0.6, 0.9), false));
    for (const side of [-1, 1]) for (let z = B - 6; z <= B; z += 1.7) game.add(makeRock(side * (B + 1), z, rand(0.6, 0.9), false));

    // The goal: a Golden Pinecone on a tall stump. Max jump at full size is ~3.4,
    // and the hops are 2.6, 2.0, 1.6 — step 1 needs Bob to be at least dog-sized.
    buildGoalTower(
      game,
      [0, -17, 2.4, 6.2],
      [
        [-6.8, -12.5, 1.5, 2.6],
        [-4.2, -15.2, 1.3, 4.6],
      ],
      (y) => new GoalTreat(0, -17, y, this.targetRadius * 0.85 - 0.02, 'pinecone'),
    );

    // Groves inside the woods
    for (const [gx, gz] of [
      [-12, 7],
      [12, -1],
      [-15, 17],
      [14, 17],
      [13, -15],
      [-15, -17],
    ]) {
      for (let i = 0; i < 3; i++) game.add(makePineTree(gx + rand(-2.5, 2.5), gz + rand(-1.5, 1.5), rand(1.0, 1.4)));
    }

    // Golden stash in a ring of rocks
    ringOfRocks(game, 17, 7, 1.6, 0.7, 6);
    game.add(makeGoldenBerry(16.7, 7, 0.25));
    game.add(makeGoldenBerry(17.3, 6.7, 0.25));
    game.add(makeGoldenBerry(17.1, 7.5, 0.25));

    for (let i = 0; i < 8; i++) game.add(makeRock(...freeSpot(game, 1.2), rand(0.6, 1.2)));

    for (const [x, z] of [
      [-5, -1],
      [7, 7],
      [-12, -9],
      [5, 16],
      [4, -12],
    ]) {
      game.add(new ThornVine(x, z, 0.8));
    }
    for (const [x, z] of [
      [-3, 16],
      [19, -1],
      [-19, 0],
    ]) {
      game.add(new FlowerVine(x, z, 0.8));
    }

    // Little snack squashes, plus medium ones that can still flatten Bob until he's grown.
    for (let i = 0; i < 5; i++) game.add(new Squash(...freeSpot(game, 0.8), 0.5, 8));
    for (const [x, z] of [
      [-8, 7],
      [-3, -10],
    ]) {
      game.add(new Squash(x, z, 1.2, 8));
    }
    game.add(new Bigfoot(6, -12, 1));

    for (let i = 0; i < 14; i++) game.add(makeBush(...freeSpot(game, 0.7), rand(0.35, 0.65)));
    for (let i = 0; i < 16; i++) game.add(makeMushroom(...freeSpot(game, 0.3), rand(0.15, 0.3), pick(CAP_COLORS)));
    for (let i = 0; i < 10; i++) game.add(makePebble(...freeSpot(game, 0.3), rand(0.2, 0.3)));
    for (let i = 0; i < 10; i++) game.add(new FallingCone(...freeSpot(game, 0.3), 0.22, true));
    for (let i = 0; i < 12; i++) game.add(makeBerry(...freeSpot(game, 0.2), 0.14, pick(BERRY_COLORS)));
  },

  tick(game, dt) {
    tickLanes(game, l2Lanes, dt);

    l2ConeTimer -= dt;
    if (l2ConeTimer <= 0) {
      l2ConeTimer = rand(3, 5);
      if (game.things.filter((t) => t.kind === 'pinecone').length < 16) dropCone(game, 0.22, 2);
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
