export type ThemeMode = 'dark' | 'light';

export class ThemeManager {
  private currentMode: ThemeMode = 'dark';
  private targetMix = 0.0; // 0.0 = dark, 1.0 = light
  private currentMix = 0.0;
  private startMix = 0.0;
  private animStartTime = 0;
  private isAnimating = false;
  private readonly durationMs = 500;
  private listeners: ((mode: ThemeMode, mix: number) => void)[] = [];

  constructor() {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('swe-lighthouse-theme') : null;
    if (stored === 'light' || stored === 'dark') {
      this.currentMode = stored;
    } else if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
      this.currentMode = 'light';
    } else {
      this.currentMode = 'dark';
    }

    this.targetMix = this.currentMode === 'light' ? 1.0 : 0.0;
    this.currentMix = this.targetMix;
    this.startMix = this.targetMix;
    this.applyDocumentTheme();
  }

  get mode(): ThemeMode {
    return this.currentMode;
  }

  get mix(): number {
    return this.currentMix;
  }

  toggle(): void {
    this.setMode(this.currentMode === 'dark' ? 'light' : 'dark');
  }

  setMode(mode: ThemeMode): void {
    if (this.currentMode === mode && !this.isAnimating) return;
    this.startMix = this.currentMix;
    this.currentMode = mode;
    this.targetMix = mode === 'light' ? 1.0 : 0.0;
    this.animStartTime = performance.now();
    this.isAnimating = true;

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('swe-lighthouse-theme', mode);
    }
    this.applyDocumentTheme();
  }

  update(): boolean {
    if (!this.isAnimating) return false;

    const elapsed = performance.now() - this.animStartTime;
    const t = Math.min(1.0, elapsed / this.durationMs);

    // Smooth cubic ease
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    this.currentMix = this.startMix + (this.targetMix - this.startMix) * ease;

    if (t >= 1.0) {
      this.currentMix = this.targetMix;
      this.isAnimating = false;
    }

    this.notify();
    return true;
  }

  onThemeChange(listener: (mode: ThemeMode, mix: number) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.currentMode, this.currentMix);
    }
  }

  private applyDocumentTheme(): void {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', this.currentMode);
    }
  }
}
