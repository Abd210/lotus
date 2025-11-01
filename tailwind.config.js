/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './public/index.html',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        gold: '#D4AF37',
        'deep-gold': '#B08D2E',
        'marble-black': '#0A0A0A',
        'off-white': '#F5F2E8',
        'muted-gray': '#A8A8A8'
      },
      fontFamily: {
        cinzel: ['Cinzel', 'serif'],
        inter: ['Inter', 'sans-serif']
      }
    }
  },
  plugins: [],
}

