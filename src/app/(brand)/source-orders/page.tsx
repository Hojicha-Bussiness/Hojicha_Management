'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/modal';
import { SkeletonTable } from '@/components/ui/skeleton-table';
import { useAuthStore } from '@/store/authStore';
import { SourceOrder, CreateSourceOrderPayload, UpdateSourceOrderPayload } from '@/types/sourceOrder';
import {
  createSourceOrder,
  deleteSourceOrder,
  getSourceOrders,
  updateSourceOrder,
} from '@/services/sourceOrders';
import {
  CheckLineIcon,
  CloseLineIcon,
  PencilIcon,
  PlusIcon,
  TrashBinIcon,
  PlugInIcon,
  InfoIcon,
} from '@/icons';

interface FormState {
  code: string;
  name: string;
  icon: string;
  displayOrder: number;
  isActive: boolean;
}

const defaultFormState: FormState = {
  code: '',
  name: '',
  icon: '',
  displayOrder: 0,
  isActive: true,
};

export default function SourceOrdersPage() {
  const { user } = useAuthStore();
  const brandId = user?.brandId ? Number(user.brandId) : undefined;

  const [sources, setSources] = useState<SourceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SourceOrder | null>(null);
  const [formData, setFormData] = useState<FormState>(defaultFormState);
  const [saving, setSaving] = useState(false);

  // Delete Confirm State
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Toggle active busy id
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const fetchSources = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getSourceOrders(brandId);
      if (res && res.data) {
        setSources(res.data);
      }
    } catch (error: any) {
      console.error(error);
      toast.error('Lỗi khi tải danh sách kênh bán', {
        description: error?.message || 'Vui lòng thử lại sau',
      });
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const filteredSources = useMemo(() => {
    return sources.filter((item) => {
      const matchQuery =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.code.toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
          ? item.isActive
          : !item.isActive;

      return matchQuery && matchStatus;
    });
  }, [sources, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const total = sources.length;
    const active = sources.filter((s) => s.isActive).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [sources]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData({
      code: '',
      name: '',
      icon: '',
      displayOrder: sources.length + 1,
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: SourceOrder) => {
    setEditingItem(item);
    setFormData({
      code: item.code,
      name: item.name,
      icon: item.icon || '',
      displayOrder: item.displayOrder,
      isActive: item.isActive,
    });
    setIsModalOpen(true);
  };

  const handleToggleActive = async (item: SourceOrder) => {
    if (togglingId !== null) return;
    setTogglingId(item.id);
    const newStatus = !item.isActive;
    try {
      const payload: UpdateSourceOrderPayload = {
        name: item.name,
        icon: item.icon,
        displayOrder: item.displayOrder,
        isActive: newStatus,
      };
      const res = await updateSourceOrder(item.id, payload);
      if (res.status === 200 || res.status === 204) {
        setSources((prev) =>
          prev.map((s) => (s.id === item.id ? { ...s, isActive: newStatus } : s))
        );
        toast.success(
          `Đã ${newStatus ? 'kích hoạt' : 'tạm ngưng'} kênh bán "${item.name}"`
        );
      } else {
        toast.error('Cập nhật trạng thái thất bại', {
          description: res.message,
        });
      }
    } catch (err: any) {
      toast.error('Lỗi khi đổi trạng thái', {
        description: err?.message,
      });
    } finally {
      setTogglingId(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Vui lòng nhập tên kênh bán');
      return;
    }

    setSaving(true);
    try {
      if (editingItem) {
        const payload: UpdateSourceOrderPayload = {
          name: formData.name.trim(),
          icon: formData.icon.trim() || null,
          displayOrder: Number(formData.displayOrder),
          isActive: formData.isActive,
        };
        const res = await updateSourceOrder(editingItem.id, payload);
        if (res.status === 200 || res.status === 204) {
          toast.success('Cập nhật kênh bán thành công');
          setIsModalOpen(false);
          await fetchSources();
        } else {
          toast.error(res.message || 'Cập nhật thất bại');
        }
      } else {
        if (!formData.code.trim()) {
          toast.error('Vui lòng nhập mã kênh bán');
          setSaving(false);
          return;
        }

        const payload: CreateSourceOrderPayload = {
          code: formData.code.trim().toUpperCase(),
          name: formData.name.trim(),
          icon: formData.icon.trim() || null,
          displayOrder: Number(formData.displayOrder),
          isActive: formData.isActive,
          brandId: brandId || null,
        };
        const res = await createSourceOrder(payload);
        if (res.status === 200 || res.status === 201) {
          toast.success('Tạo kênh bán mới thành công');
          setIsModalOpen(false);
          await fetchSources();
        } else {
          toast.error(res.message || 'Tạo kênh bán thất bại');
        }
      }
    } catch (err: any) {
      toast.error('Lỗi khi lưu kênh bán', {
        description: err?.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      const res = await deleteSourceOrder(deletingId);
      if (res.status === 200 || res.status === 204) {
        toast.success('Xóa kênh bán thành công');
        setIsDeleteModalOpen(false);
        setDeletingId(null);
        await fetchSources();
      } else {
        toast.error(res.message || 'Không thể xóa kênh bán');
      }
    } catch (err: any) {
      toast.error('Lỗi khi xóa kênh bán', {
        description: err?.message,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Kênh Bán Hàng (Nguồn Đơn)
            </h1>
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              Đa kênh & Bảng giá
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Quản lý các nguồn đơn (Tại quầy, Mang đi, Grab, Shopee...) và kích hoạt áp dụng bảng giá riêng theo từng kênh.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <PlusIcon className="h-4 w-4" />
          <span>Thêm Kênh Bán</span>
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            <PlugInIcon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Tổng kênh bán</p>
            <h3 className="mt-0.5 text-2xl font-bold text-gray-900 dark:text-white">
              {stats.total}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400">
            <CheckLineIcon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Đang hoạt động</p>
            <h3 className="mt-0.5 text-2xl font-bold text-gray-900 dark:text-white">
              {stats.active}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            <CloseLineIcon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Tạm ngưng</p>
            <h3 className="mt-0.5 text-2xl font-bold text-gray-900 dark:text-white">
              {stats.inactive}
            </h3>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Tìm theo tên kênh hoặc mã code (GRAB, SHOPEE...)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-gray-50/50 px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800/50 dark:text-white dark:placeholder-gray-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Trạng thái:</span>
          <div className="inline-flex rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
            <button
              onClick={() => setStatusFilter('all')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                statusFilter === 'all'
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                statusFilter === 'active'
                  ? 'bg-white text-green-700 shadow-sm dark:bg-gray-700 dark:text-green-400'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              Hoạt động
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                statusFilter === 'inactive'
                  ? 'bg-white text-red-700 shadow-sm dark:bg-gray-700 dark:text-red-400'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              Tạm ngưng
            </button>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        {loading ? (
          <div className="p-6">
            <SkeletonTable rows={5} columns={6} />
          </div>
        ) : filteredSources.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-800">
              <InfoIcon className="h-8 w-8" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-white">
              Chưa có kênh bán nào
            </h3>
            <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
              {searchQuery
                ? 'Không tìm thấy kênh bán phù hợp với từ khóa.'
                : 'Thêm kênh bán đầu tiên (ví dụ: Tại quầy, Mang đi, GrabFood...) để bắt đầu thiết lập bảng giá.'}
            </p>
            {!searchQuery && (
              <button
                onClick={handleOpenCreate}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90"
              >
                <PlusIcon className="h-4 w-4" />
                <span>Thêm kênh bán</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
              <thead className="border-b border-gray-200 bg-gray-50/75 text-xs font-semibold uppercase tracking-wider text-gray-700 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-300">
                <tr>
                  <th scope="col" className="px-6 py-4">ID</th>
                  <th scope="col" className="px-6 py-4">Mã kênh (Code)</th>
                  <th scope="col" className="px-6 py-4">Tên kênh bán</th>
                  <th scope="col" className="px-6 py-4">Icon / Ghi chú</th>
                  <th scope="col" className="px-6 py-4 text-center">Thứ tự</th>
                  <th scope="col" className="px-6 py-4 text-center">Trạng thái</th>
                  <th scope="col" className="px-6 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredSources.map((item) => (
                  <tr
                    key={item.id}
                    className="transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-800/40"
                  >
                    <td className="px-6 py-4 font-mono text-xs text-gray-400">
                      #{item.id}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1 font-mono text-xs font-semibold text-primary">
                        {item.code}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {item.name}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400">
                      {item.icon ? (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                          {item.icon}
                        </span>
                      ) : (
                        <span className="italic text-gray-400">Mặc định</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center font-medium text-gray-700 dark:text-gray-300">
                      {item.displayOrder}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleToggleActive(item)}
                        disabled={togglingId === item.id}
                        title={item.isActive ? 'Bấm để tạm ngưng' : 'Bấm để kích hoạt'}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                          item.isActive
                            ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400'
                        } ${togglingId === item.id ? 'opacity-50' : ''}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            item.isActive ? 'bg-green-500' : 'bg-red-500'
                          }`}
                        />
                        {item.isActive ? 'Đang bật' : 'Tạm ngưng'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-primary"
                          title="Chỉnh sửa"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setDeletingId(item.id);
                            setIsDeleteModalOpen(true);
                          }}
                          className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                          title="Xóa"
                        >
                          <TrashBinIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Thêm / Chỉnh sửa Kênh bán */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !saving && setIsModalOpen(false)}
        className="max-w-lg p-6 sm:p-8"
      >
        <div className="flex items-center gap-3 border-b border-gray-100 pb-4 dark:border-gray-800">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <PlugInIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {editingItem ? 'Chỉnh Sửa Kênh Bán' : 'Thêm Kênh Bán Mới'}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {editingItem
                ? `Cập nhật thông tin cho kênh ${editingItem.name}`
                : 'Tạo kênh bán mới áp dụng cho các cửa hàng của thương hiệu'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="mt-6 space-y-4">
          {!editingItem && (
            <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-800/40">
              <label className="mb-2 block text-xs font-semibold text-gray-600 dark:text-gray-300">
                Gợi ý mẫu kênh phổ biến (bấm để chọn nhanh):
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { code: 'GRAB', name: 'GrabFood', icon: 'grab' },
                  { code: 'SHOPEE', name: 'ShopeeFood', icon: 'shopee' },
                  { code: 'TAI_QUAY', name: 'Tại quầy', icon: 'store' },
                  { code: 'MANG_DI', name: 'Mang đi', icon: 'takeaway' },
                  { code: 'BAEMIN', name: 'Baemin', icon: 'baemin' },
                  { code: 'TIKTOK', name: 'TikTok Shop', icon: 'tiktok' },
                ].map((preset) => (
                  <button
                    key={preset.code}
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        code: preset.code,
                        name: preset.name,
                        icon: preset.icon,
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 shadow-2xs hover:border-primary hover:bg-primary/5 hover:text-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-primary dark:hover:text-primary transition-all"
                  >
                    <span>+</span> {preset.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-gray-700 dark:text-gray-300">
              Mã Kênh (Code) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={!!editingItem}
              value={formData.code}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  code: e.target.value.toUpperCase().replace(/\s+/g, '_'),
                })
              }
              placeholder="VD: GRAB, SHOPEE, TAI_QUAY, MANG_DI..."
              className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 font-mono text-sm uppercase text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:disabled:bg-gray-800/50"
            />
            {editingItem && (
              <p className="mt-1 text-xs text-gray-400">Mã kênh là định danh cố định không thể sửa đổi sau khi tạo.</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-gray-700 dark:text-gray-300">
              Tên Hiển Thị <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="VD: GrabFood, ShopeeFood, Tại quầy, Mang đi..."
              className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-gray-700 dark:text-gray-300">
                Thứ tự sắp xếp
              </label>
              <input
                type="number"
                min="0"
                value={formData.displayOrder}
                onChange={(e) =>
                  setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })
                }
                className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-gray-700 dark:text-gray-300">
                Icon / Ký hiệu
              </label>
              <input
                type="text"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                placeholder="VD: grab, shopee, store"
                className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-800/40">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                Trạng thái hoạt động
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Cho phép chọn kênh này và áp dụng bảng giá trên POS
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white dark:border-gray-600 dark:bg-gray-700" />
            </label>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => setIsModalOpen(false)}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? 'Đang lưu...' : editingItem ? 'Lưu thay đổi' : 'Tạo kênh mới'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Xác nhận Xóa */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        className="max-w-md p-6"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
            <TrashBinIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Xác nhận xóa kênh bán
            </h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Bạn có chắc chắn muốn xóa kênh bán này? Nếu kênh đã phát sinh bảng giá, hệ thống sẽ tạm ngưng hoạt động kênh thay vì xóa hẳn.
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={() => setIsDeleteModalOpen(false)}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            Hủy
          </button>
          <button
            onClick={confirmDelete}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
          >
            Đồng ý xóa
          </button>
        </div>
      </Modal>
    </div>
  );
}
