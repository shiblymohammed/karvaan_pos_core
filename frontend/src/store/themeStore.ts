import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'dark' | 'light';

interface ThemeState {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark', // Default to sleek dark mode for restaurant terminals
      toggleTheme: () => {
        const nextTheme = get().theme === 'dark' ? 'light' : 'dark';
        get().setTheme(nextTheme);
      },
      setTheme: (mode) => {
        set({ theme: mode });
        if (typeof document !== 'undefined') {
          const root = document.documentElement;
          if (mode === 'dark') {
            root.classList.add('dark');
            root.classList.remove('light');
          } else {
            root.classList.remove('dark');
            root.classList.add('light');
          }
        }
      },
    }),
    {
      name: 'karvaan-pos-theme-storage',
      onRehydrateStorage: () => (state) => {
        if (state && typeof document !== 'undefined') {
          const root = document.documentElement;
          if (state.theme === 'dark') {
            root.classList.add('dark');
            root.classList.remove('light');
          } else {
            root.classList.remove('dark');
            root.classList.add('light');
          }
        }
      },
    }
  )
);
