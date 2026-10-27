/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        finnova: {
          canvas: "#F4F5F9",
          obsidian: "#16181F",
          "obsidian-card": "#1E2029",
          "obsidian-border": "#282B37",
          indigo: "#5847F6",
          "indigo-hover": "#4939E3",
          "royal-indigo": "#5B58B6",
          "card-bg": "#F8F9FC",
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
        'glow-indigo': '0 0 20px -3px rgba(88, 71, 246, 0.35)',
        'pill': '0 4px 18px 0 rgba(0, 0, 0, 0.12)',
      },
    },
  },
  plugins: [],
}
