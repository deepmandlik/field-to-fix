/* Field-to-Fix mark: a claim travels along a loop (field) and lands as a check (fix), in Firebase warm tones. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Field-to-Fix">
      <defs>
        <linearGradient id="f2f-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffca28" />
          <stop offset=".55" stopColor="#ffa000" />
          <stop offset="1" stopColor="#f4511e" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="13" fill="url(#f2f-g)" />
      <path d="M13 31c0-9 6-16 14-16h6" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      <path d="M29 10l5 5-5 5" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 31l5 5 9-10" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="13" cy="31" r="3" fill="#fff" />
    </svg>
  );
}

export function Logo({ sub = true }: { sub?: boolean }) {
  return (
    <span className="row" style={{ gap: 10 }}>
      <LogoMark />
      <span>
        <b style={{ fontSize: 20, fontWeight: 400, letterSpacing: "-.01em" }}>Field-to-Fix</b>
        {sub && <small style={{ display: "block", fontSize: 11, color: "var(--faint)", marginTop: -2 }}>Warranty → root cause → 8D</small>}
      </span>
    </span>
  );
}
