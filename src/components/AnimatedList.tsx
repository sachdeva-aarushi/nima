"use client";

import { motion, Variants } from "framer-motion";
import { ReactNode } from "react";
import {
  DURATIONS,
  EASE_SOFT,
  fadeUpVariants,
  transitions,
} from "@/lib/motion";

interface AnimatedListProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number; // seconds, default = STAGGER_STEP (60ms)
  once?: boolean; // default true — only animate on first mount
}

/** Wraps a list/grid of elements and staggers their entrance.
 *  Every child should be a `motion.*` component (or wrapped in one)
 *  that accepts the `variants` prop.
 *
 *  Matches 10-ANIMATION-SYSTEM.md Section 3:
 *    opacity 0→1, translateY 12px→0, duration-base, ease-soft,
 *    staggered by 60ms.
 */
export function AnimatedList({
  children,
  className,
  staggerDelay = 0.06,
  once = true,
}: AnimatedListProps) {
  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: staggerDelay,
      },
    },
  };

  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount: 0.2 }}
    >
      {children}
    </motion.div>
  );
}

/** Drop this on each child inside `<AnimatedList>` (or any motion container). */
export function AnimatedListItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={fadeUpVariants}
      transition={transitions.soft}
    >
      {children}
    </motion.div>
  );
}

// ── Headline reveal (Section 7) ──

interface HeadlineRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

/** Upward fade (12px rise, 400ms, ease-soft) for screen headlines.
 *  Matches 10-ANIMATION-SYSTEM.md Section 7. */
export function HeadlineReveal({
  children,
  className,
  delay = 0,
}: HeadlineRevealProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE_SOFT, delay }}
    >
      {children}
    </motion.div>
  );
}
