"use client";

import { Moon, Sun } from "lucide-react";
import { applyTheme, saveTheme } from "@/lib/theme-runtime.mjs";

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className }: ThemeToggleProps) {
  const toggleTheme = () => {
    const root = document.documentElement;
    const nextTheme = root.dataset.theme === "light" ? "dark" : "light";

    root.classList.add("theme-transitioning");
    applyTheme(root, nextTheme);
    saveTheme(window.localStorage, nextTheme);
    window.dispatchEvent(new CustomEvent("trickee:theme", { detail: nextTheme }));
    window.setTimeout(() => root.classList.remove("theme-transitioning"), 480);
  };

  return (
    <button
      type="button"
      className={`theme-toggle${className ? ` ${className}` : ""}`}
      aria-label="Toggle sun and moon theme"
      title="Toggle sun and moon theme"
      onClick={toggleTheme}
    >
      <span className="theme-toggle-track" aria-hidden="true">
        <Sun className="theme-toggle-sun" />
        <Moon className="theme-toggle-moon" />
        <span className="theme-toggle-orb" />
      </span>
    </button>
  );
}
