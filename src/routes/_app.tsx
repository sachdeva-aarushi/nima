import { Outlet, createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<"mother" | "partner">("mother");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!data.session) {
        window.location.replace("/auth");
        return;
      }
      const { data: prof } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.session.user.id)
        .maybeSingle();
      const r = (prof?.role as "mother" | "partner" | undefined) ?? "mother";
      setRole(r);
      setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Role-aware redirects
  useEffect(() => {
    if (!ready) return;
    const path = location.pathname;
    if (role === "partner") {
      // Partners only have /partner/* + a handful of shared screens.
      const allowed =
        path.startsWith("/partner/") ||
        path.startsWith("/learn") ||
        path.startsWith("/me") ||
        path.startsWith("/crisis");
      if (!allowed) navigate({ to: "/partner/dashboard", replace: true });
    }
    // Mothers may visit /partner/* (dev/preview of partner view) — no redirect.

  }, [ready, role, location.pathname, navigate]);

  if (!ready) return null;
  return (
    <AppShell role={role}>
      <Outlet />
    </AppShell>
  );
}
