import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Level, LevelEvent } from './level';

export class BouldersBeach implements Level {
  private waterMesh: THREE.Mesh | null = null;
  private elapsedTime = 0;

  // Shell key
  private shellKey: THREE.Mesh | null = null;
  private hasKey = false;

  // Locked boulder
  private lockedBoulderMesh: THREE.Group | null = null;
  private lockedBoulderBody: InstanceType<typeof RAPIER.RigidBody> | null = null;
  private boulderUnlocked = false;
  private boulderSlideProgress = 0;
  private boulderStartX = 0;
  private boulderTargetX = 0;
  private world: InstanceType<typeof RAPIER.World> | null = null;
  private rapierRef: typeof RAPIER | null = null;

  setup(scene: THREE.Scene, world: InstanceType<typeof RAPIER.World>, rapier: typeof RAPIER): void {
    this.world = world;
    this.rapierRef = rapier;
    this.createGround(scene, world, rapier);
    this.createWater(scene);
    this.createBoundaryWalls(world, rapier);
    this.placeBoulders(scene, world, rapier);
    this.placeBushes(scene);
    this.createShellKey(scene);
    this.createLockedBoulder(scene, world, rapier);
  }

  update(deltaTime: number, playerPosition: THREE.Vector3): LevelEvent | null {
    this.elapsedTime += deltaTime;
    this.animateWater();
    this.animateShellKey();

    // Animate boulder sliding
    if (this.boulderUnlocked && this.boulderSlideProgress < 1) {
      this.boulderSlideProgress = Math.min(1, this.boulderSlideProgress + deltaTime * 0.5);
      const t = this.easeOutCubic(this.boulderSlideProgress);
      const newX = this.boulderStartX + (this.boulderTargetX - this.boulderStartX) * t;
      if (this.lockedBoulderMesh) {
        this.lockedBoulderMesh.position.x = newX;
      }
      // Move the physics body too
      if (this.lockedBoulderBody) {
        const pos = this.lockedBoulderBody.translation();
        this.lockedBoulderBody.setTranslation({ x: newX, y: pos.y, z: pos.z }, true);
      }
    }

    // Check key pickup
    if (!this.hasKey && this.shellKey) {
      const dist = playerPosition.distanceTo(this.shellKey.position);
      if (dist < 1.5) {
        this.hasKey = true;
        this.shellKey.removeFromParent();
        this.shellKey = null;
        return { type: 'key_collected' };
      }
    }

    // Check boulder interaction
    if (this.hasKey && !this.boulderUnlocked && this.lockedBoulderMesh) {
      const dist = playerPosition.distanceTo(this.lockedBoulderMesh.position);
      if (dist < 3.0) {
        this.boulderUnlocked = true;
        // Remove the keyhole marker
        const keyhole = this.lockedBoulderMesh.getObjectByName('keyhole');
        if (keyhole) keyhole.removeFromParent();
        return { type: 'boulder_unlocked' };
      }
    }

    return null;
  }

  isComplete(): boolean {
    return this.boulderUnlocked && this.boulderSlideProgress >= 1;
  }

  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  private createGround(scene: THREE.Scene, world: InstanceType<typeof RAPIER.World>, rapier: typeof RAPIER): void {
    // Visual ground with slight undulation
    const groundGeometry = new THREE.PlaneGeometry(80, 80, 40, 40);
    groundGeometry.rotateX(-Math.PI / 2);

    // Perturb vertex Y positions for undulation
    const positionAttr = groundGeometry.getAttribute('position');
    for (let i = 0; i < positionAttr.count; i++) {
      const y = positionAttr.getY(i);
      positionAttr.setY(i, y + (Math.random() - 0.5) * 0.2);
    }
    positionAttr.needsUpdate = true;
    groundGeometry.computeVertexNormals();

    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0xdeb887 });
    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.position.set(0, 0, 0);
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Physics ground: fixed body with cuboid collider
    const groundBodyDesc = rapier.RigidBodyDesc.fixed().setTranslation(0, 0, 0);
    const groundBody = world.createRigidBody(groundBodyDesc);
    const groundColliderDesc = rapier.ColliderDesc.cuboid(40, 0.1, 40);
    world.createCollider(groundColliderDesc, groundBody);
  }

  private createWater(scene: THREE.Scene): void {
    const waterGeometry = new THREE.PlaneGeometry(80, 30, 40, 20);
    waterGeometry.rotateX(-Math.PI / 2);

    const waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x4488cc,
      opacity: 0.7,
      transparent: true,
    });

    this.waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
    this.waterMesh.position.set(0, -0.2, -25);
    scene.add(this.waterMesh);
  }

  private createBoundaryWalls(world: InstanceType<typeof RAPIER.World>, rapier: typeof RAPIER): void {
    const wallPositions: [number, number, number][] = [
      [35, 5, 0],   // +X wall
      [-35, 5, 0],  // -X wall
      [0, 5, 35],   // +Z wall
      [0, 5, -35],  // -Z wall
    ];

    const wallSizes: [number, number, number][] = [
      [0.1, 5, 35],  // X walls: thin in X, tall, wide in Z
      [0.1, 5, 35],
      [35, 5, 0.1],  // Z walls: wide in X, tall, thin in Z
      [35, 5, 0.1],
    ];

    for (let i = 0; i < wallPositions.length; i++) {
      const [px, py, pz] = wallPositions[i];
      const [sx, sy, sz] = wallSizes[i];
      const bodyDesc = rapier.RigidBodyDesc.fixed().setTranslation(px, py, pz);
      const body = world.createRigidBody(bodyDesc);
      const colliderDesc = rapier.ColliderDesc.cuboid(sx, sy, sz);
      world.createCollider(colliderDesc, body);
    }
  }

  private createBoulder(
    scene: THREE.Scene,
    world: InstanceType<typeof RAPIER.World>,
    rapier: typeof RAPIER,
    size: number,
    position: { x: number; y: number; z: number }
  ): void {
    // Use detail level 2 for smoother shape, then merge vertices for consistent displacement
    const geometry = new THREE.IcosahedronGeometry(size, 2);
    const positionAttr = geometry.getAttribute('position');
    // Displace each vertex along its radial direction by a small random amount
    // Use a seeded approach: round position to grid to ensure shared-position vertices get same offset
    const displacementMap = new Map<string, number>();
    for (let i = 0; i < positionAttr.count; i++) {
      const x = positionAttr.getX(i);
      const y = positionAttr.getY(i);
      const z = positionAttr.getZ(i);
      // Key by rounded position so duplicate vertices at same location get same displacement
      const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
      if (!displacementMap.has(key)) {
        displacementMap.set(key, 0.85 + Math.random() * 0.3);
      }
      const scale = displacementMap.get(key)!;
      positionAttr.setX(i, x * scale);
      positionAttr.setY(i, y * scale);
      positionAttr.setZ(i, z * scale);
    }
    positionAttr.needsUpdate = true;
    geometry.computeVertexNormals();

    const colors = [0x808080, 0x8b8682, 0x696969, 0x7b7b7b];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.1 });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position.x, position.y, position.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const bodyDesc = rapier.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z);
    const body = world.createRigidBody(bodyDesc);
    const colliderDesc = rapier.ColliderDesc.ball(size);
    world.createCollider(colliderDesc, body);
  }

  private placeBoulders(
    scene: THREE.Scene,
    world: InstanceType<typeof RAPIER.World>,
    rapier: typeof RAPIER
  ): void {
    const boulderPlacements: { x: number; z: number; size: number }[] = [
      // Cluster near top-right
      { x: 15, z: 12, size: 2.0 },
      { x: 17, z: 14, size: 1.5 },
      { x: 13, z: 15, size: 1.0 },
      { x: 16, z: 10, size: 0.7 },
      // Cluster near bottom-left
      { x: -18, z: -10, size: 2.5 },
      { x: -15, z: -12, size: 1.8 },
      { x: -20, z: -8, size: 1.2 },
      // Scattered mid-field
      { x: -8, z: 20, size: 1.4 },
      { x: 5, z: -18, size: 1.6 },
      { x: 22, z: -5, size: 2.2 },
      { x: -25, z: 5, size: 0.8 },
      { x: 10, z: -25, size: 1.0 },
      { x: -5, z: 25, size: 0.5 },
      // A few more scattered
      { x: 25, z: 20, size: 1.3 },
      { x: -12, z: 8, size: 0.9 },
      { x: 8, z: 8, size: 0.6 },
      { x: -22, z: -22, size: 1.7 },
    ];

    for (const b of boulderPlacements) {
      this.createBoulder(scene, world, rapier, b.size, { x: b.x, y: b.size * 0.5, z: b.z });
    }
  }

  private createBush(scene: THREE.Scene, position: { x: number; y: number; z: number }): void {
    const greens = [0x2d5a27, 0x3a7a33, 0x4a8a43];
    const count = 2 + Math.floor(Math.random() * 2); // 2-3 spheres

    for (let i = 0; i < count; i++) {
      const radius = 0.2 + Math.random() * 0.2;
      const geometry = new THREE.SphereGeometry(radius, 6, 4);
      const color = greens[Math.floor(Math.random() * greens.length)];
      const material = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(
        position.x + (Math.random() - 0.5) * 0.4,
        position.y + radius,
        position.z + (Math.random() - 0.5) * 0.4
      );
      scene.add(mesh);
    }
  }

  private placeBushes(scene: THREE.Scene): void {
    const bushPositions: { x: number; z: number }[] = [
      // Near boulder clusters
      { x: 14, z: 16 },
      { x: 18, z: 11 },
      { x: -16, z: -13 },
      { x: -21, z: -7 },
      // Along edges
      { x: 28, z: 15 },
      { x: -28, z: 10 },
      { x: 20, z: -28 },
      { x: -10, z: 28 },
      // Scattered
      { x: -6, z: 22 },
      { x: 12, z: -20 },
      { x: 24, z: -8 },
      { x: -14, z: 6 },
      { x: 6, z: 10 },
    ];

    for (const p of bushPositions) {
      this.createBush(scene, { x: p.x, y: 0, z: p.z });
    }
  }

  private createShellKey(scene: THREE.Scene): void {
    // Shell-shaped key, larger and more prominent than the old collectibles
    const geometry = new THREE.TorusGeometry(0.25, 0.1, 8, 16);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffaa00,
      emissiveIntensity: 0.5,
      metalness: 0.6,
      roughness: 0.3,
    });
    this.shellKey = new THREE.Mesh(geometry, material);
    this.shellKey.scale.set(1, 0.6, 1);
    this.shellKey.position.set(-17, 0.5, -11); // Near the water edge
    this.shellKey.castShadow = true;
    scene.add(this.shellKey);
  }

  private createLockedBoulder(
    scene: THREE.Scene,
    world: InstanceType<typeof RAPIER.World>,
    rapier: typeof RAPIER
  ): void {
    const group = new THREE.Group();
    const size = 2.8;

    // Boulder mesh
    const geometry = new THREE.IcosahedronGeometry(size, 2);
    const positionAttr = geometry.getAttribute('position');
    const displacementMap = new Map<string, number>();
    for (let i = 0; i < positionAttr.count; i++) {
      const x = positionAttr.getX(i);
      const y = positionAttr.getY(i);
      const z = positionAttr.getZ(i);
      const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
      if (!displacementMap.has(key)) {
        displacementMap.set(key, 0.85 + Math.random() * 0.3);
      }
      const scale = displacementMap.get(key)!;
      positionAttr.setX(i, x * scale);
      positionAttr.setY(i, y * scale);
      positionAttr.setZ(i, z * scale);
    }
    positionAttr.needsUpdate = true;
    geometry.computeVertexNormals();

    const boulderMesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      color: 0x6a5a4a,
      roughness: 0.9,
      metalness: 0.1,
    }));
    boulderMesh.castShadow = true;
    boulderMesh.receiveShadow = true;
    group.add(boulderMesh);

    // Keyhole marker — a golden torus on the front face
    const keyholeGeo = new THREE.TorusGeometry(0.3, 0.08, 8, 16);
    const keyholeMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffaa00,
      emissiveIntensity: 0.4,
      metalness: 0.7,
      roughness: 0.2,
    });
    const keyhole = new THREE.Mesh(keyholeGeo, keyholeMat);
    keyhole.name = 'keyhole';
    keyhole.position.set(0, 0.3, size * 0.95); // On the front surface
    group.add(keyhole);

    // Position the locked boulder — blocking a path area
    const boulderX = 10;
    const boulderZ = 5;
    group.position.set(boulderX, size * 0.5, boulderZ);
    this.boulderStartX = boulderX;
    this.boulderTargetX = boulderX + 8; // Slide 8 units to the right
    scene.add(group);
    this.lockedBoulderMesh = group;

    // Physics body
    const bodyDesc = rapier.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(boulderX, size * 0.5, boulderZ);
    this.lockedBoulderBody = world.createRigidBody(bodyDesc);
    const colliderDesc = rapier.ColliderDesc.ball(size);
    world.createCollider(colliderDesc, this.lockedBoulderBody);
  }

  private animateShellKey(): void {
    if (!this.shellKey) return;
    this.shellKey.rotateY(0.02);
    this.shellKey.position.y = 0.5 + Math.sin(this.elapsedTime * 2) * 0.15;
  }

  private animateWater(): void {
    if (!this.waterMesh) return;

    const positionAttr = this.waterMesh.geometry.getAttribute('position');
    for (let i = 0; i < positionAttr.count; i++) {
      const x = positionAttr.getX(i);
      const z = positionAttr.getZ(i);
      const y = Math.sin(x * 0.3 + this.elapsedTime * 2) * 0.1 +
                Math.sin(z * 0.4 + this.elapsedTime * 1.5) * 0.08;
      positionAttr.setY(i, y);
    }
    positionAttr.needsUpdate = true;
  }
}
