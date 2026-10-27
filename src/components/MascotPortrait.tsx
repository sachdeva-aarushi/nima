import { Heart } from "lucide-react";
import { NimaMascot, type MascotSize, type MascotState } from "@/components/NimaMascot";
import { cn } from "@/lib/utils";

interface MascotPortraitProps {
  state?: MascotState;
  size?: MascotSize;
  /** Show coral heart decoration. Default true for md/lg/xl, false for sm/xs. */
  accents?: boolean;
  className?: string;
  priority?: boolean;
}

const FRAME_PX: Record<MascotSize, number> = {
  sm: 56,
  md: 96,
  lg: 128,
  xl: 176,
};

/** Circular framed portrait of Nima with optional heart accent.
 *  Used everywhere: auth, onboarding hero, dashboard greeting, check-in. */
export function MascotPortrait({
  state = "happy",
  size = "md",
  accents,
  className,
  priority,
}: MascotPortraitProps) {
  const showAccents = accents ?? (size === "md" || size === "lg" || size === "xl");
  const px = FRAME_PX[size];

  return (
    <div className={cn("relative inline-block", className)} style={{ width: px, height: px }}>
      {showAccents && (
        <Heart
          className="absolute -right-1 -top-1 h-4 w-4 fill-[#F38B82] text-[#F38B82]"
          strokeWidth={2}
          aria-hidden
        />
      )}
      <div
        className="relative h-full w-full overflow-hidden rounded-full bg-[#FFEEEB]"
        style={{ width: px, height: px }}
      >
        <NimaMascot
          state={state}
          size={size === "sm" ? "sm" : size === "md" ? "md" : "lg"}
          className="h-full w-full"
          priority={priority}
        />
      </div>
    </div>
  );
}
