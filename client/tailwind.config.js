/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Legacy tokens (keep for backward compat)
        ink: '#070A12',
        graphite: '#101828',
        electric: '#7C3AED',
        aurora: '#22D3EE',
        mist: '#F8FAFC',

        // Immersphere design system
        'ip-bg':           '#060816',
        'ip-bg-soft':      '#0A1020',
        'ip-bg-panel':     '#0B1128',
        'ip-accent':       '#7C5CFF',
        'ip-accent-hover': '#8B5CF6',
        'ip-accent-soft':  '#6D7CFF',

        // Card surfaces (rgba — reference CSS variables)
        'ip-card':         'var(--ip-card)',
        'ip-card-border':  'var(--ip-card-border)',

        // Semantic state colors
        'ip-success': '#22C55E',
        'ip-warning': '#F59E0B',
        'ip-danger':  '#EF4444',
        'ip-info':    '#38BDF8',
      },

      borderRadius: {
        'ip-card':  '16px',
        'ip-panel': '20px',
        'ip-pill':  '999px',
      },

      boxShadow: {
        // Legacy
        premium: '0 24px 80px rgba(15, 23, 42, 0.18)',
        // Immersphere
        'ip-accent-glow': '0 0 24px rgba(124, 92, 255, 0.35)',
        'ip-card-soft':   '0 4px 24px rgba(0, 0, 0, 0.40)',
      },

      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },

      fontSize: {
        'ip-xs':   ['11px', { lineHeight: '16px', letterSpacing: '0.02em' }],
        'ip-sm':   ['12px', { lineHeight: '18px', letterSpacing: '0.01em' }],
        'ip-base': ['14px', { lineHeight: '20px' }],
        'ip-md':   ['15px', { lineHeight: '22px' }],
        'ip-lg':   ['18px', { lineHeight: '26px' }],
        'ip-xl':   ['22px', { lineHeight: '30px', letterSpacing: '-0.01em' }],
        'ip-2xl':  ['28px', { lineHeight: '36px', letterSpacing: '-0.02em' }],
        'ip-3xl':  ['36px', { lineHeight: '44px', letterSpacing: '-0.02em' }],
      },

      transitionTimingFunction: {
        'ip-base': 'ease-out',
      },

      transitionDuration: {
        'ip-base': '150ms',
      },
    },
  },
  plugins: [],
};
