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
  return new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const geocoder = new (window as any).google.maps.Geocoder();
    geocoder.geocode(
      { address },
      (results: Array<{ geometry: { location: { lat(): number; lng(): number } } }>, status: string) => {
        if (status === 'OK' && results?.length) {
          resolve({ lat: results[0].geometry.location.lat(), lng: results[0].geometry.location.lng() });
        } else {
          resolve(null);
        }
      }
    );
  });
}
