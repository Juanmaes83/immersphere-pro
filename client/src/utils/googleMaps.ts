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
