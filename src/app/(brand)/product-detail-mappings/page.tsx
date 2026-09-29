'use client';
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { getProductDetailMappings, deleteProductDetailMapping, copyProductDetailMappings } from '@/services/productDetailMappings';
import CopyStoreMappingsModal from '@/components/modals/CopyStoreMappingsModal';
import { useAuthStore } from '@/store/authStore';
import { DataTable } from '@/components/ui/data-table';
import { SkeletonTable } from '@/components/ui/skeleton-table';
import { Modal } from '@/components/ui/modal';
import { ColumnDef } from '@tanstack/react-table';
import { PencilIcon, TrashBinIcon, PlugInIcon } from '@/icons';
import { formatCurrency } from '@/utils/currency';
import { ProductDetailMapping } from '@/types/product';
import { SourceOrder } from '@/types/sourceOrder';
import { getSourceOrders } from '@/services/sourceOrders';
import { getProductPricesBySource, saveProductPricesBySource } from '@/services/productPrices';
import { getStores, Store } from '@/services/stores';

export default function ProductDetailMappingListPage() {
  const [data, setData] = useState<ProductDetailMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    storeId: '',
    active: ''
  });

  // Multi-source quick modal state
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [selectedMapping, setSelectedMapping] = useState<ProductDetailMapping | null>(null);
  const [sourceOrders, setSourceOrders] = useState<SourceOrder[]>([]);
  const [modalPrices, setModalPrices] = useState<Record<number, string>>({});
  const [loadingModalPrices, setLoadingModalPrices] = useState(false);
  const [savingModalPrices, setSavingModalPrices] = useState(false);

  const fetchSourceOrdersList = useCallback(async () => {
    try {
      const brandId = useAuthStore.getState().user?.brandId;
      const res = await getSourceOrders(brandId ? Number(brandId) : undefined);
      if (res && res.data) {
        setSourceOrders(res.data.filter((s) => s.isActive));
      }
    } catch (e) {
      console.error('Error fetching source orders:', e);
    }
  }, []);

  // Stores for dropdown filter
  const [stores, setStores] = useState<Store[]>([]);

  useEffect(() => {
    const fetchStores = async () => {
      try {
        const brandId = useAuthStore.getState().user?.brandId;
        const res = await getStores(1, 100, brandId ? Number(brandId) : undefined);
        if (res && res.data) {
          const items = res.data.items || res.data;
          setStores(items);
        }
      } catch (err) {
        console.error('Failed to fetch stores:', err);
      }
    };
    fetchStores();
  }, []);

  useEffect(() => {
    fetchSourceOrdersList();
  }, [fetchSourceOrdersList]);

  useEffect(() => {
    fetchData(filters, page, size);
  }, [page, size]);

  const fetchData = async (filterValues = filters, pageNum = page, pageSize = size) => {
    try {
      const brandId = useAuthStore.getState().user?.brandId;
      
      const res = await getProductDetailMappings(
        pageNum,
        pageSize,
        brandId || undefined,
        undefined, // productId - removed since we're using search
        filterValues.storeId ? Number(filterValues.storeId) : undefined,
        filterValues.active !== '' ? filterValues.active === 'true' : undefined
      );
      
      let filteredData = res.data?.items || res.data || [];
      setTotalPages(res.data?.totalPages || 1);
      setTotalItems(res.data?.total || filteredData.length || 0);
      
      // Client-side search by product name
      if (filterValues.search) {
        filteredData = filteredData.filter((item: ProductDetailMapping) => 
          (item.productName || item.product?.productName || '').toLowerCase().includes(filterValues.search.toLowerCase())
        );
      }
      
      setData(filteredData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    setPage(1);
    fetchData(newFilters, 1, size);
  };

  const handleOpenQuickPrice = async (item: ProductDetailMapping) => {
    setSelectedMapping(item);
    setIsPriceModalOpen(true);
    setLoadingModalPrices(true);
    setModalPrices({});

    try {
      const storeId = item.storeId;
      const productId = item.productId;
      if (storeId && productId) {
        const res = await getProductPricesBySource(storeId, productId);
        if (res && res.data) {
          const map: Record<number, string> = {};
          res.data.forEach((p) => {
            if (p.price > 0) {
              map[p.sourceOrderId || p.sourceId || 0] = String(p.price);
            }
          });
          setModalPrices(map);
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Không thể tải bảng giá kênh');
    } finally {
      setLoadingModalPrices(false);
    }
  };

  const handleSaveQuickPrices = async () => {
    if (!selectedMapping || !selectedMapping.storeId || !selectedMapping.productId) return;
    setSavingModalPrices(true);

    try {
      const items = Object.entries(modalPrices).map(([srcId, val]) => ({
        sourceOrderId: Number(srcId),
        price: Number(val) || 0,
      }));

      await saveProductPricesBySource(
        selectedMapping.storeId,
        selectedMapping.productId,
        items
      );

      toast.success(
        `Cập nhật bảng giá kênh cho món "${selectedMapping.productName || selectedMapping.product?.productName || 'Sản phẩm'}" thành công!`
      );
      setIsPriceModalOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error('Lỗi khi lưu bảng giá kênh', {
        description: err?.message,
      });
    } finally {
      setSavingModalPrices(false);
    }
  };

  const columns = useMemo<ColumnDef<ProductDetailMapping>[]>(() => [
    {
      accessorKey: 'productDetailId',
      header: 'ID',
    },
    {
      accessorKey: 'productName',
      header: 'Tên Sản Phẩm',
      cell: ({ row }) => (
        <span className="font-semibold text-gray-900 dark:text-white">
          {row.original.productName || row.original.product?.productName || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'storeName',
      header: 'Cửa Hàng',
      cell: ({ row }) => (
        <span className="text-gray-700 dark:text-gray-300">
          {row.original.storeName || row.original.store?.name || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'price',
      header: 'Giá Gốc',
      cell: ({ row }) => {
        const price = row.original.price;
        const discountPrice = row.original.discountPrice;
        return (
          <div className="flex flex-col">
            <span className={discountPrice ? 'line-through text-xs text-gray-400' : 'font-medium text-gray-900 dark:text-white'}>
              {formatCurrency(price)}
            </span>
            {discountPrice && (
              <span className="text-red-500 text-sm font-semibold">
                {formatCurrency(discountPrice)}
              </span>
            )}
          </div>
        );
      },
    },

    {
      accessorKey: 'active',
      header: 'Trạng Thái',
      cell: ({ row }) => {
        const isActive = row.original.active;
        return (
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
            {isActive ? 'Đang bán' : 'Tạm ngưng'}
          </span>
        );
      }
    },
    {
      id: 'actions',
      header: 'Thao Tác',
      cell: ({ row }) => {
        const id = row.original.productDetailId;
        const handleDelete = async () => {
          if (window.confirm('Bạn có chắc chắn muốn xóa cấu hình giá món này tại cửa hàng?')) {
            try {
              await deleteProductDetailMapping(id);
              toast.success('Xóa cấu hình món thành công');
              fetchData();
            } catch (error) {
              console.error('Error deleting mapping:', error);
              toast.error('Không thể xóa cấu hình món');
            }
          }
        };

        return (
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => handleOpenQuickPrice(row.original)}
              className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-600 transition-colors hover:bg-brand-100 dark:border-brand-800/40 dark:bg-brand-900/30 dark:text-brand-300"
              title="Thiết lập bảng giá đa kênh (GrabFood, ShopeeFood...)"
            >
              <PlugInIcon className="h-3.5 w-3.5" />
              <span>Giá kênh</span>
            </button>
            <Link 
              href={`/product-detail-mappings/${id}/edit`} 
              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-brand-600 dark:text-gray-400 dark:hover:bg-gray-800"
              title="Chỉnh sửa chi tiết"
            >
              <PencilIcon className="h-4 w-4" />
            </Link>
            <button 
              onClick={handleDelete}
              className="rounded-lg p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
              title="Xóa cấu hình"
            >
              <TrashBinIcon className="h-4 w-4" />
            </button>
          </div>
        );
      }
    }
  ], []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Cấu Hình Giá Sản Phẩm Theo Cửa Hàng
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Quản lý giá bán tại quầy và thiết lập giá riêng cho các kênh bán (GrabFood, ShopeeFood...) tại từng chi nhánh.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCopyModalOpen(true)}
            className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium text-sm shadow-sm flex items-center gap-2"
          >
            <span>📋</span> Sao chép sang cửa hàng
          </button>
          <Link 
            href="/product-detail-mappings/create" 
            className="px-4 py-2.5 bg-brand-500 text-white rounded-xl hover:bg-brand-600 transition-colors font-semibold text-sm shadow-sm"
          >
            + Thiết Lập Món Mới
          </Link>
        </div>
      </div>

      <CopyStoreMappingsModal
        isOpen={isCopyModalOpen}
        onClose={() => setIsCopyModalOpen(false)}
        onSuccess={() => fetchData()}
        title="Sao chép sản phẩm sang cửa hàng"
        description="Sao chép danh sách giá & sản phẩm từ một cửa hàng nguồn sang cửa hàng đích."
        onCopy={(sourceStoreId, targetStoreId, overwriteExisting) =>
          copyProductDetailMappings({ sourceStoreId, targetStoreId, overwriteExisting })
        }
      />

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm dark:border-gray-800 dark:bg-gray-900 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-300 mb-1">
              Tìm tên sản phẩm
            </label>
            <input
              type="text"
              placeholder="VD: Trà đào, Cà phê sữa..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full p-2.5 border rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-300 mb-1">
              Cửa Hàng
            </label>
            <select
              value={filters.storeId}
              onChange={(e) => handleFilterChange('storeId', e.target.value)}
              className="w-full p-2.5 border rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white text-sm"
            >
              <option value="">Tất cả cửa hàng</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-300 mb-1">
              Trạng Thái
            </label>
            <select
              value={filters.active}
              onChange={(e) => handleFilterChange('active', e.target.value)}
              className="w-full p-2.5 border rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white text-sm"
            >
              <option value="">Tất cả</option>
              <option value="true">Đang bán</option>
              <option value="false">Tạm ngưng</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setFilters({ search: '', storeId: '', active: '' });
                fetchData({ search: '', storeId: '', active: '' });
              }}
              className="w-full py-2.5 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Xóa bộ lọc
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm dark:border-gray-800 dark:bg-gray-900 p-6">
        {loading ? (
          <SkeletonTable columns={6} rows={8} />
        ) : (
          <DataTable 
            columns={columns} 
            data={data} 
            searchKey="productName" 
            searchPlaceholder="Tìm kiếm món trong danh sách..." 
            paginationMode="server"
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={size}
            onPageChange={setPage}
            onPageSizeChange={(nextSize) => {
              setSize(nextSize);
              setPage(1);
            }}
            defaultPageSize={size}
          />
        )}
      </div>

      {/* Modal Cấu hình nhanh Giá Đa Kênh */}
      <Modal
        isOpen={isPriceModalOpen}
        onClose={() => !savingModalPrices && setIsPriceModalOpen(false)}
        className="max-w-lg p-6 sm:p-8"
      >
        <div className="flex items-center gap-3 border-b border-gray-100 pb-4 dark:border-gray-800">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
            <PlugInIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Bảng Giá Đa Kênh Cho Món
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {selectedMapping?.productName || selectedMapping?.product?.productName || 'Món'} — Tại cửa hàng: {selectedMapping?.storeName || selectedMapping?.store?.name || 'Chi nhánh'}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-gray-50 p-3.5 dark:bg-gray-800/60">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Giá gốc tại quầy:
            </span>
            <span className="font-bold text-gray-900 dark:text-white">
              {formatCurrency(selectedMapping?.price)}
            </span>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Nhập giá riêng cho từng kênh bên dưới (VNĐ). Nếu để trống hoặc 0, hệ thống sẽ tự động dùng giá gốc tại quầy.
          </p>

          {loadingModalPrices ? (
            <div className="py-6 text-center text-sm text-gray-400">Đang tải bảng giá kênh...</div>
          ) : sourceOrders.length === 0 ? (
            <p className="text-xs italic text-gray-400 py-4">
              Chưa có kênh bán nào được cấu hình cho thương hiệu. Bạn có thể thêm tại mục Thiết Lập Hệ Thống &gt; Kênh bán.
            </p>
          ) : (
            <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1 custom-scrollbar">
              {sourceOrders.map((so) => (
                <div
                  key={so.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-3 shadow-xs dark:border-gray-700 dark:bg-gray-800/80 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {so.name}
                    </p>
                    <span className="inline-block font-mono text-[10px] text-brand-700 bg-brand-50 dark:bg-brand-900/40 dark:text-brand-300 px-2 py-0.5 rounded font-medium border border-brand-100 dark:border-brand-800/50">
                      {so.code}
                    </span>
                  </div>
                  <div className="relative w-44 shrink-0">
                    <input
                      type="number"
                      step="1000"
                      min="0"
                      placeholder="Dùng giá gốc"
                      value={modalPrices[so.id] || ''}
                      onChange={(e) =>
                        setModalPrices({ ...modalPrices, [so.id]: e.target.value })
                      }
                      className="w-full rounded-xl border border-gray-200 bg-gray-50/70 py-2 pl-3 pr-7 text-right text-sm font-semibold text-gray-900 placeholder:text-xs placeholder:text-gray-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-700/60 dark:text-white dark:focus:bg-gray-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-colors"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 pointer-events-none">
                      đ
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              disabled={savingModalPrices}
              onClick={() => setIsPriceModalOpen(false)}
              className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 transition-colors"
            >
              Đóng
            </button>
            <button
              type="button"
              disabled={savingModalPrices || loadingModalPrices}
              onClick={handleSaveQuickPrices}
              className="rounded-xl bg-brand-500 hover:bg-brand-600 active:bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {savingModalPrices ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                'Lưu Bảng Giá'
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
