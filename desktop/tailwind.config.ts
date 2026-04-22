import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary:   '#0C0A09',   // stone-950 warm near-black
          secondary: '#141210',   // cards / sidebar
          tertiary:  '#1C1917',   // stone-900 elevated surface
        },
        border: { DEFAULT: '#292524' },  // stone-800
        accent: {
          DEFAULT: '#D97706',   // amber-600
          hover:   '#B45309',   // amber-700
          muted:   '#92400E',   // amber-800
          glow:    '#F59E0B',   // amber-400 (text / highlights)
        },
        text: {
          primary:   '#FAFAF9',  // stone-50
          secondary: '#A8A29E',  // stone-400
          muted:     '#78716C',  // stone-500
        },
        success: '#22C55E',
        warning: '#F59E0B',
        danger:  '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '8px',
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      animation: {
        'skeleton-pulse': 'skeleton-pulse 1.5s ease-in-out infinite',
      },
      keyframes: {
        'skeleton-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },
    },
  },
  plugins: [],
}

export default config
