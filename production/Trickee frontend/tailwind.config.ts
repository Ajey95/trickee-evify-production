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
        "bg-primary": "#0d1117",
        "bg-card": "#161b22",
        "bg-border": "#30363d",
        "accent-teal": "#00b4d8",
        "accent-magenta": "#ff00ff",
        "accent-green": "#3fb950",
        "accent-amber": "#d29922",
        "accent-red": "#f85149",
        "text-primary": "#e6edf3",
        "text-dim": "#8b949e",
      },
    },
  },
  plugins: [],
};
export default config;
