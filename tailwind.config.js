/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['var(--font-reckless)', 'Georgia', 'serif'],
        sans:  ['var(--font-geist)',   'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
