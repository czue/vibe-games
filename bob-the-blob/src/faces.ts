import * as THREE from 'three';

const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
const black = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });

/** Two googly eyes facing +z. Pupils are slightly crossed, because it's funnier. */
export function makeEyes(size: number, spacing: number, angry = false): THREE.Group {
  const g = new THREE.Group();
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(size, 16, 12), white);
    eye.position.x = side * spacing;
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(size * 0.5, 12, 8), black);
    pupil.position.set(-side * size * 0.12, -size * 0.08, size * 0.75);
    eye.add(pupil);
    g.add(eye);
    if (angry) {
      const brow = new THREE.Mesh(new THREE.BoxGeometry(size * 1.7, size * 0.35, size * 0.35), black);
      brow.position.set(side * spacing, size * 1.15, size * 0.5);
      brow.rotation.z = side * 0.45;
      g.add(brow);
    }
  }
  return g;
}

/** 'smile' hangs below the anchor, 'frown' arches above it, 'grin' is an open half-circle mouth. */
export function makeMouth(width: number, kind: 'smile' | 'frown' | 'grin'): THREE.Mesh {
  if (kind === 'grin') {
    return new THREE.Mesh(new THREE.CircleGeometry(width, 16, Math.PI, Math.PI), black);
  }
  const m = new THREE.Mesh(new THREE.TorusGeometry(width, width * 0.2, 6, 16, Math.PI), black);
  if (kind === 'smile') m.rotation.z = Math.PI;
  return m;
}

export function makeStars(): THREE.Group {
  const g = new THREE.Group();
  const starMat = new THREE.MeshBasicMaterial({ color: 0xffeb3b });
  for (let i = 0; i < 3; i++) {
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.15), starMat);
    const a = (i / 3) * Math.PI * 2;
    star.position.set(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5);
    g.add(star);
  }
  g.visible = false;
  return g;
}
