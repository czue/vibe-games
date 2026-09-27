import * as THREE from 'three';
import { makeEyes } from './faces';
import type { Thing } from './things';

export interface Swallowed {
  thing: Thing;
  gain: number;
}

export const BOB_START_COLOR = 0x7ddf64;

export class Bob {
  group = new THREE.Group();
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  volume = 0.125; // radius is the cube root of this, so eating adds up like real blobs do
  facing = 0;
  grounded = true;
  hearts = 3;
  maxHearts = 3;
  squashTimer = 0;
  invuln = 0;
  gulpTimer = 0;
  landSquish = 0;
  visualBoost = 1; // extra scale for the "getting bigger!" level-up moment
  stomach: Swallowed[] = [];
  color = new THREE.Color(BOB_START_COLOR);

  private pivot = new THREE.Group();
  private material: THREE.MeshPhysicalMaterial;
  private mouth: THREE.Mesh;
  private shown = new THREE.Color();

  constructor() {
    this.material = new THREE.MeshPhysicalMaterial({
      color: this.color,
      roughness: 0.25,
      clearcoat: 1,
      clearcoatRoughness: 0.15,
    });
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), this.material);
    body.scale.set(1, 0.85, 1);
    body.position.y = 0.85;
    body.castShadow = true;

    const shine = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }),
    );
    shine.position.set(-0.45, 1.35, 0.45);
    shine.scale.set(1, 0.6, 0.6);

    const eyes = makeEyes(0.2, 0.3);
    eyes.position.set(0, 1.08, 0.88);

    this.mouth = new THREE.Mesh(new THREE.CircleGeometry(1, 20), new THREE.MeshBasicMaterial({ color: 0x222222 }));
    this.mouth.position.set(0, 0.68, 1.0);
    this.mouth.scale.set(0.2, 0.06, 1);

    this.pivot.add(body, shine, eyes, this.mouth);
    this.group.add(this.pivot);
  }

  get radius(): number {
    return Math.cbrt(this.volume);
  }

  updateVisual(dt: number, t: number): void {
    const r = this.radius;
    this.group.position.copy(this.pos);
    this.group.scale.setScalar(r * this.visualBoost);

    let d = this.facing - this.group.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.group.rotation.y += d * Math.min(1, dt * 12);

    this.landSquish = Math.max(0, this.landSquish - dt * 4);
    this.gulpTimer = Math.max(0, this.gulpTimer - dt);

    if (this.squashTimer > 0) {
      this.pivot.scale.set(1.7, 0.15, 1.7); // pancake!
    } else {
      const speed = Math.hypot(this.vel.x, this.vel.z);
      const breathe = Math.sin(t * 4) * 0.03;
      const wobble = Math.sin(t * 14) * 0.06 * Math.min(1, speed / (3 * r + 1));
      const sy = THREE.MathUtils.clamp(1 + this.vel.y * 0.02 + breathe + wobble - this.landSquish * 0.35, 0.5, 1.4);
      const sxz = 1 / Math.sqrt(sy);
      const k = Math.min(1, dt * 18);
      this.pivot.scale.x += (sxz - this.pivot.scale.x) * k;
      this.pivot.scale.y += (sy - this.pivot.scale.y) * k;
      this.pivot.scale.z += (sxz - this.pivot.scale.z) * k;
    }

    if (this.gulpTimer > 0) this.mouth.scale.set(0.28, 0.2, 1);
    else this.mouth.scale.set(0.2, 0.06, 1);

    this.group.visible = !(this.invuln > 0 && this.squashTimer <= 0 && Math.floor(t * 12) % 2 === 0);

    // Bob's color comes from what he ate, and gets deeper and richer the bigger he is.
    this.shown.copy(this.color).offsetHSL(0, 0.08 * (r - 0.5), -0.07 * (r - 0.5));
    this.material.color.copy(this.shown);
  }
}
