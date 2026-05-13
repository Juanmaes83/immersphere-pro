import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';

const DEFAULT_BRAND = '#7C3AED';

function darkenHex(hex: string, amount: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const clamp = (v: number): number => Math.max(0, Math.min(255, v));
  const [r, g, b] = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  return `#${[r, g, b].map((c) => clamp(c - amount).toString(16).padStart(2, '0')).join('')}`;
}

export interface BrandTokens {
  color: string;
  bgStyle: React.CSSProperties;
  colorStyle: React.CSSProperties;
  borderStyle: React.CSSProperties;
}

export function useBrand(): BrandTokens {
  const user = useAuthStore((state) => state.user);
  const color = user?.tenant.primaryColor ?? DEFAULT_BRAND;

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--brand', color);
    root.style.setProperty('--brand-dark', darkenHex(color, 28));
  }, [color]);

  return {
    color,
    bgStyle: { backgroundColor: 'var(--brand)' } as React.CSSProperties,
    colorStyle: { color: 'var(--brand)' } as React.CSSProperties,
    borderStyle: { borderColor: 'var(--brand)' } as React.CSSProperties,
  };
}
