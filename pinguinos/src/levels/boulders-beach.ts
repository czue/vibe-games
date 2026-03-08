import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Level, CollectibleResult } from './level';

export class BouldersBeach implements Level {
  private waterMesh: THREE.Mesh | null = null;
  private elapsedTime = 0;
  private shells: { mesh: THREE.Mesh; id: string; collected: boolean }[] = [];

  setup(scene: THREE.Scene, world: InstanceType<typeof RAPIER.World>, rapier: typeof RAPIER): void {
    this.createGround(scene, world, rapier);
    this.createWater(scene);
    this.createBoundaryWalls(world, rapier);
    this.placeBoulders(scene, world, rapier);
    this.placeBushes(scene);

    // Place collectible shells
    const shellPositions: [number, number, number][] = [
      [16, 0.3, 13],    // Behind a large boulder
      [-17, 0.3, -11],  // Near the water edge
      [-7, 0.3, 21],    // Among some bushes
      [23, 0.3, -6],    // In a corner of the map
      [9, 0.3, -24],    // Near a cluster of boulders
    ];
    shellPositions.forEach((pos, i) => {
      this.createShell(scene, new THREE.Vector3(pos[0], pos[1], pos[2]), `shell-${i}`);
    });
  }

  update(deltaTime: number): void {
    this.elapsedTime += deltaTime;
    this.animateWater();
    this.animateShells(deltaTime);
  }

  checkCollectibles(playerPosition: THREE.Vector3): CollectibleResult | null {
    for (const shell of this.shells) {
      if (shell.collected) continue;
      const dist = playerPosition.distanceTo(shell.mesh.position);
      if (dist < 1.5) {
        shell.collected = true;
        shell.mesh.removeFromParent();
        return { id: shell.id, type: 'shell' };
      }
    }
    return null;
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
    const geometry = new THREE.IcosahedronGeometry(size, 1);
    const positionAttr = geometry.getAttribute('position');
    for (let i = 0; i < positionAttr.count; i++) {
      const scale = 0.8 + Math.random() * 0.4;
      positionAttr.setX(i, positionAttr.getX(i) * scale);
      positionAttr.setY(i, positionAttr.getY(i) * scale);
      positionAttr.setZ(i, positionAttr.getZ(i) * scale);
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

  private createShell(scene: THREE.Scene, position: THREE.Vector3, id: string): void {
    const geometry = new THREE.TorusGeometry(0.15, 0.06, 8, 12);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffd4b8,
      emissive: 0xffaa66,
      emissiveIntensity: 0.3,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.set(1, 0.5, 1);
    mesh.position.copy(position);
    scene.add(mesh);
    this.shells.push({ mesh, id, collected: false });
  }

  private animateShells(deltaTime: number): void {
    for (let i = 0; i < this.shells.length; i++) {
      const shell = this.shells[i];
      if (shell.collected) continue;
      shell.mesh.rotateY(2 * deltaTime);
      shell.mesh.position.y = 0.3 + Math.sin(this.elapsedTime * 2 + i) * 0.15;
    }
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
