/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        kiosk: {
          navy: '#0F172A',
          blue: '#1E40AF',
          'blue-hover': '#1E3A8A',
          teal: '#047857',
          'teal-hover': '#065F46',
          amber: '#D97706',
          bg: '#F8FAFC',
          card: '#FFFFFF',
          text: '#0F172A',
          subtext: '#334155'
        }
      },
      boxShadow: {
        'card': '0 4px 20px -2px rgba(15, 23, 42, 0.08), 0 2px 4px -1px rgba(15, 23, 42, 0.04)',
        'btn': '0 4px 14px 0 rgba(30, 64, 175, 0.25)',
      }
    },
  },
  plugins: [],
}
