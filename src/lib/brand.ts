// White-label configuration. Everything a school would want changed for its own
// portal — name, crest initials, motto, colours — lives here, and can be
// previewed live from Settings → Branding.

export type BrandPreset = {
  id: string;
  name: string;
  /** primary actions, active states */
  brand: string;
  /** sidebar & login panel */
  deep: string;
  /** tinted backgrounds */
  soft: string;
  /** decorative highlight (crest, small accents) */
  accent: string;
};

export const PRESETS: BrandPreset[] = [
  { id: "amaltas", name: "Amaltas green", brand: "#1F6B50", deep: "#123D2F", soft: "#E6F0EA", accent: "#E3A82B" },
  { id: "oxford", name: "Oxford blue", brand: "#264D8C", deep: "#152B52", soft: "#E6ECF6", accent: "#D9A74A" },
  { id: "maroon", name: "Heritage maroon", brand: "#8A2834", deep: "#4D141C", soft: "#F6E8EA", accent: "#D9A441" },
  { id: "teal", name: "Lagoon teal", brand: "#0F6C72", deep: "#0B3E42", soft: "#E1EFEF", accent: "#E9A23B" },
  { id: "graphite", name: "Graphite", brand: "#3A4250", deep: "#1D222B", soft: "#E9EBEF", accent: "#D6A13C" },
];

export type BrandConfig = {
  school: string;
  short: string;
  city: string;
  motto: string;
  mottoTranslation: string;
  presetId: string;
  product: string;
};

export const DEFAULT_BRAND: BrandConfig = {
  school: "Amaltas International School",
  short: "AIS",
  city: "Sector 57, Gurugram",
  motto: "तमसो मा ज्योतिर्गमय",
  mottoTranslation: "From darkness, lead us to light",
  presetId: "amaltas",
  product: "Kaksha",
};

export const BRAND_KEY = "kaksha.brand.v1";

export function presetById(id: string): BrandPreset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}

export function cssVarsFor(p: BrandPreset): Record<string, string> {
  return {
    "--brand": p.brand,
    "--brand-deep": p.deep,
    "--brand-soft": p.soft,
    "--accent": p.accent,
  };
}

/**
 * Inline script that applies a saved brand before first paint (no flash of the
 * default colours when a school has re-branded the demo).
 */
export const brandBootScript = `(function(){try{var b=JSON.parse(localStorage.getItem('${BRAND_KEY}')||'null');if(!b)return;var P=${JSON.stringify(
  Object.fromEntries(PRESETS.map((p) => [p.id, cssVarsFor(p)])),
)};var v=P[b.presetId];if(!v)return;var r=document.documentElement.style;for(var k in v)r.setProperty(k,v[k]);}catch(e){}})();`;
