import { type NextFunction, type Request, type Response } from 'express';
import { generatePropertyReport } from '../services/pdf-report.service.js';

export async function exportPropertyReportController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { propertyId } = req.params;
    const tenantId = req.auth!.tenantId;

    const { buffer, filename } = await generatePropertyReport(propertyId, tenantId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}
