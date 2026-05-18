import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import { useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import TopNav from "./components/TopNav";
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
import Documents from '@/pages/Documents';
import Team from '@/pages/Team';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import LandingPage from '@/pages/LandingPage';
import TrialBanner from '@/components/TrialBanner';
import TrialGate from '@/components/TrialGate';
import OnboardingModal from '@/components/OnboardingModal';
import OfflineIndicator from '@/components/OfflineIndicator';
import Foods from '@/pages/nutrition/Foods';
import Menus from '@/pages/nutrition/Menus';
import NutritionHub from '@/pages/nutrition/NutritionHub';
import Production from '@/pages/nutrition/Production';
import Recipes from '@/pages/nutrition/Recipes';
import SigpcReport from '@/pages/nutrition/SigpcReport';
import SpecialDiets from '@/pages/nutrition/SpecialDiets';

/** Redirects to /landing (or /login) when user is not authenticated and auth has loaded. */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      // Root path → show landing page; other paths → go to login with redirect
      if (location === '/') {
        navigate('/landing');
      } else {
        navigate(`/login?redirect=${encodeURIComponent(location)}`);
      }
    }
  }, [user, loading, navigate, location]);

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
      <Route path="/registro" component={Register} />
      <Route path="/esqueci-senha" component={ForgotPassword} />
      <Route path="/training/attend/:token" component={TrainingAttend} />
      <Route path="/landing" component={LandingPage} />

      <Route path="*">
        <AuthGuard>
        <TrialGate>
        <div className="flex flex-col min-h-screen">
          <TopNav />
          <TrialBanner />
          <OnboardingModal />
          <main className="flex-1 bg-gray-50">
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
              <Route path="/schools" component={Schools} />
              <Route path="/resto-ingesta" component={RestoIngesta} />
              <Route path="/acceptability" component={Acceptability} />
              <Route path="/maintenance" component={Maintenance} />
              <Route path="/certificates" component={SchoolCertificates} />
              <Route path="/training" component={Training} />
              <Route path="/notifications" component={Notifications} />
              <Route path="/profile" component={Profile} />
              <Route path="/billing" component={Billing} />
              <Route path="/documents" component={Documents} />
              <Route path="/team" component={Team} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
        </TrialGate>
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
            <OfflineIndicator />
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;