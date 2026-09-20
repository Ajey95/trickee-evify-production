import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-manrope)", "Manrope", "sans-serif"],
        display: ["var(--font-syne)", "Syne", "sans-serif"],
        technical: ["var(--font-michroma)", "Michroma", "sans-serif"],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        "bg-primary": "rgb(var(--bg-primary-rgb) / <alpha-value>)",
        "bg-card": "rgb(var(--bg-card-rgb) / <alpha-value>)",
        "bg-border": "rgb(var(--bg-border-rgb) / <alpha-value>)",
        "accent-teal": "rgb(var(--accent-teal-rgb) / <alpha-value>)",
        "accent-gold": "rgb(var(--accent-gold-rgb) / <alpha-value>)",
        "accent-magenta": "rgb(var(--accent-gold-rgb) / <alpha-value>)",
        "accent-green": "rgb(var(--accent-gold-rgb) / <alpha-value>)",
        "accent-amber": "rgb(var(--accent-amber-rgb) / <alpha-value>)",
        "accent-red": "rgb(var(--accent-red-rgb) / <alpha-value>)",
        "text-primary": "rgb(var(--text-primary-rgb) / <alpha-value>)",
        "text-dim": "rgb(var(--text-dim-rgb) / <alpha-value>)",
      },
    },
  },
  plugins: [],
};
export default config;
