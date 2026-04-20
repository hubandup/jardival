import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Store, Tag, BookOpen, ArrowRight, Package } from "lucide-react";

export default function AdminDashboard() {
  const { data: counts } = useQuery({
    queryKey: ["admin-counts"],
    queryFn: async () => {
      const [stores, promos, catalogues, products] = await Promise.all([
        supabase.from("stores").select("id", { count: "exact", head: true }),
        supabase.from("promotions").select("id", { count: "exact", head: true }),
        supabase.from("catalogues").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id", { count: "exact", head: true }),
      ]);
      return {
        stores: stores.count ?? 0,
        promotions: promos.count ?? 0,
        catalogues: catalogues.count ?? 0,
        products: products.count ?? 0,
      };
    },
  });

  const cards = [
    { to: "/admin/magasins", label: "Magasins", icon: Store, count: counts?.stores },
    { to: "/admin/produits", label: "Produits", icon: Package, count: counts?.products },
    { to: "/admin/promotions", label: "Promotions", icon: Tag, count: counts?.promotions },
    { to: "/admin/catalogues", label: "Catalogues", icon: BookOpen, count: counts?.catalogues },
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
                  <div className="text-3xl font-bold">{c.count ?? "—"}</div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
