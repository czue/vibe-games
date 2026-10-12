import * as THREE from 'three';
import { DIFFICULTIES, type DifficultyName } from './difficulty';

interface Bubble {
  el: HTMLDivElement;
  key: object;
  getPos: () => THREE.Vector3;
  ttl: number;
}

const MODE_BLURBS: Record<DifficultyName, string> = {
  easy: 'More hearts, fewer logs, sleepy squashes',
  regular: 'For brave blobs',
};

function el(id: string): HTMLElement {
  return document.getElementById(id)!;
}

export class UI {
  private hearts = el('hearts');
  private meterFill = el('meter-fill');
  private meterLabel = el('meter-label');
  private levelName = el('level-name');
  private bigMessage = el('big-message');
  private bubbleLayer = el('bubbles');
  private overlay = el('overlay');
  private fade = el('fade');
  private bubbles: Bubble[] = [];
  private bigTimer = 0;
  private lastHearts = '';
  private lastLabel = '';

  setHearts(n: number, max: number): void {
    const s = '❤️'.repeat(Math.max(0, n)) + '🤍'.repeat(Math.max(0, max - n));
    if (s !== this.lastHearts) this.hearts.textContent = this.lastHearts = s;
  }

  setMeter(frac: number, label: string): void {
    this.meterFill.style.width = `${(frac * 100).toFixed(1)}%`;
    if (label !== this.lastLabel) this.meterLabel.textContent = this.lastLabel = label;
  }

  setLevelName(name: string): void {
    this.levelName.textContent = name;
  }

  big(html: string, duration: number): void {
    this.bigMessage.innerHTML = html;
    this.bigMessage.classList.add('show');
    this.bigTimer = duration;
  }

  /** A speech bubble that follows something around. One bubble per speaker at a time. */
  say(key: object, getPos: () => THREE.Vector3, text: string, duration = 2, style = ''): void {
    const existing = this.bubbles.find((b) => b.key === key);
    if (existing) {
      existing.el.textContent = text;
      existing.el.className = `bubble ${style}`;
      existing.ttl = duration;
      return;
    }
    const div = document.createElement('div');
    div.className = `bubble ${style}`;
    div.textContent = text;
    this.bubbleLayer.appendChild(div);
    this.bubbles.push({ el: div, key, getPos, ttl: duration });
  }

  update(dt: number, camera: THREE.Camera): void {
    if (this.bigTimer > 0) {
      this.bigTimer -= dt;
      if (this.bigTimer <= 0) this.bigMessage.classList.remove('show');
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (const b of this.bubbles) {
      b.ttl -= dt;
      const p = b.getPos().project(camera);
      const onScreen = p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1;
      b.el.style.display = onScreen ? '' : 'none';
      b.el.style.left = `${((p.x + 1) / 2) * w}px`;
      b.el.style.top = `${((1 - p.y) / 2) * h}px`;
      b.el.style.opacity = String(Math.min(1, b.ttl * 3));
      if (b.ttl <= 0) b.el.remove();
    }
    this.bubbles = this.bubbles.filter((b) => b.ttl > 0);
  }

  showTitle(levelNames: string[]): void {
    this.overlay.innerHTML = `
      <h1>Bob the Blob</h1>
      <p class="tag">A very hungry blob in a very big forest</p>
      <div class="bob-pic"><div class="eye"></div><div class="eye"></div></div>
      <ul class="controls">
        <li><b>WASD</b> / <b>Arrows</b> move</li>
        <li><b>Space</b> jump</li>
        <li>Bump into food to <b>eat it</b></li>
        <li><b>E</b> big slurp</li>
        <li><b>Q</b> spit it back out</li>
      </ul>
      <p>Swallow things smaller than you to grow bigger.<br>
      Watch out for squashes, rolling logs, pinecones and thorny vines!</p>
      <div class="levels">
        ${levelNames.map((n, i) => `<button class="level" data-level="${i}"><b>${i + 1}</b>${n}</button>`).join('')}
      </div>
      <div class="modes">
        ${Object.values(DIFFICULTIES)
          .map((d) => `<button class="mode" data-mode="${d.name}">${d.label}<small>${MODE_BLURBS[d.name]}</small></button>`)
          .join('')}
      </div>
      <p class="press">Pick a level and a mode, then press Enter</p>`;
    this.overlay.classList.add('show');
  }

  /** Highlight the selected level button on the title screen. */
  selectLevel(index: number): void {
    for (const btn of this.overlay.querySelectorAll<HTMLButtonElement>('.level')) {
      btn.classList.toggle('selected', btn.dataset.level === String(index));
    }
  }

  /** Highlight the selected difficulty button on the title screen. */
  selectMode(name: DifficultyName): void {
    for (const btn of this.overlay.querySelectorAll<HTMLButtonElement>('.mode')) {
      btn.classList.toggle('selected', btn.dataset.mode === name);
    }
  }

  showFinale(sizeName: string): void {
    this.overlay.innerHTML = `
      <h1>BOB ATE BIGFOOT!</h1>
      <p class="tag">He ate the forest, a whole snack stop, and Bigfoot.<br>Now he's as big as ${sizeName}!</p>
      <p>But he's still hungry... One day he'll eat 🪐 <b>PLANETS</b> 🪐<br><small>(that's a LOT of levels away!)</small></p>
      <p class="press">Press Enter to play again</p>`;
    this.overlay.classList.add('show');
  }

  hideOverlay(): void {
    this.overlay.classList.remove('show');
  }

  setFade(opacity: number): void {
    this.fade.style.opacity = String(opacity);
  }
}
