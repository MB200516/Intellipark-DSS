/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        crimson: {
          DEFAULT: '#8B1E2D',
          dark: '#5E141E',
          critical: '#B71C1C',
        },
        grey: {
          cool: '#5F6770',
        },
        offwhite: '#F5F3EE',
        warning: '#D4A017',
      },
      fontFamily: {
        serif: ['"Times New Roman"', 'Times', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
