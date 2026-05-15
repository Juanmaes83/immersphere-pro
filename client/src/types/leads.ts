export interface LeadWithProperty {
  id: string;
  propertyId: string;
  propertyTitle: string;
  email: string;
  phone: string;
  notes: string;
  source: string;
  status: string;
  internalNote: string;
  nextActionAt: string | null;
  nextActionText: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeadDetailPanelProps {
  lead: LeadWithProperty;
  isSaving: boolean;
  saveError: string | null;
  onSave: (patch: Partial<Pick<LeadWithProperty, 'internalNote' | 'nextActionAt' | 'nextActionText'>>) => void;
}
