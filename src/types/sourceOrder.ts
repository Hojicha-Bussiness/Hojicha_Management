export interface SourceOrder {
  id: number;
  code: string;
  name: string;
  icon?: string | null;
  displayOrder: number;
  isActive: boolean;
  brandId?: number | null;
  createdAt?: string;
  updatedAt?: string | null;
}

export interface CreateSourceOrderPayload {
  code: string;
  name: string;
  icon?: string | null;
  displayOrder: number;
  isActive: boolean;
  brandId?: number | null;
}

export interface UpdateSourceOrderPayload {
  name: string;
  icon?: string | null;
  displayOrder: number;
  isActive: boolean;
}
