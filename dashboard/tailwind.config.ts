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
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        pop: {
          lime: "#BFFF00",
          pink: "#FF3366",
          blue: "#3366FF",
          orange: "#FF6B00",
          purple: "#8B5CF6",
          cyan: "#00D4FF",
          yellow: "#FFE500",
        },
        ink: "#141414",
        chalk: "#F5F5F0",
        status: {
          pending: "#FF6B00",
          approved: "#BFFF00",
          rejected: "#FF3366",
        },
      },
      borderWidth: {
        "3": "3px",
      },
      borderRadius: {
        none: "0px",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
