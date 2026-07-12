import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          light: "#fcfcfb",
          dark: "#1a1a19",
        },
        plane: {
          light: "#f9f9f7",
          dark: "#0d0d0d",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
