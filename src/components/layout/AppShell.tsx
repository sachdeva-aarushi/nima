import { Link, useRouterState } from "@tanstack/react-router";
import { Home, TrendingUp, BookOpen, User as UserIcon, Compass, Sparkles, type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";
import { NimaMascot } from "@/components/NimaMascot";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: ReactNode;
  role?: "mother" | "partner";
}

type NavItem = {
  to: string;
  label: string;
  icon?: LucideIcon;
  mascot?: boolean;
};

const MOTHER_NAV: NavItem[] = [
  { to: "/dashboard", label: "home", icon: Home },
  { to: "/progress", label: "progress", icon: TrendingUp },
  { to: "/nima", label: "nima", mascot: true },
  { to: "/learn", label: "learn", icon: BookOpen },
  { to: "/me", label: "me", icon: UserIcon },
];

const PARTNER_NAV: NavItem[] = [
  { to: "/partner/dashboard", label: "home", icon: Home },
  { to: "/partner/track", label: "track", icon: Compass },
  { to: "/partner/nima", label: "nima", mascot: true },
  { to: "/learn", label: "learn", icon: BookOpen },
  { to: "/me", label: "me", icon: UserIcon },
];

export function AppShell({ children, role = "mother" }: AppShellProps) {
  const nav = role === "partner" ? PARTNER_NAV : MOTHER_NAV;
  return (
    <div className="min-h-screen w-full bg-[#FFF8F7] text-[#3D2A28]">
      {/* Desktop sidebar */}
      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:flex md:w-20 md:flex-col md:items-center md:gap-2 md:border-r md:border-[#F1D9D5] md:bg-white md:py-6">
        <nav className="flex flex-col items-center gap-3" aria-label="Primary">
          {nav.map((item) => (
            <NavLinkItem key={item.to} item={item} vertical />
          ))}
        </nav>
      </aside>

      <main className="pb-24 md:ml-20 md:pb-0">{children}</main>

      {/* Mobile bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#2A2422] bg-[#3D3633]/95 px-2 pb-[max(env(safe-area-inset-bottom),0.25rem)] pt-1 backdrop-blur md:hidden"
        aria-label="Primary"
      >
        <ul className="flex items-center justify-around">
          {nav.map((item) => (
            <li key={item.to}>
              <NavLinkItem item={item} dark />
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function NavLinkItem({ item, vertical, dark }: { item: NavItem; vertical?: boolean; dark?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = pathname === item.to || pathname.startsWith(item.to + "/");
  const Icon = item.icon;
  const idleColor = dark ? "text-[#B8A8A5]" : "text-[#A8908D]";
  const activeColor = dark ? "text-[#FFB4A8]" : "text-[#F38B82]";
  const mascotRing = dark ? "border-[#5A4F4B]" : "border-white";
  const mascotRingActive = dark ? "border-[#FFB4A8]" : "border-[#F38B82]";

  return (
    <Link
      to={item.to}
      className={cn(
        "flex flex-col items-center gap-1 rounded-2xl px-3 transition-colors",
        vertical ? "py-2 w-14" : "py-1 min-w-14"
      )}
    >
      {item.mascot ? (
        <span className="relative flex h-9 w-9 items-center justify-center">
          <span
            className={cn(
              "absolute inset-0 rounded-full bg-gradient-to-tr from-[#F38B82] via-[#FFECE9] to-[#F38B82] transition-opacity",
              active ? "opacity-100" : "opacity-70"
            )}
          />
          <Sparkles
            className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 text-[#FFE4E1]"
            fill="currentColor"
          />
          <Sparkles
            className="absolute -bottom-0.5 -left-0.5 h-2 w-2 text-[#FFE4E1]"
            fill="currentColor"
          />
          <span
            className={cn(
              "relative grid h-7 w-7 place-items-center overflow-hidden rounded-full border-2 bg-[#FFEEEB] shadow-sm transition-colors",
              active ? mascotRingActive : mascotRing
            )}
          >
            <NimaMascot state="happy" size="sm" className="h-full w-full" />
          </span>
        </span>
      ) : (
        Icon && (
          <Icon
            className={cn(
              "h-5 w-5 transition-colors",
              active ? activeColor : idleColor
            )}
            strokeWidth={active ? 2.2 : 1.8}
          />
        )
      )}
      <span
        className={cn(
          "text-[10px] font-medium transition-colors",
          active ? activeColor : idleColor
        )}
      >
        {item.label}
      </span>
    </Link>
  );
}
