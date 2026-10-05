/** School crest: a roundel with a hanging amaltas (golden shower) raceme. */
export function Crest({ size = 36, className }: { size?: number; className?: string }) {
  // flowers hang along a gentle curve, getting smaller towards the tip
  const flowers = [
    { x: 20, y: 11.5, r: 3.1 },
    { x: 16.3, y: 14.6, r: 2.7 },
    { x: 23.6, y: 15.4, r: 2.7 },
    { x: 18.4, y: 18.8, r: 2.45 },
    { x: 22.2, y: 21.6, r: 2.2 },
    { x: 18.9, y: 24.6, r: 1.95 },
    { x: 21.4, y: 27.5, r: 1.6 },
    { x: 19.6, y: 30.1, r: 1.25 },
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} role="img" aria-label="School crest">
      <circle cx="20" cy="20" r="19.25" fill="var(--brand-deep)" />
      <circle cx="20" cy="20" r="16.6" fill="none" stroke="var(--accent)" strokeOpacity="0.55" strokeWidth="0.7" />
      <path d="M20 6.2 C 20 9, 19.6 10.5, 20 11.5" stroke="var(--accent)" strokeWidth="0.9" fill="none" strokeLinecap="round" />
      <path d="M12.5 9.8 C 15 7.6, 25 7.6, 27.5 9.8" stroke="var(--accent)" strokeOpacity="0.8" strokeWidth="0.9" fill="none" strokeLinecap="round" />
      {flowers.map((f, i) => (
        <circle key={i} cx={f.x} cy={f.y} r={f.r} fill="var(--accent)" opacity={1 - i * 0.045} />
      ))}
      <path d="M11.5 31.5 Q 20 35.2 28.5 31.5" stroke="var(--accent)" strokeOpacity="0.55" strokeWidth="0.7" fill="none" strokeLinecap="round" />
    </svg>
  );
}
