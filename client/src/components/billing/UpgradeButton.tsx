import { useState } from 'react';
import { api, getApiErrorMessage, unwrapApiResponse } from '@/services/api';

interface CheckoutResponse {
  mode: 'internal' | 'stripe';
  plan: string;
  url: string | null;
}

interface UpgradeButtonProps {
  plan: string;
  disabled?: boolean;
  className?: string;
  onInternalPlanChange?: () => void;
}

export default function UpgradeButton({
  plan,
  disabled = false,
  className = '',
  onInternalPlanChange
}: UpgradeButtonProps): JSX.Element {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade(): Promise<void> {
    setIsLoading(true);
    setError(null);

    try {
      const checkout = await unwrapApiResponse<CheckoutResponse>(
        api.post('/subscriptions/create-checkout', { plan })
      );

      if (checkout.mode === 'internal') {
        onInternalPlanChange?.();
        setIsLoading(false);
        return;
      }

      if (!checkout.url) {
        throw new Error('Stripe no devolvió una URL de pago.');
      }

      window.location.href = checkout.url;
    } catch (error) {
      setError(getApiErrorMessage(error));
      setIsLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={disabled || isLoading}
        onClick={handleUpgrade}
        className={`w-full rounded-2xl px-5 py-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      >
        {isLoading ? 'Preparando Stripe...' : plan === 'STARTER' ? 'Cambiar a Starter' : `Upgrade a ${plan === 'PROFESSIONAL' ? 'Pro' : plan === 'ENTERPRISE' ? 'Agency' : plan}`}
      </button>
      {error ? <p className="mt-3 text-sm font-bold text-red-600">{error}</p> : null}
    </div>
  );
}
