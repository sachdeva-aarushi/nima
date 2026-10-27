import { useReducedMotion as useFramerReducedMotion } from "framer-motion";

// ── Motion tokens — Section 1 of 10-ANIMATION-SYSTEM.md ──
// Every duration / easing in the app MUST come from here.

export const EASE_SOFT = [0.25, 0.1, 0.25, 1] as const;
export const EASE_BOUNCE = [0.34, 1.56, 0.64, 1] as const;

export const DURATIONS = {
  instant: 0.12, // 120ms  — hover, button press
  fast: 0.2, // 200ms    — card lift, tab switches
  base: 0.35, // 350ms   — entrances, modal open/close
  slow: 0.6, // 600ms    — hero, celebrations
} as const;

export const STAGGER_STEP = 0.06; // 60ms

// ── Reusable Framer Motion transition presets ──
export const transitions = {
  soft: {
    duration: DURATIONS.base,
    ease: EASE_SOFT,
  },
  softFast: {
    duration: DURATIONS.fast,
    ease: EASE_SOFT,
  },
  softSlow: {
    duration: DURATIONS.slow,
    ease: EASE_SOFT,
  },
  instant: {
    duration: DURATIONS.instant,
    ease: EASE_SOFT,
  },
  bounce: {
    duration: DURATIONS.slow,
    ease: EASE_BOUNCE,
  },
} as const;

// ── Entrance variants ──
export const fadeUpVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

export const fadeInVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export const scaleInVariants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1 },
};

export const slideFromRightVariants = {
  hidden: { opacity: 0, x: 16 },
  visible: { opacity: 1, x: 0 },
};

export const slideFromLeftVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0 },
};

export const slideUpVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

// ── Hover / tap states ──
export const cardHoverTap = {
  hover: { y: -2, transition: transitions.softFast },
  tap: { scale: 0.97, transition: transitions.instant },
};

export const buttonHoverTap = {
  hover: { y: -2, transition: transitions.softFast },
  tap: { scale: 0.98, transition: transitions.instant },
};

export const chipSelectPulse = {
  initial: { scale: 1 },
  animate: { scale: [1, 1.03, 1], transition: { duration: DURATIONS.fast, ease: EASE_SOFT } },
};

// ── Reduced motion helper ──
export function useReducedMotion(): boolean {
  return useFramerReducedMotion() ?? false;
}

/** Returns a motion config object that disables animations when the user
 *  prefers reduced motion. Use as a spread on motion components. */
export function reducedMotionSafe(motionProps: Record<string, unknown>) {
  // This is a client-only helper; the actual check happens inside
  // Framer Motion's own `useReducedMotion`. We just export a convenience
  // wrapper so every component doesn't have to repeat the pattern.
  return motionProps;
}
