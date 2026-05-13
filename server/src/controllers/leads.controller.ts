import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../middleware/errorHandler.js';
import { createLead, exportPropertyLeadsCsv, getPropertyLeads } from '../services/leads.service.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createLeadController(
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { propertyId, email, phone, notes, source } = request.body;

    if (!propertyId || typeof propertyId !== 'string') {
      response.status(400).json({ success: false, error: 'propertyId requerido.' });
      return;
    }
    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      response.status(400).json({ success: false, error: 'Email válido requerido.' });
      return;
    }

    const lead = await createLead({
      propertyId,
      email,
      phone: typeof phone === 'string' ? phone : undefined,
      notes: typeof notes === 'string' ? notes : undefined,
      source: typeof source === 'string' ? source : 'viewer'
    });

    response.status(201).json({ success: true, data: { id: lead.id } });
  } catch (error) {
    next(error);
  }
}

export async function getPropertyLeadsController(
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = request.auth?.tenantId;
    if (!tenantId) {
      throw new AppError(401, 'Autenticación requerida.');
    }

    const { propertyId } = request.params;
    const leads = await getPropertyLeads(propertyId, tenantId);

    response.status(200).json({ success: true, data: leads });
  } catch (error) {
    next(error);
  }
}

export async function exportPropertyLeadsCsvController(
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = request.auth?.tenantId;
    if (!tenantId) {
      throw new AppError(401, 'Autenticación requerida.');
    }

    const { propertyId } = request.params;
    const csv = await exportPropertyLeadsCsv(propertyId, tenantId);

    if (csv === null) {
      throw new AppError(404, 'Propiedad no encontrada.');
    }

    const filename = `leads-${propertyId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv`;

    response
      .status(200)
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      .send('﻿' + csv);
  } catch (error) {
    next(error);
  }
}
