"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ReactNode } from "react";
import { DURATIONS, EASE_SOFT } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface CoralButtonProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  size?: "sm" | "md" | "lg";
}

/** Primary CTA button with the spec's coral pill treatment.
 *
 *  Hover: subtle bg darken + -2px lift
 *  Active/press: scale 98%, 120ms instant
 *  Matches 10-ANIMATION-SYSTEM.md Section 4 (Buttons). */
export function CoralButton({
  children,
  className,
  onClick,
  disabled,
  type = "button",
  size = "md",
}: CoralButtonProps) {
  const reduced = useReducedMotion();

  const sizeClasses = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg",
  }[size];

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative inline-flex items-center justify-center rounded-full font-medium",
        "bg-primary text-primary-foreground",
        "transition-colors duration-200",
        "hover:bg-primary/90",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        disabled && "opacity-50 cursor-not-allowed",
        sizeClasses,
        className
      )}
      whileHover={reduced || disabled ? undefined : { y: -2 }}
      whileTap={reduced || disabled ? undefined : { scale: 0.98 }}
      transition={{ duration: DURATIONS.instant, ease: EASE_SOFT }}
    >
      {children}
    </motion.button>
  );
}
