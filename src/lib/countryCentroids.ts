// ISO 3166-1 alpha-2 country code → approximate representative lat/lon, for
// placing a user's avatar on the globe. Intentionally coarse (country-level,
// not precise geolocation) — matches the product requirement that exact
// location is never needed or collected.
//
// Coverage: common countries reachable from this app's existing LANGUAGES
// list (src/lib/types.ts) plus other populous/common countries. Not
// exhaustive — `countryCentroid()` returns null for anything missing, and
// callers must handle that (e.g. by omitting the marker) rather than
// guessing a fallback location.

export const COUNTRY_CENTROIDS: Record<string, { lat: number; lon: number }> = {
  US: { lat: 38,  lon: -97  },
  CA: { lat: 56,  lon: -106 },
  MX: { lat: 23,  lon: -102 },
  BR: { lat: -15, lon: -48  },
  AR: { lat: -38, lon: -64  },
  CL: { lat: -35, lon: -71  },
  CO: { lat: 4,   lon: -72  },
  PE: { lat: -10, lon: -76  },
  GB: { lat: 54,  lon: -2   },
  IE: { lat: 53,  lon: -8   },
  FR: { lat: 47,  lon: 3    },
  DE: { lat: 51,  lon: 10   },
  ES: { lat: 40,  lon: -4   },
  PT: { lat: 39,  lon: -8   },
  IT: { lat: 43,  lon: 12   },
  NL: { lat: 52,  lon: 5    },
  BE: { lat: 51,  lon: 4    },
  CH: { lat: 47,  lon: 8    },
  AT: { lat: 47,  lon: 14   },
  SE: { lat: 60,  lon: 15   },
  NO: { lat: 61,  lon: 9    },
  DK: { lat: 56,  lon: 10   },
  FI: { lat: 64,  lon: 26   },
  PL: { lat: 52,  lon: 19   },
  RU: { lat: 62,  lon: 94   },
  TR: { lat: 39,  lon: 35   },
  GR: { lat: 39,  lon: 22   },
  UA: { lat: 49,  lon: 32   },
  SA: { lat: 24,  lon: 45   },
  AE: { lat: 24,  lon: 54   },
  EG: { lat: 27,  lon: 30   },
  IL: { lat: 31,  lon: 35   },
  IN: { lat: 22,  lon: 79   },
  PK: { lat: 30,  lon: 70   },
  BD: { lat: 24,  lon: 90   },
  CN: { lat: 35,  lon: 105  },
  JP: { lat: 36,  lon: 138  },
  KR: { lat: 37,  lon: 127  },
  TW: { lat: 24,  lon: 121  },
  HK: { lat: 22,  lon: 114  },
  VN: { lat: 16,  lon: 108  },
  TH: { lat: 15,  lon: 101  },
  ID: { lat: -2,  lon: 118  },
  MY: { lat: 4,   lon: 102  },
  SG: { lat: 1,   lon: 104  },
  PH: { lat: 13,  lon: 122  },
  NG: { lat: 9,   lon: 8    },
  KE: { lat: 1,   lon: 38   },
  ZA: { lat: -29, lon: 24   },
  AU: { lat: -25, lon: 134  },
  NZ: { lat: -41, lon: 174  },
};

export function countryCentroid(countryCode: string | null | undefined): { lat: number; lon: number } | null {
  if (!countryCode) return null;
  return COUNTRY_CENTROIDS[countryCode.toUpperCase()] ?? null;
}
