export class GameUI {
  private objectiveEl: HTMLElement;
  private controlsHintEl: HTMLElement;
  private completionEl: HTMLElement;

  constructor() {
    this.objectiveEl = document.getElementById('objective')!;
    this.controlsHintEl = document.getElementById('controls-hint')!;
    this.completionEl = document.getElementById('completion')!;
  }

  setObjective(text: string): void {
    this.objectiveEl.textContent = text;
  }

  showCompletion(): void {
    this.completionEl.style.display = 'flex';
  }

  fadeControlsHint(): void {
    setTimeout(() => {
      this.controlsHintEl.style.opacity = '0';
    }, 5000);
  }
}
