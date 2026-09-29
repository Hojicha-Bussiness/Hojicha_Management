'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getProductDetailMappingById, updateProductDetailMapping } from '@/services/productDetailMappings';
import { getProducts } from '@/services/products';
import { getStores } from '@/services/stores';
import { getSourceOrders } from '@/services/sourceOrders';
import { getProductPricesBySource, saveProductPricesBySource } from '@/services/productPrices';
import { useAuthStore } from '@/store/authStore';
import { SourceOrder } from '@/types/sourceOrder';

export default function EditProductDetailMappingPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [mapping, setMapping] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [sourceOrders, setSourceOrders] = useState<SourceOrder[]>([]);
  const [channelPrices, setChannelPrices] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [params.id]);

  const fetchData = async () => {
    try {
      const brandId = useAuthStore.getState().user?.brandId ? Number(useAuthStore.getState().user?.brandId) : 1;
      const [mappingRes, productsRes, storesRes, sourcesRes] = await Promise.all([
        getProductDetailMappingById(params.id, brandId),
        getProducts(1, 1000),
        getStores(1, 1000, brandId),
        getSourceOrders(brandId),
      ]);
      
      if (mappingRes && mappingRes.data) {
        const mapData = mappingRes.data;
        setMapping(mapData);

        // Fetch channel prices for this store & product
        if (mapData.storeId && mapData.productId) {
          try {
            const pricesRes = await getProductPricesBySource(mapData.storeId, mapData.productId);
            if (pricesRes && pricesRes.data) {
              const priceMap: Record<number, string> = {};
              pricesRes.data.forEach((p) => {
                if (p.price > 0) {
                  priceMap[p.sourceOrderId || p.sourceId || 0] = String(p.price);
                }
              });
              setChannelPrices(priceMap);
            }
          } catch (e) {
            console.error('Error fetching source prices:', e);
          }
        }
      }
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
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const productId = Number(formData.get("ProductId"));
    const storeId = Number(formData.get("StoreId"));
    const basePrice = formData.get("Price") ? Number(formData.get("Price")) : null;

    const payload = {
      ProductId: productId,
      StoreId: storeId,
      Price: basePrice,
      DiscountPrice: formData.get("DiscountPrice") ? Number(formData.get("DiscountPrice")) : null,
      DiscountPercent: formData.get("DiscountPercent") ? Number(formData.get("DiscountPercent")) : null,
      Active: formData.get("Active") === "on",
    };
    
    try {
      await updateProductDetailMapping(Number(params.id), payload);

      // Save channel prices batch
      const sourcePriceItems = Object.entries(channelPrices).map(([srcId, val]) => ({
        sourceOrderId: Number(srcId),
        price: Number(val) || 0,
      }));

      if (sourcePriceItems.length > 0 && storeId && productId) {
        await saveProductPricesBySource(storeId, productId, sourcePriceItems);
      }

      toast.success('Cập nhật cấu hình giá món và bảng giá kênh thành công!');
      router.push('/product-detail-mappings');
    } catch (err: any) {
      toast.error(`Error updating mapping: ${err.message}`);
    } finally {
      setSaving(false);
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
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Chỉnh sửa Cấu hình Giá Món</h1>
      </div>
      
      <div className="p-6 bg-white rounded-2xl border border-gray-200 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <form onSubmit={handleUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Sản phẩm *</label>
            <select 
              required 
              name="ProductId" 
              defaultValue={mapping?.productId || ''}
              className="w-full p-2.5 border rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            >
              <option value="">Chọn sản phẩm</option>
              {products.map((product: any) => (
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
              defaultValue={mapping?.storeId || ''}
              className="w-full p-2.5 border rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            >
              <option value="">Chọn cửa hàng</option>
              {stores.map((store: any) => (
                <option key={store.storeId || store.id} value={store.storeId || store.id}>
                  {store.storeName || store.name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Giá gốc tại cửa hàng (VNĐ)</label>
            <input 
              type="number" 
              step="1000" 
              name="Price" 
              defaultValue={mapping?.price || ''}
              placeholder="Giá bán chuẩn tại quầy"
              className="w-full p-2.5 border rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white" 
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Giá khuyến mãi (VNĐ)</label>
            <input 
              type="number" 
              step="1000" 
              name="DiscountPrice" 
              defaultValue={mapping?.discountPrice || ''}
              placeholder="Giá sau giảm (tùy chọn)"
              className="w-full p-2.5 border rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white" 
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">% Giảm giá (0-100)</label>
            <input 
              type="number" 
              step="0.1" 
              min="0" 
              max="100" 
              name="DiscountPercent" 
              defaultValue={mapping?.discountPercent || ''}
              placeholder="Tự động tính nếu bỏ trống"
              className="w-full p-2.5 border rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white" 
            />
          </div>
          
          <div className="flex items-center gap-2 mt-4">
            <input 
              type="checkbox" 
              name="Active" 
              id="active" 
              defaultChecked={mapping?.active} 
              className="w-4 h-4 rounded text-primary focus:ring-primary" 
            />
            <label htmlFor="active" className="text-sm font-medium dark:text-gray-300">Đang kinh doanh tại cửa hàng</label>
          </div>

          {/* Section Bảng giá theo Kênh bán */}
          <div className="md:col-span-2 mt-4 rounded-2xl border border-gray-200 bg-gray-50/70 p-5 dark:border-gray-700 dark:bg-gray-800/40">
            <div className="flex items-center gap-2 mb-1.5">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Bảng giá theo Kênh bán (Nguồn đơn)
              </h3>
              <span className="text-[11px] rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 font-medium">
                Đa kênh
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
                        placeholder={`Dùng giá gốc (${mapping?.price ? Number(mapping.price).toLocaleString('vi-VN') + ' đ' : 'Mặc định'})`}
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
          
          <div className="md:col-span-2 mt-4 flex justify-end gap-3 pt-2">
            <button 
              type="button" 
              disabled={saving}
              onClick={() => router.back()} 
              className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Hủy
            </button>
            <button 
              type="submit" 
              disabled={saving}
              className="px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? 'Đang lưu...' : 'Lưu Thay Đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
