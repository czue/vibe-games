import * as THREE from 'three';
import { Game } from './game';
import { UI } from './ui';
import { Input } from './input';
import { LEVELS } from './levels';
import { unlockAudio } from './audio';

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

game.loadLevel(startLevel);
ui.showTitle();

function begin(): void {
  unlockAudio();
  ui.hideOverlay();
  if (game.state === 'done') game.loadLevel(0);
  game.announceLevel();
  game.state = 'play';
}

window.addEventListener('click', () => {
  if (game.state === 'title' || game.state === 'done') begin();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
function frame(): void {
  const dt = clock.getDelta();
  if ((game.state === 'title' || game.state === 'done') && input.wasPressed('Enter', 'Space')) begin();
  game.update(dt);
  renderer.render(scene, camera);
  input.endFrame();
  requestAnimationFrame(frame);
}
frame();

// Handy for poking at the game from the browser console while developing.
if (import.meta.env.DEV) (window as unknown as { game: Game }).game = game;
