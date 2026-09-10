import { apiClient } from './apiClient';

export const getLoyaltyStats = async () => {
  return await apiClient('/loyalty/stats');
};

export const getSuperVips = async () => {
  return await apiClient('/admin/super-vip/list');
};

export const checkSuperVip = async (customerId: number) => {
  return await apiClient(`/admin/super-vip/check/${customerId}`);
};

export const addSuperVip = async (customerId: number) => {
  return await apiClient('/admin/super-vip/add', {
    method: 'POST',
    body: JSON.stringify({ customerId }),
  });
};

export const removeSuperVip = async (customerId: number) => {
  return await apiClient(`/admin/super-vip/remove/${customerId}`, {
    method: 'DELETE',
  });
};

export const changeTier = async (customerId: number, tierName: string) => {
  return await apiClient('/admin/super-vip/change-tier', {
    method: 'POST',
    body: JSON.stringify({ customerId, tierName }),
  });
};

export interface ManualVoucherPayload {
  customerId?: number;
  brandId: number;
  code?: string;
  /** 1 = Percentage, 2 = Amount */
  rewardType: 1 | 2;
  percentageBasisPoints?: number;
  amount?: number;
  maxDiscountAmount?: number;
  minOrderAmount?: number;
  validityDays?: number;
  note?: string;
}

/** Phát voucher trực tiếp vào ví khách hàng. */
export const issueVoucherToUser = async (payload: ManualVoucherPayload) => {
  return await apiClient('/admin/super-vip/vouchers/issue', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

/** Tạo mã voucher chưa gán owner — user tự nhập trên app để nhận vào ví. */
export const generateVoucherCode = async (payload: Omit<ManualVoucherPayload, 'customerId'>) => {
  return await apiClient('/admin/super-vip/vouchers/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};
