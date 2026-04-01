import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: "#FFD700",
        "grog-yellow": "#FFD700",
        category: {
          creator: "#7C3AED",
          artist: "#EA580C",
          club: "#16A34A",
          bar: "#2563EB",
        },
        status: {
          pending: "#D97706",
          approved: "#16A34A",
          rejected: "#DC2626",
        },
        sidebar: {
          bg: "#111827",
          text: "#9CA3AF",
          active: "#FFD700",
        },
        surface: "#FFFFFF",
      },
      backgroundColor: {
        page: "#FAFAFA",
      },
    },
  },
  plugins: [],
};
export default config;
