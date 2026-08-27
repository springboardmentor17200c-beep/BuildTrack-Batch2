import { Injectable, signal } from '@angular/core';

export type AppTheme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly THEME_KEY = 'buildtrack_theme';
  currentTheme = signal<AppTheme>(this.getStoredTheme());

  constructor() {
    this.applyTheme(this.currentTheme());
  }

  setTheme(theme: AppTheme): void {
    this.currentTheme.set(theme);
    localStorage.setItem(this.THEME_KEY, theme);
    this.applyTheme(theme);
  }

  toggleTheme(): void {
    const next = this.currentTheme() === 'dark' ? 'light' : 'dark';
    this.setTheme(next);
  }

  private applyTheme(theme: AppTheme): void {
    if (typeof document !== 'undefined') {
      document.body.classList.remove('dark-theme');
      document.documentElement.removeAttribute('data-theme');
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(this.THEME_KEY);
      }
    }
  }

  private getStoredTheme(): AppTheme {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(this.THEME_KEY);
      if (stored === 'dark' || stored === 'light') return stored;
    }
    return 'light';
  }
}
