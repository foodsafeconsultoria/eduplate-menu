import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import { useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import Sidebar from "./components/Sidebar";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Acceptability from '@/pages/Acceptability';
import Dashboard from '@/pages/Dashboard';
import Inspection from '@/pages/Inspection';
import Login from '@/pages/Login';
import Maintenance from '@/pages/Maintenance';
import NotFound from "./pages/NotFound";
import Notifications from '@/pages/Notifications';
import PPEs from '@/pages/PPEs';
import Profile from '@/pages/Profile';
import Reports from '@/pages/Reports';
import RestoIngesta from '@/pages/RestoIngesta';
import Schedule from '@/pages/Schedule';
import SchoolCertificates from '@/pages/SchoolCertificates';
import Schools from '@/pages/Schools';
import Training from '@/pages/Training';
import TrainingAttend from '@/pages/TrainingAttend';
import PrivacyPolicy from '@/pages/PrivacyPolicy';
import TermsOfUse from '@/pages/TermsOfUse';
import Pricing from '@/pages/Pricing';
import Billing from '@/pages/Billing';
import Cadastro from '@/pages/Cadastro';
import TrialBanner from '@/components/TrialBanner';
import Foods from '@/pages/nutrition/Foods';
import Menus from '@/pages/nutrition/Menus';
import NutritionHub from '@/pages/nutrition/NutritionHub';
import Production from '@/pages/nutrition/Production';
import Recipes from '@/pages/nutrition/Recipes';
import SigpcReport from '@/pages/nutrition/SigpcReport';
import SpecialDiets from '@/pages/nutrition/SpecialDiets';

/** Redirects to /login when user is not authenticated and auth has loaded. */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto" />
          <p className="text-gray-500 text-sm">Carregando…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/privacidade" component={PrivacyPolicy} />
      <Route path="/termos" component={TermsOfUse} />
      <Route path="/planos" component={Pricing} />
      <Route path="/cadastro" component={Cadastro} />
      <Route path="/training/attend/:token" component={TrainingAttend} />

      <Route path="*">
        <AuthGuard>
        <div className="flex flex-col min-h-screen">
          <TrialBanner />
          <div className="flex flex-1">
          <Sidebar />
          <main className="flex-1">
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/nutrition" component={NutritionHub} />
              <Route path="/nutrition/foods" component={Foods} />
              <Route path="/nutrition/recipes" component={Recipes} />
              <Route path="/nutrition/menus" component={Menus} />
              <Route path="/nutrition/special-diets" component={SpecialDiets} />
              <Route path="/nutrition/production" component={Production} />
              <Route path="/nutrition/sigpc" component={SigpcReport} />
              <Route path="/inspection" component={Inspection} />
              <Route path="/ppes" component={PPEs} />
              <Route path="/schedule" component={Schedule} />
              <Route path="/reports" component={Reports} />
              <Route path="/schools" component={Schools} />
              <Route path="/resto-ingesta" component={RestoIngesta} />
              <Route path="/acceptability" component={Acceptability} />
              <Route path="/maintenance" component={Maintenance} />
              <Route path="/certificates" component={SchoolCertificates} />
              <Route path="/training" component={Training} />
              <Route path="/notifications" component={Notifications} />
              <Route path="/profile" component={Profile} />
              <Route path="/billing" component={Billing} />
              <Route component={NotFound} />
            </Switch>
          </main>
          </div>
        </div>
        </AuthGuard>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;