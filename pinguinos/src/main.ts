import * as THREE from 'three';
import { initPhysics } from './physics';
import { createPenguin } from './player/penguin';
import { PlayerController } from './player/controller';
import { FollowCamera } from './camera';
import { PenguinAnimator } from './player/animations';
import { BouldersBeach } from './levels/boulders-beach';
import { GameUI } from './ui';

async function startGame() {
  // Initialize physics
  const { world, RAPIER } = await initPhysics();

  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // Scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 50, 120);

  // Camera
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 5, 10);

  // Lighting
  const light = new THREE.DirectionalLight(0xfff5e6, 1.5);
  light.position.set(10, 15, 10);
  light.castShadow = true;
  light.shadow.mapSize.width = 2048;
  light.shadow.mapSize.height = 2048;
  light.shadow.camera.near = 0.5;
  light.shadow.camera.far = 100;
  light.shadow.camera.left = -40;
  light.shadow.camera.right = 40;
  light.shadow.camera.top = 40;
  light.shadow.camera.bottom = -40;
  scene.add(light);
  scene.add(new THREE.AmbientLight(0x8899aa, 0.5));

  // Level
  const level = new BouldersBeach();
  level.setup(scene, world, RAPIER);

  // Penguin
  const penguin = createPenguin(world, RAPIER);
  scene.add(penguin.group);

  // Enable shadows on penguin meshes
  penguin.group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
    }
  });

  // Player controller
  const controller = new PlayerController(penguin.rigidBody, RAPIER, world, penguin.group);

  // Penguin animator
  const animator = new PenguinAnimator(penguin.parts);

  // Follow camera
  const followCamera = new FollowCamera(camera, penguin.group);

  // UI
  const ui = new GameUI();
  ui.setObjective('Find the shell key');
  ui.fadeControlsHint();

  // Delta time tracking
  const clock = new THREE.Clock();

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    world.step();
    controller.update(delta);

    // Sync penguin mesh position to physics body
    // Offset Y by capsule half-extent (0.8) so feet align with ground
    const t = penguin.rigidBody.translation();
    penguin.group.position.set(t.x, t.y - 0.8, t.z);

    const event = level.update(delta, penguin.group.position);
    if (event) {
      if (event.type === 'key_collected') {
        ui.setObjective('Bring the key to the golden boulder');
      } else if (event.type === 'boulder_unlocked') {
        ui.setObjective('');
        ui.showCompletion();
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

startGame();
