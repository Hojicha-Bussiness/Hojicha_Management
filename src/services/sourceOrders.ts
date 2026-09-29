import { apiClient } from './apiClient';
import { SourceOrder, CreateSourceOrderPayload, UpdateSourceOrderPayload } from '@/types/sourceOrder';

export interface ApiResponse<T = unknown> {
  status: number;
  message?: string;
  data?: T;
}

export const getSourceOrders = async (brandId?: number) => {
  const query = brandId ? `?brandId=${encodeURIComponent(String(brandId))}` : '';
  return apiClient<ApiResponse<SourceOrder[]>>(`/source-orders${query}`);
};

export const createSourceOrder = async (payload: CreateSourceOrderPayload) => {
  return apiClient<ApiResponse<SourceOrder>>('/source-orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const updateSourceOrder = async (id: number, payload: UpdateSourceOrderPayload) => {
  return apiClient<ApiResponse<SourceOrder>>(`/source-orders/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
};

export const deleteSourceOrder = async (id: number) => {
  return apiClient<ApiResponse>(`/source-orders/${id}`, {
    method: 'DELETE',
  });
};
