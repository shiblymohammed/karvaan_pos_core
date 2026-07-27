/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'pos-bg': 'var(--pos-bg)',
        'pos-sidebar': 'var(--pos-sidebar)',
        'pos-card': 'var(--pos-card)',
        'pos-card-hover': 'var(--pos-card-hover)',
        'pos-text': 'var(--pos-text)',
        'pos-text-muted': 'var(--pos-text-muted)',
        'pos-border': 'var(--pos-border)',
        'pos-input': 'var(--pos-input)',
        'pos-accent': '#10b981', // Vibrant Turquoise / Emerald Green accent
        'pos-accent-hover': '#059669', // Deep Teal / Emerald hover
        'pos-success': '#10b981',
        'pos-warning': '#f97316',
        'pos-danger': '#ef4444',
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glass': '0 8px 32px 0 var(--pos-shadow)',
        'glow-accent': '0 4px 14px 0 rgba(16, 185, 129, 0.25)', // Clean elevation shadow in both light & dark
      },
    },
  },
  plugins: [],
};
