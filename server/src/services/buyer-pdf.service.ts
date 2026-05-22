/**
 * Buyer Property PDF
 *
 * Generates a buyer-facing A4 PDF ficha for a published property.
 * Public endpoint — no authentication required.
 *
 * Resilience:
 *   - Cover image: downloaded with a 5 s timeout. PDF is generated without
 *     the image if the download fails (CORS, network error, timeout).
 *   - QR: generated via the `qrcode` package. Omitted silently if it fails.
 */
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { prisma } from '../index.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';

export async function generateBuyerPropertyPDF(
  propertyId: string
): Promise<{ buffer: Buffer; filename: string }> {
  // ── Fetch property + tenant ──────────────────────────────────────────────
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: {
      tenant: {
        select: {
          name: true,
          primaryColor: true,
          removeBranding: true,
          phone: true,
          whatsappNumber: true
        }
      }
    }
  });

  if (!property) throw new AppError(404, 'Propiedad no encontrada.');
  if (property.status !== 'PUBLISHED') throw new AppError(404, 'Propiedad no encontrada.');

  const tenant = property.tenant;
  const primaryHex = tenant?.primaryColor ?? '#7C3AED';
  const removeBranding = tenant?.removeBranding ?? false;
  const appUrl = env.APP_URL.replace(/\/$/, '');
  const propertyUrl = `${appUrl}/property/${propertyId}`;

  // ── Cover image (non-fatal, 5 s timeout) ────────────────────────────────
  let coverImageBuffer: Buffer | null = null;
  if (property.coverImage) {
    try {
      const controller = new AbortController();
      const timerId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(property.coverImage, { signal: controller.signal });
      clearTimeout(timerId);
      if (res.ok) {
        coverImageBuffer = Buffer.from(await res.arrayBuffer());
      }
    } catch {
      coverImageBuffer = null;
    }
  }

  // ── QR code (non-fatal) ──────────────────────────────────────────────────
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

  // ── Helpers ───────────────────────────────────────────────────────────────
  const priceStr =
    property.price > 0
      ? new Intl.NumberFormat('es-ES', {
          style: 'currency',
          currency: 'EUR',
          maximumFractionDigits: 0
        }).format(property.price)
      : null;

  const slug =
    property.title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || propertyId.slice(0, 8);

  const filename = `ficha-${slug}.pdf`;

  // ── Build PDF ─────────────────────────────────────────────────────────────
  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    info: {
      Title: property.title,
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
    const W = RIGHT - LEFT;

    function hline(y?: number, color = '#e2e8f0'): void {
      const lineY = y ?? doc.y;
      doc.moveTo(LEFT, lineY).lineTo(RIGHT, lineY).strokeColor(color).lineWidth(0.5).stroke();
    }

    function sectionLabel(text: string): void {
      doc.moveDown(0.8);
      doc.fontSize(7.5).fillColor('#94a3b8').text(text, LEFT, doc.y, { characterSpacing: 1.5, width: W });
      doc.moveDown(0.3);
      hline(doc.y, '#f1f5f9');
      doc.moveDown(0.6);
    }

    // ── HEADER ──────────────────────────────────────────────────────────────
    const headerLabel = removeBranding ? (tenant?.name ?? '') : 'Immersphere Pro';
    const dateStr = new Date().toLocaleDateString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });

    doc.fontSize(8).fillColor('#64748b').text(headerLabel, LEFT, 50, { lineBreak: false });
    doc.fontSize(7.5).fillColor('#94a3b8').text(dateStr, LEFT, 50, {
      align: 'right',
      width: W
    });
    doc.moveDown(0.6);
    hline(doc.y);
    doc.moveDown(1);

    // ── TÍTULO + DIRECCIÓN ───────────────────────────────────────────────────
    doc.fontSize(8).fillColor('#94a3b8').text('FICHA DE PROPIEDAD', LEFT, doc.y, {
      characterSpacing: 1.5
    });
    doc.moveDown(0.4);
    doc.fontSize(20).fillColor('#0f172a').text(property.title, LEFT, doc.y, {
      lineGap: 4,
      width: W
    });
    if (property.address) {
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor('#64748b').text(property.address, LEFT, doc.y, { width: W });
    }
    doc.moveDown(0.8);

    // ── COVER IMAGE ──────────────────────────────────────────────────────────
    if (coverImageBuffer) {
      try {
        const imgY = doc.y;
        doc.image(coverImageBuffer, LEFT, imgY, { fit: [W, 200] });
        // advance cursor past the image area
        doc.text('', LEFT, imgY + 210);
      } catch {
        // Image embedding failed — continue without it
      }
    }

    doc.moveDown(0.5);

    // ── PRECIO ───────────────────────────────────────────────────────────────
    if (priceStr) {
      doc.fontSize(18).fillColor(primaryHex).text(priceStr, LEFT, doc.y);
      doc.moveDown(0.4);
    }

    // ── CARACTERÍSTICAS ──────────────────────────────────────────────────────
    const specs: string[] = [];
    if (property.area > 0) specs.push(`${property.area} m²`);
    if (property.rooms > 0) specs.push(`${property.rooms} hab.`);
    if (property.bathrooms > 0) specs.push(`${property.bathrooms} baños`);
    if (specs.length > 0) {
      doc.fontSize(11).fillColor('#334155').text(specs.join(' · '), LEFT, doc.y);
      doc.moveDown(0.6);
    }

    // ── DESCRIPCIÓN ──────────────────────────────────────────────────────────
    if (property.description) {
      const desc =
        property.description.length > 500
          ? property.description.slice(0, 497) + '…'
          : property.description;
      sectionLabel('DESCRIPCIÓN');
      doc.fontSize(9.5).fillColor('#475569').text(desc, LEFT, doc.y, {
        width: W,
        lineGap: 3
      });
      doc.moveDown(0.8);
    }

    // ── TOUR VIRTUAL ─────────────────────────────────────────────────────────
    sectionLabel('VER TOUR VIRTUAL');
    doc.fontSize(9).fillColor(primaryHex).text(propertyUrl, LEFT, doc.y, {
      link: propertyUrl,
      underline: true,
      width: W
    });
    doc.moveDown(0.8);

    // ── QR ───────────────────────────────────────────────────────────────────
    if (qrBuffer) {
      const qrY = doc.y;
      doc.image(qrBuffer, LEFT, qrY, { width: 90, height: 90 });
      doc
        .fontSize(9)
        .fillColor('#0f172a')
        .text('Escanea para ver el tour', LEFT + 105, qrY + 12)
        .fontSize(8)
        .fillColor('#64748b')
        .text('Abre el tour en tu móvil sin instalar nada.', LEFT + 105, qrY + 28)
        .fontSize(7.5)
        .fillColor(primaryHex)
        .text(propertyUrl, LEFT + 105, qrY + 46, {
          link: propertyUrl,
          underline: true,
          width: W - 110
        });
      doc.text('', LEFT, qrY + 100);
    }

    // ── CONTACTO ─────────────────────────────────────────────────────────────
    const phone = tenant?.phone ?? '';
    if (phone) {
      sectionLabel('CONTACTO');
      doc.fontSize(9).fillColor('#0f172a').text(phone, LEFT, doc.y, {
        link: `tel:${phone.replace(/\s/g, '')}`
      });
      doc.moveDown(0.4);
    }

    // ── FOOTER ───────────────────────────────────────────────────────────────
    const footerY = doc.page.height - 45;
    doc
      .moveTo(LEFT, footerY - 8)
      .lineTo(RIGHT, footerY - 8)
      .strokeColor('#e2e8f0')
      .lineWidth(0.5)
      .stroke();
    const footerText = removeBranding
      ? (tenant?.name ?? '')
      : 'Generado por Immersphere Pro · immersphere.io';
    if (footerText) {
      doc
        .fontSize(7)
        .fillColor('#94a3b8')
        .text(footerText, LEFT, footerY, { align: 'center', width: W });
    }

    doc.end();
  });

  const buffer = Buffer.concat(chunks);
  return { buffer, filename };
}
