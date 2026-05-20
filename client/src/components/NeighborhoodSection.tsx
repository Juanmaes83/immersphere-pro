import { useEffect, useState } from 'react';

// ── Haversine distance (meters) ───────────────────────────────────────────────
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toWalkLabel(meters: number): string {
  const mins = Math.max(1, Math.round((meters * 1.35) / 80));
  if (mins < 60) return `${mins} min a pie`;
  return `${Math.floor(mins / 60)}h ${mins % 60}min a pie`;
}

// ── Overpass query ────────────────────────────────────────────────────────────
interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

async function fetchPOIs(lat: number, lng: number): Promise<OverpassElement[]> {
  const query = `[out:json][timeout:15];
(
  node["station"="subway"](around:1200,${lat},${lng});
  node["railway"="subway_entrance"](around:1200,${lat},${lng});
  node["highway"="bus_stop"](around:400,${lat},${lng});
  node["amenity"="school"](around:1000,${lat},${lng});
  node["shop"="supermarket"](around:800,${lat},${lng});
  node["shop"="convenience"](around:400,${lat},${lng});
  node["amenity"="pharmacy"](around:600,${lat},${lng});
  node["leisure"="park"](around:800,${lat},${lng});
  way["leisure"="park"](around:800,${lat},${lng});
);
out center body;`;

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: controller.signal,
    });
    clearTimeout(tid);
    if (!res.ok) return [];
    const json: { elements: OverpassElement[] } = await res.json();
    return json.elements ?? [];
  } catch {
    clearTimeout(tid);
    return [];
  }
}

// ── Category classification ───────────────────────────────────────────────────
interface POI {
  id: number;
  name: string;
  category: string;
  emoji: string;
  lat: number;
  lng: number;
  dist: number;
}

const PRIORITY: Record<string, number> = {
  metro: 0, bus: 1, school: 2, supermarket: 3, pharmacy: 4, park: 5,
};

function classify(el: OverpassElement, homeLat: number, homeLng: number): POI | null {
  const tags = el.tags ?? {};
  const elLat = el.lat ?? el.center?.lat;
  const elLng = el.lon ?? el.center?.lon;
  if (!elLat || !elLng) return null;

  let category = '';
  let emoji = '';

  if (tags.station === 'subway' || tags.railway === 'subway_entrance') { category = 'metro'; emoji = '🚇'; }
  else if (tags.highway === 'bus_stop') { category = 'bus'; emoji = '🚌'; }
  else if (tags.amenity === 'school' || tags.amenity === 'kindergarten') { category = 'school'; emoji = '🏫'; }
  else if (tags.shop === 'supermarket') { category = 'supermarket'; emoji = '🛒'; }
  else if (tags.shop === 'convenience') { category = 'supermarket'; emoji = '🏪'; }
  else if (tags.amenity === 'pharmacy') { category = 'pharmacy'; emoji = '💊'; }
  else if (tags.leisure === 'park') { category = 'park'; emoji = '🌳'; }
  else return null;

  const name = tags.name || tags['name:es'] || tags.ref || '';
  if (!name) return null;

  return {
    id: el.id,
    name,
    category,
    emoji,
    lat: elLat,
    lng: elLng,
    dist: haversine(homeLat, homeLng, elLat, elLng),
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  lat: number;
  lng: number;
}

export default function NeighborhoodSection({ lat, lng }: Props): JSX.Element | null {
  const [pois, setPois] = useState<POI[]>([]);
  const [status, setStatus] = useState<'loading' | 'done' | 'empty' | 'error'>('loading');

  useEffect(() => {
    setStatus('loading');
    fetchPOIs(lat, lng).then(elements => {
      const classified: POI[] = [];
      const seen = new Set<string>();

      for (const el of elements) {
        const poi = classify(el, lat, lng);
        if (!poi) continue;
        // Deduplicate by name+category
        const key = `${poi.category}:${poi.name.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        classified.push(poi);
      }

      // Sort by category priority then distance
      classified.sort((a, b) => {
        const pA = PRIORITY[a.category] ?? 99;
        const pB = PRIORITY[b.category] ?? 99;
        if (pA !== pB) return pA - pB;
        return a.dist - b.dist;
      });

      // Keep top 2 per category
      const counts: Record<string, number> = {};
      const top = classified.filter(p => {
        counts[p.category] = (counts[p.category] ?? 0) + 1;
        return counts[p.category] <= 2;
      });

      if (top.length === 0) setStatus('empty');
      else { setPois(top); setStatus('done'); }
    }).catch(() => setStatus('error'));
  }, [lat, lng]);

  if (status === 'empty' || status === 'error') return null;

  return (
    <section className="mt-6">
      <h3 className="mb-4 text-sm font-black uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">
        El barrio
      </h3>

      {status === 'loading' ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {pois.map(poi => (
            <div
              key={poi.id}
              className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60"
            >
              <span className="text-xl leading-none">{poi.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{poi.name}</p>
                <p className="text-xs font-semibold text-slate-400">{toWalkLabel(poi.dist)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
