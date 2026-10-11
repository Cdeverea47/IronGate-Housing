/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f2f6fe',
          100: '#e2ebfd',
          200: '#c7d7fb',
          300: '#9fb8f8',
          400: '#4A90E2',
          500: '#4F9DF7',
          600: '#5B7EF6',
          700: '#6A35D8',
          800: '#5228a8',
          900: '#3d1d80',
        },
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(180deg, #4A90E2 0%, #4F9DF7 35%, #5B7EF6 65%, #6A35D8 100%)',
        'brand-gradient-diagonal': 'linear-gradient(135deg, #4A90E2 0%, #4F9DF7 35%, #5B7EF6 65%, #6A35D8 100%)',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px -4px rgba(76, 91, 219, 0.12)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
      },
    },
  },
  plugins: [],
};
