import { apiClient } from './apiClient';

// ─── Type Definitions ────────────────────────────────────────────────

export interface CreatePromotionDetailData {
  promotionDetailCode?: string;
  regExCode?: string;
  minOrderAmount?: number;
  maxOrderAmount?: number;
  buyProductCode?: string;
  minBuyQuantity?: number;
  maxBuyQuantity?: number;
  giftProductCode?: string;
  giftQuantity?: number;
  discountRate?: number;
  discountAmount?: number;
}

export interface CreatePromotionData {
  promotionCode: string;
  promotionName: string;
  promotionClassName?: string;
  shortDescription?: string;
  description?: string;
  imageUrl?: string;
  applyLevel: number;        // 0: Order, 1: OrderDetail
  giftType: number;          // 0: DiscountRate, 1: Gift, 2: DiscountAmount
  promotionType: number;     // 0–5 (Internal, Separate, Common, AutoApply, PromotionCode, VoucherCode)
  isForMember: boolean;
  fromDate: string;
  toDate: string;
  applyFromTime?: number;
  applyToTime?: number;
  brandId?: number;
  storeIds: number[];
  details: CreatePromotionDetailData[];
}

export interface UpdatePromotionData {
  promotionName?: string;
  promotionClassName?: string;
  shortDescription?: string;
  description?: string;
  imageUrl?: string;
  applyLevel?: number;
  giftType?: number;
  promotionType?: number;
  isForMember?: boolean;
  fromDate?: string;
  toDate?: string;
  applyFromTime?: number;
  applyToTime?: number;
  isVoucher?: boolean;
  isApplyOnce?: boolean;
  voucherQuantity?: number;
  fromHappyDay?: number;
  toHappyDay?: number;
  fromHoursHappy?: number;
  toHoursHappy?: number;
  usingPoint?: boolean;
  applyToPartner?: number;
}

export interface UpdatePromotionDetailData {
  promotionDetailCode?: string;
  regExCode?: string;
  minOrderAmount?: number;
  maxOrderAmount?: number;
  buyProductCode?: string;
  minBuyQuantity?: number;
  maxBuyQuantity?: number;
  giftProductCode?: string;
  giftQuantity?: number;
  discountRate?: number;
  discountAmount?: number;
  pointTrade?: number;
  minPoint?: number;
  maxPoint?: number;
  expirationPeriod?: number;
}

export interface UpdateStoreMappingData {
  active?: boolean;
  storeId?: number;
}

export interface GenerateVouchersData {
  count: number;
  promotionDetailId?: number;
}

// ─── Enum helpers ────────────────────────────────────────────────────

export const PROMOTION_TYPE_LABELS: Record<number, string> = {
  0: 'Internal',
  1: 'Separate',
  2: 'Common',
  3: 'Auto Apply',
  4: 'Promotion Code',
  5: 'Voucher Code',
};

export const GIFT_TYPE_LABELS: Record<number, string> = {
  0: 'Discount Rate',
  1: 'Gift',
  2: 'Discount Amount',
};

export const APPLY_LEVEL_LABELS: Record<number, string> = {
  0: 'Order Level',
  1: 'Order Detail Level',
};

// ─── API Functions ───────────────────────────────────────────────────

export const getPromotionsByBrand = async (
  page = 1,
  size = 30,
  sortBy?: string,
  isAsc = true,
  keyword?: string,
  active?: boolean
) => {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('size', String(size));
  if (sortBy) params.set('sortBy', sortBy);
  params.set('isAsc', String(isAsc));
  if (keyword) params.set('keyword', keyword);
  if (active !== undefined) params.set('active', String(active));
  return await apiClient(`/promotions?${params.toString()}`);
};

export const getPromotionById = async (id: number) => {
  return await apiClient(`/promotions/${id}`);
};

export const createPromotion = async (data: CreatePromotionData) => {
  return await apiClient('/promotions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const updatePromotion = async (id: number, data: UpdatePromotionData) => {
  return await apiClient(`/promotions/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ promotionId: id, ...data }),
  });
};

export const updatePromotionDetail = async (
  detailId: number,
  data: UpdatePromotionDetailData
) => {
  return await apiClient(`/promotions/details/${detailId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const createPromotionDetail = async (
  promotionId: number,
  data: CreatePromotionDetailData
) => {
  return await apiClient(`/promotions/${promotionId}/details`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const updateStoreMapping = async (
  mappingId: number,
  data: UpdateStoreMappingData
) => {
  return await apiClient(`/promotions/store-mappings/${mappingId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const generateVouchers = async (
  promotionId: number,
  data: GenerateVouchersData
) => {
  return await apiClient(`/promotions/${promotionId}/vouchers/generate`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const getVouchersByPromotion = async (
  promotionId: number,
  page = 1,
  size = 50
) => {
  return await apiClient(
    `/promotions/${promotionId}/vouchers?page=${page}&size=${size}`
  );
};

export interface CopyPromotionStoreMappingsData {
  sourceStoreId: number;
  targetStoreId: number;
  overwriteExisting?: boolean;
}

export const copyPromotionStoreMappings = async (data: CopyPromotionStoreMappingsData) => {
  return await apiClient('/promotions/store-mappings/copy', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const addStoreMapping = async (promotionId: number, storeId: number) => {
  return await apiClient(`/promotions/${promotionId}/store-mappings`, {
    method: 'POST',
    body: JSON.stringify({ storeId }),
  });
};
