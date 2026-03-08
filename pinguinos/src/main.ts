import * as THREE from 'three';
import { initPhysics } from './physics';
import { createPenguin } from './player/penguin';
import { PlayerController } from './player/controller';
import { FollowCamera } from './camera';
import { PenguinAnimator } from './player/animations';
import { BouldersBeach } from './levels/boulders-beach';

async function startGame() {
  // Initialize physics
  const { world, RAPIER } = await initPhysics();

  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);

  // Camera
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 5, 10);

  // Lighting
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(5, 10, 5);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0x404040));

  // Level
  const level = new BouldersBeach();
  level.setup(scene, world, RAPIER);

  // Penguin
  const penguin = createPenguin(world, RAPIER);
  scene.add(penguin.group);

  // Player controller
  const controller = new PlayerController(penguin.rigidBody, RAPIER, world, penguin.group);

  // Penguin animator
  const animator = new PenguinAnimator(penguin.parts);

  // Follow camera
  const followCamera = new FollowCamera(camera, penguin.group);

  // Delta time tracking
  const clock = new THREE.Clock();

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    world.step();
    controller.update(delta);
    level.update(delta);
    animator.update(delta, controller.isMoving, controller.isGrounded);

    // Sync penguin mesh position to physics body
    const t = penguin.rigidBody.translation();
    penguin.group.position.set(t.x, t.y, t.z);

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
