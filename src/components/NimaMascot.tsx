import { cn } from "@/lib/utils";

import idleAsset from "@/assets/mascot/idle.png.asset.json";
import listeningAsset from "@/assets/mascot/listening.png.asset.json";
import comfortingAsset from "@/assets/mascot/comforting.png.asset.json";
import happyAsset from "@/assets/mascot/happy.png.asset.json";
import celebratingAsset from "@/assets/mascot/celebrating.png.asset.json";
import sleepyAsset from "@/assets/mascot/sleepy.png.asset.json";
import thinkingAsset from "@/assets/mascot/thinking.png.asset.json";
import concernedAsset from "@/assets/mascot/concerned.png.asset.json";

export type MascotState =
  | "idle"
  | "listening"
  | "comforting"
  | "happy"
  | "celebrating"
  | "sleepy"
  | "thinking"
  | "concerned";

export type MascotSize = "sm" | "md" | "lg" | "xl";

const MASCOT_SOURCES: Record<MascotState, string> = {
  idle: idleAsset.url,
  listening: listeningAsset.url,
  comforting: comfortingAsset.url,
  happy: happyAsset.url,
  celebrating: celebratingAsset.url,
  sleepy: sleepyAsset.url,
  thinking: thinkingAsset.url,
  concerned: concernedAsset.url,
};

const DEFAULT_ALT: Record<MascotState, string> = {
  idle: "Nima the capybara, resting calmly",
  listening: "Nima listening attentively",
  comforting: "Nima holding a heart, offering comfort",
  happy: "Nima smiling warmly",
  celebrating: "Nima celebrating with arms raised",
  sleepy: "Nima sleeping in a nightcap",
  thinking: "Nima thinking thoughtfully",
  concerned: "Nima looking concerned",
};

const SIZE_PX: Record<MascotSize, number> = {
  sm: 48,
  md: 96,
  lg: 160,
  xl: 240,
};

export interface NimaMascotProps {
  state: MascotState;
  size?: MascotSize;
  className?: string;
  alt?: string;
  priority?: boolean;
}

export function NimaMascot({
  state,
  size = "md",
  className,
  alt,
  priority = false,
}: NimaMascotProps) {
  const px = SIZE_PX[size];
  // If the consumer hands us its own sizing (h-*, w-*, h-full, etc.), don't
  // fight it with inline width/height — let the parent control the box.
  const overrideSize = className ? /\b[hw]-(full|\d|\[)/.test(className) : false;
  return (
    <img
      src={MASCOT_SOURCES[state]}
      alt={alt ?? DEFAULT_ALT[state]}
      width={px}
      height={px}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      className={cn("select-none object-cover", className)}
      style={overrideSize ? undefined : { width: px, height: px }}
    />
  );
}

export default NimaMascot;
