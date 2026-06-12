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
        exicom: {
          teal: "#1ea8a0",
          tealDark: "#0c7d77",
          ink: "#0c1b22",
        },
      },
    },
  },
  plugins: [],
};
export default config;
