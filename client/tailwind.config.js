/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: '#070A12',
        graphite: '#101828',
        electric: '#7C3AED',
        aurora: '#22D3EE',
        mist: '#F8FAFC'
      },
      boxShadow: {
        premium: '0 24px 80px rgba(15, 23, 42, 0.18)'
      }
    }
  },
  plugins: []
};
