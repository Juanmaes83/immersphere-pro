// ── Geocode an address string → { lat, lng } using Nominatim (OpenStreetMap) ──
// Free, no API key required. Rate limit: 1 req/s (fine for user-triggered geocoding).
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(address)}&format=json&limit=1&accept-language=es`;

    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Nominatim policy: identify your app in User-Agent
        'User-Agent': 'ImmerspherePro/1.0 (juanmaes83@gmail.com)',
      },
    });
    clearTimeout(tid);

    if (!response.ok) return null;

    const data: Array<{ lat: string; lon: string }> = await response.json();
    if (data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
    }
    return null;
  } catch {
    return null;
  }
}

// ── Address autocomplete using Photon (Komoot/OpenStreetMap) ─────────────────
export interface AddressSuggestion {
  label: string;
  lat: number;
  lng: number;
}

export async function searchAddressSuggestions(query: string): Promise<AddressSuggestion[]> {
  if (query.length < 3) return [];
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lang=es`;
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(tid);
    if (!response.ok) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: { features?: any[] } = await response.json();
    return (data.features ?? []).map((f: any) => {
      const p = f.properties ?? {};
      const parts = [
        p.name,
        p.housenumber ? `${p.street ?? ''} ${p.housenumber}`.trim() : p.street,
        p.city ?? p.county,
        p.country,
      ].filter(Boolean);
      return {
        label: parts.join(', '),
        lat: f.geometry.coordinates[1] as number,
        lng: f.geometry.coordinates[0] as number,
      };
    });
  } catch {
    return [];
  }
}
