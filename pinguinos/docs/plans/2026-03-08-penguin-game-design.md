# Pinguinos — 3D Penguin Adventure Game

## Overview

A 3D browser game where a penguin explores semi-linear levels with specific objectives,
inspired by Kirby and the Forgotten Land. Low-poly stylized visuals, built for extensibility
with an item-based ability system.

## Tech Stack

- **Three.js** — rendering, scene management
- **Rapier (@dimforge/rapier3d-compat)** — physics, collisions, ground detection
- **Vite** — dev server and bundling
- **Vanilla TypeScript** — type safety, no framework overhead

## Project Structure

```
pinguinos/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.ts              # Entry point, game loop
    ├── scene.ts             # Scene, camera, lighting setup
    ├── physics.ts           # Rapier world setup
    ├── player/
    │   ├── penguin.ts       # Penguin model (procedural geometry)
    │   ├── controller.ts    # Input handling, movement
    │   └── animations.ts    # Waddle/jump animations
    ├── levels/
    │   ├── level.ts         # Base level interface
    │   └── boulders-beach.ts # First level
    └── utils/
        └── helpers.ts
```

## Penguin Character

### Visual Design
Procedural low-poly penguin built from Three.js geometry:
- Rounded body (sphere/capsule) — black with white belly
- Head (smaller sphere) — orange beak, simple eyes
- Flippers (flat elongated shapes) — animate during waddle
- Feet (small orange shapes)

### Movement
- **Waddle:** WASD/arrow keys, smooth acceleration/deceleration, side-to-side body rock
- **Jump:** Spacebar, ground detection via Rapier raycast (no double-jump)
- Third-person camera follows behind with slight lag

### Item System (future)
- Base moveset is permanent: waddle + jump only
- Items are collectible objects that grant abilities (e.g., surfboard, helmet, fish)
- Internally: `Inventory` class with `onUse()` hook per item
- Not built in v1 — code structured to accommodate it later

## Boulders Beach Level

Inspired by Boulders Beach, South Africa — where penguins actually live.

### Environment (all procedural low-poly geometry)
- **Sand ground:** Flat plane with slight undulation, warm tan color
- **Boulders:** Various sizes, grey/brown, physics-enabled solid colliders
- **Water edge:** Shallow blue water on one side, animated wave effect (visual only)
- **Vegetation:** Simple low-poly bushes/scrub grass clusters
- **Boundaries:** Natural edges (rocks, water, cliffs) to keep penguin in bounds

### Lighting
- Warm directional sunlight + soft ambient light
- Simple shadows from boulders

### Objective
Collect 5 shells scattered among the boulders. Shells rendered as small glowing objects,
collected on contact.

## Game Loop & UI

### Game Loop
- requestAnimationFrame: update physics → process input → update animations → render
- Delta-time based for consistent behavior across frame rates

### UI (HTML overlay)
- Objective counter at top: "Find 5 shells: 3/5"
- Completion message when done
- No menus or title screen for v1

### Controls
- Small hint on load: "WASD to move, Space to jump"
- Fades out after a few seconds
