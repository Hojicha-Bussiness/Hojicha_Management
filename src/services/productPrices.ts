import { apiClient } from './apiClient';

export interface ProductPriceBySourceItem {
  sourceOrderId: number;
  sourceId?: number;
  sourceCode?: string;
  sourceName?: string;
  price: number;
}

export interface UpsertProductPricesPayload {
  storeId: number;
  productId: number;
  sourcePrices: {
    sourceOrderId?: number;
    sourceId?: number;
    price: number;
  }[];
}

export interface ApiResponse<T = unknown> {
  status: number;
  message?: string;
  data?: T;
}

export const getProductPricesBySource = async (storeId: number, productId: number) => {
  return apiClient<ApiResponse<ProductPriceBySourceItem[]>>(
    `/product-prices/by-source?storeId=${storeId}&productId=${productId}`
  );
};

export const saveProductPricesBySource = async (
  storeId: number,
  productId: number,
  sourcePrices: { sourceOrderId?: number; sourceId?: number; price: number }[]
) => {
  const payload: UpsertProductPricesPayload = {
    storeId,
    productId,
    sourcePrices: sourcePrices.map((sp) => ({
      sourceOrderId: sp.sourceOrderId ?? sp.sourceId ?? 0,
      sourceId: sp.sourceOrderId ?? sp.sourceId ?? 0,
      price: Number(sp.price) || 0,
    })),
  };

  return apiClient<ApiResponse>('/product-prices/by-source/batch', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};
