/** School crest: a roundel with a five-petalled amaltas (golden shower) blossom. */
export function Crest({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} role="img" aria-label="School crest">
      <circle cx="20" cy="20" r="19.25" fill="var(--brand-deep)" />
      <circle cx="20" cy="20" r="16.4" fill="none" stroke="var(--accent)" strokeOpacity="0.5" strokeWidth="0.75" />
      <g transform="rotate(-18 20 20)">
        {[0, 72, 144, 216, 288].map((a) => (
          <path
            key={a}
            transform={`rotate(${a} 20 20)`}
            d="M20 19.4 C 16.2 17.6, 15.4 12.2, 18.1 10.3 C 19.2 9.6, 20.8 9.6, 21.9 10.3 C 24.6 12.2, 23.8 17.6, 20 19.4 Z"
            fill="var(--accent)"
          />
        ))}
      </g>
      <circle cx="20" cy="20" r="2.4" fill="var(--brand-deep)" />
      <circle cx="20" cy="20" r="1.15" fill="var(--accent)" />
    </svg>
  );
}
