/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Cairo', 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', 'sans-serif'],
      },
      animation: {
        'fade-slide-up': 'fadeSlideUp 0.4s ease-out forwards',
        'fade-slide-down': 'fadeSlideDown 0.3s ease-out forwards',
        'slide-up-bottom': 'slideUpFromBottom 0.4s ease-out forwards',
        'pulse-correct': 'pulseCorrect 0.5s ease-in-out',
        'shake-wrong': 'shakeWrong 0.5s ease-in-out',
        'confetti': 'confettiBurst 0.8s ease-out forwards',
        'xp-pop': 'xpPop 0.6s ease-out forwards',
        'star-pop': 'starPop 0.5s ease-out forwards',
        'progress-glow': 'progressGlow 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'heart-beat': 'heartBeat 0.4s ease-in-out',
      },
    },
  },
  plugins: [],
}
