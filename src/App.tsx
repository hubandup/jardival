import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import ProductDetail from "./pages/ProductDetail.tsx";
import Stores from "./pages/Stores.tsx";
import StoreDetail from "./pages/StoreDetail.tsx";
import Catalogue from "./pages/Catalogue.tsx";
import Promotions from "./pages/Promotions.tsx";
import NotFound from "./pages/NotFound.tsx";
import { PromoPeriodGuard } from "./components/PromoPeriodGuard";
import AdminLogin from "./pages/admin/AdminLogin.tsx";
import AdminForgotPassword from "./pages/admin/AdminForgotPassword.tsx";
import AdminResetPassword from "./pages/admin/AdminResetPassword.tsx";
import AdminLayout from "./pages/admin/AdminLayout.tsx";
import AdminDashboard from "./pages/admin/AdminDashboard.tsx";
import AdminStores from "./pages/admin/AdminStores.tsx";
import AdminPromotions from "./pages/admin/AdminPromotions.tsx";
import AdminCatalogues from "./pages/admin/AdminCatalogues.tsx";
import AdminProducts from "./pages/admin/AdminProducts.tsx";
import AdminProfile from "./pages/admin/AdminProfile.tsx";
import AdminMedia from "./pages/admin/AdminMedia.tsx";
import AdminSettings from "./pages/admin/AdminSettings.tsx";
import { AuthProvider } from "./hooks/useAuth";
import { usePageTracking } from "./hooks/usePageTracking";


const queryClient = new QueryClient();

function PageTracker() {
  usePageTracking();
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <PageTracker />
          <Routes>
            <Route path="/" element={<PromoPeriodGuard><Index /></PromoPeriodGuard>} />
            <Route path="/produit/:id" element={<PromoPeriodGuard><ProductDetail /></PromoPeriodGuard>} />
            <Route path="/magasins" element={<Stores />} />
            <Route path="/magasins/:id" element={<StoreDetail />} />
            <Route path="/catalogue" element={<PromoPeriodGuard><Catalogue /></PromoPeriodGuard>} />
            <Route path="/promotions" element={<PromoPeriodGuard><Promotions /></PromoPeriodGuard>} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/forgot-password" element={<AdminForgotPassword />} />
            <Route path="/admin/reset-password" element={<AdminResetPassword />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="magasins" element={<AdminStores />} />
              <Route path="promotions" element={<AdminPromotions />} />
              <Route path="catalogues" element={<AdminCatalogues />} />
              <Route path="produits" element={<AdminProducts />} />
              <Route path="medias" element={<AdminMedia />} />
              <Route path="seo-llm" element={<AdminSeoLlm />} />
              <Route path="profil" element={<AdminProfile />} />
              <Route path="utilisateurs" element={<AdminUsers />} />
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
