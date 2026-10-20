/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#eef4fb",
          100: "#d9e6f5",
          200: "#b3cdea",
          300: "#84addb",
          400: "#5489c6",
          500: "#346dab",
          600: "#24568d",
          700: "#1b4370",
          800: "#122f52",
          900: "#0b1f38",
          950: "#061426",
        },
        teal: {
          50: "#effdfa",
          100: "#c8fff5",
          200: "#91feeb",
          300: "#53f5de",
          400: "#20e1c8",
          500: "#0dbfa9",
          600: "#079a89",
          700: "#0a7a6e",
          800: "#0d6059",
          900: "#10504a",
          950: "#022f2c",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        card: "0 10px 30px -12px rgba(6, 20, 38, 0.25)",
        glow: "0 0 40px -8px rgba(13, 191, 169, 0.45)",
      },
    },
  },
  plugins: [],
};
