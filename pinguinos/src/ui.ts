export class GameUI {
  private objectiveEl: HTMLElement;
  private controlsHintEl: HTMLElement;
  private completionEl: HTMLElement;

  constructor() {
    this.objectiveEl = document.getElementById('objective')!;
    this.controlsHintEl = document.getElementById('controls-hint')!;
    this.completionEl = document.getElementById('completion')!;
  }

  updateObjective(collected: number, total: number): void {
    this.objectiveEl.textContent = `Shells: ${collected}/${total}`;
  }

  showCompletion(): void {
    this.completionEl.style.display = 'block';
  }

  fadeControlsHint(): void {
    setTimeout(() => {
      this.controlsHintEl.style.opacity = '0';
    }, 5000);
  }
}
