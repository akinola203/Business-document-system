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
          navy: "#0B132B",
          "navy-dark": "#070C1E",
          "navy-surface": "#0F172A",
          indigo: "#6366F1",
          "indigo-hover": "#4F46E5",
          purple: "#7C3AED",
          silver: "#E2E8F0",
        },
        finnova: {
          canvas: "#F4F5F9",
          obsidian: "#16181F",
          "obsidian-card": "#1E2029",
          "obsidian-border": "#282B37",
          indigo: "#6366F1",
          "indigo-hover": "#4F46E5",
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
        'glow-indigo': '0 0 20px -3px rgba(99, 102, 241, 0.35)',
        'glow-orange': '0 0 20px -3px rgba(99, 102, 241, 0.35)',
        'pill': '0 4px 18px 0 rgba(0, 0, 0, 0.12)',
      },
    },
  },
  plugins: [],
}
