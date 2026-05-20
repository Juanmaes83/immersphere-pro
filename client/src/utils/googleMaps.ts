// ── Singleton Google Maps JS script loader ────────────────────────────────────
let _state: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
const _callbacks: Array<(ok: boolean) => void> = [];

export function loadGoogleMapsScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (_state === 'ready') { resolve(true); return; }
    if (_state === 'error') { resolve(false); return; }
    _callbacks.push(resolve);
    if (_state === 'loading') return;
    _state = 'loading';
    const apiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? '';
    if (!apiKey) { _state = 'error'; _callbacks.splice(0).forEach(cb => cb(false)); return; }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;
    script.onload  = () => { _state = 'ready'; _callbacks.splice(0).forEach(cb => cb(true)); };
    script.onerror = () => { _state = 'error';  _callbacks.splice(0).forEach(cb => cb(false)); };
    document.head.appendChild(script);
  });
}

// ── Geocode an address string → { lat, lng } using google.maps.Geocoder ──────
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const ok = await loadGoogleMapsScript();
  if (!ok) return null;
  try {
    // Modern Maps JS SDK returns a Promise from geocode() — do NOT use callback form
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const G = (window as any).google;
    const geocoder = new G.maps.Geocoder() as {
      geocode(req: { address: string }): Promise<{
        results: Array<{ geometry: { location: { lat(): number; lng(): number } } }>;
      }>;
    };
    const response = await geocoder.geocode({ address });
    if (response.results?.length) {
      return {
        lat: response.results[0].geometry.location.lat(),
        lng: response.results[0].geometry.location.lng()
      };
    }
    return null;
  } catch {
    return null;
  }
}
