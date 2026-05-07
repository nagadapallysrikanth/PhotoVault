/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // PhotoVault palette
        void:   '#0f0e0d',   // near-black background
        ink:    '#1a1917',   // card/panel background
        ash:    '#2a2825',   // borders, dividers
        stone:  '#6b6560',   // muted text
        sand:   '#b5a99a',   // secondary text
        cream:  '#f0e8dc',   // primary text
        amber:  '#d4873a',   // accent — primary actions
        ember:  '#c46a1e',   // accent hover
        rose:   '#c45a4e',   // danger/delete
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body:    ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'fade-in':    'fadeIn 0.4s ease forwards',
        'slide-up':   'slideUp 0.4s ease forwards',
        'scale-in':   'scaleIn 0.3s ease forwards',
        'shimmer':    'shimmer 1.8s infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 },                    to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(20px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        scaleIn: { from: { opacity: 0, transform: 'scale(0.95)' },      to: { opacity: 1, transform: 'scale(1)' } },
        shimmer: { '0%, 100%': { opacity: 0.4 }, '50%': { opacity: 0.8 } },
      },
    },
  },
  plugins: [],
}
