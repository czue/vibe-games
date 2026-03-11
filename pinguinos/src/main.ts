import * as THREE from 'three';
import { initPhysics } from './physics';
import { createPenguin } from './player/penguin';
import { PlayerController } from './player/controller';
import { FollowCamera } from './camera';
import { PenguinAnimator } from './player/animations';
import { BouldersBeach } from './levels/boulders-beach';
import { PillarMaze } from './levels/pillar-maze';
import { GameUI } from './ui';
import type { Level } from './levels/level';

async function startGame() {
  // Initialize physics
  let { world, RAPIER } = await initPhysics();

  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // Scene
  let scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 50, 120);

  // Camera
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 5, 10);

  // Lighting (for level 1 — level 2 adds its own)
  const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.5);
  sunLight.position.set(10, 15, 10);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 100;
  sunLight.shadow.camera.left = -40;
  sunLight.shadow.camera.right = 40;
  sunLight.shadow.camera.top = 40;
  sunLight.shadow.camera.bottom = -40;
  scene.add(sunLight);
  const ambientLight = new THREE.AmbientLight(0x8899aa, 0.5);
  scene.add(ambientLight);

  // Level — check URL param for starting level (e.g. ?level=2)
  const urlParams = new URLSearchParams(window.location.search);
  const startLevel = Math.max(0, (parseInt(urlParams.get('level') ?? '1', 10) - 1));

  let currentLevelIndex = startLevel;
  const levels: Level[] = [new BouldersBeach(), new PillarMaze()];
  let level = levels[currentLevelIndex];

  // For level 2+, remove default level-1 lighting (level 2 adds its own)
  if (currentLevelIndex > 0) {
    scene.remove(sunLight);
    scene.remove(ambientLight);
  }

  level.setup(scene, world, RAPIER);

  // Penguin
  const spawn = level.getSpawnPosition?.() ?? { x: 0, y: 2, z: 0 };
  let penguin = createPenguin(world, RAPIER);
  penguin.rigidBody.setTranslation({ x: spawn.x, y: spawn.y, z: spawn.z }, true);
  scene.add(penguin.group);
  penguin.group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
    }
  });

  // Player controller
  let controller = new PlayerController(penguin.rigidBody, RAPIER, world, penguin.group);
  const animator = new PenguinAnimator(penguin.parts);
  const followCamera = new FollowCamera(camera, penguin.group);

  // UI
  const ui = new GameUI();
  const levelObjectives: Record<number, string> = {
    0: 'Find the shell key',
    1: 'Climb the pillars!',
  };
  ui.setObjective(levelObjectives[currentLevelIndex] ?? '');
  ui.fadeControlsHint();

  // Fade overlay
  const fadeOverlay = document.getElementById('fade-overlay')!;

  // Delta time tracking
  const clock = new THREE.Clock();

  // Game state
  let controlsDisabled = false;
  let enteringPortal = false;
  let portalFallProgress = 0;
  let transitioningLevel = false;

  // Level 2 state
  let earthquakeActive = false;
  let faintActive = false;
  let faintProgress = 0;

  // --- Level transition ---
  async function transitionToLevel(nextIndex: number) {
    transitioningLevel = true;
    controlsDisabled = true;

    // Fade to black
    fadeOverlay.style.opacity = '1';
    await sleep(1500);

    // Reset physics world
    const physics = await initPhysics();
    world = physics.world;
    RAPIER = physics.RAPIER;

    // Clear scene
    while (scene.children.length > 0) {
      scene.remove(scene.children[0]);
    }

    // Setup new level
    currentLevelIndex = nextIndex;
    level = levels[currentLevelIndex];
    level.setup(scene, world, RAPIER);

    // Respawn penguin
    const spawn = level.getSpawnPosition?.() ?? { x: 0, y: 2, z: 0 };
    penguin = createPenguin(world, RAPIER);
    penguin.rigidBody.setTranslation({ x: spawn.x, y: spawn.y, z: spawn.z }, true);
    scene.add(penguin.group);
    penguin.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
      }
    });

    // Recreate controller
    controller = new PlayerController(penguin.rigidBody, RAPIER, world, penguin.group);
    followCamera.target = penguin.group;

    // Reset state
    enteringPortal = false;
    portalFallProgress = 0;
    penguin.group.scale.set(1, 1, 1);

    // Level-specific UI
    if (nextIndex === 1) {
      ui.setObjective('Climb the pillars!');
      ui.hideCompletion();
    }

    // Fade back in
    fadeOverlay.style.opacity = '0';
    await sleep(1000);

    controlsDisabled = false;
    transitioningLevel = false;
  }

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05); // Cap delta to prevent physics issues

    if (transitioningLevel) {
      renderer.render(scene, camera);
      return;
    }

    world.step();

    if (!controlsDisabled) {
      controller.update(delta);
    }

    // Sync penguin mesh position to physics body
    const t = penguin.rigidBody.translation();
    penguin.group.position.set(t.x, t.y - 0.8, t.z);

    const event = level.update(delta, penguin.group.position);
    if (event) {
      switch (event.type) {
        // Level 1 events
        case 'key_collected':
          ui.setObjective('Bring the key to the golden boulder');
          break;
        case 'boulder_unlocked':
          ui.setObjective('Enter the portal...');
          break;
        case 'portal_entered':
          enteringPortal = true;
          controlsDisabled = true;
          penguin.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
          penguin.rigidBody.setGravityScale(0, true);
          break;

        // Level 2 events
        case 'reached_maze':
          ui.setObjective('Find the center of the maze');
          break;
        case 'reached_center':
          controlsDisabled = true;
          earthquakeActive = true;
          penguin.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
          ui.setObjective('');
          break;
        case 'cutscene_done':
          faintActive = true;
          faintProgress = 0;
          break;
      }
    }

    // Level 1: Portal fall animation
    if (enteringPortal) {
      portalFallProgress += delta;
      penguin.group.rotation.y += delta * 8;
      const shrink = Math.max(0, 1 - portalFallProgress * 0.8);
      penguin.group.scale.set(shrink, shrink, shrink);
      const pos = penguin.rigidBody.translation();
      penguin.rigidBody.setTranslation(
        { x: pos.x, y: pos.y - delta * 3, z: pos.z },
        true,
      );
      if (portalFallProgress > 1.5) {
        enteringPortal = false;
        transitionToLevel(1);
      }
    }

    // Level 2: Earthquake camera shake
    if (earthquakeActive && level instanceof PillarMaze) {
      const shake = level.getCameraShakeOffset();
      camera.position.add(shake);
    }

    // Level 2: Faint sequence (fade to black)
    if (faintActive) {
      faintProgress += delta;
      fadeOverlay.style.opacity = String(Math.min(1, faintProgress * 0.7));

      // Penguin tips over
      penguin.group.rotation.z = Math.min(Math.PI / 2, faintProgress * 2);

      if (faintProgress > 3) {
        faintActive = false;
        // Show the wake-up message
        ui.showWakeUp();
      }
    }

    animator.update(delta, controller.isMoving, controller.isGrounded);
    followCamera.update(delta);
    renderer.render(scene, camera);
  }
  animate();

  // Handle window resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

startGame();
