/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Outfit', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg:        '#08090e',
        surface:   '#0f1117',
        elevated:  '#13161f',
        card:      '#181d2a',
        'card-hi': '#1d2333',
        gold:      '#c9973a',
        'gold-lt': '#e0b96a',
        ivory:     '#f0ece3',
        muted:     '#4e5568',
        subtle:    '#252d40',
        jade:      '#22c87a',
        sapphire:  '#4f8ef7',
        ember:     '#f07040',
        ruby:      '#e84545',
      },
      boxShadow: {
        'card':    '0 1px 3px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
        'card-lg': '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
        'gold':    '0 0 24px rgba(201,151,58,0.25)',
        'drawer':  '-8px 0 48px rgba(0,0,0,0.7)',
      },
      keyframes: {
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          '0%':   { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-up': {
          '0%':   { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-gold': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(201,151,58,0.4)' },
          '50%':      { boxShadow: '0 0 0 8px rgba(201,151,58,0)' },
        },
        'dot-bounce': {
          '0%, 80%, 100%': { transform: 'scale(0.6)', opacity: '0.4' },
          '40%':           { transform: 'scale(1)',   opacity: '1'   },
        },
      },
      animation: {
        'fade-up':    'fade-up 0.4s ease both',
        'slide-in':   'slide-in 0.35s cubic-bezier(0.32,0.72,0,1) both',
        'slide-up':   'slide-up 0.35s cubic-bezier(0.32,0.72,0,1) both',
        'shimmer':    'shimmer 2s linear infinite',
        'pulse-gold': 'pulse-gold 2s ease-in-out infinite',
        'dot-1':      'dot-bounce 1.4s ease-in-out 0ms   infinite',
        'dot-2':      'dot-bounce 1.4s ease-in-out 200ms infinite',
        'dot-3':      'dot-bounce 1.4s ease-in-out 400ms infinite',
      },
    },
  },
  plugins: [],
};
