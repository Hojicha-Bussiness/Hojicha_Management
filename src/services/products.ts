import { apiClient } from './apiClient';
import { ParsedProductRow } from '@/utils/excelProductParser';

// ─── Type Definitions ────────────────────────────────────────────────

export interface CreateProductRequest {
  ProductName: string;
  ProductNameEng?: string;
  Price: number;
  CatId: number;
  Code?: string;
  ProductType: number;
  GeneralProductId?: number | null;
  IsAvailable?: boolean;
  Active?: boolean;
  ExtraProductCodes?: string[];
  // Optional extras used during batch import
  PriceCogs?: number | null;
  DisplayOrder?: number;
  IsMostOrdered?: boolean;
}

export interface UpdateProductRequest {
  ProductName?: string;
  ProductNameEng?: string;
  Price?: number;
  PicUrl?: string;
  CatId?: number;
  IsAvailable?: boolean;
  Code?: string;
  DiscountPercent?: number;
  DiscountPrice?: number;
  ProductType?: number;
  DisplayOrder?: number;
  HasExtra?: boolean;
  IsFixedPrice?: boolean;
  IsMenuDisplay?: boolean;
  GeneralProductId?: number | null;
  Description?: string;
  DescriptionEng?: string;
  Introduction?: string;
  IntroductionEng?: string;
  SeoName?: string;
  SeoKeyWords?: string;
  SeoDescription?: string;
  Active?: boolean;
  Note?: string;
  AlternativeCode?: string;
  PriceCogs?: number;
  MemberPoint?: number;
  ExtraProductCodes?: string[];
}

export interface CreateStoreMappingData {
  ProductId: number;
  StoreId: number;
  Price?: number | null;
  DiscountPrice?: number | null;
  DiscountPercent?: number | null;
  Active?: boolean;
}

export interface UpdateStoreMappingData {
  ProductId?: number;
  StoreId?: number;
  Price?: number | null;
  DiscountPrice?: number | null;
  DiscountPercent?: number | null;
  Active?: boolean;
}

// ─── Product CRUD ────────────────────────────────────────────────────

export const getProducts = async (page = 1, size = 50) => {
  return await apiClient(`/products?page=${page}&size=${size}`);
};

export const getProductById = async (id: string | number) => {
  return await apiClient(`/products/${id}`);
};

export const createProduct = async (request: CreateProductRequest | FormData) => {
  const isFormData = request instanceof FormData;
  return await apiClient('/products', {
    method: 'POST',
    body: isFormData ? request : JSON.stringify(request),
  });
};

export const updateProduct = async (id: number, request: UpdateProductRequest | FormData) => {
  const isFormData = request instanceof FormData;
  return await apiClient(`/products/${id}`, {
    method: 'PUT',
    body: isFormData ? request : JSON.stringify(request),
  });
};

export const deleteProduct = async (id: number) => {
  return await apiClient('/products/' + id, {
    method: 'DELETE',
  });
};

// ─── Batch Import from Excel ──────────────────────────────────────────────────

export interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}

export type ImportProgressCallback = (current: number, total: number, rowIndex: number, success: boolean) => void;

export const importProductsFromExcel = async (
  rows: ParsedProductRow[],
  storeIds: number[],
  onProgress?: ImportProgressCallback
): Promise<ImportResult> => {
  const result: ImportResult = { success: 0, failed: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const { rowIndex, data } = rows[i];
    try {
      const payload = new FormData();
      payload.append('ProductName', data.ProductName);
      if (data.ProductNameEng) payload.append('ProductNameEng', data.ProductNameEng);
      payload.append('Price', String(data.Price));
      if (data.PriceCogs != null) payload.append('PriceCogs', String(data.PriceCogs));
      payload.append('CatId', String(data.CatId));
      payload.append('ProductType', String(data.ProductType));
      if (data.Code) payload.append('Code', data.Code);
      if (data.GeneralProductId != null) payload.append('GeneralProductId', String(data.GeneralProductId));
      payload.append('DisplayOrder', String(data.DisplayOrder ?? 0));
      payload.append('Active', String(data.Active !== false));
      payload.append('IsAvailable', String(data.IsAvailable !== false));
      payload.append('ExtraProductCodes', '');

      const createRes = await createProduct(payload);
      const created =
        createRes?.data?.data ??
        createRes?.data?.Data ??
        createRes?.data;
      const createdId = created?.id ?? created?.Id ?? created?.productId ?? created?.ProductId;

      if (!createdId) throw new Error('Không lấy được ID sản phẩm vừa tạo');

      // Map to all selected stores
      if (storeIds.length > 0) {
        await Promise.all(
          storeIds.map((storeId) =>
            createProductDetailMapping({
              ProductId: Number(createdId),
              StoreId: storeId,
              Price: data.Price,
              DiscountPrice: null,
              DiscountPercent: null,
              Active: true,
            })
          )
        );
      }

      result.success++;
      onProgress?.(i + 1, rows.length, rowIndex, true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      result.failed++;
      result.errors.push({ row: rowIndex, message });
      onProgress?.(i + 1, rows.length, rowIndex, false);
    }
  }

  return result;
};

// ─── Product Store Mappings (Store Menu) ─────────────────────────────

export const getProductDetailMappings = async (
  page = 1,
  size = 50,
  brandId?: number,
  productId?: number,
  storeId?: number,
  active?: boolean
) => {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('size', String(size));
  if (brandId) params.set('brandId', String(brandId));
  if (productId) params.set('productId', String(productId));
  if (storeId) params.set('storeId', String(storeId));
  if (active !== undefined) params.set('active', String(active));
  return await apiClient(`/product-detail-mappings?${params.toString()}`);
};

export const getProductDetailMappingById = async (id: string | number, brandId?: number) => {
  let endpoint = `/product-detail-mappings/${id}`;
  if (brandId) {
    endpoint += `?brandId=${brandId}`;
  }
  return await apiClient(endpoint);
};

export const createProductDetailMapping = async (data: CreateStoreMappingData) => {
  return await apiClient('/product-detail-mappings', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const updateProductDetailMapping = async (id: number, data: UpdateStoreMappingData) => {
  return await apiClient(`/product-detail-mappings/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const deleteProductDetailMapping = async (id: number) => {
  return await apiClient('/product-detail-mappings/' + id, {
    method: 'DELETE',
  });
};
