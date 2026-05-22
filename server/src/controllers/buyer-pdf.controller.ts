import type { NextFunction, Request, Response } from 'express';
import { generateBuyerPropertyPDF } from '../services/buyer-pdf.service.js';

export async function buyerPdfController(
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { propertyId } = request.params;
    const { buffer, filename } = await generateBuyerPropertyPDF(propertyId);

    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    response.setHeader('Content-Length', String(buffer.length));
    response.send(buffer);
  } catch (err) {
    next(err);
  }
}
