import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import { lazy, Suspense, useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import TopNav from "./components/TopNav";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import TrialBanner from '@/components/TrialBanner';
import TrialGate from '@/components/TrialGate';
import OfflineIndicator from '@/components/OfflineIndicator';

// ── Páginas públicas (carregam imediatamente) ─────────────────────────────────
import Login from '@/pages/Login';
import LandingPage from '@/pages/LandingPage';
import NotFound from "./pages/NotFound";

// ── Páginas com lazy loading (carregam só quando acessadas) ───────────────────
const Acceptability      = lazy(() => import('@/pages/Acceptability'));
const Dashboard          = lazy(() => import('@/pages/Dashboard'));
const Inspection         = lazy(() => import('@/pages/Inspection'));
const Maintenance        = lazy(() => import('@/pages/Maintenance'));
const Notifications      = lazy(() => import('@/pages/Notifications'));
const PPEs               = lazy(() => import('@/pages/PPEs'));
const Profile            = lazy(() => import('@/pages/Profile'));
const RestoIngesta       = lazy(() => import('@/pages/RestoIngesta'));
const Schedule           = lazy(() => import('@/pages/Schedule'));
const Schools            = lazy(() => import('@/pages/Schools'));
const Training           = lazy(() => import('@/pages/Training'));
const TrainingAttend     = lazy(() => import('@/pages/TrainingAttend'));
const PrivacyPolicy      = lazy(() => import('@/pages/PrivacyPolicy'));
const TermsOfUse         = lazy(() => import('@/pages/TermsOfUse'));
const Pricing            = lazy(() => import('@/pages/Pricing'));
const Billing            = lazy(() => import('@/pages/Billing'));
const Cadastro           = lazy(() => import('@/pages/Cadastro'));
const Documents          = lazy(() => import('@/pages/Documents'));
const Team               = lazy(() => import('@/pages/Team'));
const Register           = lazy(() => import('@/pages/Register'));
const ForgotPassword     = lazy(() => import('@/pages/ForgotPassword'));

// ── Módulos de nutrição (lazy — os mais pesados) ──────────────────────────────
const Foods        = lazy(() => import('@/pages/nutrition/Foods'));
const Menus        = lazy(() => import('@/pages/nutrition/Menus'));
const NutritionHub = lazy(() => import('@/pages/nutrition/NutritionHub'));
const Production   = lazy(() => import('@/pages/nutrition/Production'));
const Recipes      = lazy(() => import('@/pages/nutrition/Recipes'));
const SigpcReport  = lazy(() => import('@/pages/nutrition/SigpcReport'));
const SpecialDiets = lazy(() => import('@/pages/nutrition/SpecialDiets'));

// ── Spinner de transição entre módulos ────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="text-center space-y-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mx-auto" />
        <p className="text-gray-400 text-sm">Carregando…</p>
      </div>
    </div>
  );
}

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
    <Suspense fallback={<PageLoader />}>
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
            <main className="flex-1 bg-gray-50">
              <Suspense fallback={<PageLoader />}>
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
                  <Route path="/training" component={Training} />
                  <Route path="/notifications" component={Notifications} />
                  <Route path="/profile" component={Profile} />
                  <Route path="/billing" component={Billing} />
                  <Route path="/documents" component={Documents} />
                  <Route path="/team" component={Team} />
                  <Route component={NotFound} />
                </Switch>
              </Suspense>
            </main>
          </div>
          </TrialGate>
          </AuthGuard>
        </Route>
      </Switch>
    </Suspense>
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
