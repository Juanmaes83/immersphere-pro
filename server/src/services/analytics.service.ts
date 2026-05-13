import { prisma } from '../index.js';

export interface TenantPropertyStat {
  propertyId: string;
  title: string;
  totalEvents: number;
  hotspotClicks: number;
  leadCtas: number;
  spaceChanges: number;
  viewerOpens: number;
  engagementScore: number;
}

export interface TenantAnalyticsSummary {
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
    createdAt: Date;
    sessionId: string | null;
  }>;
}

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

interface CountByKey {
  key: string;
  count: number;
}

function computeEngagementScore(counts: Record<string, number>): number {
  const score =
    (counts['viewer_open'] ?? 0) * 1 +
    (counts['space_change'] ?? 0) * 3 +
    (counts['viewer_drag'] ?? 0) * 2 +
    (counts['hotspot_click'] ?? 0) * 8 +
    (counts['lead_cta'] ?? 0) * 20;

  return Math.min(100, Math.round(score));
}

export async function getPropertyAnalyticsSummary(propertyId: string) {
  const allEvents = await prisma.viewerEvent.findMany({
    where: { propertyId },
    select: {
      id: true,
      type: true,
      label: true,
      spaceId: true,
      assetId: true,
      sessionId: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' }
  });

  const totalEvents = allEvents.length;

  // counts by type
  const typeCounts: Record<string, number> = {};
  for (const ev of allEvents) {
    typeCounts[ev.type] = (typeCounts[ev.type] ?? 0) + 1;
  }

  const hotspotClicks = typeCounts['hotspot_click'] ?? 0;
  const spaceChanges = typeCounts['space_change'] ?? 0;
  const leadCtas = typeCounts['lead_cta'] ?? 0;
  const viewerOpens = typeCounts['viewer_open'] ?? 0;

  const eventsByType: CountByKey[] = Object.entries(typeCounts)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);

  // counts by space
  const spaceCounts: Record<string, number> = {};
  for (const ev of allEvents) {
    if (ev.spaceId) {
      spaceCounts[ev.spaceId] = (spaceCounts[ev.spaceId] ?? 0) + 1;
    }
  }
  const eventsBySpace: CountByKey[] = Object.entries(spaceCounts)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);

  // counts by asset
  const assetCounts: Record<string, number> = {};
  for (const ev of allEvents) {
    if (ev.assetId) {
      assetCounts[ev.assetId] = (assetCounts[ev.assetId] ?? 0) + 1;
    }
  }
  const eventsByAsset: CountByKey[] = Object.entries(assetCounts)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);

  // top hotspots by label
  const hotspotCounts: Record<string, number> = {};
  for (const ev of allEvents) {
    if (ev.type === 'hotspot_click' && ev.label) {
      hotspotCounts[ev.label] = (hotspotCounts[ev.label] ?? 0) + 1;
    }
  }
  const topHotspots: CountByKey[] = Object.entries(hotspotCounts)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const lastEvents = allEvents.slice(0, 10).map((ev) => ({
    id: ev.id,
    type: ev.type,
    label: ev.label,
    spaceId: ev.spaceId,
    sessionId: ev.sessionId,
    createdAt: ev.createdAt
  }));

  const engagementScore = computeEngagementScore(typeCounts);

  // most engaged space (first in eventsBySpace)
  const topSpaceId = eventsBySpace[0]?.key ?? null;
  const topHotspotLabel = topHotspots[0]?.key ?? null;

  return {
    totalEvents,
    viewerOpens,
    hotspotClicks,
    spaceChanges,
    leadCtas,
    engagementScore,
    topSpaceId,
    topHotspotLabel,
    eventsByType,
    eventsBySpace,
    eventsByAsset,
    topHotspots,
    lastEvents
  };
}

export async function getTenantAnalyticsSummary(tenantId: string): Promise<TenantAnalyticsSummary> {
  const [allEvents, properties] = await Promise.all([
    prisma.viewerEvent.findMany({
      where: { tenantId },
      select: {
        propertyId: true,
        type: true,
        sessionId: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.property.findMany({
      where: { tenantId },
      select: { id: true, title: true }
    })
  ]);

  const propertyTitleMap = new Map(properties.map((p) => [p.id, p.title]));

  // per-property buckets
  const buckets = new Map<string, { total: number; hotspot: number; lead: number; space: number; open: number }>();
  for (const ev of allEvents) {
    const b = buckets.get(ev.propertyId) ?? { total: 0, hotspot: 0, lead: 0, space: 0, open: 0 };
    b.total += 1;
    if (ev.type === 'hotspot_click') b.hotspot += 1;
    if (ev.type === 'lead_cta') b.lead += 1;
    if (ev.type === 'space_change') b.space += 1;
    if (ev.type === 'viewer_open') b.open += 1;
    buckets.set(ev.propertyId, b);
  }

  const topProperties: TenantPropertyStat[] = Array.from(buckets.entries())
    .map(([propertyId, b]) => {
      const score = computeEngagementScore({
        viewer_open: b.open,
        space_change: b.space,
        hotspot_click: b.hotspot,
        lead_cta: b.lead
      });
      return {
        propertyId,
        title: propertyTitleMap.get(propertyId) ?? propertyId.slice(0, 8) + '…',
        totalEvents: b.total,
        hotspotClicks: b.hotspot,
        leadCtas: b.lead,
        spaceChanges: b.space,
        viewerOpens: b.open,
        engagementScore: score
      };
    })
    .sort((a, b) => b.engagementScore - a.engagementScore)
    .slice(0, 8);

  const totalEvents = allEvents.length;
  const totalHotspotClicks = allEvents.filter((e) => e.type === 'hotspot_click').length;
  const totalLeadCtas = allEvents.filter((e) => e.type === 'lead_cta').length;
  const totalSpaceChanges = allEvents.filter((e) => e.type === 'space_change').length;
  const totalViewerOpens = allEvents.filter((e) => e.type === 'viewer_open').length;
  const propertiesWithEvents = buckets.size;

  const overallEngagementScore = computeEngagementScore({
    viewer_open: totalViewerOpens,
    space_change: totalSpaceChanges,
    hotspot_click: totalHotspotClicks,
    lead_cta: totalLeadCtas
  });

  const recentLeads = allEvents
    .filter((e) => e.type === 'lead_cta')
    .slice(0, 10)
    .map((e) => ({
      propertyId: e.propertyId,
      propertyTitle: propertyTitleMap.get(e.propertyId) ?? e.propertyId.slice(0, 8) + '…',
      createdAt: e.createdAt,
      sessionId: e.sessionId
    }));

  return {
    totalEvents,
    totalViewerOpens,
    totalHotspotClicks,
    totalLeadCtas,
    totalSpaceChanges,
    propertiesWithEvents,
    overallEngagementScore,
    topProperties,
    recentLeads
  };
}
