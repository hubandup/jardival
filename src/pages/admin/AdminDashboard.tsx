import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Store, Tag, BookOpen, ArrowRight, Package, AlertCircle, Eye, TrendingUp,
  Users, Smartphone, Monitor, Tablet,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

export default function AdminDashboard() {
  const [days, setDays] = useState<7 | 30>(7);

  const { data: counts } = useQuery({
    queryKey: ["admin-counts"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [stores, products, promos, promosActive, catalogues, cataloguesActive, expiring] =
        await Promise.all([
          supabase.from("stores").select("id", { count: "exact", head: true }),
          supabase.from("products").select("id", { count: "exact", head: true }).eq("active", true),
          supabase.from("promotions").select("id", { count: "exact", head: true }),
          supabase
            .from("promotions")
            .select("id", { count: "exact", head: true })
            .eq("active", true)
            .or(`ends_at.is.null,ends_at.gte.${today}`),
          supabase.from("catalogues").select("id", { count: "exact", head: true }),
          supabase
            .from("catalogues")
            .select("id", { count: "exact", head: true })
            .eq("active", true)
            .or(`ends_at.is.null,ends_at.gte.${today}`),
          supabase
            .from("promotions")
            .select("id, title, ends_at")
            .eq("active", true)
            .not("ends_at", "is", null)
            .gte("ends_at", today)
            .lte("ends_at", new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10))
            .order("ends_at", { ascending: true })
            .limit(5),
        ]);
      return {
        stores: stores.count ?? 0,
        products: products.count ?? 0,
        promotions: promos.count ?? 0,
        promotionsActive: promosActive.count ?? 0,
        catalogues: catalogues.count ?? 0,
        cataloguesActive: cataloguesActive.count ?? 0,
        expiring: expiring.data ?? [],
      };
    },
  });

  const { data: daily } = useQuery({
    queryKey: ["pageviews-daily", days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pageviews_daily", { _days: days });
      if (error) throw error;
      return (data ?? []).map((d: any) => ({
        day: d.day,
        label: format(parseISO(d.day), days === 7 ? "EEE" : "d MMM", { locale: fr }),
        views: Number(d.views),
      }));
    },
  });

  const { data: top } = useQuery({
    queryKey: ["pageviews-top", days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pageviews_top_paths", { _days: days, _limit: 10 });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["pageviews-stats", days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pageviews_stats", { _days: days });
      if (error) throw error;
      return (data?.[0] ?? null) as {
        total_views: number;
        unique_sessions: number;
        mobile_views: number;
        tablet_views: number;
        desktop_views: number;
      } | null;
    },
  });

  const { data: topStores } = useQuery({
    queryKey: ["pageviews-top-stores", days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pageviews_top_stores", { _days: days, _limit: 10 });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: topProducts } = useQuery({
    queryKey: ["pageviews-top-products", days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pageviews_top_products", { _days: days, _limit: 10 });
      if (error) throw error;
      return data ?? [];
    },
  });

  const totalViews = Number(stats?.total_views ?? 0);
  const uniqueRate =
    stats && Number(stats.total_views) > 0
      ? Math.round((Number(stats.unique_sessions) / Number(stats.total_views)) * 100)
      : 0;
  const deviceTotal =
    Number(stats?.mobile_views ?? 0) +
    Number(stats?.tablet_views ?? 0) +
    Number(stats?.desktop_views ?? 0);
  const pct = (n: number) => (deviceTotal > 0 ? Math.round((n / deviceTotal) * 100) : 0);

  const cards = [
    { to: "/admin/magasins", label: "Magasins", icon: Store, count: counts?.stores },
    { to: "/admin/produits", label: "Produits actifs", icon: Package, count: counts?.products },
    {
      to: "/admin/promotions",
      label: "Promotions actives",
      icon: Tag,
      count: counts?.promotionsActive,
      sub: counts ? `sur ${counts.promotions} au total` : undefined,
    },
    {
      to: "/admin/catalogues",
      label: "Catalogues en cours",
      icon: BookOpen,
      count: counts?.cataloguesActive,
      sub: counts ? `sur ${counts.catalogues} au total` : undefined,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tableau de bord</h1>
        <p className="text-muted-foreground mt-1">Vue d'ensemble de votre site Jardival</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link key={c.to} to={c.to}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
                <c.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-3xl font-bold">{c.count ?? "—"}</div>
                    {c.sub && <div className="text-xs text-muted-foreground mt-1">{c.sub}</div>}
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {counts?.expiring && counts.expiring.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-4 w-4 text-destructive" />
              Promotions expirant dans 7 jours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {counts.expiring.map((p: any) => (
                <li key={p.id} className="flex justify-between items-center text-sm border-b last:border-0 py-2">
                  <span className="font-medium">{p.title}</span>
                  <span className="text-muted-foreground">
                    expire le {format(parseISO(p.ends_at), "d MMMM", { locale: fr })}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Trafic du site
            </CardTitle>
            <CardDescription>
              {totalViews} visite{totalViews > 1 ? "s" : ""} sur {days} jours
            </CardDescription>
          </div>
          <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v) as 7 | 30)}>
            <TabsList>
              <TabsTrigger value="7">7 jours</TabsTrigger>
              <TabsTrigger value="30">30 jours</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={daily ?? []}>
                <defs>
                  <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" fontSize={12} stroke="hsl(var(--muted-foreground))" />
                <YAxis allowDecimals={false} fontSize={12} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="views"
                  stroke="hsl(var(--primary))"
                  fill="url(#viewsGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Eye className="h-4 w-4" /> Visites
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalViews}</div>
            <p className="text-xs text-muted-foreground mt-1">sur {days} jours</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> Visiteurs uniques
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Number(stats?.unique_sessions ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">{uniqueRate}% du trafic</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Monitor className="h-4 w-4" /> Desktop
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pct(Number(stats?.desktop_views ?? 0))}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {Number(stats?.desktop_views ?? 0)} visite{Number(stats?.desktop_views ?? 0) > 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Smartphone className="h-4 w-4" /> Mobile
              {Number(stats?.tablet_views ?? 0) > 0 && (
                <Tablet className="h-3 w-3 opacity-50" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pct(Number(stats?.mobile_views ?? 0) + Number(stats?.tablet_views ?? 0))}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {Number(stats?.mobile_views ?? 0)} mobile · {Number(stats?.tablet_views ?? 0)} tablette
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Pages les plus consultées
          </CardTitle>
          <CardDescription>Sur les {days} derniers jours</CardDescription>
        </CardHeader>
        <CardContent>
          {(top ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Aucune visite enregistrée pour le moment.
            </p>
          ) : (
            <ul className="space-y-1">
              {(top ?? []).map((p: any) => (
                <li
                  key={p.path}
                  className="flex justify-between items-center text-sm py-2 border-b last:border-0"
                >
                  <span className="font-mono text-xs truncate">{p.path}</span>
                  <span className="font-semibold">{Number(p.views)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Store className="h-4 w-4" /> Top magasins consultés
            </CardTitle>
            <CardDescription>Sur les {days} derniers jours</CardDescription>
          </CardHeader>
          <CardContent>
            {(topStores ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Aucune consultation</p>
            ) : (
              <ul className="space-y-1">
                {(topStores ?? []).map((s: any) => (
                  <li
                    key={s.store_id}
                    className="flex justify-between items-center text-sm py-2 border-b last:border-0"
                  >
                    <span className="truncate">{s.store_name ?? s.store_id}</span>
                    <span className="font-semibold">{Number(s.views)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4" /> Top produits vus
            </CardTitle>
            <CardDescription>Sur les {days} derniers jours</CardDescription>
          </CardHeader>
          <CardContent>
            {(topProducts ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Aucune consultation</p>
            ) : (
              <ul className="space-y-1">
                {(topProducts ?? []).map((p: any) => (
                  <li
                    key={p.product_id}
                    className="flex justify-between items-center text-sm py-2 border-b last:border-0"
                  >
                    <span className="truncate">{p.product_name ?? p.product_id}</span>
                    <span className="font-semibold">{Number(p.views)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
