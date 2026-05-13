import { prisma } from '../index.js';
import { env } from '../config/env.js';

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

  if (!property || property.tenantId !== tenantId) {
    return [];
  }

  return prisma.lead.findMany({
    where: { propertyId },
    orderBy: { createdAt: 'desc' },
    take: 100
  });
}

async function fireLeadWebhook(lead: LeadRecord): Promise<void> {
  const webhookUrl = env.LEAD_NOTIFICATION_WEBHOOK_URL;
  if (!webhookUrl) return;

  const property = await prisma.property.findUnique({
    where: { id: lead.propertyId },
    select: { title: true, tenantId: true }
  });

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
