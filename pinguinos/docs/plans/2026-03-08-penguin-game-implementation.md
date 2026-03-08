# Pinguinos Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a playable 3D browser game where a penguin waddles and jumps around Boulders Beach collecting shells.

**Architecture:** Three.js renders the scene, Rapier handles physics/collisions, Vite bundles everything. Game loop runs on requestAnimationFrame with delta-time. Player, levels, and UI are decoupled modules.

**Tech Stack:** Three.js, @dimforge/rapier3d-compat, Vite, TypeScript

---

### Task 1: Project Scaffold

**Files:**
- Create: `pinguinos/package.json`
- Create: `pinguinos/tsconfig.json`
- Create: `pinguinos/vite.config.ts`
- Create: `pinguinos/index.html`
- Create: `pinguinos/src/main.ts`

**Step 1: Initialize the project**

```bash
cd pinguinos
npm init -y
```

**Step 2: Install dependencies**

```bash
npm install three @dimforge/rapier3d-compat
npm install -D typescript vite @types/three
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "sourceMap": true
  },
  "include": ["src"]
}
```

**Step 4: Create vite.config.ts**

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
  },
});
```

**Step 5: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Pinguinos</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { overflow: hidden; background: #000; }
    canvas { display: block; }
    #ui {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      pointer-events: none;
      font-family: 'Segoe UI', sans-serif;
      color: white;
      text-shadow: 1px 1px 3px rgba(0,0,0,0.7);
    }
    #objective {
      text-align: center;
      padding: 20px;
      font-size: 24px;
    }
    #controls-hint {
      position: absolute;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 16px;
      opacity: 1;
      transition: opacity 2s;
    }
    #completion {
      display: none;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 48px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div id="ui">
    <div id="objective"></div>
    <div id="controls-hint">WASD to move, Space to jump</div>
    <div id="completion">You found all the shells!</div>
  </div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

**Step 6: Create minimal src/main.ts**

```ts
import * as THREE from 'three';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10);
camera.lookAt(0, 0, 0);

// Test cube
const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0x00ff00 })
);
scene.add(cube);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 5);
scene.add(light);
scene.add(new THREE.AmbientLight(0x404040));

function animate() {
  requestAnimationFrame(animate);
  cube.rotation.y += 0.01;
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
```

**Step 7: Verify it works**

```bash
npx vite --open
```

Expected: Browser opens showing a spinning green cube on a sky-blue background.

**Step 8: Commit**

```bash
git add pinguinos/
git commit -m "feat: scaffold Pinguinos project with Three.js + Vite"
```

---

### Task 2: Physics Setup

**Files:**
- Create: `pinguinos/src/physics.ts`
- Modify: `pinguinos/src/main.ts`

**Step 1: Create physics.ts**

Initialize Rapier world with gravity. Export an `initPhysics()` async function (Rapier requires async WASM init) that returns the world and provides helpers for creating rigid bodies and colliders.

```ts
import RAPIER from '@dimforge/rapier3d-compat';

export async function initPhysics() {
  await RAPIER.init();
  const gravity = new RAPIER.Vector3(0.0, -9.81, 0.0);
  const world = new RAPIER.World(gravity);
  return { world, RAPIER };
}
```

**Step 2: Update main.ts to use async init**

Wrap the game startup in an async function that calls `initPhysics()` before creating the scene. Remove the test cube. Store the world reference for the game loop.

**Step 3: Add a physics ground plane**

Create a fixed rigid body with a cuboid collider (wide, thin) to act as the ground. Add a matching Three.js plane mesh so you can see it.

**Step 4: Verify**

Run dev server. Should see a flat ground plane with sky background. Nothing falls yet since there's no dynamic body.

**Step 5: Commit**

```bash
git add pinguinos/src/
git commit -m "feat: add Rapier physics world with ground plane"
```

---

### Task 3: Penguin Model

**Files:**
- Create: `pinguinos/src/player/penguin.ts`
- Modify: `pinguinos/src/main.ts`

**Step 1: Create penguin.ts**

Build a `createPenguin()` function that returns a Three.js Group containing:

- **Body:** SphereGeometry slightly scaled on Y axis (taller than wide), black MeshStandardMaterial. Add a white belly using a second slightly smaller sphere positioned forward.
- **Head:** Smaller SphereGeometry on top of body, black material.
- **Eyes:** Two tiny white spheres with black pupil spheres on the head.
- **Beak:** ConeGeometry, orange material, rotated to point forward from head.
- **Flippers:** Flattened BoxGeometry on each side of body, dark grey/black material.
- **Feet:** Two small flattened BoxGeometry at base, orange material.

The function returns `{ group, parts }` where `parts` gives named references to flippers, feet, body for animation later.

**Step 2: Add penguin to scene in main.ts**

Import `createPenguin`, add the group to the scene, position it at (0, 1, 0) so it's above the ground.

**Step 3: Verify**

Run dev server. Should see a recognizable penguin standing on the ground plane.

**Step 4: Commit**

```bash
git add pinguinos/src/player/
git commit -m "feat: add procedural low-poly penguin model"
```

---

### Task 4: Player Physics Body

**Files:**
- Modify: `pinguinos/src/player/penguin.ts`
- Modify: `pinguinos/src/main.ts`

**Step 1: Add a dynamic rigid body to the penguin**

In `createPenguin()`, accept the Rapier world and RAPIER module as parameters. Create a dynamic rigid body with a capsule collider sized to match the penguin mesh. Lock rotations on X and Z axes so the penguin doesn't topple over.

**Step 2: Sync mesh position to physics body each frame**

In the game loop, read the rigid body's translation and update the Three.js group's position to match.

**Step 3: Verify**

Run dev server. Penguin should spawn above ground and fall onto it due to gravity, then rest on the surface.

**Step 4: Commit**

```bash
git add pinguinos/src/
git commit -m "feat: add physics body to penguin with gravity"
```

---

### Task 5: Player Controller (Movement + Jump)

**Files:**
- Create: `pinguinos/src/player/controller.ts`
- Modify: `pinguinos/src/main.ts`

**Step 1: Create controller.ts**

Build a `PlayerController` class that:

- Tracks currently pressed keys via `keydown`/`keyup` event listeners
- Has an `update(deltaTime)` method that:
  - Reads WASD/arrow key state
  - Computes a movement direction vector
  - Applies velocity to the rigid body (set linvel) for horizontal movement
  - Preserves the Y velocity from physics (gravity/jumping)
  - Applies smooth acceleration/deceleration using lerp
- Has a jump method triggered by spacebar:
  - Casts a ray downward from the penguin to detect ground (Rapier raycast)
  - Only jumps if grounded (ray hit distance < threshold)
  - Applies an upward impulse

Movement speed: ~5 units/sec. Jump impulse: ~7 units upward.

**Step 2: Rotate penguin to face movement direction**

When the penguin moves, smoothly rotate the group to face the direction of movement using `Math.atan2` and lerping the rotation.

**Step 3: Wire controller into main.ts game loop**

Create the controller after physics init, call `controller.update(delta)` each frame.

**Step 4: Verify**

Run dev server. WASD moves the penguin across the ground. Space makes it jump. Penguin faces the direction it moves. Can't double-jump.

**Step 5: Commit**

```bash
git add pinguinos/src/
git commit -m "feat: add player controller with WASD movement and jump"
```

---

### Task 6: Third-Person Camera

**Files:**
- Modify: `pinguinos/src/main.ts` (or create `pinguinos/src/camera.ts` if cleaner)

**Step 1: Create a follow camera**

Build a camera controller that:
- Positions the camera behind and above the penguin (offset: 0, 4, 8 relative to penguin)
- Smoothly follows using lerp (lag factor ~0.05-0.1 per frame)
- Always looks at the penguin's position (slightly above center)

**Step 2: Verify**

Run dev server. Camera smoothly follows the penguin as it waddles around. Feels natural and not jerky.

**Step 3: Commit**

```bash
git add pinguinos/src/
git commit -m "feat: add smooth third-person follow camera"
```

---

### Task 7: Waddle Animation

**Files:**
- Create: `pinguinos/src/player/animations.ts`
- Modify: `pinguinos/src/main.ts`

**Step 1: Create animations.ts**

Build a `PenguinAnimator` class that:
- Takes the penguin parts (flippers, feet, body) as constructor args
- Has an `update(deltaTime, isMoving, isGrounded)` method
- When moving and grounded:
  - Rocks the body side to side (rotate on Z axis, sinusoidal)
  - Swings flippers back and forth (rotate on X axis, opposite phase)
  - Shuffles feet slightly
- When idle: slowly returns to neutral pose
- When airborne: flippers spread out slightly

Animation speed should scale with movement speed.

**Step 2: Wire into game loop**

Call `animator.update()` each frame with the appropriate state.

**Step 3: Verify**

Run dev server. Penguin visibly waddles when moving — body rocks, flippers swing. Looks cute.

**Step 4: Commit**

```bash
git add pinguinos/src/
git commit -m "feat: add waddle animation for penguin"
```

---

### Task 8: Boulders Beach Level — Ground & Water

**Files:**
- Create: `pinguinos/src/levels/level.ts`
- Create: `pinguinos/src/levels/boulders-beach.ts`
- Modify: `pinguinos/src/main.ts`

**Step 1: Create level.ts**

Define a `Level` interface:
```ts
interface Level {
  setup(scene: THREE.Scene, world: RAPIER.World, RAPIER: typeof import('@dimforge/rapier3d-compat')): void;
  update(deltaTime: number): void;
  checkCollectibles(playerPosition: THREE.Vector3): CollectibleResult | null;
}

interface CollectibleResult {
  id: string;
  type: string;
}
```

**Step 2: Create boulders-beach.ts**

Implement the Level interface:
- **Ground:** Large plane with vertex displacement for slight undulation, warm tan MeshStandardMaterial (color: 0xdeb887). Physics: fixed body with cuboid collider.
- **Water:** Plane on one side, semi-transparent blue material (color: 0x4488cc, opacity: 0.7). Animate vertices up/down in `update()` for wave effect. No physics collider (visual only for v1).
- **Boundary walls:** Invisible fixed body colliders around the level perimeter to keep the penguin in bounds.

**Step 3: Replace ground plane in main.ts with level**

Remove the old ground plane. Create a `BouldersBeach` level instance, call `setup()`, call `update()` in game loop.

**Step 4: Verify**

Penguin walks on sandy-colored terrain. Water visible on one side with subtle wave animation. Penguin can't walk off the edge of the level.

**Step 5: Commit**

```bash
git add pinguinos/src/
git commit -m "feat: add Boulders Beach level with sand terrain and water"
```

---

### Task 9: Boulders & Vegetation

**Files:**
- Modify: `pinguinos/src/levels/boulders-beach.ts`

**Step 1: Add boulders**

Create a `createBoulder(size, position)` helper that:
- Creates an IcosahedronGeometry with low detail, randomly perturbed vertices for organic shape
- Grey/brown MeshStandardMaterial with slight color variation per boulder
- Matching fixed rigid body with convex hull or ball collider in Rapier
- Place 15-20 boulders of varying sizes across the level

**Step 2: Add vegetation**

Create simple bush shapes:
- Clusters of 2-3 small SphereGeometry with green material, slightly different shades
- Place near boulders and around the level edges
- No physics colliders (decorative only)

**Step 3: Verify**

Level looks like a rocky beach with scattered boulders the penguin bumps into and walks around. Bushes add visual variety.

**Step 4: Commit**

```bash
git add pinguinos/src/
git commit -m "feat: add boulders and vegetation to beach level"
```

---

### Task 10: Lighting & Shadows

**Files:**
- Modify: `pinguinos/src/main.ts` or `pinguinos/src/scene.ts`

**Step 1: Set up proper lighting**

- Create `scene.ts` if it doesn't exist yet
- Warm directional light (slightly yellow-tinted, 0xfff5e6) positioned like afternoon sun
- Soft ambient light (0x8899aa) for fill
- Enable shadow mapping on the renderer (`renderer.shadowMap.enabled = true`)
- DirectionalLight casts shadows, configure shadow camera to cover the level area
- Ground and boulders receive shadows
- Penguin and boulders cast shadows

**Step 2: Add sky color / fog**

- Scene background: light blue gradient feel (0x87ceeb)
- Optional: light fog for depth (same color, far distance)

**Step 3: Verify**

Boulders and penguin cast visible shadows on the sand. Lighting feels warm and natural.

**Step 4: Commit**

```bash
git add pinguinos/src/
git commit -m "feat: add warm lighting and shadows"
```

---

### Task 11: Collectible Shells

**Files:**
- Modify: `pinguinos/src/levels/boulders-beach.ts`
- Modify: `pinguinos/src/main.ts`

**Step 1: Create shell collectibles**

Build a `createShell(position)` function:
- Small shell shape using LatheGeometry (rotated profile curve) or a flattened torus, cream/pink colored
- Add a PointLight or emissive material for subtle glow
- Slowly rotate and bob up/down in the `update()` method
- Track shells in an array with positions and collected state

**Step 2: Implement collection detection**

In `checkCollectibles()`:
- Check distance between player position and each uncollected shell
- If within collection radius (~1.5 units), mark as collected
- Remove the shell mesh from the scene (or make invisible)
- Return the collectible result

**Step 3: Wire into main.ts**

Each frame, call `level.checkCollectibles(penguinPosition)`. Track collected count.

**Step 4: Place 5 shells around the level**

Position them in interesting spots — behind boulders, near the water, among vegetation.

**Step 5: Verify**

Shells visible, glowing, bobbing. Walking over them makes them disappear. Console log confirms collection.

**Step 6: Commit**

```bash
git add pinguinos/src/
git commit -m "feat: add collectible shells to beach level"
```

---

### Task 12: UI — Objective Counter & Completion

**Files:**
- Create: `pinguinos/src/ui.ts`
- Modify: `pinguinos/src/main.ts`

**Step 1: Create ui.ts**

Build a `GameUI` class that:
- References the HTML elements (#objective, #controls-hint, #completion)
- `updateObjective(collected, total)` — updates the objective text: "Shells: 3/5"
- `showCompletion()` — shows the completion message
- `fadeControlsHint()` — fades out the controls hint after 5 seconds

**Step 2: Wire into main.ts**

- Create `GameUI` instance on startup
- Call `fadeControlsHint()` on start
- Update objective display when a shell is collected
- Show completion when all 5 are collected

**Step 3: Verify**

UI shows shell count updating as you collect them. Controls hint fades. Completion message appears when all 5 are found.

**Step 4: Commit**

```bash
git add pinguinos/src/
git commit -m "feat: add UI with objective counter and completion message"
```

---

### Task 13: Polish & Final Verification

**Files:**
- Various minor tweaks across existing files

**Step 1: Tune movement feel**

- Adjust movement speed, jump height, camera follow distance
- Make sure the penguin feels good to control
- Tweak waddle animation speed

**Step 2: Tune level layout**

- Adjust boulder placement so shells aren't too easy/hard to find
- Make sure there are no spots where the penguin gets stuck
- Ensure level boundaries feel natural

**Step 3: Add window resize handling**

Ensure the game handles browser resize correctly (already partially done in Task 1).

**Step 4: Final playthrough**

Play through the entire level:
- Walk around the whole beach
- Collect all 5 shells
- Verify completion message
- Check for visual glitches or physics issues

**Step 5: Commit**

```bash
git add pinguinos/
git commit -m "feat: polish gameplay feel and level layout"
```
