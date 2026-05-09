import EduPlateLogo from '@/components/EduPlateLogo';

export default function BrandLogo({ compact = false }: { compact?: boolean }) {
  if (compact) {
    // Mobile top bar — mark only
    return <EduPlateLogo markOnly className="h-10 w-auto" variant="dark" />;
  }

  // Desktop sidebar — full logo
  return <EduPlateLogo className="w-44 h-auto" variant="dark" />;
}
