# Bob the Blob

A silly 3D game about Bob, a very hungry blob. Swallow things smaller than you to grow bigger, and don't get squashed!

Built with Three.js, Vite, and TypeScript.

## Quick Start

```bash
cd bob-the-blob
npm install
npx vite
```

Then open the URL shown in the terminal (usually http://localhost:5173). Pick a level and a difficulty on the title screen.

## Controls

- **WASD / Arrow Keys** — Move
- **Space** — Jump
- **Bump into food** to eat it
- **E** — Big slurp: grab things a bit further away (hold it down to keep slurping!)
- **Q** — Spit the last thing you ate (stuns squashes and Bigfoot)

## Difficulty

Pick a mode on the title screen (click it, or use the arrow keys and Enter). The game remembers your choice.

- **🌱 Easy** — 5 hearts, one log lane, fewer and sleepier squashes, fewer pinecones, a calmer Bigfoot, and a ramp
  up to the goal treat instead of jumping.
- **🔥 Regular** — 3 hearts, three log lanes, squashes that aim where you're going, and you have to jump up
  stair-stumps to reach the goal.

All the difficulty numbers live in `src/difficulty.ts` if you want to tweak them.

## How to Play

- You can only swallow things **smaller than you**. The more you eat, the bigger you get.
- Fill the size meter until Bob is **big enough**, then find the level's goal treat (follow the beam of light).
  It sits on top of a tall stump past the log lanes — walk up the ramp (easy) or jump up the stair-stumps (regular), then swallow it
  to grow into the next level, where the world is a whole new scale.
- **Squashes, rolling logs, and Bigfoot** squash you flat like a pancake, and you lose some of what you ate.
- **Pinecones and thorny vines** hurt (you lose a heart). Watch for the shadow of falling pinecones!
- **Flower vines** are your friends and give hearts back.
- Look for **golden berries** — some are hidden behind rocks you have to push, some are on top of the mushrooms.

## Levels

1. **The Forest Floor** — Bob is ant-sized and everything is huge. Goal: the Giant Strawberry 🍓.
2. **The Big Woods** — Bob starts coconut-sized and grows to the size of a person, the little squashes are snacks (the medium ones aren't!), and Bigfoot is on the loose. Goal: the Golden Pinecone ✨.
3. **The Snack Stop** — Bob leaves the forest and finds a roadside rest stop full of dropped junk food.
   Cross the roads without getting run over by googly-eyed cars, dodge rock slides, the GIANT squash,
   a grumpy frying-pan chef, and the Yeti. Nice picnickers toss you snacks. Goal: grow big enough to
   **eat Bigfoot** (he'll run away once you're bigger than him!).

Coming someday (many, many levels from now): planets. 🪐
