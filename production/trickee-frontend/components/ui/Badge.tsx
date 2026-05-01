import React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "warning" | "error" | "info" | "outline";
}

export const Badge = ({ className, variant = "default", ...props }: BadgeProps) => {
  const variants = {
    default: "bg-bg-border text-text-primary",
    success: "bg-accent-green/10 text-accent-green border border-accent-green/20",
    warning: "bg-accent-amber/10 text-accent-amber border border-accent-amber/20",
    error: "bg-accent-red/10 text-accent-red border border-accent-red/20",
    info: "bg-accent-teal/10 text-accent-teal border border-accent-teal/20",
    outline: "border border-bg-border text-text-dim",
  };

  return (
    <div
      className={cn(
        "status-badge inline-flex items-center",
        variants[variant],
        className
      )}
      {...props}
    />
  );
};
