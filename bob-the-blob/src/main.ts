import * as THREE from 'three';
import { Game } from './game';
import { UI } from './ui';
import { Input } from './input';
import { LEVELS } from './levels';
import { unlockAudio } from './audio';
import { difficulty, setDifficulty, type DifficultyName } from './difficulty';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500);
const ui = new UI();
const input = new Input();
const game = new Game(scene, camera, ui, input);

// ?level=2 skips straight to a level
const params = new URLSearchParams(window.location.search);
const requested = parseInt(params.get('level') ?? '1', 10) - 1;
const startLevel = Number.isNaN(requested) ? 0 : THREE.MathUtils.clamp(requested, 0, LEVELS.length - 1);

let selectedMode: DifficultyName = difficulty.name;
let selectedLevel = startLevel;

function showTitle(): void {
  game.state = 'title';
  ui.showTitle(LEVELS.map((l) => l.name));
  ui.selectMode(selectedMode);
  ui.selectLevel(selectedLevel);
}

function begin(): void {
  unlockAudio();
  ui.hideOverlay();
  setDifficulty(selectedMode);
  // Reload so the level is built with the chosen mode's squashes, logs and hearts.
  game.loadLevel(selectedLevel);
  game.announceLevel();
  game.state = 'play';
}

game.loadLevel(startLevel);
showTitle();

window.addEventListener('click', (e) => {
  if (game.state === 'done') {
    showTitle();
    return;
  }
  if (game.state !== 'title') return;
  const levelBtn = (e.target as HTMLElement).closest<HTMLButtonElement>('.level');
  if (levelBtn) {
    selectedLevel = Number(levelBtn.dataset.level);
    ui.selectLevel(selectedLevel);
    return;
  }
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.mode');
  if (!btn) return;
  selectedMode = btn.dataset.mode as DifficultyName;
  ui.selectMode(selectedMode);
  begin();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
function frame(): void {
  const dt = clock.getDelta();
  if (game.state === 'title') {
    if (input.wasPressed('ArrowLeft', 'ArrowUp', 'KeyA', 'KeyW')) selectedMode = 'easy';
    if (input.wasPressed('ArrowRight', 'ArrowDown', 'KeyD', 'KeyS')) selectedMode = 'regular';
    ui.selectMode(selectedMode);
    // Number keys pick a level
    LEVELS.forEach((_, i) => {
      if (input.wasPressed(`Digit${i + 1}`)) selectedLevel = i;
    });
    ui.selectLevel(selectedLevel);
    if (input.wasPressed('Enter', 'Space')) begin();
  } else if (game.state === 'done' && input.wasPressed('Enter', 'Space')) {
    showTitle();
  }
  game.update(dt);
  renderer.render(scene, camera);
  input.endFrame();
  requestAnimationFrame(frame);
}
frame();

// Handy for poking at the game from the browser console while developing.
if (import.meta.env.DEV) (window as unknown as { game: Game }).game = game;
