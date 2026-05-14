/** @jsxImportSource react */
/**
 * Vercel Edge Function — Dynamic OG image generator.
 *
 * Route: GET /api/og?title=<property-title>
 *
 * Returns a 1200×630 PNG with Immersphere Pro branding and the property
 * title. Used as og:image fallback when a property has no coverImage.
 *
 * Deployed automatically by Vercel as an Edge Function (no Next.js needed).
 * API functions take priority over the catch-all rewrite in vercel.json.
 */

import { ImageResponse } from '@vercel/og';

export const config = {
  runtime: 'edge',
};

export default function handler(req: Request): ImageResponse {
  const { searchParams } = new URL(req.url);
  const rawTitle = searchParams.get('title') ?? 'Tour Virtual';
  // Truncate to avoid overflow; font size adjusts for longer titles
  const title = rawTitle.slice(0, 65);
  const fontSize = title.length > 40 ? '44px' : title.length > 25 ? '52px' : '62px';

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          background: 'linear-gradient(140deg, #0f172a 0%, #1e1b4b 60%, #0f172a 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'flex-end',
          padding: '64px 72px',
          position: 'relative',
        }}
      >
        {/* Decorative accent bar */}
        <div
          style={{
            position: 'absolute',
            top: '0px',
            left: '0px',
            width: '6px',
            height: '100%',
            background: '#7c3aed',
          }}
        />

        {/* Brand label */}
        <div
          style={{
            color: '#7c3aed',
            fontSize: '13px',
            fontWeight: '900',
            letterSpacing: '0.35em',
            textTransform: 'uppercase',
            marginBottom: '20px',
          }}
        >
          IMMERSPHERE PRO
        </div>

        {/* Property title */}
        <div
          style={{
            color: '#ffffff',
            fontSize,
            fontWeight: '900',
            lineHeight: 1.1,
            maxWidth: '980px',
          }}
        >
          {title}
        </div>

        {/* Tagline */}
        <div
          style={{
            color: '#94a3b8',
            fontSize: '20px',
            marginTop: '24px',
            letterSpacing: '0.02em',
          }}
        >
          Tour virtual inmersivo · immersphere.io
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
