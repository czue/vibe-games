import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';

export class PlayerController {
  private rigidBody: InstanceType<typeof RAPIER.RigidBody>;
  private rapier: typeof RAPIER;
  private world: InstanceType<typeof RAPIER.World>;
  private penguinGroup: THREE.Group;

  private keys = new Set<string>();
  private spaceWasReleased = true;
  private _isGrounded = false;

  private readonly moveSpeed = 5;
  private readonly jumpImpulse = 7;
  private readonly groundRayThreshold = 1.0;
  private readonly lerpFactor = 0.15;
  private readonly rotationLerpFactor = 0.15;

  private targetAngle = 0;

  constructor(
    rigidBody: InstanceType<typeof RAPIER.RigidBody>,
    rapier: typeof RAPIER,
    world: InstanceType<typeof RAPIER.World>,
    penguinGroup: THREE.Group,
  ) {
    this.rigidBody = rigidBody;
    this.rapier = rapier;
    this.world = world;
    this.penguinGroup = penguinGroup;

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'Space') {
        this.spaceWasReleased = true;
      }
    });
  }

  get isMoving(): boolean {
    const dir = this.getMovementDirection();
    return dir.x !== 0 || dir.z !== 0;
  }

  get isGrounded(): boolean {
    return this._isGrounded;
  }

  update(deltaTime: number): void {
    // Movement
    const dir = this.getMovementDirection();
    const currentVel = this.rigidBody.linvel();

    const targetVelX = dir.x * this.moveSpeed;
    const targetVelZ = dir.z * this.moveSpeed;

    const newVelX = THREE.MathUtils.lerp(currentVel.x, targetVelX, this.lerpFactor);
    const newVelZ = THREE.MathUtils.lerp(currentVel.z, targetVelZ, this.lerpFactor);

    this.rigidBody.setLinvel({ x: newVelX, y: currentVel.y, z: newVelZ }, true);

    // Rotation towards movement direction
    if (dir.x !== 0 || dir.z !== 0) {
      this.targetAngle = Math.atan2(dir.x, dir.z);
    }

    const currentRotation = this.penguinGroup.rotation.y;
    // Shortest path angle interpolation
    let angleDiff = this.targetAngle - currentRotation;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    this.penguinGroup.rotation.y = currentRotation + angleDiff * this.rotationLerpFactor;

    // Ground check
    const pos = this.rigidBody.translation();
    const ray = new this.rapier.Ray(
      { x: pos.x, y: pos.y, z: pos.z },
      { x: 0, y: -1, z: 0 },
    );
    const hit = this.world.castRay(ray, 2.0, true);
    this._isGrounded = hit !== null && hit.timeOfImpact < this.groundRayThreshold;

    // Jump
    if (this.keys.has('Space') && this._isGrounded && this.spaceWasReleased) {
      this.rigidBody.applyImpulse({ x: 0, y: this.jumpImpulse, z: 0 }, true);
      this.spaceWasReleased = false;
    }
  }

  private getMovementDirection(): { x: number; z: number } {
    let x = 0;
    let z = 0;

    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;

    // Normalize diagonal movement
    const len = Math.sqrt(x * x + z * z);
    if (len > 0) {
      x /= len;
      z /= len;
    }

    return { x, z };
  }
}
