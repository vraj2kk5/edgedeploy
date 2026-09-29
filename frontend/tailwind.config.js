/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#090d16',
        surface: '#111827',
        card: '#1f2937',
        border: '#374151',
        brand: '#0066ff',
        brandHover: '#0052cc',
      },
    },
  },
  plugins: [],
};
