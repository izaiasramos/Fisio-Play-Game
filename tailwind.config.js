/** @type {import('tailwindcss').Config} */
// Design tokens do FisioPlay. Mantidos em sincronia com src/theme/tokens.ts
// (className usa estas chaves; tokens.ts é a mesma paleta para estilo imperativo).
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: "#0B1020",
        surface: "#151B2E",
        card: "#1C2440",
        primary: "#6C5CE7",
        primaryDark: "#5A4BD1",
        accent: "#00D2A8",
        success: "#22C55E",
        successDeep: "#15803D",
        error: "#FF5A5F",
        warning: "#FBBF24",
        ink: "#F5F7FF",
        inkSoft: "#D4DAEC",
        muted: "#8A93AD",
      },
      borderRadius: {
        xl: "16px",
        "2xl": "24px",
        "3xl": "28px",
      },
    },
  },
  plugins: [],
};
