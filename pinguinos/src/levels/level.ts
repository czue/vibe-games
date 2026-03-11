import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';

export interface LevelEvent {
  type: 'key_collected' | 'boulder_unlocked' | 'portal_entered' | 'reached_maze' | 'reached_center' | 'cutscene_done';
}

export interface Level {
  setup(scene: THREE.Scene, world: InstanceType<typeof RAPIER.World>, rapier: typeof RAPIER): void;
  update(deltaTime: number, playerPosition: THREE.Vector3): LevelEvent | null;
  isComplete(): boolean;
  getSpawnPosition?(): { x: number; y: number; z: number };
}
