import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings } from "lucide-react";
import AdminSeoLlm from "./AdminSeoLlm";
import AdminUsers from "./AdminUsers";
import { useAuth } from "@/hooks/useAuth";

export default function AdminSettings() {
  const { isSuperAdmin } = useAuth();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Settings className="h-7 w-7 text-primary" /> Paramètres
        </h1>
        <p className="text-muted-foreground mt-1">Configuration générale de l'administration.</p>
      </div>
      <Tabs defaultValue="seo">
        <TabsList>
          <TabsTrigger value="seo">Référencement LLM</TabsTrigger>
          {isSuperAdmin && <TabsTrigger value="users">Utilisateurs</TabsTrigger>}
        </TabsList>
        <TabsContent value="seo" className="mt-6">
          <AdminSeoLlm />
        </TabsContent>
        {isSuperAdmin && (
          <TabsContent value="users" className="mt-6">
            <AdminUsers />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
