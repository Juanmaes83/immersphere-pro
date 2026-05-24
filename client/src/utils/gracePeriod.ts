// ─────────────────────────────────────────────────────────────────────────────
// gracePeriod.ts
// Calcula el nivel de acceso de un tenant según el estado de su suscripción.
//
// Niveles:
//   full     → acceso completo (TRIAL, ACTIVE, PAST_DUE, o CANCELED días 0-7)
//   readonly → viewer funciona, lead capture desactivado (CANCELED días 8-15)
//   blocked  → pantalla de bloqueo en viewer/embed (CANCELED día 16+)
// ─────────────────────────────────────────────────────────────────────────────

export type AccessLevel = 'full' | 'readonly' | 'blocked';

const FULL_STATUSES = new Set(['TRIAL', 'ACTIVE', 'PAST_DUE']);

export function getAccessLevel(status?: string, updatedAt?: string): AccessLevel {
  if (!status || FULL_STATUSES.has(status)) return 'full';
  if (status !== 'CANCELED') return 'full'; // EXPIRED u otros → conservador: full
  if (!updatedAt) return 'blocked';

  const daysSince = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince <= 7) return 'full';
  if (daysSince <= 15) return 'readonly';
  return 'blocked';
}

/** Días restantes hasta el siguiente nivel de restricción, o 0 si ya está bloqueado. */
export function getDaysUntilNextRestriction(updatedAt?: string): number {
  if (!updatedAt) return 0;
  const daysSince = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince <= 7) return Math.ceil(7 - daysSince);
  if (daysSince <= 15) return Math.ceil(15 - daysSince);
  return 0;
}

/** Días totales desde la cancelación. */
export function getDaysSinceCancellation(updatedAt?: string): number {
  if (!updatedAt) return 0;
  return Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24));
}
