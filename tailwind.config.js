/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // "accent" sigue las variables CSS definidas en index.css, que
        // cambian según el acento elegido en Ajustes (brand/mono/ndvi).
        accent: {
          50: "var(--accent-50)",
          100: "var(--accent-100)",
          400: "var(--accent-400)",
          500: "var(--accent-500)",
          600: "var(--accent-600)",
          700: "var(--accent-700)",
        },
        // "brand" (ámbar) y "ndvi" (verde) son paletas fijas, independientes
        // del acento activo — se usan para datos (GDD, vigor vegetal, etc.)
        // cuyo color no debe cambiar con la preferencia visual del usuario.
        brand: {
          50: "#fbf3e4",
          100: "#f5e4c0",
          400: "#d9a544",
          500: "#c08a2e",
          600: "#9c6f1f",
          700: "#7a581a",
        },
        ndvi: {
          50: "#eef7f0",
          100: "#dcefe1",
          400: "#7cc192",
          500: "#4c9a63",
          600: "#3b7a4e",
          700: "#2c5d3b",
        },
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(16, 24, 40, 0.06)",
      },
    },
  },
  plugins: [],
};
