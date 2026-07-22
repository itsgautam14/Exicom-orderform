import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // Exicom Brand Identity Guidelines: Teal + Neon, used in an 80:20 ratio.
        exicom: {
          teal: "#27bdbe",
          neon: "#94f440",
          tealDark: "#0c7d77",
          gray: "#b5b5b5",
          ink: "#343a42",
        },
      },
    },
  },
  plugins: [],
};
export default config;
