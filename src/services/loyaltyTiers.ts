import { apiClient } from './apiClient';

export interface BrandLoyaltyTier {
  id: number;
  brandId: number;
  tierName: string;
  imageUrl?: string | null;
  badgeImageUrl?: string | null;
  minSpend: number;
  earnMultiplier: number;
  stampThreshold: number;
  freeUpsize: number;
  monthlyVoucherCount: number;
  birthdayReward?: string | null;
  upgradeRewardDescription?: string | null;
  sortOrder: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string | null;
}

export interface BrandLoyaltyTierPayload {
  brandId?: number;
  tierName: string;
  minSpend: number;
  earnMultiplier: number;
  stampThreshold: number;
  freeUpsize: number;
  monthlyVoucherCount: number;
  birthdayReward?: string | null;
  upgradeRewardDescription?: string | null;
  sortOrder: number;
  active: boolean;
}

export interface ApiResponse<T = unknown> {
  status: number;
  message?: string;
  data?: T;
}

const endpoint = '/admin/brand-loyalty-tiers';

export interface UploadTierArtworkOptions {
  badgeImage?: File | null;
  removeImage?: boolean;
  removeBadgeImage?: boolean;
}

export const uploadTierImage = (
  id: number,
  image?: File | null,
  options?: UploadTierArtworkOptions,
) => {
  const form = new FormData();
  if (image) {
    form.append('Image', image);
  }
  if (options?.badgeImage) {
    form.append('BadgeImage', options.badgeImage);
  }
  if (options?.removeImage) {
    form.append('RemoveImage', 'true');
  }
  if (options?.removeBadgeImage) {
    form.append('RemoveBadgeImage', 'true');
  }
  return apiClient<ApiResponse<BrandLoyaltyTier>>(`${endpoint}/${id}/image`, {
    method: 'POST',
    body: form,
  });
};

export const getBrandLoyaltyTiers = async (brandId?: number) => {
  const query = brandId ? `?brandId=${encodeURIComponent(String(brandId))}` : '';
  return apiClient<ApiResponse<BrandLoyaltyTier[]>>(`${endpoint}${query}`);
};

export const createBrandLoyaltyTier = async (data: BrandLoyaltyTierPayload) => {
  return apiClient<ApiResponse<BrandLoyaltyTier>>(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const updateBrandLoyaltyTier = async (
  id: number,
  data: BrandLoyaltyTierPayload,
) => {
  return apiClient<ApiResponse<BrandLoyaltyTier>>(`${endpoint}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const deleteBrandLoyaltyTier = async (id: number) => {
  return apiClient<ApiResponse>(`${endpoint}/${id}`, {
    method: 'DELETE',
  });
};
