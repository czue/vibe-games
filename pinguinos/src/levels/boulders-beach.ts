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

  // Portal
  private portalMesh: THREE.Group | null = null;
  private portalLight: THREE.PointLight | null = null;
  private portalEntered = false;
  private portalPosition = new THREE.Vector3(10, 0, 10);

  setup(scene: THREE.Scene, world: InstanceType<typeof RAPIER.World>, rapier: typeof RAPIER): void {
    this.world = world;
    this.rapierRef = rapier;
    this.createGround(scene, world, rapier);
    this.createWater(scene);
    this.createBoundaryWalls(world, rapier);
    this.placeBoulders(scene, world, rapier);
    this.placeBushes(scene);
    this.createShellKey(scene);
    this.createPortal(scene);
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
        if (this.shellKeyLight) {
          this.shellKeyLight.removeFromParent();
          this.shellKeyLight = null;
        }
        return { type: 'key_collected' };
      }
    }

    // Check boulder interaction
    if (this.hasKey && !this.boulderUnlocked && this.lockedBoulderMesh) {
      const dist = playerPosition.distanceTo(this.lockedBoulderMesh.position);
      if (dist < 5.0) {
        this.boulderUnlocked = true;
        // Remove the keyhole marker
        const keyhole = this.lockedBoulderMesh.getObjectByName('keyhole');
        if (keyhole) keyhole.removeFromParent();
        return { type: 'boulder_unlocked' };
      }
    }

    // Animate portal
    if (this.portalMesh) {
      this.portalMesh.rotation.y = this.elapsedTime * 1.5;
      if (this.portalLight) {
        this.portalLight.intensity = 3 + Math.sin(this.elapsedTime * 3) * 1;
      }
    }

    // Check portal entry (only after boulder has fully slid away)
    if (this.boulderUnlocked && this.boulderSlideProgress >= 1 && !this.portalEntered) {
      const dist = playerPosition.distanceTo(this.portalPosition);
      if (dist < 1.8) {
        this.portalEntered = true;
        return { type: 'portal_entered' };
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
    // Sand ground — covers the +Z half (the beach)
    const sandGeometry = new THREE.PlaneGeometry(80, 50, 40, 25);
    sandGeometry.rotateX(-Math.PI / 2);

    // Gentle undulation
    const sandPos = sandGeometry.getAttribute('position');
    for (let i = 0; i < sandPos.count; i++) {
      const y = sandPos.getY(i);
      const z = sandPos.getZ(i);
      // Slope down slightly toward the water edge (negative Z in local space)
      const slopeDown = Math.max(0, (-z - 15) * 0.03);
      sandPos.setY(i, y + (Math.random() - 0.5) * 0.15 - slopeDown);
    }
    sandPos.needsUpdate = true;
    sandGeometry.computeVertexNormals();

    const sandMaterial = new THREE.MeshStandardMaterial({ color: 0xdeb887 });
    const sandMesh = new THREE.Mesh(sandGeometry, sandMaterial);
    sandMesh.position.set(0, 0, 15); // Offset toward +Z
    sandMesh.receiveShadow = true;
    scene.add(sandMesh);

    // Wet sand strip along the shoreline
    const wetSandGeo = new THREE.PlaneGeometry(80, 8, 40, 4);
    wetSandGeo.rotateX(-Math.PI / 2);
    const wetSandMat = new THREE.MeshStandardMaterial({ color: 0xc4a56e });
    const wetSandMesh = new THREE.Mesh(wetSandGeo, wetSandMat);
    wetSandMesh.position.set(0, -0.02, -6); // At shoreline
    wetSandMesh.receiveShadow = true;
    scene.add(wetSandMesh);

    // Physics ground: covers the walkable sand area
    const groundBodyDesc = rapier.RigidBodyDesc.fixed().setTranslation(0, -0.1, 10);
    const groundBody = world.createRigidBody(groundBodyDesc);
    const groundColliderDesc = rapier.ColliderDesc.cuboid(40, 0.1, 30);
    world.createCollider(groundColliderDesc, groundBody);
  }

  private createWater(scene: THREE.Scene): void {
    // Large water plane covering the -Z half
    const waterGeometry = new THREE.PlaneGeometry(80, 50, 40, 25);
    waterGeometry.rotateX(-Math.PI / 2);

    const waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x2277bb,
      opacity: 0.8,
      transparent: true,
    });

    this.waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
    this.waterMesh.position.set(0, -0.4, -25); // Water is below ground level
    scene.add(this.waterMesh);

    // Ocean floor underneath the water (dark sand)
    const floorGeo = new THREE.PlaneGeometry(80, 50);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x8b7355 });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(0, -1.5, -25);
    scene.add(floorMesh);
  }

  private createBoundaryWalls(world: InstanceType<typeof RAPIER.World>, rapier: typeof RAPIER): void {
    const wallPositions: [number, number, number][] = [
      [35, 5, 15],   // +X wall
      [-35, 5, 15],  // -X wall
      [0, 5, 35],    // +Z wall (back of beach)
      [0, 5, -8],    // -Z wall (shoreline — keep penguin out of water)
    ];

    const wallSizes: [number, number, number][] = [
      [0.1, 5, 25],  // X walls: narrower to match sand area
      [0.1, 5, 25],
      [35, 5, 0.1],  // Z walls
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
      // Cluster near right side of beach
      { x: 15, z: 18, size: 2.0 },
      { x: 17, z: 20, size: 1.5 },
      { x: 13, z: 22, size: 1.0 },
      { x: 16, z: 15, size: 0.7 },
      // Cluster near left side
      { x: -18, z: 8, size: 2.5 },
      { x: -15, z: 6, size: 1.8 },
      { x: -20, z: 10, size: 1.2 },
      // Along the shoreline (partially in wet sand)
      { x: -8, z: -2, size: 1.4 },
      { x: 5, z: -3, size: 1.6 },
      { x: 22, z: 0, size: 2.2 },
      { x: -25, z: 2, size: 0.8 },
      // Scattered across the beach
      { x: -5, z: 28, size: 0.5 },
      { x: 25, z: 25, size: 1.3 },
      { x: -12, z: 15, size: 0.9 },
      { x: 8, z: 12, size: 0.6 },
      { x: -22, z: 20, size: 1.7 },
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
      { x: 14, z: 23 },
      { x: 18, z: 16 },
      { x: -16, z: 7 },
      { x: -21, z: 11 },
      // Along back edge of beach
      { x: 28, z: 30 },
      { x: -28, z: 25 },
      { x: 20, z: 32 },
      { x: -10, z: 30 },
      // Scattered on beach
      { x: -6, z: 18 },
      { x: 12, z: 10 },
      { x: 24, z: 5 },
      { x: -14, z: 14 },
      { x: 6, z: 20 },
    ];

    for (const p of bushPositions) {
      this.createBush(scene, { x: p.x, y: 0, z: p.z });
    }
  }

  private shellKeyLight: THREE.PointLight | null = null;

  private createShellKey(scene: THREE.Scene): void {
    // Shell-shaped key — large, bright, and hard to miss
    const geometry = new THREE.TorusGeometry(0.4, 0.15, 8, 16);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffaa00,
      emissiveIntensity: 0.8,
      metalness: 0.6,
      roughness: 0.3,
    });
    this.shellKey = new THREE.Mesh(geometry, material);
    this.shellKey.scale.set(1, 0.6, 1);
    this.shellKey.position.set(-8, 1.0, 20); // Open area on the beach, easy to spot
    this.shellKey.castShadow = true;
    scene.add(this.shellKey);

    // Add a glowing point light so it illuminates the area
    this.shellKeyLight = new THREE.PointLight(0xffd700, 2, 8);
    this.shellKeyLight.position.copy(this.shellKey.position);
    scene.add(this.shellKeyLight);
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
    const boulderZ = 10;
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

  private createPortal(scene: THREE.Scene): void {
    const group = new THREE.Group();

    // Outer ring — glowing purple/blue
    const ringGeo = new THREE.TorusGeometry(1.2, 0.15, 8, 32);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x6644cc,
      emissive: 0x4422aa,
      emissiveIntensity: 0.8,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2; // Lay flat
    group.add(ring);

    // Inner swirl — semi-transparent disc
    const discGeo = new THREE.CircleGeometry(1.1, 32);
    const discMat = new THREE.MeshStandardMaterial({
      color: 0x8866ff,
      emissive: 0x6644dd,
      emissiveIntensity: 1.0,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.01;
    group.add(disc);

    // Second smaller ring for depth
    const innerRingGeo = new THREE.TorusGeometry(0.7, 0.1, 8, 24);
    const innerRingMat = new THREE.MeshStandardMaterial({
      color: 0xaa88ff,
      emissive: 0x8866dd,
      emissiveIntensity: 1.0,
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 0.02;
    group.add(innerRing);

    group.position.copy(this.portalPosition);
    group.position.y = 0.05; // Just above ground
    scene.add(group);
    this.portalMesh = group;

    // Portal glow light
    this.portalLight = new THREE.PointLight(0x8866ff, 3, 10);
    this.portalLight.position.set(this.portalPosition.x, 1, this.portalPosition.z);
    scene.add(this.portalLight);
  }

  private animateShellKey(): void {
    if (!this.shellKey) return;
    this.shellKey.rotateY(0.02);
    this.shellKey.position.y = 1.0 + Math.sin(this.elapsedTime * 2) * 0.2;
    if (this.shellKeyLight) {
      this.shellKeyLight.position.y = this.shellKey.position.y;
    }
  }

  private animateWater(): void {
    if (!this.waterMesh) return;

    const positionAttr = this.waterMesh.geometry.getAttribute('position');
    for (let i = 0; i < positionAttr.count; i++) {
      const x = positionAttr.getX(i);
      const z = positionAttr.getZ(i);
      // Gentle rolling waves
      const y = Math.sin(x * 0.15 + this.elapsedTime * 1.2) * 0.15 +
                Math.sin(z * 0.2 + this.elapsedTime * 0.8) * 0.1 +
                Math.sin((x + z) * 0.1 + this.elapsedTime * 0.5) * 0.05;
      positionAttr.setY(i, y);
    }
    positionAttr.needsUpdate = true;
    this.waterMesh.geometry.computeVertexNormals();
  }
}
