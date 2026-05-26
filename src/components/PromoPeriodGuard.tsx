import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export function PromoPeriodGuard({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "ok" | "redirect">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("catalogues")
        .select("id")
        .eq("active", true)
        .lte("starts_at", today)
        .gte("ends_at", today)
        .limit(1);
      if (cancelled) return;
      if (error) {
        setStatus("ok");
        return;
      }
      setStatus(data && data.length > 0 ? "ok" : "redirect");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "loading") return null;
  if (status === "redirect") return <Navigate to="/magasins" replace />;
  return <>{children}</>;
}
