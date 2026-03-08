import * as THREE from 'three';
import type { PenguinParts } from './penguin';

export class PenguinAnimator {
  private parts: PenguinParts;
  private time = 0;

  private readonly waddleFrequency = 9; // Hz
  private readonly bodyRockAmplitude = 0.1; // rad
  private readonly flipperSwingAmplitude = 0.3; // rad
  private readonly footShuffleAmplitude = 0.2; // rad
  private readonly lerpSpeed = 5; // for returning to rest pose

  // Default rest rotations for flippers
  private readonly leftFlipperRestZ = 0.2;
  private readonly rightFlipperRestZ = -0.2;

  // Airborne flipper spread (increase Z rotation outward)
  private readonly leftFlipperAirborneZ = 0.6;
  private readonly rightFlipperAirborneZ = -0.6;

  constructor(parts: PenguinParts) {
    this.parts = parts;
  }

  update(deltaTime: number, isMoving: boolean, isGrounded: boolean): void {
    this.time += deltaTime;
    const phase = this.time * this.waddleFrequency * Math.PI * 2;

    if (isMoving && isGrounded) {
      // Waddle animation
      // Body rocks side to side
      this.parts.body.rotation.z = Math.sin(phase) * this.bodyRockAmplitude;

      // Flippers swing back and forth (opposite phase)
      this.parts.leftFlipper.rotation.x = Math.sin(phase) * this.flipperSwingAmplitude;
      this.parts.rightFlipper.rotation.x = Math.sin(phase + Math.PI) * this.flipperSwingAmplitude;

      // Flippers keep their default Z rotation while waddling
      this.parts.leftFlipper.rotation.z = this.leftFlipperRestZ;
      this.parts.rightFlipper.rotation.z = this.rightFlipperRestZ;

      // Feet shuffle alternately
      this.parts.leftFoot.rotation.x = Math.sin(phase) * this.footShuffleAmplitude;
      this.parts.rightFoot.rotation.x = Math.sin(phase + Math.PI) * this.footShuffleAmplitude;
    } else if (!isGrounded) {
      // Airborne: spread flippers, neutral feet
      const t = 1 - Math.exp(-this.lerpSpeed * deltaTime);

      this.parts.body.rotation.z = THREE.MathUtils.lerp(this.parts.body.rotation.z, 0, t);

      this.parts.leftFlipper.rotation.x = THREE.MathUtils.lerp(this.parts.leftFlipper.rotation.x, 0, t);
      this.parts.rightFlipper.rotation.x = THREE.MathUtils.lerp(this.parts.rightFlipper.rotation.x, 0, t);
      this.parts.leftFlipper.rotation.z = THREE.MathUtils.lerp(this.parts.leftFlipper.rotation.z, this.leftFlipperAirborneZ, t);
      this.parts.rightFlipper.rotation.z = THREE.MathUtils.lerp(this.parts.rightFlipper.rotation.z, this.rightFlipperAirborneZ, t);

      this.parts.leftFoot.rotation.x = THREE.MathUtils.lerp(this.parts.leftFoot.rotation.x, 0, t);
      this.parts.rightFoot.rotation.x = THREE.MathUtils.lerp(this.parts.rightFoot.rotation.x, 0, t);
    } else {
      // Idle and grounded: lerp back to rest pose
      const t = 1 - Math.exp(-this.lerpSpeed * deltaTime);

      this.parts.body.rotation.z = THREE.MathUtils.lerp(this.parts.body.rotation.z, 0, t);

      this.parts.leftFlipper.rotation.x = THREE.MathUtils.lerp(this.parts.leftFlipper.rotation.x, 0, t);
      this.parts.rightFlipper.rotation.x = THREE.MathUtils.lerp(this.parts.rightFlipper.rotation.x, 0, t);
      this.parts.leftFlipper.rotation.z = THREE.MathUtils.lerp(this.parts.leftFlipper.rotation.z, this.leftFlipperRestZ, t);
      this.parts.rightFlipper.rotation.z = THREE.MathUtils.lerp(this.parts.rightFlipper.rotation.z, this.rightFlipperRestZ, t);

      this.parts.leftFoot.rotation.x = THREE.MathUtils.lerp(this.parts.leftFoot.rotation.x, 0, t);
      this.parts.rightFoot.rotation.x = THREE.MathUtils.lerp(this.parts.rightFoot.rotation.x, 0, t);
    }
  }
}
