"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ReactNode } from "react";
import { transitions } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface InteractiveCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  as?: "div" | "button" | "a";
  href?: string;
  disabled?: boolean;
  /** Disables the hover-lift shadow for static decorative cards */
  noShadow?: boolean;
}

/** Reusable hover-lift + tap-feedback wrapper for every interactive card.
 *
 *  Desktop (Section 4):
 *    translateY 0 → -2px, shadow deepens, 200ms ease-soft
 *  Mobile (Section 5):
 *    scale to 97% on touch-start, instant return
 *
 *  Respects `prefers-reduced-motion` — falls back to instant state change.
 */
export function InteractiveCard({
  children,
  className,
  onClick,
  as = "div",
  href,
  disabled,
  noShadow = false,
}: InteractiveCardProps) {
  const reduced = useReducedMotion();

  const baseClasses = cn(
    "rounded-xl border border-border bg-card text-card-foreground transition-colors",
    onClick && !disabled && "cursor-pointer",
    disabled && "opacity-60 cursor-not-allowed",
    className
  );

  const shadowClasses = !noShadow
    ? "shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)]"
    : "";

  const hoverShadow = !noShadow
    ? "hover:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.1)]"
    : "";

  if (as === "a" && href) {
    return (
      <motion.a
        href={href}
        className={cn(baseClasses, shadowClasses, hoverShadow)}
        whileHover={reduced ? undefined : { y: -2 }}
        whileTap={reduced ? undefined : { scale: 0.97 }}
        transition={transitions.softFast}
      >
        {children}
      </motion.a>
    );
  }

  if (as === "button") {
    return (
      <motion.button
        onClick={onClick}
        disabled={disabled}
        className={cn(baseClasses, shadowClasses, hoverShadow, "text-left")}
        whileHover={reduced || disabled ? undefined : { y: -2 }}
        whileTap={reduced || disabled ? undefined : { scale: 0.97 }}
        transition={transitions.softFast}
      >
        {children}
      </motion.button>
    );
  }

  return (
    <motion.div
      onClick={disabled ? undefined : onClick}
      className={cn(baseClasses, shadowClasses, hoverShadow)}
      whileHover={reduced || !onClick ? undefined : { y: -2 }}
      whileTap={reduced || !onClick ? undefined : { scale: 0.97 }}
      transition={transitions.softFast}
    >
      {children}
    </motion.div>
  );
}
