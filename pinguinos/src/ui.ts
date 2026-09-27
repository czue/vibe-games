export class GameUI {
  private objectiveEl: HTMLElement;
  private controlsHintEl: HTMLElement;
  private completionEl: HTMLElement;
  private wakeUpEl: HTMLElement;

  constructor() {
    this.objectiveEl = document.getElementById('objective')!;
    this.controlsHintEl = document.getElementById('controls-hint')!;
    this.completionEl = document.getElementById('completion')!;
    this.wakeUpEl = document.getElementById('wake-up')!;
  }

  setObjective(text: string): void {
    this.objectiveEl.textContent = text;
  }

  showCompletion(): void {
    this.completionEl.style.display = 'flex';
  }

  hideCompletion(): void {
    this.completionEl.style.display = 'none';
  }

  showWakeUp(): void {
    this.wakeUpEl.style.display = 'flex';
  }

  fadeControlsHint(): void {
    setTimeout(() => {
      this.controlsHintEl.style.opacity = '0';
    }, 5000);
  }

  showSaveIndicator(): void {
    this.showFlashMessage('Game Saved');
  }

  showLoadIndicator(): void {
    this.showFlashMessage('Game Loaded');
  }

  private showFlashMessage(text: string): void {
    const el = document.getElementById('flash-message')!;
    el.textContent = text;
    el.style.opacity = '1';
    setTimeout(() => {
      el.style.opacity = '0';
    }, 1500);
  }
}
