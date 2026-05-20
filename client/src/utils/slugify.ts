/**
 * Converts a string to a URL-safe slug.
 * "Gran Vía 32, Madrid" → "gran-via-32-madrid"
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // strip accents
    .replace(/[^a-z0-9\s-]/g, '')       // keep alphanumeric + spaces + hyphens
    .trim()
    .replace(/\s+/g, '-')               // spaces → hyphens
    .replace(/-+/g, '-')                // collapse duplicate hyphens
    .slice(0, 60);                      // max length
}

/**
 * Builds the canonical Immosphere share URL for a property.
 * Result: https://host/property/UUID/slug-title
 */
export function propertyShareUrl(propertyId: string, title: string): string {
  const slug = slugify(title);
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return slug
    ? `${base}/property/${propertyId}/${slug}`
    : `${base}/property/${propertyId}`;
}
