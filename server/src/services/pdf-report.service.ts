import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { prisma } from '../index.js';
import { env } from '../config/env.js';
import { getPropertyAnalyticsSummary } from './analytics.service.js';
import { AppError } from '../middleware/errorHandler.js';

export async function generatePropertyReport(
  propertyId: string,
  tenantId: string
): Promise<{ buffer: Buffer; filename: string }> {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, tenantId },
    include: {
      spaces: {
        orderBy: { order: 'asc' },
        include: { assets: true }
      },
      _count: { select: { leads: true } }
    }
  });

  if (!property) {
    throw new AppError(404, 'Propiedad no encontrada.');
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      name: true,
      logoText: true,
      primaryColor: true,
      removeBranding: true,
      pdfReportsEnabled: true
    }
  });

  // Gate: PDF reports are an opt-in add-on. Activated manually per tenant in DB.
  if (!tenant?.pdfReportsEnabled) {
    throw new AppError(403, 'El add-on de informes PDF no está activo para esta cuenta.');
  }

  const analytics = await getPropertyAnalyticsSummary(propertyId);

  const rawAppUrl = env.APP_URL.replace(/\/$/, '');

  // Warn if APP_URL looks like a local/dev URL — QR would be useless in production
  const isLocalUrl =
    rawAppUrl === '' ||
    rawAppUrl.includes('localhost') ||
    rawAppUrl.includes('127.0.0.1');
  if (isLocalUrl) {
    console.warn(
      '[pdf-report] APP_URL is local or empty ("%s"). QR code will not point to a public URL.',
      rawAppUrl
    );
  }

  const appUrl = rawAppUrl;
  const propertyUrl = `${appUrl}/property/${propertyId}`;

  // Generate QR as PNG buffer — non-fatal if it fails
  let qrBuffer: Buffer | null = null;
  try {
    qrBuffer = await QRCode.toBuffer(propertyUrl, {
      type: 'png',
      width: 150,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' }
    });
  } catch {
    qrBuffer = null;
  }

  // Asset type breakdown
  const allAssets = property.spaces.flatMap((s: { assets: Array<{ type: string }> }) => s.assets);
  const assetCounts: Record<string, number> = {};
  for (const asset of allAssets) {
    assetCounts[asset.type] = (assetCounts[asset.type] ?? 0) + 1;
  }

  const removeBranding = tenant?.removeBranding ?? false;
  const primaryHex = tenant?.primaryColor ?? '#7C3AED';

  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    info: {
      Title: `Informe — ${property.title}`,
      Author: tenant?.name ?? 'Immersphere Pro',
      Creator: 'Immersphere Pro'
    }
  });

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  await new Promise<void>((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);

    const LEFT = 50;
    const RIGHT = 545;
    const COL2 = 200; // value column x
    const dateStr = new Date().toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    // ── HELPER FUNCTIONS ──────────────────────────────────

    function hline(color = '#e2e8f0'): void {
      doc.moveTo(LEFT, doc.y).lineTo(RIGHT, doc.y).strokeColor(color).lineWidth(0.5).stroke();
    }

    function sectionLabel(text: string): void {
      doc.moveDown(0.8);
      doc
        .fontSize(7.5)
        .fillColor('#94a3b8')
        .text(text, LEFT, doc.y, { characterSpacing: 1.8, width: RIGHT - LEFT });
      doc.moveDown(0.3);
      hline('#f1f5f9');
      doc.moveDown(0.6);
    }

    function row(label: string, value: string, indent = 0): void {
      const y = doc.y;
      doc
        .fontSize(9)
        .fillColor('#64748b')
        .text(label, LEFT + indent, y, { lineBreak: false, width: COL2 - LEFT - indent });
      doc.fontSize(9).fillColor('#0f172a').text(value, COL2, y);
      doc.moveDown(0.15);
    }

    // ── HEADER ────────────────────────────────────────────
    if (!removeBranding) {
      doc
        .fontSize(7.5)
        .fillColor('#94a3b8')
        .text('IMMERSPHERE PRO', LEFT, 50, {
          lineBreak: false,
          characterSpacing: 1.5
        });
      doc
        .fontSize(7.5)
        .fillColor('#94a3b8')
        .text(dateStr, LEFT, 50, { align: 'right', width: RIGHT - LEFT });
    } else {
      doc
        .fontSize(7.5)
        .fillColor('#94a3b8')
        .text(dateStr, LEFT, 50, { align: 'right', width: RIGHT - LEFT });
    }

    doc.moveDown(0.6);
    hline('#e2e8f0');
    doc.moveDown(1);

    // ── TÍTULO ────────────────────────────────────────────
    doc
      .fontSize(8)
      .fillColor('#94a3b8')
      .text('INFORME DE PROPIEDAD', LEFT, doc.y, { characterSpacing: 1.5 });
    doc.moveDown(0.4);
    doc.fontSize(20).fillColor('#0f172a').text(property.title, LEFT, doc.y, {
      lineGap: 4,
      width: RIGHT - LEFT
    });
    doc.moveDown(0.8);

    // ── DATOS DE LA PROPIEDAD ─────────────────────────────
    const typeLabels: Record<string, string> = {
      APARTMENT: 'Apartamento',
      HOUSE: 'Casa',
      OFFICE: 'Oficina',
      COMMERCIAL: 'Local comercial',
      LAND: 'Terreno',
      OTHER: 'Otro'
    };
    const statusLabels: Record<string, string> = {
      PUBLISHED: 'Publicada',
      DRAFT: 'Borrador',
      ARCHIVED: 'Archivada'
    };

    row('Tipo:', typeLabels[property.type] ?? property.type);
    row('Estado:', statusLabels[property.status] ?? property.status);
    if (property.price > 0) {
      row('Precio:', `${property.price.toLocaleString('es-ES')} €`);
    }
    if (property.area > 0) {
      row('Superficie:', `${property.area} m²`);
    }
    if (property.rooms > 0) {
      row('Habitaciones:', String(property.rooms));
    }
    if (property.bathrooms > 0) {
      row('Baños:', String(property.bathrooms));
    }
    if (property.address) {
      row('Dirección:', property.address);
    }
    row(
      'Creada:',
      new Date(property.createdAt).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    );

    doc.moveDown(0.5);
    doc
      .fontSize(8)
      .fillColor(primaryHex)
      .text(propertyUrl, LEFT, doc.y, {
        link: propertyUrl,
        underline: true,
        width: RIGHT - LEFT
      });

    // ── CONTENIDO ─────────────────────────────────────────
    sectionLabel('CONTENIDO');

    row('Espacios:', String(property.spaces.length));
    row('Assets totales:', String(allAssets.length));

    const assetTypeLabels: Record<string, string> = {
      PANORAMA_360: 'Panoramas 360°',
      GAUSSIAN_SPLAT: 'Gaussian Splats',
      GLB_MODEL: 'Modelos GLB',
      IMAGE: 'Imágenes',
      VIDEO: 'Vídeos'
    };
    for (const [type, count] of Object.entries(assetCounts)) {
      row(`${assetTypeLabels[type] ?? type}:`, String(count), 12);
    }

    // ── ANALYTICS ─────────────────────────────────────────
    sectionLabel('ANALYTICS');

    row('Aperturas del visor:', String(analytics.viewerOpens));
    row('Leads generados:', String(property._count.leads));
    row('Clicks en hotspots:', String(analytics.hotspotClicks));
    row('Cambios de espacio:', String(analytics.spaceChanges));
    row('Engagement score:', `${analytics.engagementScore} / 100`);

    // ── QR ────────────────────────────────────────────────
    if (qrBuffer) {
      sectionLabel('CÓDIGO QR');

      const qrY = doc.y;
      doc.image(qrBuffer, LEFT, qrY, { width: 90, height: 90 });

      doc
        .fontSize(9)
        .fillColor('#0f172a')
        .text('Escanea para abrir el tour', LEFT + 105, qrY + 8)
        .fontSize(8)
        .fillColor('#64748b')
        .text('Compatible con cualquier app de cámara.', LEFT + 105, qrY + 24)
        .fontSize(7.5)
        .fillColor(primaryHex)
        .text(propertyUrl, LEFT + 105, qrY + 44, {
          link: propertyUrl,
          underline: true,
          width: RIGHT - LEFT - 110
        });

      // Advance cursor past the QR image
      doc.text('', LEFT, qrY + 100);
    }

    // ── FOOTER ────────────────────────────────────────────
    if (!removeBranding) {
      const footerY = doc.page.height - 45;
      doc
        .moveTo(LEFT, footerY - 8)
        .lineTo(RIGHT, footerY - 8)
        .strokeColor('#e2e8f0')
        .lineWidth(0.5)
        .stroke();
      doc
        .fontSize(7)
        .fillColor('#94a3b8')
        .text('Generado por Immersphere Pro · immersphere.io', LEFT, footerY, {
          align: 'center',
          width: RIGHT - LEFT
        });
    }

    doc.end();
  });

  const buffer = Buffer.concat(chunks);

  const slug = property.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || propertyId.slice(0, 8);

  const date = new Date().toISOString().slice(0, 10);
  const filename = `informe-${slug}-${date}.pdf`;

  return { buffer, filename };
}
