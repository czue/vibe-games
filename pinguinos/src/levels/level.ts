import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';

export interface CollectibleResult {
  id: string;
  type: string;
}

export interface Level {
  setup(scene: THREE.Scene, world: InstanceType<typeof RAPIER.World>, rapier: typeof RAPIER): void;
  update(deltaTime: number): void;
  checkCollectibles(playerPosition: THREE.Vector3): CollectibleResult | null;
}
