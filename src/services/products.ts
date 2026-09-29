import { apiClient } from './apiClient';

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
