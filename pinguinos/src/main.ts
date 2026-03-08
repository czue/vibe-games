import * as THREE from 'three';
import { initPhysics } from './physics';
import { createPenguin } from './player/penguin';

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
  camera.lookAt(0, 0, 0);

  // Lighting
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(5, 10, 5);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0x404040));

  // Physics ground plane: fixed rigid body with a wide, thin cuboid collider
  const groundBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 0);
  const groundBody = world.createRigidBody(groundBodyDesc);
  const groundColliderDesc = RAPIER.ColliderDesc.cuboid(50, 0.1, 50);
  world.createCollider(groundColliderDesc, groundBody);

  // Visual ground plane (matches physics collider dimensions)
  const groundGeometry = new THREE.BoxGeometry(100, 0.2, 100);
  const groundMaterial = new THREE.MeshStandardMaterial({ color: 0xdeb887 });
  const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
  groundMesh.position.set(0, 0, 0);
  scene.add(groundMesh);

  // Penguin
  const penguin = createPenguin();
  penguin.group.position.set(0, 2, 0);
  scene.add(penguin.group);

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    world.step();
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
