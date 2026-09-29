'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createProductDetailMapping } from '@/services/productDetailMappings';
import { getProducts } from '@/services/products';
import { getStores } from '@/services/stores';
import { getSourceOrders } from '@/services/sourceOrders';
import { saveProductPricesBySource } from '@/services/productPrices';
import { useAuthStore } from '@/store/authStore';
import { Product } from '@/types/product';
import { Store } from '@/types/store';
import { SourceOrder } from '@/types/sourceOrder';

export default function CreateProductDetailMappingPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [sourceOrders, setSourceOrders] = useState<SourceOrder[]>([]);
  const [channelPrices, setChannelPrices] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchOptions();
  }, []);

  const fetchOptions = async () => {
    try {
      const brandId = useAuthStore.getState().user?.brandId ? Number(useAuthStore.getState().user?.brandId) : 1;
      const [productsRes, storesRes, sourcesRes] = await Promise.all([
        getProducts(1, 1000),
        getStores(1, 1000, brandId || undefined),
        getSourceOrders(brandId),
      ]);
      
      if (productsRes && productsRes.data) {
        setProducts(productsRes.data.items || productsRes.data);
      }
      if (storesRes && storesRes.data) {
        setStores(storesRes.data.items || storesRes.data);
      }
      if (sourcesRes && sourcesRes.data) {
        setSourceOrders(sourcesRes.data.filter((s) => s.isActive));
      }
    } catch (error) {
      console.error('Error fetching options:', error);
      toast.error('Failed to load options');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    
    const productId = Number(formData.get("ProductId"));
    const storeId = Number(formData.get("StoreId"));
    const price = formData.get("Price") ? Number(formData.get("Price")) : null;
    const discountPrice = formData.get("DiscountPrice") ? Number(formData.get("DiscountPrice")) : null;
    
    // Validation: Discount price cannot exceed original price
    if (discountPrice && price && discountPrice > price) {
      toast.error('Giá khuyến mãi không được lớn hơn giá gốc');
      setSubmitting(false);
      return;
    }
    
    const payload = {
      ProductId: productId,
      StoreId: storeId,
      Price: price,
      DiscountPrice: discountPrice,
      DiscountPercent: null, // Will be calculated by BE
      Active: formData.get("Active") === "on",
    };
    
    try {
      await createProductDetailMapping(payload);

      // Save channel prices batch if entered
      const sourcePriceItems = Object.entries(channelPrices).map(([srcId, val]) => ({
        sourceOrderId: Number(srcId),
        price: Number(val) || 0,
      }));

      if (sourcePriceItems.length > 0 && storeId && productId) {
        try {
          await saveProductPricesBySource(storeId, productId, sourcePriceItems);
        } catch (errPrice: any) {
          console.error('Error saving channel prices:', errPrice);
        }
      }

      toast.success('Thiết lập giá món tại cửa hàng và bảng giá kênh thành công!');
      router.push('/product-detail-mappings');
    } catch (err: any) {
      toast.error(`Error creating mapping: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="grid grid-cols-2 gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i}>
                  <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                  <div className="h-10 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          &larr; Quay lại
        </button>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Thiết Lập Giá Món Tại Cửa Hàng</h1>
      </div>
      
      <div className="p-6 bg-white rounded-2xl border border-gray-200 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <form onSubmit={handleCreate} className="space-y-5">
          <div>
            <h2 className="text-base font-semibold mb-3 text-gray-900 dark:text-white">Thông Tin Cơ Bản</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Sản phẩm *</label>
                <select 
                  required 
                  name="ProductId" 
                  className="w-full p-2.5 border rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                >
                  <option value="">Chọn sản phẩm</option>
                  {products.map((product: Product) => (
                    <option key={product.id} value={product.id}>
                      {product.productName} ({product.code})
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Cửa hàng *</label>
                <select 
                  required 
                  name="StoreId" 
                  className="w-full p-2.5 border rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                >
                  <option value="">Chọn cửa hàng</option>
                  {stores.map((store: Store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          
          <div>
            <h2 className="text-base font-semibold mb-3 text-gray-900 dark:text-white">Đơn Giá Gốc Cửa Hàng</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Giá gốc tại quầy (VNĐ)</label>
                <input 
                  type="number" 
                  step="1000" 
                  name="Price" 
                  placeholder="VD: 30000"
                  className="w-full p-2.5 border rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white" 
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Giá khuyến mãi (VNĐ)</label>
                <input 
                  type="number" 
                  step="1000" 
                  name="DiscountPrice" 
                  placeholder="Giá sau giảm (tùy chọn)"
                  className="w-full p-2.5 border rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white" 
                />
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              name="Active" 
              id="active" 
              defaultChecked={true} 
              className="w-4 h-4 rounded text-primary focus:ring-primary" 
            />
            <label htmlFor="active" className="text-sm font-medium dark:text-gray-300">Đang kinh doanh tại cửa hàng</label>
          </div>

          {/* Section Bảng giá theo Kênh bán */}
          <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-5 dark:border-gray-700 dark:bg-gray-800/40">
            <div className="flex items-center gap-2 mb-1.5">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Bảng giá theo Kênh bán (Nguồn đơn)
              </h3>
              <span className="text-[11px] rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 font-medium">
                Tùy chọn
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Thiết lập giá riêng khi bán trên từng kênh (GrabFood, ShopeeFood, Mang đi...). Nếu để trống hoặc bằng 0, hệ thống sẽ tự động dùng giá gốc cửa hàng.
            </p>

            {sourceOrders.length === 0 ? (
              <p className="text-xs italic text-gray-400">
                Chưa có kênh bán nào được cấu hình cho thương hiệu. Bạn có thể thêm tại mục Thiết Lập Hệ Thống &gt; Kênh bán.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {sourceOrders.map((so) => (
                  <div key={so.id} className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-2xs dark:border-gray-700 dark:bg-gray-800">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-gray-900 dark:text-white">
                        {so.name}
                      </span>
                      <span className="font-mono text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold">
                        {so.code}
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="1000"
                        min="0"
                        placeholder="Dùng giá gốc cửa hàng"
                        value={channelPrices[so.id] || ''}
                        onChange={(e) => setChannelPrices({ ...channelPrices, [so.id]: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-900 placeholder:text-xs placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      />
                      <span className="absolute right-2.5 top-2 text-xs text-gray-400 font-medium pointer-events-none">
                        VNĐ
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex justify-end gap-3 pt-2">
            <button 
              type="button" 
              onClick={() => router.back()} 
              className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Hủy
            </button>
            <button 
              type="submit" 
              disabled={submitting}
              className="px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Đang tạo...' : 'Tạo Thiết Lập Giá'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
