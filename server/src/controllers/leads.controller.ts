import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../middleware/errorHandler.js';
import { createLead, exportPropertyLeadsCsv, getPropertyLeads, getAllTenantLeads, exportAllTenantLeadsCsv, getTenantLeadsCount, updateLead } from '../services/leads.service.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function getLeadsCountController(
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = request.auth?.tenantId;
    if (!tenantId) throw new AppError(401, 'Autenticación requerida.');
    const count = await getTenantLeadsCount(tenantId);
    response.status(200).json({ success: true, data: { count } });
  } catch (error) {
    next(error);
  }
}

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

export async function getAllLeadsController(
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = request.auth?.tenantId;
    if (!tenantId) throw new AppError(401, 'Autenticación requerida.');

    const { propertyId, from, to } = request.query as Record<string, string | undefined>;
    const leads = await getAllTenantLeads(tenantId, { propertyId, from, to });
    response.status(200).json({ success: true, data: leads });
  } catch (error) {
    next(error);
  }
}

export async function exportAllLeadsCsvController(
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = request.auth?.tenantId;
    if (!tenantId) throw new AppError(401, 'Autenticación requerida.');

    const { propertyId, from, to } = request.query as Record<string, string | undefined>;
    const csv = await exportAllTenantLeadsCsv(tenantId, { propertyId, from, to });
    const filename = `leads-all-${new Date().toISOString().slice(0, 10)}.csv`;
    response
      .status(200)
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      .send('﻿' + csv);
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

export async function updateLeadController(
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = request.auth?.tenantId;
    if (!tenantId) throw new AppError(401, 'Autenticación requerida.');

    const { id } = request.params;
    if (!id || typeof id !== 'string') {
      response.status(400).json({ success: false, error: 'ID de lead requerido.' });
      return;
    }

    const { status, internalNote, nextActionAt, nextActionText } = request.body as {
      status?: unknown;
      internalNote?: unknown;
      nextActionAt?: unknown;
      nextActionText?: unknown;
    };

    const input: Parameters<typeof updateLead>[2] = {};

    if (status !== undefined) {
      if (typeof status !== 'string') {
        response.status(400).json({ success: false, error: 'status debe ser un string.' });
        return;
      }
      input.status = status;
    }

    if (internalNote !== undefined) {
      if (typeof internalNote !== 'string') {
        response.status(400).json({ success: false, error: 'internalNote debe ser un string.' });
        return;
      }
      input.internalNote = internalNote;
    }

    if ('nextActionAt' in request.body) {
      if (nextActionAt !== null && typeof nextActionAt !== 'string') {
        response.status(400).json({ success: false, error: 'nextActionAt debe ser un string ISO o null.' });
        return;
      }
      input.nextActionAt = nextActionAt as string | null;
    }

    if (nextActionText !== undefined) {
      if (typeof nextActionText !== 'string') {
        response.status(400).json({ success: false, error: 'nextActionText debe ser un string.' });
        return;
      }
      input.nextActionText = nextActionText;
    }

    const lead = await updateLead(id, tenantId, input);
    response.status(200).json({ success: true, data: lead });
  } catch (error) {
    next(error);
  }
}
