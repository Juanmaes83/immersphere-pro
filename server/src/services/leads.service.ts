import { Resend } from 'resend';
import { prisma } from '../index.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';

export interface CreateLeadInput {
  propertyId: string;
  email: string;
  phone?: string;
  notes?: string;
  source?: string;
  propertySlug?: string;
  spaceId?: string;
  spaceName?: string;
  assetId?: string;
  hotspotId?: string;
  hotspotLabel?: string;
  actionType?: string;
  ctaLabel?: string;
  sessionId?: string;
  origin?: string;
  referrer?: string;
  guidedStepId?: string;
  guidedStepTitle?: string;
}

export const LEAD_STATUSES = [
  'nuevo',
  'contactado',
  'visita',
  'negociando',
  'cerrado',
  'descartado'
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export interface LeadRecord {
  id: string;
  propertyId: string;
  email: string;
  phone: string;
  notes: string;
  source: string;
  status: string;
  internalNote: string;
  nextActionAt: Date | null;
  nextActionText: string;
  propertySlug: string;
  spaceId: string;
  spaceName: string;
  assetId: string;
  hotspotId: string;
  hotspotLabel: string;
  actionType: string;
  ctaLabel: string;
  sessionId: string;
  origin: string;
  referrer: string;
  guidedStepId: string;
  guidedStepTitle: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateLeadInput {
  status?: string;
  internalNote?: string;
  nextActionAt?: string | null; // ISO string or null from request body
  nextActionText?: string;
}

export async function createLead(input: CreateLeadInput): Promise<LeadRecord> {
  const lead = await prisma.lead.create({
    data: {
      propertyId: input.propertyId,
      email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim() ?? '',
      notes: input.notes?.trim() ?? '',
      source: input.source ?? 'viewer',
      propertySlug: input.propertySlug?.trim() ?? '',
      spaceId: input.spaceId?.trim() ?? '',
      spaceName: input.spaceName?.trim() ?? '',
      assetId: input.assetId?.trim() ?? '',
      hotspotId: input.hotspotId?.trim() ?? '',
      hotspotLabel: input.hotspotLabel?.trim() ?? '',
      actionType: input.actionType?.trim() ?? '',
      ctaLabel: input.ctaLabel?.trim() ?? '',
      sessionId: input.sessionId?.trim() ?? '',
      origin: input.origin?.trim() ?? '',
      referrer: input.referrer?.trim() ?? '',
      guidedStepId: input.guidedStepId?.trim() ?? '',
      guidedStepTitle: input.guidedStepTitle?.trim() ?? ''
    }
  });

  fireLeadWebhook(lead).catch((err) => {
    console.error('[leads] Webhook delivery failed:', err instanceof Error ? err.message : err);
  });
  sendLeadEmail(lead).catch((err) => {
    console.error('[leads] Resend email failed:', err instanceof Error ? err.message : err);
  });

  return lead;
}

export async function getPropertyLeads(
  propertyId: string,
  tenantId: string
): Promise<LeadRecord[]> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { tenantId: true }
  });

  if (!property) {
    throw new AppError(404, 'Propiedad no encontrada.');
  }

  if (property.tenantId !== tenantId) {
    throw new AppError(403, 'No tienes acceso a los leads de esta propiedad.');
  }

  return prisma.lead.findMany({
    where: { propertyId },
    orderBy: { createdAt: 'desc' },
    take: 100
  });
}

export async function updateLead(
  leadId: string,
  tenantId: string,
  input: UpdateLeadInput
): Promise<LeadRecord> {
  // Verify the lead belongs to this tenant before mutating
  const existing = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { property: { select: { tenantId: true } } }
  });

  if (!existing) {
    throw new AppError(404, 'Lead no encontrado.');
  }

  if (existing.property.tenantId !== tenantId) {
    throw new AppError(403, 'No tienes acceso a este lead.');
  }

  if (input.status !== undefined && !LEAD_STATUSES.includes(input.status as LeadStatus)) {
    throw new AppError(400, `Estado inválido: ${input.status}. Valores permitidos: ${LEAD_STATUSES.join(', ')}.`);
  }

  const data: Record<string, unknown> = {};
  if (input.status !== undefined)       data.status         = input.status;
  if (input.internalNote !== undefined) data.internalNote   = input.internalNote.trim();
  if ('nextActionAt' in input)          data.nextActionAt   = input.nextActionAt ? new Date(input.nextActionAt) : null;
  if (input.nextActionText !== undefined) data.nextActionText = input.nextActionText.trim();

  return prisma.lead.update({
    where: { id: leadId },
    data
  });
}

function csvEscape(value: string): string {
  const s = String(value ?? '');
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export async function exportPropertyLeadsCsv(
  propertyId: string,
  tenantId: string
): Promise<string> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { tenantId: true, title: true }
  });

  if (!property) {
    throw new AppError(404, 'Propiedad no encontrada.');
  }

  if (property.tenantId !== tenantId) {
    throw new AppError(403, 'No tienes acceso a los leads de esta propiedad.');
  }

  const leads = await prisma.lead.findMany({
    where: { propertyId },
    orderBy: { createdAt: 'desc' }
  });

  const header = ['id', 'email', 'phone', 'notes', 'source', 'status', 'internalNote', 'nextActionAt', 'nextActionText', 'spaceId', 'spaceName', 'assetId', 'hotspotId', 'hotspotLabel', 'actionType', 'ctaLabel', 'sessionId', 'origin', 'referrer', 'guidedStepId', 'guidedStepTitle', 'createdAt', 'updatedAt'].map(csvEscape).join(',');

  const rows = leads.map((l) =>
    [
      l.id,
      l.email,
      l.phone,
      l.notes,
      l.source,
      l.status,
      l.internalNote,
      l.nextActionAt ? l.nextActionAt.toISOString() : '',
      l.nextActionText,
      l.spaceId,
      l.spaceName,
      l.assetId,
      l.hotspotId,
      l.hotspotLabel,
      l.actionType,
      l.ctaLabel,
      l.sessionId,
      l.origin,
      l.referrer,
      l.guidedStepId,
      l.guidedStepTitle,
      l.createdAt.toISOString(),
      l.updatedAt.toISOString()
    ]
      .map(csvEscape)
      .join(',')
  );

  return [header, ...rows].join('\r\n');
}

export interface AllLeadsFilters {
  propertyId?: string;
  from?: string;
  to?: string;
}

export interface LeadWithProperty extends LeadRecord {
  propertyTitle: string;
}

export async function getTenantLeadsCount(tenantId: string): Promise<number> {
  return prisma.lead.count({ where: { property: { tenantId } } });
}

export async function getAllTenantLeads(
  tenantId: string,
  filters: AllLeadsFilters = {}
): Promise<LeadWithProperty[]> {
  const where: Record<string, unknown> = {
    property: { tenantId }
  };

  if (filters.propertyId) {
    where.propertyId = filters.propertyId;
  }

  if (filters.from || filters.to) {
    const range: Record<string, Date> = {};
    if (filters.from) range.gte = new Date(filters.from);
    if (filters.to) range.lte = new Date(filters.to);
    where.createdAt = range;
  }

  const leads = await prisma.lead.findMany({
    where: where as any,
    orderBy: { createdAt: 'desc' },
    take: 500,
    include: {
      property: { select: { title: true } }
    }
  });

  return leads.map((l) => ({
    id: l.id,
    propertyId: l.propertyId,
    propertyTitle: l.property?.title ?? '',
    email: l.email,
    phone: l.phone,
    notes: l.notes,
    source: l.source,
    status: l.status,
    internalNote: l.internalNote,
    nextActionAt: l.nextActionAt,
    nextActionText: l.nextActionText,
    propertySlug: l.propertySlug,
    spaceId: l.spaceId,
    spaceName: l.spaceName,
    assetId: l.assetId,
    hotspotId: l.hotspotId,
    hotspotLabel: l.hotspotLabel,
    actionType: l.actionType,
    ctaLabel: l.ctaLabel,
    sessionId: l.sessionId,
    origin: l.origin,
    referrer: l.referrer,
    guidedStepId: l.guidedStepId,
    guidedStepTitle: l.guidedStepTitle,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt
  }));
}

export async function exportAllTenantLeadsCsv(
  tenantId: string,
  filters: AllLeadsFilters = {}
): Promise<string> {
  const leads = await getAllTenantLeads(tenantId, filters);

  const header = ['id', 'propertyTitle', 'email', 'phone', 'notes', 'source', 'status', 'internalNote', 'nextActionAt', 'nextActionText', 'spaceId', 'spaceName', 'assetId', 'hotspotId', 'hotspotLabel', 'actionType', 'ctaLabel', 'sessionId', 'origin', 'referrer', 'guidedStepId', 'guidedStepTitle', 'createdAt', 'updatedAt'].map(csvEscape).join(',');
  const rows = leads.map((l) =>
    [
      l.id,
      l.propertyTitle,
      l.email,
      l.phone,
      l.notes,
      l.source,
      l.status,
      l.internalNote,
      l.nextActionAt ? new Date(l.nextActionAt).toISOString() : '',
      l.nextActionText,
      l.spaceId,
      l.spaceName,
      l.assetId,
      l.hotspotId,
      l.hotspotLabel,
      l.actionType,
      l.ctaLabel,
      l.sessionId,
      l.origin,
      l.referrer,
      l.guidedStepId,
      l.guidedStepTitle,
      new Date(l.createdAt).toISOString(),
      new Date(l.updatedAt).toISOString()
    ]
      .map(csvEscape)
      .join(',')
  );
  return [header, ...rows].join('\r\n');
}

async function sendLeadEmail(lead: LeadRecord): Promise<void> {
  if (!env.RESEND_API_KEY) return;

  const property = await prisma.property.findUnique({
    where: { id: lead.propertyId },
    select: { title: true, tenantId: true }
  });
  if (!property) return;

  const agentUser = await prisma.user.findFirst({
    where: { tenantId: property.tenantId },
    select: { email: true, name: true },
    orderBy: { createdAt: 'asc' }
  });
  if (!agentUser) return;

  const appUrl = env.APP_URL.replace(/\/$/, '');
  const propertyUrl = `${appUrl}/property/${lead.propertyId}`;
  const date = new Date(lead.createdAt).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
    <div style="background:#0f172a;padding:28px 32px">
      <p style="margin:0;color:#7c3aed;font-size:11px;font-weight:900;letter-spacing:0.2em;text-transform:uppercase">Nuevo lead capturado</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:900">${property.title}</h1>
    </div>
    <div style="padding:28px 32px">
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#94a3b8;font-weight:700;width:110px">Email</td>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;font-weight:900;color:#0f172a">${lead.email}</td>
        </tr>
        ${lead.phone ? `<tr>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#94a3b8;font-weight:700">Teléfono</td>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;font-weight:900;color:#0f172a">${lead.phone}</td>
        </tr>` : ''}
        ${lead.notes ? `<tr>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#94a3b8;font-weight:700">Notas</td>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#334155">${lead.notes}</td>
        </tr>` : ''}
        <tr>
          <td style="padding:10px 0;font-size:13px;color:#94a3b8;font-weight:700">Fecha</td>
          <td style="padding:10px 0;font-size:13px;color:#64748b">${date}</td>
        </tr>
      </table>
      <a href="${propertyUrl}" style="display:inline-block;margin-top:24px;background:#7c3aed;color:#fff;font-size:13px;font-weight:900;text-decoration:none;padding:12px 24px;border-radius:999px">
        Ver propiedad →
      </a>
    </div>
    <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #f1f5f9">
      <p style="margin:0;font-size:11px;color:#94a3b8">Immersphere Pro · immersphere.io</p>
    </div>
  </div>
</body>
</html>`;

  const resend = new Resend(env.RESEND_API_KEY);
  await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: agentUser.email,
    subject: `Nuevo lead: ${property.title}`,
    html
  });
}

/**
 * Basic SSRF protection for outbound webhook URLs.
 * Blocks private/loopback ranges (RFC1918, RFC5735) and non-HTTPS schemes.
 * Returns true if the URL is safe to fetch, false otherwise.
 */
function isSafeWebhookUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false; // unparseable URL
  }

  // Only HTTPS is allowed — no http, ftp, file, data, etc.
  if (parsed.protocol !== 'https:') return false;

  const host = parsed.hostname.toLowerCase();

  // Block loopback and unspecified
  if (host === 'localhost' || host === '0.0.0.0') return false;

  // Block IPv6 loopback / link-local
  if (host === '::1' || host.startsWith('fe80:')) return false;

  // Block private IPv4 ranges (RFC1918 + RFC5735 + CGNAT)
  const ipv4 = host.match(
    /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
  );
  if (ipv4) {
    const [, a, b] = ipv4.map(Number);
    if (
      a === 10 ||                        // 10.0.0.0/8
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
      (a === 192 && b === 168) ||        // 192.168.0.0/16
      (a === 127) ||                     // 127.0.0.0/8  loopback
      (a === 169 && b === 254) ||        // 169.254.0.0/16 link-local
      (a === 100 && b >= 64 && b <= 127) // 100.64.0.0/10 CGNAT
    ) return false;
  }

  // Block metadata services by hostname
  const blockedHosts = [
    'metadata.google.internal',
    '169.254.169.254', // AWS/GCP/Azure metadata
  ];
  if (blockedHosts.includes(host)) return false;

  return true;
}

async function fireLeadWebhook(lead: LeadRecord): Promise<void> {
  const property = await prisma.property.findUnique({
    where: { id: lead.propertyId },
    select: {
      title: true,
      tenantId: true,
      tenant: { select: { webhookUrl: true } }
    }
  });

  const webhookUrl =
    (property?.tenant?.webhookUrl ?? '').trim() ||
    (env.LEAD_NOTIFICATION_WEBHOOK_URL ?? '').trim();

  if (!webhookUrl) return;

  if (!isSafeWebhookUrl(webhookUrl)) {
    try {
      const { protocol, hostname } = new URL(webhookUrl);
      console.warn('[leads] Webhook URL blocked by SSRF guard:', { protocol, hostname });
    } catch {
      console.warn('[leads] Webhook URL blocked by SSRF guard');
    }
    return;
  }

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'lead.created',
      leadId: lead.id,
      email: lead.email,
      phone: lead.phone,
      notes: lead.notes,
      propertyId: lead.propertyId,
      propertyTitle: property?.title ?? '',
      tenantId: property?.tenantId ?? '',
      spaceId: lead.spaceId,
      spaceName: lead.spaceName,
      assetId: lead.assetId,
      hotspotId: lead.hotspotId,
      hotspotLabel: lead.hotspotLabel,
      actionType: lead.actionType,
      ctaLabel: lead.ctaLabel,
      sessionId: lead.sessionId,
      origin: lead.origin,
      referrer: lead.referrer,
      guidedStepId: lead.guidedStepId,
      guidedStepTitle: lead.guidedStepTitle,
      createdAt: lead.createdAt.toISOString()
    }),
    signal: AbortSignal.timeout(8000)
  });
}
