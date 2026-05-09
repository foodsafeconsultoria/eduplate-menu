/**
 * EduPlate Menu — logo original
 * Prato (dois anéis) + capelo de formatura + wordmark
 *
 * variant="dark"  → sobre fundo escuro (anéis brancos)
 * variant="light" → sobre fundo claro  (anéis navy)
 */

interface Props {
  markOnly?: boolean;
  className?: string;
  variant?: 'dark' | 'light';
}

export default function EduPlateLogo({
  markOnly = false,
  className = '',
  variant = 'dark',
}: Props) {
  const ringColor  = variant === 'dark' ? 'white'    : '#1B2A4A';
  const textColor  = variant === 'dark' ? 'white'    : '#1B2A4A';

  /**
   * Mark: plate (two concentric rings) + graduation cap
   * ViewBox origin: 0,0  — mark spans ~0–130 x 0–145
   */
  const Mark = (
    <g>
      {/* ── Plate ───────────────────────────────────────── */}
      <circle cx="65" cy="96" r="42" stroke={ringColor} strokeWidth="3"   fill="none" />
      <circle cx="65" cy="96" r="32" stroke={ringColor} strokeWidth="1.5" fill="none" />

      {/* ── Graduation cap ──────────────────────────────── */}

      {/* Brim / dome peeking below the board */}
      <ellipse cx="65" cy="64" rx="24" ry="7" fill="#388E3C" />

      {/* 3-D right face of the board (darker strip) */}
      <polygon points="100,42 100,52 65,70 65,62" fill="#2E7D32" />

      {/* Board — main top face (isometric diamond) */}
      <polygon points="65,16 100,42 65,66 30,42" fill="#4CAF50" />

      {/* Subtle highlight on board (top-left catch-light) */}
      <polygon points="65,16 100,42 82,53 47,27" fill="white" fillOpacity="0.09" />

      {/* Tassel cord */}
      <path
        d="M100,42 L111,57 L107,76"
        stroke="#FF9800" strokeWidth="2.5"
        fill="none" strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Tassel end */}
      <rect x="103" y="76" width="8" height="13" rx="3" fill="#FF9800" />
    </g>
  );

  /* ── Mark only (sidebar icon, mobile, favicon) ── */
  if (markOnly) {
    return (
      <svg
        viewBox="0 0 130 145"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="EduPlate Menu"
      >
        {Mark}
      </svg>
    );
  }

  /* ── Full logo with wordmark ── */
  return (
    <svg
      viewBox="0 0 390 145"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="EduPlate Menu"
    >
      {Mark}

      {/* EduPlate */}
      <text
        x="152" y="70"
        fontFamily="'Poppins', system-ui, -apple-system, sans-serif"
        fontWeight="800" fontSize="38"
        fill={textColor}
      >
        EduPlate
      </text>

      {/* Green separator bar */}
      <rect x="152" y="79" width="66" height="4" rx="2" fill="#4CAF50" />

      {/* Menu */}
      <text
        x="152" y="122"
        fontFamily="'Poppins', system-ui, -apple-system, sans-serif"
        fontWeight="800" fontSize="38"
        fill="#4CAF50"
      >
        Menu
      </text>
    </svg>
  );
}
