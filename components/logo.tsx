export function Logo({ className = "h-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 360 110"
      className={className}
      role="img"
      aria-label="stailist"
    >
      <text
        x="28"
        y="74"
        fontFamily="var(--font-outfit), sans-serif"
        fontSize="58"
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
