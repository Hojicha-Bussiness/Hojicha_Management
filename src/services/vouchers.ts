import { api } from './apiClient';

export interface AdminVoucherItem {
  id: number;
  code: string;
  brandId: number;
  brandName: string;
  customerId: number;
  customerName?: string | null;
  customerPhone?: string | null;
  isFloating: boolean;
  sourceSystem: string;
  status: number; // 0 = Active, 1 = Reserved, 2 = Used, 3 = Cancelled, 4 = Expired
  statusName: string;
  isExpired: boolean;
  issuedAt: string;
  startsAt: string;
  expiresAt?: string | null;
  rewardType: number; // 1 = Percentage, 2 = Amount
  rewardTypeName: string;
  percentageBasisPoints?: number | null;
  discountPercent?: number | null;
  amount?: number | null;
  maxDiscountAmount?: number | null;
  minOrderAmount?: number | null;
  note?: string | null;
  reservationId?: number | null;
  orderId?: number | null;
}

export interface AdminVouchersResponse {
  items: AdminVoucherItem[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

export interface GetAdminVouchersParams {
  brandId?: number;
  keyword?: string;
  status?: number;
  rewardType?: number;
  page?: number;
  size?: number;
}

export interface CreateVoucherPayload {
  brandId: number;
  customerId?: number;
  code?: string;
  rewardType: 1 | 2; // 1 = Percentage, 2 = Fixed amount
  percentageBasisPoints?: number;
  amount?: number;
  maxDiscountAmount?: number;
  minOrderAmount?: number;
  validityDays: number;
  note?: string;
}

export interface BatchGenerateVouchersPayload {
  brandId: number;
  count: number;
  prefix?: string;
  rewardType: 1 | 2;
  percentageBasisPoints?: number;
  amount?: number;
  maxDiscountAmount?: number;
  minOrderAmount?: number;
  validityDays: number;
  note?: string;
}

export interface BatchGenerateVouchersResult {
  count: number;
  brandId: number;
  rewardType: number;
  expiresAt: string;
  codes: string[];
}

export const getAdminVouchers = async (params: GetAdminVouchersParams = {}) => {
  const query = new URLSearchParams();
  if (params.brandId) query.append('brandId', String(params.brandId));
  if (params.keyword?.trim()) query.append('keyword', params.keyword.trim());
  if (params.status !== undefined && params.status !== null) query.append('status', String(params.status));
  if (params.rewardType) query.append('rewardType', String(params.rewardType));
  if (params.page) query.append('page', String(params.page));
  if (params.size) query.append('size', String(params.size));

  const endpoint = `/admin/vouchers${query.toString() ? `?${query.toString()}` : ''}`;
  return await api.get(endpoint);
};

export const generateFloatingVoucher = async (payload: Omit<CreateVoucherPayload, 'customerId'>) => {
  return await api.post('/admin/vouchers/generate', payload);
};

export const issueVoucherToCustomer = async (payload: CreateVoucherPayload) => {
  return await api.post('/admin/vouchers/issue', payload);
};

export const batchGenerateVouchers = async (payload: BatchGenerateVouchersPayload) => {
  return await api.post('/admin/vouchers/batch', payload);
};

export const deleteVoucher = async (id: number) => {
  return await api.delete(`/admin/vouchers/${id}`);
};

export const searchVoucherCustomers = async (q: string) => {
  return await api.get(`/admin/super-vip/customers/search?q=${encodeURIComponent(q)}`);
};
