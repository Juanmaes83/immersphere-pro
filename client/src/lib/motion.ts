/**
 * Immersphere Motion System
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralised timing config + GSAP lazy-loader.
 *
 * RULE: Import ONLY from marketing pages (pricing, landing, onboarding, studio).
 *       Never import in dashboard / operational pages (dashboard, leads, CRUD).
 *       Violations penalise TTI on the app shell.
 *
 * Usage (in a React page):
 *
 *   const mainRef = useRef<HTMLElement>(null);
 *   useEffect(() => {
 *     let ctx: any;
 *     loadGSAP().then(({ gsap, ScrollTrigger, SplitText }) => {
 *       ctx = gsap.context(() => { ... }, mainRef);
 *     });
 *     return () => ctx?.revert();
 *   }, []);
 */

// ── Timing constants ─────────────────────────────────────────────────────────
// Parascope-quality feel: every number here was chosen intentionally.
// duration: 0.65 = feels immediate but not cheap.
// stagger:  0.08 = tight enough to feel like a wave, loose enough to be readable.
// ease:     power2.out = decelerates fast, lands clean. Default for reveals.

export const M = {
  // Durations (seconds)
  fast:      0.40,   // micro-interactions, hover states
  base:      0.65,   // standard reveals
  slow:      1.00,   // section entrances
  cinematic: 1.40,   // hero images, full-bleed reveals

  // Easing
  ease:      'power2.out',    // standard: fast start, clean land
  easeIn:    'power2.in',     // exits
  easeBack:  'back.out(1.4)', // cards with slight overshoot
  easeSine:  'sine.inOut',    // loops, ambient motion

  // Stagger (seconds between each element)
  staggerFast: 0.05,
  stagger:     0.08,
  staggerSlow: 0.14,

  // ScrollTrigger defaults
  scrollStart: 'top 85%',
} as const;

// ── Lazy GSAP loader ─────────────────────────────────────────────────────────
// Dynamic imports ensure GSAP (~30 kB gz) ships only with marketing page chunks.

export async function loadGSAP() {
  const { default: gsap } = await import('gsap');
  const { ScrollTrigger } = await import('gsap/ScrollTrigger');
  const { SplitText } = await import('gsap/SplitText');
  gsap.registerPlugin(ScrollTrigger, SplitText);
  return { gsap, ScrollTrigger, SplitText };
}
