'use client';

// Small presentational pieces shared by the instant-call experience (dev
// globe prototype + the real /app integration's mock and real modes alike).
// Purely visual — no data fetching, no mock/real awareness.

export function Starfield() {
  // Cheap, static, tiled star layers — no per-star DOM nodes.
  const layer = (size: number, dots: [number, number][], opacity: number) => ({
    backgroundImage: dots.map(([x, y]) => `radial-gradient(1px 1px at ${x}px ${y}px, rgba(255,255,255,${opacity}), transparent)`).join(','),
    backgroundSize: `${size}px ${size}px`,
  });
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
      <div className="absolute inset-0" style={layer(140, [[20, 30], [80, 90], [120, 20], [40, 110]], 0.5)} />
      <div className="absolute inset-0" style={layer(220, [[30, 180], [160, 60], [190, 200], [70, 40]], 0.35)} />
    </div>
  );
}

export function Spinner() {
  return <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />;
}

export function CenteredOverlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm text-center px-6">
      {children}
    </div>
  );
}

export function ResolutionOverlay({
  title, subtitle, actions,
}: {
  title: string;
  subtitle?: string;
  actions: { label: string; onClick: () => void; primary?: boolean }[];
}) {
  return (
    <CenteredOverlay>
      <p className="text-xl font-semibold">{title}</p>
      {subtitle && <p className="text-white/50 text-sm mt-1">{subtitle}</p>}
      <div className="mt-8 flex flex-col gap-2 w-56">
        {actions.map(a => (
          <button
            key={a.label}
            onClick={a.onClick}
            className={`px-5 py-2.5 rounded-full font-semibold ${
              a.primary ? 'bg-white text-black' : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>
    </CenteredOverlay>
  );
}

export function PartnerAvatar({
  name, color, flag, size = 88,
}: { name: string; color: string; flag?: string; size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div
        className="w-full h-full rounded-full flex items-center justify-center font-bold text-white shadow-2xl ring-4 ring-white/15"
        style={{ background: color, fontSize: size * 0.36 }}
      >
        {name.slice(0, 1)}
      </div>
      {flag && (
        <span
          className="absolute -bottom-1 -right-1 rounded-full bg-black/60 flex items-center justify-center"
          style={{ width: size * 0.34, height: size * 0.34, fontSize: size * 0.2 }}
        >
          {flag}
        </span>
      )}
    </div>
  );
}
