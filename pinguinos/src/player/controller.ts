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
  private airJumpsUsed = 0;
  private readonly maxAirJumps = 1;
  private _didJump = false; // true on the frame a jump happens

  private readonly moveSpeed = 5;
  private readonly jumpImpulse = 3.5;
  private readonly airJumpImpulse = 4.0;
  private readonly groundRayThreshold = 0.15;
  private readonly lerpFactor = 0.15;
  private readonly rotationLerpFactor = 0.15;
  private readonly turnSpeed = 3.0;

  private targetAngle = 0;
  private tankControls = false;

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

    this.targetAngle = penguinGroup.rotation.y;

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

  setTankControls(enabled: boolean): void {
    this.tankControls = enabled;
  }

  get isMoving(): boolean {
    if (this.tankControls) {
      return this.keys.has('KeyW') || this.keys.has('ArrowUp') ||
             this.keys.has('KeyS') || this.keys.has('ArrowDown');
    }
    const dir = this.getMovementDirection();
    return dir.x !== 0 || dir.z !== 0;
  }

  get isGrounded(): boolean {
    return this._isGrounded;
  }

  get didJump(): boolean {
    return this._didJump;
  }

  get isAirJump(): boolean {
    return this._didJump && this.airJumpsUsed > 0;
  }

  update(deltaTime: number): void {
    const currentVel = this.rigidBody.linvel();

    if (this.tankControls) {
      // Tank controls: A/D turn, W/S move forward/back relative to facing
      let turnInput = 0;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) turnInput += 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) turnInput -= 1;
      this.targetAngle += turnInput * this.turnSpeed * deltaTime;
      this.penguinGroup.rotation.y = this.targetAngle;

      let forwardInput = 0;
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) forwardInput += 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) forwardInput -= 1;

      // Move in the direction the penguin faces
      const targetVelX = Math.sin(this.targetAngle) * forwardInput * this.moveSpeed;
      const targetVelZ = Math.cos(this.targetAngle) * forwardInput * this.moveSpeed;

      const newVelX = THREE.MathUtils.lerp(currentVel.x, targetVelX, this.lerpFactor);
      const newVelZ = THREE.MathUtils.lerp(currentVel.z, targetVelZ, this.lerpFactor);
      this.rigidBody.setLinvel({ x: newVelX, y: currentVel.y, z: newVelZ }, true);
    } else {
      // World-axis controls: WASD maps to world directions
      const dir = this.getMovementDirection();
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
      let angleDiff = this.targetAngle - currentRotation;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      this.penguinGroup.rotation.y = currentRotation + angleDiff * this.rotationLerpFactor;
    }

    // Ground check — start the ray just inside the capsule bottom (which sits at -0.8)
    // and exclude our own body. Starting it below the capsule put the origin inside the
    // floor collider while standing, so resting on the ground never counted as grounded.
    const pos = this.rigidBody.translation();
    const ray = new this.rapier.Ray(
      { x: pos.x, y: pos.y - 0.75, z: pos.z },
      { x: 0, y: -1, z: 0 },
    );
    const hit = this.world.castRay(ray, 0.5, true, undefined, undefined, undefined, this.rigidBody);
    this._isGrounded = hit !== null && hit.timeOfImpact < this.groundRayThreshold;

    // Reset air jumps when grounded
    if (this._isGrounded) {
      this.airJumpsUsed = 0;
    }

    // Jump (ground jump + up to 2 air jumps = triple jump)
    this._didJump = false;
    if (this.keys.has('Space') && this.spaceWasReleased) {
      if (this._isGrounded) {
        // Ground jump
        this.rigidBody.applyImpulse({ x: 0, y: this.jumpImpulse, z: 0 }, true);
        this.spaceWasReleased = false;
        this._didJump = true;
      } else if (this.airJumpsUsed < this.maxAirJumps) {
        // Air jump — cancel downward velocity first for consistent height
        const vel = this.rigidBody.linvel();
        this.rigidBody.setLinvel({ x: vel.x, y: 0, z: vel.z }, true);
        this.rigidBody.applyImpulse({ x: 0, y: this.airJumpImpulse, z: 0 }, true);
        this.airJumpsUsed++;
        this.spaceWasReleased = false;
        this._didJump = true;
      }
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
