'use client';

import React, { useState, useEffect } from 'react';
import { getStores } from '@/services/stores';
import { useAuthStore } from '@/store/authStore';

interface StoreOption {
  id: number;
  name: string;
}

interface CopyStoreMappingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title: string;
  description?: string;
  onCopy: (sourceStoreId: number, targetStoreId: number, overwriteExisting: boolean) => Promise<any>;
}

export default function CopyStoreMappingsModal({
  isOpen,
  onClose,
  onSuccess,
  title,
  description,
  onCopy,
}: CopyStoreMappingsModalProps) {
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [loadingStores, setLoadingStores] = useState<boolean>(false);
  const [sourceStoreId, setSourceStoreId] = useState<string>('');
  const [targetStoreId, setTargetStoreId] = useState<string>('');
  const [overwriteExisting, setOverwriteExisting] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchStoreList();
      setError(null);
      setResultMessage(null);
    }
  }, [isOpen]);

  const fetchStoreList = async () => {
    setLoadingStores(true);
    try {
      const brandId = useAuthStore.getState().user?.brandId;
      const res = await getStores(1, 200, brandId || undefined);
      const items = res.data?.items || res.data || [];
      const storeList = items.map((s: any) => ({
        id: s.id || s.storeId,
        name: s.name || s.shortName || `Cửa hàng #${s.id || s.storeId}`,
      }));
      setStores(storeList);
    } catch (err) {
      console.error('Lỗi khi tải danh sách cửa hàng:', err);
    } finally {
      setLoadingStores(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResultMessage(null);

    const sourceId = Number(sourceStoreId);
    const targetId = Number(targetStoreId);

    if (!sourceId || sourceId <= 0) {
      setError('Vui lòng chọn hoặc nhập ID cửa hàng nguồn.');
      return;
    }
    if (!targetId || targetId <= 0) {
      setError('Vui lòng chọn hoặc nhập ID cửa hàng đích.');
      return;
    }
    if (sourceId === targetId) {
      setError('Cửa hàng nguồn và cửa hàng đích không được trùng nhau.');
      return;
    }

    setLoading(true);
    try {
      const res = await onCopy(sourceId, targetId, overwriteExisting);
      if (res.status === 200 || res.status === 201 || res.status === 0 || !res.status) {
        const msg = res.message || 'Sao chép thành công!';
        const details = res.data
          ? ` (Đã thêm: ${res.data.insertedCount ?? res.data.InsertedCount ?? 0}, Cập nhật: ${res.data.updatedCount ?? res.data.UpdatedCount ?? 0}, Bỏ qua: ${res.data.skippedCount ?? res.data.SkippedCount ?? 0})`
          : '';
        setResultMessage(msg + details);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      } else {
        setError(res.message || 'Có lỗi xảy ra khi sao chép.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Có lỗi hệ thống xảy ra.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 space-y-5 border dark:border-gray-700 animate-fadeIn">
        <div className="flex justify-between items-center border-b dark:border-gray-700 pb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold"
          >
            &times;
          </button>
        </div>

        {description && (
          <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
        )}

        {error && (
          <div className="p-3 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}

        {resultMessage && (
          <div className="p-3 text-sm text-green-700 bg-green-100 rounded-lg dark:bg-green-900/30 dark:text-green-300">
            {resultMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Cửa hàng nguồn (Source Store) *
            </label>
            <select
              value={sourceStoreId}
              onChange={(e) => setSourceStoreId(e.target.value)}
              disabled={loadingStores}
              required
              className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
            >
              <option value="">
                {loadingStores ? 'Đang tải danh sách cửa hàng...' : '-- Chọn cửa hàng nguồn --'}
              </option>
              {stores.map((s) => (
                <option key={`src-${s.id}`} value={s.id}>
                  {s.name} (Mã: #{s.id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Cửa hàng đích (Target Store) *
            </label>
            <select
              value={targetStoreId}
              onChange={(e) => setTargetStoreId(e.target.value)}
              disabled={loadingStores}
              required
              className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
            >
              <option value="">
                {loadingStores ? 'Đang tải danh sách cửa hàng...' : '-- Chọn cửa hàng đích --'}
              </option>
              {stores.map((s) => (
                <option key={`tgt-${s.id}`} value={s.id}>
                  {s.name} (Mã: #{s.id})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="overwriteExisting"
              checked={overwriteExisting}
              onChange={(e) => setOverwriteExisting(e.target.checked)}
              className="w-4 h-4 text-brand-500 rounded border-gray-300 focus:ring-brand-500"
            />
            <label htmlFor="overwriteExisting" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              Ghi đè cấu hình nếu sản phẩm/khuyến mãi đã tồn tại
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? 'Đang sao chép...' : 'Thực hiện sao chép'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
