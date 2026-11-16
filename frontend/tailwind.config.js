/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sage: {
          50: '#F4F7F5',
          100: '#E6ECE8',
          200: '#CFDBD4',
          300: '#AEC2B7',
          400: '#7E9B8D',
          500: '#5C7C6E', // Standard Sage
          600: '#4A6B5D', // Brand Primary Sage Green
          700: '#3D594D',
          800: '#32473D',
          900: '#2A3B33',
        },
        cream: {
          50: '#FDFCF9',
          100: '#FBF9F4', // Brand Secondary
          200: '#F5F0E6',
          300: '#EBE2D2',
          400: '#DCCDB6',
          500: '#C8B495',
        },
        rose: {
          50: '#FCF8F8',
          100: '#F7EEEE',
          200: '#EED9D9',
          300: '#DFBDBD',
          400: '#D49B9B',
          500: '#C88A8A', // Brand Accent Dusty Pink
          600: '#B06E6E',
          700: '#945555',
        },
        forest: {
          900: '#1F2B24', // Brand Main Text
          800: '#2D3A31',
          700: '#3D4D43',
          600: '#5A6B62', // Muted Text
          500: '#798C82',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
