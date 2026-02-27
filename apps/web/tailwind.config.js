/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./public/**/*.{html,js}",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3b82f6',
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        secondary: {
          DEFAULT: '#10b981',
          50: '#ecfdf5',
          500: '#10b981',
          600: '#059669',
        },
        danger: {
          DEFAULT: '#ef4444',
          50: '#fef2f2',
          500: '#ef4444',
          600: '#dc2626',
        },
        surface: {
          light: 'rgba(255, 255, 255, 0.7)',
          'light-solid': '#ffffff',
          dark: 'rgba(17, 24, 39, 0.7)',
          'dark-solid': '#111827',
        },
        border: {
          light: 'rgba(229, 231, 235, 0.5)',
          dark: 'rgba(31, 41, 55, 0.5)',
        },
      },
      borderRadius: {
        'card': '1.5rem',
        'button': '0.75rem',
        'badge': '9999px',
        'menu': '1rem',
      },
      boxShadow: {
        'card': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        'card-light': '0 10px 15px -3px rgb(0 0 0 / 0.1)',
        'card-dark': '0 25px 50px -12px rgb(0 0 0 / 0.5)',
      },
      fontSize: {
        'page-title': ['1.5rem', { lineHeight: '2rem', fontWeight: '700' }],
        'section-title': ['1.125rem', { lineHeight: '1.75rem', fontWeight: '600' }],
        'card-title': ['1rem', { lineHeight: '1.5rem', fontWeight: '600' }],
      },
      spacing: {
        'header': '72px',
        'footer': '80px',
        'sidebar': '256px',
      },
    },
  },
  plugins: [],
}
