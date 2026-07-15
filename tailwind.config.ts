import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/domains/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f7ff",
          100: "#dbeaff",
          200: "#b8d5ff",
          300: "#8ab8ff",
          400: "#5591ff",
          500: "#2f6df0",
          600: "#1f52cc",
          700: "#1c40a3",
          800: "#1c3782",
          900: "#1c306b",
        },
      },
      borderRadius: {
        card: "0.75rem",
      },
    },
  },
  plugins: [],
};

export default config;
