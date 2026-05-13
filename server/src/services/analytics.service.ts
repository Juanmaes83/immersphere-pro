import { prisma } from '../index.js';

export interface CreateViewerEventInput {
  tenantId: string;
  propertyId: string;
  spaceId?: string;
  assetId?: string;
  type: string;
  label?: string;
  payload?: Record<string, unknown>;
  sessionId?: string;
}

export async function createViewerEvent(input: CreateViewerEventInput): Promise<void> {
  await prisma.viewerEvent.create({
    data: {
      tenantId: input.tenantId,
      propertyId: input.propertyId,
      spaceId: input.spaceId ?? null,
      assetId: input.assetId ?? null,
      type: input.type,
      label: input.label ?? null,
      payload: input.payload ? JSON.stringify(input.payload) : null,
      sessionId: input.sessionId ?? null
    }
  });
}

export async function getPropertyAnalyticsSummary(propertyId: string) {
  const [totalEvents, hotspotClicks, spaceChanges, leadCtas, lastEvents] = await Promise.all([
    prisma.viewerEvent.count({ where: { propertyId } }),
    prisma.viewerEvent.count({ where: { propertyId, type: 'hotspot_click' } }),
    prisma.viewerEvent.count({ where: { propertyId, type: 'space_change' } }),
    prisma.viewerEvent.count({ where: { propertyId, type: 'lead_cta' } }),
    prisma.viewerEvent.findMany({
      where: { propertyId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        type: true,
        label: true,
        spaceId: true,
        sessionId: true,
        createdAt: true
      }
    })
  ]);

  return { totalEvents, hotspotClicks, spaceChanges, leadCtas, lastEvents };
}
