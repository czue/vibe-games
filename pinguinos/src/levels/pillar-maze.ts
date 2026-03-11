import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Level, LevelEvent } from './level';

export class PillarMaze implements Level {
  private elapsedTime = 0;
  private reachedMaze = false;
  private reachedCenter = false;
  private earthquakeActive = false;
  private earthquakeProgress = 0;
  private faintProgress = 0;
  private cutsceneDone = false;
  private scene: THREE.Scene | null = null;
  private sceneObjects: THREE.Object3D[] = [];

  // Maze center position
  private readonly mazeHeight = 60;
  private readonly mazeCenter = new THREE.Vector3(0, this.mazeHeight, 0);
  private readonly mazeRadius = 18;

  // Screen shake
  private cameraShakeOffset = new THREE.Vector3();

  getSpawnPosition() {
    return { x: 0, y: 2, z: 0 };
  }

  setup(scene: THREE.Scene, world: InstanceType<typeof RAPIER.World>, rapier: typeof RAPIER): void {
    this.scene = scene;

    // Change sky to a deeper blue (we're going up high)
    scene.background = new THREE.Color(0x5588cc);
    scene.fog = new THREE.Fog(0x5588cc, 80, 200);

    // Ground platform at the start
    this.createStartPlatform(scene, world, rapier);

    // Stone pillars climbing upward
    this.createPillars(scene, world, rapier);

    // The circular maze at the top
    this.createCircularMaze(scene, world, rapier);

    // Lighting adjustment for height
    const light = new THREE.DirectionalLight(0xfff5e6, 1.5);
    light.position.set(10, this.mazeHeight + 20, 10);
    light.castShadow = true;
    light.shadow.mapSize.width = 2048;
    light.shadow.mapSize.height = 2048;
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 200;
    light.shadow.camera.left = -50;
    light.shadow.camera.right = 50;
    light.shadow.camera.top = 50;
    light.shadow.camera.bottom = -50;
    scene.add(light);
    this.sceneObjects.push(light);

    const ambient = new THREE.AmbientLight(0x8899bb, 0.6);
    scene.add(ambient);
    this.sceneObjects.push(ambient);
  }

  update(deltaTime: number, playerPosition: THREE.Vector3): LevelEvent | null {
    this.elapsedTime += deltaTime;

    // Check if player reached the maze platform
    if (!this.reachedMaze && playerPosition.y > this.mazeHeight - 3) {
      this.reachedMaze = true;
      return { type: 'reached_maze' };
    }

    // Check if player reached the center of the maze
    if (this.reachedMaze && !this.reachedCenter) {
      const horizDist = Math.sqrt(
        Math.pow(playerPosition.x - this.mazeCenter.x, 2) +
        Math.pow(playerPosition.z - this.mazeCenter.z, 2)
      );
      if (horizDist < 2.5 && playerPosition.y > this.mazeHeight - 3) {
        this.reachedCenter = true;
        this.earthquakeActive = true;
        return { type: 'reached_center' };
      }
    }

    // Earthquake animation
    if (this.earthquakeActive) {
      this.earthquakeProgress += deltaTime;

      // Screen shake
      const intensity = Math.min(1, this.earthquakeProgress * 0.5) * 0.3;
      this.cameraShakeOffset.set(
        (Math.random() - 0.5) * intensity,
        (Math.random() - 0.5) * intensity * 0.5,
        (Math.random() - 0.5) * intensity,
      );

      // After 3 seconds, start fainting
      if (this.earthquakeProgress > 3) {
        this.earthquakeActive = false;
        this.faintProgress = 0;
      }
    }

    // Faint sequence
    if (this.reachedCenter && !this.earthquakeActive && !this.cutsceneDone) {
      this.faintProgress += deltaTime;
      if (this.faintProgress > 2) {
        this.cutsceneDone = true;
        return { type: 'cutscene_done' };
      }
    }

    return null;
  }

  getCameraShakeOffset(): THREE.Vector3 {
    return this.cameraShakeOffset;
  }

  getFaintProgress(): number {
    return this.faintProgress;
  }

  isEarthquakeActive(): boolean {
    return this.earthquakeActive;
  }

  isComplete(): boolean {
    return this.cutsceneDone;
  }

  private createStartPlatform(scene: THREE.Scene, world: InstanceType<typeof RAPIER.World>, rapier: typeof RAPIER): void {
    // A circular stone platform to start on
    const geo = new THREE.CylinderGeometry(4, 4, 0.5, 16);
    const mat = new THREE.MeshStandardMaterial({ color: 0x887766, roughness: 0.9 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, -0.25, 0);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    scene.add(mesh);
    this.sceneObjects.push(mesh);

    // Physics
    const bodyDesc = rapier.RigidBodyDesc.fixed().setTranslation(0, -0.25, 0);
    const body = world.createRigidBody(bodyDesc);
    rapier.ColliderDesc.cylinder(0.25, 4);
    const collider = rapier.ColliderDesc.cylinder(0.25, 4);
    world.createCollider(collider, body);
  }

  private createPillars(scene: THREE.Scene, world: InstanceType<typeof RAPIER.World>, rapier: typeof RAPIER): void {
    // Pillars spiraling upward
    const pillarCount = 25;
    const maxHeight = this.mazeHeight - 2;

    for (let i = 0; i < pillarCount; i++) {
      const progress = i / (pillarCount - 1);
      const height = progress * maxHeight;

      // Spiral pattern
      const angle = progress * Math.PI * 3; // 1.5 full rotations
      const radius = 3 + progress * 4; // Spiral outward slightly
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      // Pillar visual — stone column
      const pillarHeight = 0.8 + Math.random() * 0.4;
      const pillarRadius = 0.8 + (1 - progress) * 0.4; // Slightly wider at bottom

      const geo = new THREE.CylinderGeometry(pillarRadius * 0.9, pillarRadius, pillarHeight, 8);
      const colors = [0x998877, 0x887766, 0x776655, 0x8a7a6a];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, height, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      this.sceneObjects.push(mesh);

      // Top cap (flat disc on top for landing)
      const capGeo = new THREE.CylinderGeometry(pillarRadius, pillarRadius * 0.95, 0.15, 8);
      const capMat = new THREE.MeshStandardMaterial({ color: 0xaa9988, roughness: 0.7 });
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.set(x, height + pillarHeight / 2 + 0.075, z);
      cap.receiveShadow = true;
      scene.add(cap);
      this.sceneObjects.push(cap);

      // Physics — cylinder collider
      const bodyDesc = rapier.RigidBodyDesc.fixed().setTranslation(x, height, z);
      const body = world.createRigidBody(bodyDesc);
      const colliderDesc = rapier.ColliderDesc.cylinder(pillarHeight / 2, pillarRadius);
      world.createCollider(colliderDesc, body);

      // Cap physics
      const capBodyDesc = rapier.RigidBodyDesc.fixed().setTranslation(x, height + pillarHeight / 2 + 0.075, z);
      const capBody = world.createRigidBody(capBodyDesc);
      const capCollider = rapier.ColliderDesc.cylinder(0.075, pillarRadius);
      world.createCollider(capCollider, capBody);
    }
  }

  private createCircularMaze(scene: THREE.Scene, world: InstanceType<typeof RAPIER.World>, rapier: typeof RAPIER): void {
    const y = this.mazeHeight;
    const cx = this.mazeCenter.x;
    const cz = this.mazeCenter.z;

    // Maze floor — large disc
    const floorGeo = new THREE.CylinderGeometry(this.mazeRadius, this.mazeRadius, 0.3, 32);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x99887a, roughness: 0.8 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(cx, y - 0.15, cz);
    floor.receiveShadow = true;
    scene.add(floor);
    this.sceneObjects.push(floor);

    // Floor physics
    const floorBodyDesc = rapier.RigidBodyDesc.fixed().setTranslation(cx, y - 0.15, cz);
    const floorBody = world.createRigidBody(floorBodyDesc);
    const floorCollider = rapier.ColliderDesc.cylinder(0.15, this.mazeRadius);
    world.createCollider(floorCollider, floorBody);

    // Center goal marker — glowing pillar
    const goalGeo = new THREE.CylinderGeometry(0.3, 0.3, 2, 8);
    const goalMat = new THREE.MeshStandardMaterial({
      color: 0xffdd44,
      emissive: 0xffaa00,
      emissiveIntensity: 0.6,
    });
    const goal = new THREE.Mesh(goalGeo, goalMat);
    goal.position.set(cx, y + 1, cz);
    scene.add(goal);
    this.sceneObjects.push(goal);

    const goalLight = new THREE.PointLight(0xffaa00, 3, 8);
    goalLight.position.set(cx, y + 2, cz);
    scene.add(goalLight);
    this.sceneObjects.push(goalLight);

    // Build concentric ring walls with gaps
    // Ring radii: outer edge, and 3 inner rings
    const wallHeight = 2.5;
    const wallThickness = 0.4;
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x665544, roughness: 0.9 });

    // Outer wall (full ring with one gap)
    this.createRingWall(scene, world, rapier, cx, cz, y, this.mazeRadius - 0.2, wallHeight, wallThickness, wallMat, [
      { start: 0, end: 0.15 }, // Gap facing the pillar landing area
    ]);

    // Ring 1 (radius 13)
    this.createRingWall(scene, world, rapier, cx, cz, y, 13, wallHeight, wallThickness, wallMat, [
      { start: 0.4, end: 0.5 },
      { start: 0.85, end: 0.95 },
    ]);

    // Ring 2 (radius 9)
    this.createRingWall(scene, world, rapier, cx, cz, y, 9, wallHeight, wallThickness, wallMat, [
      { start: 0.15, end: 0.28 },
      { start: 0.65, end: 0.75 },
    ]);

    // Ring 3 (radius 5)
    this.createRingWall(scene, world, rapier, cx, cz, y, 5, wallHeight, wallThickness, wallMat, [
      { start: 0.5, end: 0.65 },
    ]);

    // Radial walls connecting rings (creating passages)
    this.createRadialWall(scene, world, rapier, cx, cz, y, 5, 9, 0.25, wallHeight, wallThickness, wallMat);
    this.createRadialWall(scene, world, rapier, cx, cz, y, 9, 13, 0.6, wallHeight, wallThickness, wallMat);
    this.createRadialWall(scene, world, rapier, cx, cz, y, 13, this.mazeRadius - 0.2, 0.3, wallHeight, wallThickness, wallMat);
    this.createRadialWall(scene, world, rapier, cx, cz, y, 5, 13, 0.0, wallHeight, wallThickness, wallMat);
    this.createRadialWall(scene, world, rapier, cx, cz, y, 9, this.mazeRadius - 0.2, 0.8, wallHeight, wallThickness, wallMat);
  }

  private createRingWall(
    scene: THREE.Scene,
    world: InstanceType<typeof RAPIER.World>,
    rapier: typeof RAPIER,
    cx: number, cz: number, y: number,
    radius: number, height: number, thickness: number,
    material: THREE.MeshStandardMaterial,
    gaps: { start: number; end: number }[], // Gaps as fractions of the full circle (0-1)
  ): void {
    const segments = 48;
    const segmentAngle = (Math.PI * 2) / segments;

    for (let i = 0; i < segments; i++) {
      const fraction = i / segments;

      // Check if this segment falls in a gap
      let inGap = false;
      for (const gap of gaps) {
        if (fraction >= gap.start && fraction < gap.end) {
          inGap = true;
          break;
        }
      }
      if (inGap) continue;

      const angle = i * segmentAngle;
      const nextAngle = (i + 1) * segmentAngle;
      const midAngle = (angle + nextAngle) / 2;

      const x = cx + Math.cos(midAngle) * radius;
      const z = cz + Math.sin(midAngle) * radius;

      // Wall segment
      const segLength = 2 * radius * Math.sin(segmentAngle / 2) + 0.1;
      const geo = new THREE.BoxGeometry(segLength, height, thickness);
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.set(x, y + height / 2, z);
      mesh.rotation.y = -midAngle + Math.PI / 2;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      this.sceneObjects.push(mesh);

      // Physics
      const bodyDesc = rapier.RigidBodyDesc.fixed().setTranslation(x, y + height / 2, z);
      const body = world.createRigidBody(bodyDesc);
      body.setRotation({ x: 0, y: Math.sin((-midAngle + Math.PI / 2) / 2), z: 0, w: Math.cos((-midAngle + Math.PI / 2) / 2) }, true);
      const colliderDesc = rapier.ColliderDesc.cuboid(segLength / 2, height / 2, thickness / 2);
      world.createCollider(colliderDesc, body);
    }
  }

  private createRadialWall(
    scene: THREE.Scene,
    world: InstanceType<typeof RAPIER.World>,
    rapier: typeof RAPIER,
    cx: number, cz: number, y: number,
    innerRadius: number, outerRadius: number,
    angleFraction: number, // 0-1 fraction of full circle
    height: number, thickness: number,
    material: THREE.MeshStandardMaterial,
  ): void {
    const angle = angleFraction * Math.PI * 2;
    const midRadius = (innerRadius + outerRadius) / 2;
    const length = outerRadius - innerRadius;

    const x = cx + Math.cos(angle) * midRadius;
    const z = cz + Math.sin(angle) * midRadius;

    const geo = new THREE.BoxGeometry(thickness, height, length);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y + height / 2, z);
    mesh.rotation.y = -angle;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    this.sceneObjects.push(mesh);

    // Physics
    const bodyDesc = rapier.RigidBodyDesc.fixed().setTranslation(x, y + height / 2, z);
    const body = world.createRigidBody(bodyDesc);
    body.setRotation({ x: 0, y: Math.sin(-angle / 2), z: 0, w: Math.cos(-angle / 2) }, true);
    const colliderDesc = rapier.ColliderDesc.cuboid(thickness / 2, height / 2, length / 2);
    world.createCollider(colliderDesc, body);
  }
}
