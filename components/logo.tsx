// Wordmark v3 (Gen-Z monocromo): "stailist" en Arimo 700 con el "ai" en
// Instrument Serif itálica. El guiño a "AI" se lee por el contraste sans/serif,
// NUNCA por color (antes el "ai" iba en burdeos; vetado en v3). Tinta sobre
// claro vía var(--c-ink); en superficies oscuras, pasar text-on-accent.
export function Logo({ className = "h-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 360 110"
      className={className}
      role="img"
      aria-label="stailist"
    >
      <text
        x="4"
        y="80"
        fontFamily="var(--font-arimo), Helvetica, Arial, sans-serif"
        fontSize="82"
        fontWeight="700"
        letterSpacing="-4"
        fill="var(--c-ink)"
      >
        st
        <tspan
          fontFamily="var(--font-instrument), Georgia, serif"
          fontStyle="italic"
          fontWeight="400"
          letterSpacing="0"
        >
          ai
        </tspan>
        list
      </text>
    </svg>
  );
}
