import UpgradeButton from '@/components/billing/UpgradeButton';

interface PlanCardProps {
  plan: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  title: string;
  price: string;
  description: string;
  features: string[];
  currentPlan?: string;
  onPlanChanged?: () => void;
}

export default function PlanCard({
  plan,
  title,
  price,
  description,
  features,
  currentPlan,
  onPlanChanged
}: PlanCardProps): JSX.Element {
  const isCurrent = currentPlan?.toUpperCase() === plan;
  const isEnterprise = plan === 'ENTERPRISE';

  return (
    <article className={`rounded-[1.8rem] bg-white p-6 shadow-sm ring-1 ${isCurrent ? 'ring-violet-500' : 'ring-slate-200'}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-violet-700">{plan}</p>
          <h3 className="mt-2 text-2xl font-black text-slate-950">{title}</h3>
        </div>
        {isCurrent ? (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">Actual</span>
        ) : null}
      </div>

      <p className="mt-5 text-4xl font-black text-slate-950">{price}</p>
      <p className="mt-3 min-h-[48px] text-sm leading-6 text-slate-500">{description}</p>

      <ul className="mt-6 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex gap-3 text-sm font-semibold text-slate-700">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-50 text-xs text-violet-700">✓</span>
            {feature}
          </li>
        ))}
      </ul>

      <div className="mt-7">
        <UpgradeButton
          plan={plan}
          disabled={isCurrent}
          onInternalPlanChange={onPlanChanged}
          className={isEnterprise ? 'bg-slate-950 text-white hover:bg-violet-700' : 'bg-violet-700 text-white hover:bg-slate-950'}
        />
      </div>
    </article>
  );
}
