/**
 * Lead Reminder Service
 *
 * Sends a summary email to each tenant that has unanswered leads.
 *
 * Criterion (no schema migration needed):
 *   status = 'nuevo' AND createdAt < 48 h ago
 *
 * Rationale: once an agent updates a lead status to 'contactado', 'visita', etc.
 * the lead is excluded from future reminders automatically. No extra field needed.
 *
 * Execution: manual only (protected SUPERADMIN endpoint). No cron configured yet.
 * If Resend fails for one tenant, the others are still processed — partial success
 * is captured in the returned { sent, errors } summary.
 */
import { Resend } from 'resend';
import { prisma } from '../index.js';
import { env } from '../config/env.js';

export interface ReminderResult {
  sent: number;
  errors: number;
}

interface PropertySummary {
  propertyId: string;
  propertyTitle: string;
  leadCount: number;
}

interface TenantSummary {
  tenantId: string;
  tenantName: string;
  properties: PropertySummary[];
  totalLeads: number;
}

export async function sendUnansweredLeadReminders(): Promise<ReminderResult> {
  // Guard: skip silently if Resend is not configured
  if (!env.RESEND_API_KEY) {
    console.warn('[lead-reminder] RESEND_API_KEY not configured — skipping');
    return { sent: 0, errors: 0 };
  }

  // Leads older than 48 h that are still in 'nuevo' status
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const leads = await prisma.lead.findMany({
    where: {
      status: 'nuevo',
      createdAt: { lt: cutoff }
    },
    include: {
      property: {
        select: {
          id: true,
          title: true,
          tenantId: true,
          tenant: { select: { name: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (leads.length === 0) {
    console.log('[lead-reminder] No unanswered leads found — nothing to send');
    return { sent: 0, errors: 0 };
  }

  // Group leads by tenant, then by property within each tenant
  const byTenant = new Map<string, TenantSummary>();

  for (const lead of leads) {
    const { tenantId, title: propertyTitle, id: propertyId, tenant } = lead.property;
    const tenantName = tenant?.name ?? 'Agencia';

    if (!byTenant.has(tenantId)) {
      byTenant.set(tenantId, {
        tenantId,
        tenantName,
        properties: [],
        totalLeads: 0
      });
    }

    const entry = byTenant.get(tenantId)!;
    const prop = entry.properties.find((p) => p.propertyId === propertyId);

    if (prop) {
      prop.leadCount++;
    } else {
      entry.properties.push({ propertyId, propertyTitle, leadCount: 1 });
    }

    entry.totalLeads++;
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const appUrl = env.APP_URL.replace(/\/$/, '');
  const leadsUrl = `${appUrl}/leads`;

  let sent = 0;
  let errors = 0;

  for (const summary of byTenant.values()) {
    try {
      // Get the oldest (primary) user for this tenant — same pattern as leads.service.ts
      const adminUser = await prisma.user.findFirst({
        where: { tenantId: summary.tenantId },
        select: { email: true, name: true },
        orderBy: { createdAt: 'asc' }
      });

      if (!adminUser?.email) {
        console.warn(`[lead-reminder] No user found for tenant ${summary.tenantId} — skipping`);
        continue;
      }

      const subject =
        `🔔 Tienes ${summary.totalLeads} lead${summary.totalLeads !== 1 ? 's' : ''} sin responder en Immersphere Pro`;

      const html = buildReminderHtml(summary, leadsUrl);

      await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: adminUser.email,
        subject,
        html
      });

      sent++;
      console.log(
        `[lead-reminder] Sent to ${adminUser.email} — ${summary.totalLeads} leads across ${summary.properties.length} properties`
      );
    } catch (err) {
      errors++;
      console.error(
        `[lead-reminder] Failed for tenant ${summary.tenantId}:`,
        err instanceof Error ? err.message : err
      );
      // Lead records are NOT modified on failure — no data loss
    }
  }

  console.log(`[lead-reminder] Done: ${sent} sent, ${errors} errors`);
  return { sent, errors };
}

// ─── Email template ───────────────────────────────────────────────────────────

function buildReminderHtml(summary: TenantSummary, leadsUrl: string): string {
  const rows = summary.properties
    .map(
      (p) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;font-weight:700;color:#0f172a">
            ${escapeHtml(p.propertyTitle)}
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;font-weight:900;color:#7c3aed;text-align:right;white-space:nowrap">
            ${p.leadCount} lead${p.leadCount !== 1 ? 's' : ''}
          </td>
        </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">

    <div style="background:#0f172a;padding:28px 32px">
      <p style="margin:0;color:#7c3aed;font-size:11px;font-weight:900;letter-spacing:0.2em;text-transform:uppercase">
        Recordatorio de leads
      </p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:900">
        Tienes ${summary.totalLeads} lead${summary.totalLeads !== 1 ? 's' : ''} sin responder
      </h1>
    </div>

    <div style="padding:28px 32px">
      <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.6">
        Hola <strong>${escapeHtml(summary.tenantName)}</strong>,<br><br>
        Los siguientes leads están esperando respuesta desde hace más de 48 horas:
      </p>

      <table style="width:100%;border-collapse:collapse">
        ${rows}
      </table>

      <p style="margin:20px 0 0;font-size:14px;color:#64748b;line-height:1.6">
        Responde pronto — cada hora sin contacto reduce la probabilidad de conversión.
      </p>

      <a
        href="${leadsUrl}"
        style="display:inline-block;margin-top:24px;background:#7c3aed;color:#fff;font-size:13px;font-weight:900;text-decoration:none;padding:13px 26px;border-radius:999px"
      >
        Ir al panel de leads →
      </a>
    </div>

    <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #f1f5f9">
      <p style="margin:0;font-size:11px;color:#94a3b8">
        Immersphere Pro · immersphere.io
      </p>
    </div>

  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
