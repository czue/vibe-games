import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';

export interface PenguinParts {
  body: THREE.Mesh;
  leftFlipper: THREE.Mesh;
  rightFlipper: THREE.Mesh;
  leftFoot: THREE.Mesh;
  rightFoot: THREE.Mesh;
}

export function createPenguin(
  world: InstanceType<typeof RAPIER.World>,
  rapier: typeof RAPIER,
): { group: THREE.Group; parts: PenguinParts; rigidBody: InstanceType<typeof RAPIER.RigidBody> } {
  const group = new THREE.Group();

  // Materials
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0 });
  const orangeMat = new THREE.MeshStandardMaterial({ color: 0xff8c00 });
  const darkGreyMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a });

  // Body (slightly taller than wide)
  const bodyGeo = new THREE.SphereGeometry(0.3, 12, 10);
  bodyGeo.scale(1, 1.3, 0.9);
  const body = new THREE.Mesh(bodyGeo, blackMat);
  body.position.y = 0.55;
  group.add(body);

  // White belly
  const bellyGeo = new THREE.SphereGeometry(0.25, 10, 8);
  bellyGeo.scale(0.85, 1.2, 0.7);
  const belly = new THREE.Mesh(bellyGeo, whiteMat);
  belly.position.set(0, -0.02, 0.1);
  body.add(belly);

  // Head
  const headGeo = new THREE.SphereGeometry(0.2, 10, 8);
  const head = new THREE.Mesh(headGeo, blackMat);
  head.position.set(0, 0.45, 0.02);
  body.add(head);

  // Eyes - white part
  const eyeWhiteGeo = new THREE.SphereGeometry(0.045, 8, 6);
  const leftEyeWhite = new THREE.Mesh(eyeWhiteGeo, whiteMat);
  leftEyeWhite.position.set(-0.08, 0.04, 0.16);
  head.add(leftEyeWhite);

  const rightEyeWhite = new THREE.Mesh(eyeWhiteGeo, whiteMat);
  rightEyeWhite.position.set(0.08, 0.04, 0.16);
  head.add(rightEyeWhite);

  // Eyes - black pupils
  const pupilGeo = new THREE.SphereGeometry(0.025, 6, 6);
  const leftPupil = new THREE.Mesh(pupilGeo, blackMat);
  leftPupil.position.set(0, 0, 0.03);
  leftEyeWhite.add(leftPupil);

  const rightPupil = new THREE.Mesh(pupilGeo, blackMat);
  rightPupil.position.set(0, 0, 0.03);
  rightEyeWhite.add(rightPupil);

  // Beak (cone pointing forward)
  const beakGeo = new THREE.ConeGeometry(0.04, 0.12, 6);
  const beak = new THREE.Mesh(beakGeo, orangeMat);
  beak.position.set(0, -0.02, 0.22);
  beak.rotation.x = Math.PI / 2;
  head.add(beak);

  // Flippers (flattened boxes on each side)
  const flipperGeo = new THREE.BoxGeometry(0.08, 0.35, 0.15);
  const leftFlipper = new THREE.Mesh(flipperGeo, darkGreyMat);
  leftFlipper.position.set(-0.32, 0.05, 0);
  leftFlipper.rotation.z = 0.2;
  body.add(leftFlipper);

  const rightFlipper = new THREE.Mesh(flipperGeo, darkGreyMat);
  rightFlipper.position.set(0.32, 0.05, 0);
  rightFlipper.rotation.z = -0.2;
  body.add(rightFlipper);

  // Feet (flattened boxes at the base)
  const footGeo = new THREE.BoxGeometry(0.12, 0.04, 0.18);
  const leftFoot = new THREE.Mesh(footGeo, orangeMat);
  leftFoot.position.set(-0.1, 0, 0.03);
  group.add(leftFoot);

  const rightFoot = new THREE.Mesh(footGeo, orangeMat);
  rightFoot.position.set(0.1, 0, 0.03);
  group.add(rightFoot);

  // Physics rigid body
  const bodyDesc = rapier.RigidBodyDesc.dynamic()
    .setTranslation(0, 2, 0)
    .enabledRotations(false, true, false);
  const rigidBody = world.createRigidBody(bodyDesc);

  // Capsule collider sized to match the penguin mesh
  const colliderDesc = rapier.ColliderDesc.capsule(0.5, 0.3);
  world.createCollider(colliderDesc, rigidBody);

  return {
    group,
    parts: {
      body,
      leftFlipper,
      rightFlipper,
      leftFoot,
      rightFoot,
    },
    rigidBody,
  };
}
