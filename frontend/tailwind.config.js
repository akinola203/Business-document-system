/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          obsidian: "#0A0B0E",
          charcoal: "#121318",
          surface: "#181A20",
          silver: "#E4E4E7",
          white: "#FFFFFF",
        },
        finnova: {
          canvas: "#F4F5F7",
          obsidian: "#111217",
          "obsidian-card": "#181A20",
          "obsidian-border": "#272A34",
          indigo: "#18181B",
          "indigo-hover": "#27272A",
          "royal-indigo": "#121318",
          "card-bg": "#F8F9FA",
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      borderRadius: {
        '3xl': '24px',
        '4xl': '32px',
      },
      boxShadow: {
        'glow-indigo': '0 0 20px -3px rgba(255, 255, 255, 0.12)',
        'glow-orange': '0 0 20px -3px rgba(255, 255, 255, 0.12)',
        'pill': '0 4px 18px 0 rgba(0, 0, 0, 0.18)',
      },
    },
  },
  plugins: [],
}
