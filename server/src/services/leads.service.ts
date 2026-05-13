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
}

export interface LeadRecord {
  id: string;
  propertyId: string;
  email: string;
  phone: string;
  notes: string;
  source: string;
  createdAt: Date;
}

export async function createLead(input: CreateLeadInput): Promise<LeadRecord> {
  const lead = await prisma.lead.create({
    data: {
      propertyId: input.propertyId,
      email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim() ?? '',
      notes: input.notes?.trim() ?? '',
      source: input.source ?? 'viewer'
    }
  });

  fireLeadWebhook(lead).catch(() => {});
  sendLeadEmail(lead).catch(() => {});

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

  const header = ['id', 'email', 'phone', 'notes', 'source', 'createdAt'].map(csvEscape).join(',');

  const rows = leads.map((l) =>
    [
      l.id,
      l.email,
      l.phone,
      l.notes,
      l.source,
      l.createdAt.toISOString()
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
      createdAt: lead.createdAt.toISOString()
    }),
    signal: AbortSignal.timeout(8000)
  });
}
