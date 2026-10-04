export type DifficultyName = 'easy' | 'regular';

/** All the knobs that make the game harder or easier, in one place. */
export interface Difficulty {
  name: DifficultyName;
  label: string;
  hearts: number;
  growthMul: number; // how much Bob grows per bite
  squashDrop: number; // bites Bob loses when flattened
  squashCountMul: number; // fraction of each level's big squashes that show up
  squashRest: [number, number]; // seconds between hops
  squashHopMul: number; // >1 = slower, floatier hops
  squashLead: number; // how far ahead of Bob squashes aim (0 = right where he is)
  squashAggroMul: number; // how close Bob has to be before squashes notice him
  allLogLanes: boolean; // false = only the middle lane rolls
  logSpeedMul: number;
  logGapMul: number; // >1 = more time between logs
  coneGapMul: number; // >1 = fewer pinecones
  bigfootNoticeMul: number;
  bigfootWindup: number; // seconds of warning before the leap
  bigfootCooldown: [number, number];
}

export const DIFFICULTIES: Record<DifficultyName, Difficulty> = {
  easy: {
    name: 'easy',
    label: '🌱 Easy',
    hearts: 5,
    growthMul: 1.3,
    squashDrop: 2,
    squashCountMul: 0.67,
    squashRest: [1.3, 2.2],
    squashHopMul: 1.3,
    squashLead: 0,
    squashAggroMul: 0.8,
    allLogLanes: false,
    logSpeedMul: 0.85,
    logGapMul: 1.3,
    coneGapMul: 1.7,
    bigfootNoticeMul: 0.7,
    bigfootWindup: 1.1,
    bigfootCooldown: [3.5, 5.5],
  },
  regular: {
    name: 'regular',
    label: '🔥 Regular',
    hearts: 3,
    growthMul: 1,
    squashDrop: 4,
    squashCountMul: 1,
    squashRest: [0.7, 1.3],
    squashHopMul: 1,
    squashLead: 0.35,
    squashAggroMul: 1,
    allLogLanes: true,
    logSpeedMul: 1,
    logGapMul: 1,
    coneGapMul: 1,
    bigfootNoticeMul: 1,
    bigfootWindup: 0.7,
    bigfootCooldown: [2, 3.5],
  },
};

const STORAGE_KEY = 'bob-the-blob-difficulty';

function loadSaved(): DifficultyName {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'easy' || saved === 'regular') return saved;
  } catch {
    // Storage can be blocked (private windows etc.) — just use the default.
  }
  return 'easy';
}

export let difficulty: Difficulty = DIFFICULTIES[loadSaved()];

export function setDifficulty(name: DifficultyName): void {
  difficulty = DIFFICULTIES[name];
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // Not remembering the choice is fine.
  }
}

/** Keep roughly `difficulty.squashCountMul` of a list (always at least one). */
export function someOf<T>(items: T[]): T[] {
  return items.slice(0, Math.max(1, Math.round(items.length * difficulty.squashCountMul)));
}
