/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'kv-primary': 'var(--kv-primary)',
        'kv-creme': 'var(--kv-bg-creme)',
        'kv-surface': 'var(--kv-surface)',
        'kv-dark': 'var(--kv-text-dark)',
        'kv-muted': 'var(--kv-text-muted)',
        'kv-border': 'var(--kv-border)',
        'pos-bg': '#d6d6f8',
        'pos-card': '#ffffff',
        'pos-text': '#0f172a',
        'pos-text-muted': '#64748b',
        'pos-border': '#cbd5e1',
        'pos-accent': '#8cc63f',
        'pos-card-hover': '#f8fafc',
        'pos-blue': '#87cdf1',
        'pos-red': '#d37a75',
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0) scale(0.96)' },
          '25%': { transform: 'translateX(-4px) scale(0.96)' },
          '50%': { transform: 'translateX(4px) scale(0.96)' },
          '75%': { transform: 'translateX(-4px) scale(0.96)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-100%)' },
        }
      },
      animation: {
        shake: 'shake 0.2s cubic-bezier(.36,.07,.19,.97) both',
        marquee: 'marquee 25s linear infinite',
      }
    },
  },
  plugins: [],
};
