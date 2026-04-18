/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0b1020',
        cream: '#f6f3ec',
        accent: '#ff6b35',
      },
    },
  },
  plugins: [],
};
