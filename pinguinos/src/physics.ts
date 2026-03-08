import RAPIER from '@dimforge/rapier3d-compat';

export async function initPhysics() {
  await RAPIER.init();
  const gravity = new RAPIER.Vector3(0.0, -9.81, 0.0);
  const world = new RAPIER.World(gravity);
  return { world, RAPIER };
}
