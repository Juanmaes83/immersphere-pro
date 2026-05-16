import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { api } from '@/services/api';
import type { PublicTenantProfile } from '@/types/gallery';
import { formatCurrency } from '@/utils/format';

export default function AgencyPage(): JSX.Element {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PublicTenantProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    api.get(`/tenants/public/${slug}`)
      .then((res) => {
        const data = (res.data as { success: boolean; data: PublicTenantProfile }).data;
        setProfile(data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-20 text-center">
        <p className="font-bold text-slate-500">Cargando perfil de agencia...</p>
      </main>
    );
  }

  if (notFound || !profile) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-20 text-center">
        <h1 className="text-4xl font-black">Agencia no encontrada</h1>
        <button type="button" onClick={() => navigate('/gallery')} className="mt-8 rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white">
          Ver galería
        </button>
      </main>
    );
  }

  const primaryColor = profile.primaryColor || '#7C3AED';

  return (
    <main className="mx-auto max-w-7xl px-5 py-10">
      <Helmet>
        <title>{profile.name} · Propiedades en Immersphere Pro</title>
        <meta name="description" content={`Explora las propiedades publicadas por ${profile.name} con tours virtuales inmersivos.`} />
      </Helmet>

      <section className="overflow-hidden rounded-[2rem] bg-slate-950 p-8 text-white md:p-12">
        <div className="flex items-center gap-5">
          {profile.logoUrl ? (
            <img src={profile.logoUrl} alt={profile.name} className="h-20 w-20 rounded-2xl object-cover" />
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-2xl text-2xl font-black text-white" style={{ backgroundColor: primaryColor }}>
              {profile.logoText || profile.name.slice(0, 2).toUpperCase()}
            </span>
          )}
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em]" style={{ color: primaryColor }}>Agencia</p>
            <h1 className="mt-1 text-4xl font-black tracking-tight">{profile.name}</h1>
            <p className="mt-1 text-sm text-white/50">{profile.properties.length} {profile.properties.length === 1 ? 'propiedad publicada' : 'propiedades publicadas'}</p>
          </div>
        </div>
      </section>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {profile.properties.map((property) => (
          <article key={property.id} className="overflow-hidden rounded-[1.7rem] bg-white shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-xl">
            <button type="button" onClick={() => navigate(`/property/${property.id}`)} className="block w-full text-left">
              <div className="relative aspect-[4/3] bg-gradient-to-br from-cyan-400/35 via-violet-500/20 to-slate-950">
                {property.coverImage ? <img src={property.coverImage} alt={property.title} className="h-full w-full object-cover" /> : null}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <h3 className="text-xl font-black leading-tight">{property.title}</h3>
                  <p className="mt-1 text-sm font-semibold text-white/75">{property.area} m² · {property.rooms} hab.</p>
                </div>
              </div>
            </button>
            <div className="p-5">
              <p className="text-xl font-black text-slate-950">{formatCurrency(property.price)}</p>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{property.description}</p>
              {property.address ? <p className="mt-2 text-xs font-semibold text-slate-400">📍 {property.address}</p> : null}
              <button type="button" onClick={() => navigate(`/property/${property.id}`)} className="mt-4 w-full rounded-2xl px-4 py-3 text-sm font-black text-white transition hover:opacity-90" style={{ backgroundColor: primaryColor }}>
                Ver tour inmersivo
              </button>
            </div>
          </article>
        ))}
      </div>

      {profile.properties.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-slate-500">Esta agencia no tiene propiedades publicadas todavía.</p>
        </div>
      ) : null}
    </main>
  );
}
