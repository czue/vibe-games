import * as THREE from 'three';

export class FollowCamera {
  private camera: THREE.PerspectiveCamera;
  target: THREE.Group;
  offset: THREE.Vector3;
  private lagFactor: number;

  constructor(camera: THREE.PerspectiveCamera, target: THREE.Group) {
    this.camera = camera;
    this.target = target;
    this.offset = new THREE.Vector3(0, 4, 8);
    this.lagFactor = 0.07;
  }

  update(deltaTime: number): void {
    // Calculate desired camera position: target position + offset
    const desiredPosition = new THREE.Vector3().copy(this.target.position).add(this.offset);

    // Smoothly lerp the camera position toward the desired position
    this.camera.position.lerp(desiredPosition, this.lagFactor);

    // Look at the target position, offset slightly upward
    this.camera.lookAt(
      this.target.position.x,
      this.target.position.y + 1,
      this.target.position.z
    );
  }
}
