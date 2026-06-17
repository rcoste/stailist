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
        fontFamily="var(--font-bodoni), 'Times New Roman', serif"
        fontSize="82"
        fontWeight="600"
        letterSpacing="-1"
        fill="var(--c-ink)"
      >
        st
        <tspan fill="var(--c-accent)">ai</tspan>
        list
      </text>
    </svg>
  );
}
