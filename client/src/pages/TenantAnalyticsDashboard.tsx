import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, unwrapApiResponse } from '@/services/api';

interface TenantPropertyStat {
  propertyId: string;
  title: string;
  totalEvents: number;
  hotspotClicks: number;
  leadCtas: number;
  spaceChanges: number;
  viewerOpens: number;
  engagementScore: number;
}

interface TenantAnalyticsSummary {
  totalEvents: number;
  totalViewerOpens: number;
  totalHotspotClicks: number;
  totalLeadCtas: number;
  totalSpaceChanges: number;
  propertiesWithEvents: number;
  overallEngagementScore: number;
  topProperties: TenantPropertyStat[];
  recentLeads: Array<{
    propertyId: string;
    propertyTitle: string;
    createdAt: string;
    sessionId: string | null;
  }>;
}

function ScoreBar({ score, max }: { score: number; max: number }): JSX.Element {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  const color = score >= 70 ? 'bg-emerald-500' : score >= 35 ? 'bg-amber-500' : 'bg-slate-500';
  return (
    <div className="h-1.5 w-full rounded-full bg-white/10">
      <div className={`h-1.5 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function ScorePill({ score }: { score: number }): JSX.Element {
  const color = score >= 70
    ? 'bg-emerald-500/20 text-emerald-300'
    : score >= 35
      ? 'bg-amber-500/20 text-amber-300'
      : 'bg-slate-600/30 text-slate-400';
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-black ${color}`}>{score}</span>
  );
}

export default function TenantAnalyticsDashboard(): JSX.Element | null {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<TenantAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    unwrapApiResponse<TenantAnalyticsSummary>(api.get('/analytics/tenant/summary'))
      .then((data) => { setSummary(data); })
      .catch(() => {})
      .finally(() => { setLoading(false); });
  }, []);

  if (loading) {
    return (
      <section className="mt-8 rounded-[1.6rem] bg-slate-950 p-6 text-white">
        <p className="text-sm font-black uppercase tracking-[0.22em] text-cyan-300">Analytics global</p>
        <p className="mt-3 text-sm text-white/40">Cargando datos...</p>
      </section>
    );
  }

  if (!summary) return null;

  const maxScore = summary.topProperties[0]?.engagementScore ?? 1;

  return (
    <section className="mt-8 overflow-hidden rounded-[1.6rem] bg-slate-950 text-white">
      <div className="border-b border-white/10 px-6 py-5">
        <p className="text-sm font-black uppercase tracking-[0.22em] text-cyan-300">
          Analytics global del tenant
        </p>
        <p className="mt-1 text-xs text-white/40">
          Comportamiento agregado de todos los visores activos
        </p>
      </div>

      <div className="p-6">
        {/* Global KPIs */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-2xl bg-white/[0.07] p-4 lg:col-span-1">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/40">Score global</p>
            <p className="mt-1 text-3xl font-black"
               style={{ color: summary.overallEngagementScore >= 70 ? '#34d399' : summary.overallEngagementScore >= 35 ? '#fbbf24' : '#94a3b8' }}>
              {summary.overallEngagementScore}
            </p>
          </div>
          <div className="rounded-2xl bg-white/[0.07] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/40">Eventos</p>
            <p className="mt-1 text-3xl font-black">{summary.totalEvents}</p>
          </div>
          <div className="rounded-2xl bg-white/[0.07] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-400/70">Aperturas</p>
            <p className="mt-1 text-3xl font-black text-cyan-300">{summary.totalViewerOpens}</p>
          </div>
          <div className="rounded-2xl bg-white/[0.07] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-violet-400/70">Hotspots</p>
            <p className="mt-1 text-3xl font-black text-violet-300">{summary.totalHotspotClicks}</p>
          </div>
          <div className="rounded-2xl bg-white/[0.07] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-400/70">Lead CTAs</p>
            <p className="mt-1 text-3xl font-black text-emerald-300">{summary.totalLeadCtas}</p>
          </div>
          <div className="rounded-2xl bg-white/[0.07] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/40">Propiedades</p>
            <p className="mt-1 text-3xl font-black">{summary.propertiesWithEvents}</p>
          </div>
        </div>

        {/* Top properties ranking */}
        {summary.topProperties.length > 0 ? (
          <div className="mt-6">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-white/40">
              Propiedades por engagement
            </p>
            <div className="space-y-2">
              {summary.topProperties.map((prop, i) => (
                <button
                  key={prop.propertyId}
                  type="button"
                  onClick={() => navigate(`/property/${prop.propertyId}`)}
                  className="w-full rounded-2xl bg-white/[0.06] px-4 py-3 text-left transition hover:bg-white/10"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-5 shrink-0 text-center text-xs font-black text-white/30">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-black">{prop.title}</span>
                        <div className="flex shrink-0 items-center gap-3 text-xs text-white/45">
                          <span title="Hotspot clicks">⬡ {prop.hotspotClicks}</span>
                          <span title="Lead CTAs" className="text-emerald-400">✓ {prop.leadCtas}</span>
                          <span title="Aperturas">◎ {prop.viewerOpens}</span>
                          <ScorePill score={prop.engagementScore} />
                        </div>
                      </div>
                      <ScoreBar score={prop.engagementScore} max={maxScore} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-6 text-sm text-white/35">
            Sin datos todavía. Abre el visor de cualquier propiedad para comenzar a acumular analytics.
          </p>
        )}

        {/* Recent lead CTAs */}
        {summary.recentLeads.length > 0 ? (
          <div className="mt-6">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-white/40">
              Últimas intenciones de contacto (Lead CTAs)
            </p>
            <div className="space-y-1.5">
              {summary.recentLeads.map((lead, i) => (
                <div
                  key={`${lead.propertyId}-${i}`}
                  className="flex items-center justify-between rounded-xl bg-emerald-500/10 px-4 py-2.5 text-sm"
                >
                  <span className="font-black text-emerald-300">Lead CTA</span>
                  <span className="mx-3 flex-1 truncate text-white/60">{lead.propertyTitle}</span>
                  <span className="shrink-0 text-xs text-white/30">
                    {new Date(lead.createdAt).toLocaleDateString('es-ES', {
                      day: '2-digit', month: '2-digit'
                    })}
                    {' '}
                    {new Date(lead.createdAt).toLocaleTimeString('es-ES', {
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
