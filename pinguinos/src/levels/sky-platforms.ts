import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Level, LevelEvent } from './level';

export class SkyPlatforms implements Level {
  private sceneObjects: THREE.Object3D[] = [];
  private reachedSummit = false;
  private summitPosition = new THREE.Vector3(1, 21, -1);
  private elapsedTime = 0;
  private goalPillar: THREE.Mesh | null = null;

  setup(scene: THREE.Scene, world: InstanceType<typeof RAPIER.World>, rapier: typeof RAPIER): void {
    // Sky background
    scene.background = new THREE.Color(0x6db3f2);
    scene.fog = new THREE.Fog(0x6db3f2, 40, 100);

    // Lighting
    const sun = new THREE.DirectionalLight(0xfff5e6, 1.5);
    sun.position.set(5, 20, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 60;
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -10;
    scene.add(sun);
    this.sceneObjects.push(sun);

    const ambient = new THREE.AmbientLight(0x99bbdd, 0.6);
    scene.add(ambient);
    this.sceneObjects.push(ambient);

    // Ground platform (grassy starting area)
    this.createPlatform(scene, world, rapier, 0, -0.25, 0, 8, 0.5, 8, 0x4a8c3f);

    // The other penguin (from Level 2 cutscene) standing nearby
    this.createCompanionPenguin(scene, 2, 0.5, 2);

    // Stepping platforms going up — requires triple jump
    // Each jump gets about 3.5 units of height, triple jump gets ~10 units
    // So platforms should be spaced ~7-9 units apart vertically

    // First tier — single jump to reach
    this.createPlatform(scene, world, rapier, -3, 2.5, -3, 2.5, 0.4, 2.5, 0x6b9e5e);
    this.createPlatform(scene, world, rapier, 3, 3, -4, 2, 0.4, 2, 0x6b9e5e);

    // Second tier — double jump (ground + air) to reach (~6 units up)
    this.createPlatform(scene, world, rapier, 0, 8, -2, 2.5, 0.4, 2.5, 0x5e9452);

    // Third tier — double jump from second tier
    this.createPlatform(scene, world, rapier, -3, 14, 0, 2.5, 0.4, 2.5, 0x528a46);

    // Summit platform — double jump from third tier
    this.createPlatform(scene, world, rapier, 1, 20, -1, 3, 0.5, 3, 0x3d7a32);

    // Golden goal marker on summit
    const goalGeo = new THREE.CylinderGeometry(0.3, 0.3, 2, 8);
    const goalMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffa000, emissiveIntensity: 0.5 });
    this.goalPillar = new THREE.Mesh(goalGeo, goalMat);
    this.goalPillar.position.set(1, 21.5, -1);
    this.goalPillar.castShadow = true;
    scene.add(this.goalPillar);
    this.sceneObjects.push(this.goalPillar);

    const goalLight = new THREE.PointLight(0xffd700, 2, 10);
    goalLight.position.set(1, 22, -1);
    scene.add(goalLight);
    this.sceneObjects.push(goalLight);

    // Some floating decorative clouds
    this.createCloud(scene, -10, 12, -8);
    this.createCloud(scene, 12, 8, 5);
    this.createCloud(scene, -5, 18, 10);
    this.createCloud(scene, 8, 20, -6);
    this.createCloud(scene, -12, 5, 3);
  }

  update(deltaTime: number, playerPosition: THREE.Vector3): LevelEvent | null {
    this.elapsedTime += deltaTime;

    // Animate goal pillar
    if (this.goalPillar) {
      this.goalPillar.rotation.y = this.elapsedTime * 1.5;
    }

    // Check if player reached summit
    if (!this.reachedSummit && playerPosition.distanceTo(this.summitPosition) < 4) {
      this.reachedSummit = true;
      return { type: 'reached_summit' };
    }

    return null;
  }

  isComplete(): boolean {
    return this.reachedSummit;
  }

  getSpawnPosition() {
    return { x: 0, y: 2, z: 3 };
  }

  private createPlatform(
    scene: THREE.Scene,
    world: InstanceType<typeof RAPIER.World>,
    rapier: typeof RAPIER,
    x: number, y: number, z: number,
    hw: number, hh: number, hd: number,
    color: number,
  ): void {
    const geo = new THREE.BoxGeometry(hw * 2, hh * 2, hd * 2);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    scene.add(mesh);
    this.sceneObjects.push(mesh);

    const bodyDesc = rapier.RigidBodyDesc.fixed().setTranslation(x, y, z);
    const body = world.createRigidBody(bodyDesc);
    const collider = rapier.ColliderDesc.cuboid(hw, hh, hd);
    world.createCollider(collider, body);
  }

  private createCompanionPenguin(scene: THREE.Scene, x: number, y: number, z: number): void {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    // Body
    const bodyGeo = new THREE.SphereGeometry(0.5, 12, 10);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.scale.set(1, 1.3, 1);
    body.position.y = 0.5;
    group.add(body);

    // Belly
    const bellyGeo = new THREE.SphereGeometry(0.35, 10, 8);
    const bellyMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0 });
    const belly = new THREE.Mesh(bellyGeo, bellyMat);
    belly.scale.set(1, 1.2, 0.8);
    belly.position.set(0, 0.45, 0.2);
    group.add(belly);

    // Head
    const headGeo = new THREE.SphereGeometry(0.32, 10, 8);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 1.1, 0);
    group.add(head);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.06, 6, 6);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.12, 1.15, 0.25);
    group.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.12, 1.15, 0.25);
    group.add(rightEye);

    // Beak
    const beakGeo = new THREE.ConeGeometry(0.08, 0.2, 6);
    const beakMat = new THREE.MeshStandardMaterial({ color: 0xff8c00 });
    const beak = new THREE.Mesh(beakGeo, beakMat);
    beak.position.set(0, 1.05, 0.35);
    beak.rotation.x = Math.PI / 2;
    group.add(beak);

    // Face toward center
    group.lookAt(0, y, 0);

    scene.add(group);
    this.sceneObjects.push(group);
  }

  private createCloud(scene: THREE.Scene, x: number, y: number, z: number): void {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });

    for (let i = 0; i < 5; i++) {
      const size = 1 + Math.random() * 1.5;
      const geo = new THREE.SphereGeometry(size, 8, 6);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 1,
        (Math.random() - 0.5) * 3,
      );
      group.add(mesh);
    }

    group.position.set(x, y, z);
    scene.add(group);
    this.sceneObjects.push(group);
  }
}
