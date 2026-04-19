/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        sans: ['Figtree', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        paper:       '#F6F5F2',
        'paper-2':   '#EEECEA',
        surface:     '#FFFFFF',
        ink:         '#1A1714',
        'ink-2':     '#5C554E',
        muted:       '#A09688',
        border:      '#E8E4DC',
        'border-2':  '#D0CBC0',
        crimson:     '#C8102E',
        'crimson-2': '#A50D25',
        'crimson-lt':'#FEF0F1',
        jade:        '#15803D',
        'jade-lt':   '#F0FDF4',
        amber:       '#B45309',
        'amber-lt':  '#FFFBEB',
        sapphire:    '#1D4ED8',
        'sapphire-lt':'#EFF6FF',
        violet:      '#6D28D9',
        'violet-lt': '#F5F3FF',
        ember:       '#C2410C',
        'ember-lt':  '#FFF7ED',
        ruby:        '#B91C1C',
        'ruby-lt':   '#FEF2F2',
        slate:       '#9CA3AF',
        'slate-lt':  '#F9FAFB',
      },
      boxShadow: {
        'sm':       '0 1px 2px rgba(26,23,20,0.05)',
        'card':     '0 1px 3px rgba(26,23,20,0.05), 0 4px 16px rgba(26,23,20,0.06)',
        'card-lg':  '0 2px 6px rgba(26,23,20,0.07), 0 12px 40px rgba(26,23,20,0.10)',
        'drawer':   '-2px 0 0 rgba(26,23,20,0.06), -8px 0 48px rgba(26,23,20,0.12)',
        'input':    '0 1px 2px rgba(26,23,20,0.04)',
      },
      keyframes: {
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in': {
          '0%':   { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'dot-bounce': {
          '0%, 80%, 100%': { transform: 'scale(0.5)', opacity: '0.35' },
          '40%':           { transform: 'scale(1)',   opacity: '1'    },
        },
        'pulse-red': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(200,16,46,0.3)' },
          '50%':      { boxShadow: '0 0 0 6px rgba(200,16,46,0)' },
        },
      },
      animation: {
        'fade-up':   'fade-up 0.4s ease both',
        'fade-in':   'fade-in 0.3s ease both',
        'slide-in':  'slide-in 0.35s cubic-bezier(0.32,0.72,0,1) both',
        'dot-1':     'dot-bounce 1.4s ease-in-out 0ms   infinite',
        'dot-2':     'dot-bounce 1.4s ease-in-out 200ms infinite',
        'dot-3':     'dot-bounce 1.4s ease-in-out 400ms infinite',
        'pulse-red': 'pulse-red 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
