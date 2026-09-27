import * as THREE from 'three';

export class FollowCamera {
  private camera: THREE.PerspectiveCamera;
  target: THREE.Group;
  offset: THREE.Vector3;
  private lagFactor: number;

  // For rotation-following mode
  private followRotation = false;
  private currentAngle = 0;

  constructor(camera: THREE.PerspectiveCamera, target: THREE.Group) {
    this.camera = camera;
    this.target = target;
    this.offset = new THREE.Vector3(0, 4, 8);
    this.lagFactor = 0.07;
  }

  /** Enable rotation-following mode: camera orbits behind the penguin's facing direction */
  setFollowRotation(enabled: boolean): void {
    this.followRotation = enabled;
  }

  update(deltaTime: number): void {
    let desiredPosition: THREE.Vector3;

    if (this.followRotation) {
      // Camera orbits to stay behind the penguin based on its Y rotation
      const targetAngle = this.target.rotation.y + Math.PI; // Behind the penguin
      // Smooth the angle
      let angleDiff = targetAngle - this.currentAngle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      this.currentAngle += angleDiff * 0.05;

      const dist = this.offset.length();
      const heightOffset = this.offset.y;
      const horizDist = Math.sqrt(dist * dist - heightOffset * heightOffset);

      desiredPosition = new THREE.Vector3(
        this.target.position.x + Math.sin(this.currentAngle) * horizDist,
        this.target.position.y + heightOffset,
        this.target.position.z + Math.cos(this.currentAngle) * horizDist,
      );
    } else {
      // Fixed offset mode (original behavior)
      desiredPosition = new THREE.Vector3().copy(this.target.position).add(this.offset);
    }

    this.camera.position.lerp(desiredPosition, this.lagFactor);

    this.camera.lookAt(
      this.target.position.x,
      this.target.position.y + 1,
      this.target.position.z
    );
  }
}
