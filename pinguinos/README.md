# Pinguinos

A 3D browser game about a penguin's adventure, starting on Boulders Beach and climbing up into the sky.
Inspired by *Kirby and the Forgotten Land*, and by the real Boulders Beach in South Africa, where penguins actually live.

Built with Three.js, Rapier physics, Vite, and TypeScript. Everything is procedural low-poly geometry — no asset files.

## Quick Start

```bash
cd pinguinos
npm install
npx vite
```

Then open the URL shown in the terminal (usually http://localhost:5173). Add `?level=N` to the URL to skip to any level.

## Controls

- **WASD / Arrow Keys** — Move
- **Space** — Jump
- **F5** — Save game
- **F9** — Load game

## Levels

1. **Boulders Beach** — Find the glowing golden shell key and bring it to the large boulder with the golden keyhole.
   The boulder slides aside to reveal a portal to the next level.
2. **Pillar Maze** — Climb the stone pillars up to a circular maze in the sky and find its center... then hold on tight.
3. **Sky Platforms** — Hop across floating platforms to reach the summit. Try pressing jump again in the air!

## Ideas

- An item system: collectibles (surfboard, helmet, fish...) that grant the penguin new abilities, on top of the base
  waddle + jump moveset.
