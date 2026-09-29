'use client';

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { getStores } from '@/services/stores';
import { getOrders, updateOrder, OrderItem } from '@/services/orders';
import { getPaymentTypesByBrand, PaymentType } from '@/services/paymentTypes';
import { Modal } from '@/components/ui/modal';
import DatePicker from '@/components/form/date-picker';
import { getPresetDateRange } from '@/lib/vietnamDate';
import {
  TaskIcon,
  GridIcon
} from '@/icons';
import { getSourceOrders } from '@/services/sourceOrders';
import { SourceOrder } from '@/types/sourceOrder';

type BrandStore = {
  id?: number;
  storeId?: number;
  name?: string;
  storeName?: string;
};

const STATUS_MAPPINGS: Record<number, { text: string; badgeClass: string }> = {
  8: { text: 'Mới', badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' },
  10: { text: 'Đang xử lý', badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' },
  17: { text: 'POS Đang xử lý', badgeClass: 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700' },
  11: { text: 'POS Hoàn tất', badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' },
  2: { text: 'Hoàn tất', badgeClass: 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700' },
  13: { text: 'POS Hủy', badgeClass: 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' },
  3: { text: 'Đã hủy', badgeClass: 'bg-red-100 text-red-800 border border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700' },
  12: { text: 'POS Hủy trước CB', badgeClass: 'bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-800/80 dark:text-gray-400 dark:border-gray-700' },
  4: { text: 'Hủy trước CB', badgeClass: 'bg-gray-200 text-gray-800 border border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600' },
  18: { text: 'Redeem Thất bại', badgeClass: 'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800' },
};

const ORDER_TYPE_MAPPINGS: Record<number, { text: string; badgeClass: string }> = {
  4: { text: 'Tại quán', badgeClass: 'bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800' },
  5: { text: 'Mang về', badgeClass: 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800' },
  6: { text: 'Giao hàng', badgeClass: 'bg-pink-50 text-pink-700 border border-pink-200 dark:bg-pink-900/30 dark:text-pink-400 dark:border-pink-800' },
  8: { text: 'Thả món (CA)', badgeClass: 'bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-800' },
  1: { text: 'Đặt Online', badgeClass: 'bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800' },
  7: { text: 'Nạp thẻ', badgeClass: 'bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800' },
};

const formatVND = (value: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const getErrorMessage = (err: unknown, fallback: string) => {
  return err instanceof Error ? err.message : fallback;
};

const formatPaymentNames = (order: OrderItem) => {
  return order.payments && order.payments.length > 0
    ? order.payments.map((payment) => payment.name || `Loại ${payment.type}`).join(', ')
    : 'Chưa thanh toán';
};

export default function OrdersPage() {
  const [stores, setStores] = useState<BrandStore[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | ''>('');
  const [storesLoading, setStoresLoading] = useState<boolean>(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<number | ''>('');
  const [typeFilter, setTypeFilter] = useState<number | ''>('');
  const [paymentFilter, setPaymentFilter] = useState<number | ''>('');
  const [sourceFilter, setSourceFilter] = useState<number | ''>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Source Orders for filter and badges
  const [sourceOrders, setSourceOrders] = useState<SourceOrder[]>([]);

  // Payment Types for filter
  const [paymentTypes, setPaymentTypes] = useState<PaymentType[]>([]);
  const [paymentTypesLoading, setPaymentTypesLoading] = useState<boolean>(false);

  // Date filters (defaults: from 7 days ago to today)
  const [fromDate, setFromDate] = useState<string>(() => getPresetDateRange('7-days').fromDate);
  const [toDate, setToDate] = useState<string>(() => getPresetDateRange('7-days').toDate);

  // Pagination
  const [page, setPage] = useState<number>(1);
  const [size, setSize] = useState<number>(20);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);

  // Orders State
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [ordersLoading, setOrdersLoading] = useState<boolean>(false);

  // Selected Order for Detail View
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [selectedStatus, setSelectedStatus] = useState<number | ''>('');
  const [selectedPaymentType, setSelectedPaymentType] = useState<number | ''>('');
  const [isSavingOrder, setIsSavingOrder] = useState<boolean>(false);

  const dateRange = `${fromDate} to ${toDate}`;

  const handleDateRangeChange = React.useCallback((selectedDates: Date[], dateStr: string) => {
    // Only apply when the picker produced a range string or two+ dates.
    if (dateStr.includes(' to ') || selectedDates.length >= 2) {
      const parts = dateStr.split(' to ');
      const from = parts[0];
      const to = parts[1] || parts[0];

      if (from) {
        setFromDate(from);
        setToDate(to || from);
        setPage(1);
      }
    }
  }, []);

  // Fetch brand stores
  useEffect(() => {
    const fetchStores = async () => {
      setStoresLoading(true);
      try {
        const brandId = useAuthStore.getState().user?.brandId;
        const res = await getStores(1, 100, brandId || undefined);
        if (res && res.data) {
          const items = res.data.items || res.data;
          setStores(items);
          if (items.length > 0) {
            setSelectedStoreId(items[0].id || items[0].storeId);
          }
        }
      } catch (err) {
        console.error('Failed to fetch stores:', err);
        toast.error('Không thể tải danh sách cửa hàng');
      } finally {
        setStoresLoading(false);
      }
    };
    fetchStores();
  }, []);

  // Fetch payment types for filter
  useEffect(() => {
    const fetchPaymentTypes = async () => {
      setPaymentTypesLoading(true);
      try {
        const res = await getPaymentTypesByBrand(1, 100);
        if (res && res.data) {
          setPaymentTypes(res.data.items || res.data);
        } else {
          setPaymentTypes([]);
        }
      } catch (err) {
        console.error('Failed to fetch payment types:', err);
        toast.error('Không thể tải danh sách phương thức thanh toán');
      } finally {
        setPaymentTypesLoading(false);
      }
    };
    fetchPaymentTypes();
  }, []);

  // Fetch source orders for filter and badge resolution
  useEffect(() => {
    const fetchSourceOrders = async () => {
      try {
        const brandId = useAuthStore.getState().user?.brandId;
        const res = await getSourceOrders(brandId ? Number(brandId) : undefined);
        if (res && res.data) {
          setSourceOrders(res.data);
        }
      } catch (err) {
        console.error('Failed to fetch source orders:', err);
      }
    };
    fetchSourceOrders();
  }, []);

  const loadOrders = useCallback(async (pageNum: number, pageSize: number) => {
    setOrdersLoading(true);
    try {
      const res = await getOrders(
        Number(selectedStoreId),
        pageNum,
        pageSize,
        statusFilter !== '' ? Number(statusFilter) : null,
        fromDate ? `${fromDate}T00:00:00` : null,
        toDate ? `${toDate}T23:59:59` : null
      );
      if (res && res.data) {
        setOrders(res.data.items || []);
        setTotalPages(res.data.totalPages || 1);
        setTotalItems(res.data.total || 0);
      } else {
        setOrders([]);
        setTotalPages(1);
        setTotalItems(0);
      }
    } catch (err: unknown) {
      console.error('Failed to fetch orders:', err);
      toast.error(getErrorMessage(err, 'Không thể tải danh sách đơn hàng'));
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, [selectedStoreId, statusFilter, fromDate, toDate]);

  useEffect(() => {
    if (selectedStoreId) {
      void loadOrders(page, size);
    }
  }, [selectedStoreId, page, size, loadOrders]);

  // Local filtering by search term (Invoice ID), type filter and payment filter
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesSearch = searchTerm
        ? order.invoiceId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.orderId?.toString().includes(searchTerm)
        : true;
      const matchesType = typeFilter !== '' ? order.orderType === Number(typeFilter) : true;
      const matchesPayment = paymentFilter !== ''
        ? order.payments?.some((payment) => Number(payment.type) === Number(paymentFilter))
        : true;
      const matchesSource = sourceFilter !== ''
        ? (order.sourceId === Number(sourceFilter) || order.sourceType === Number(sourceFilter))
        : true;
      return matchesSearch && matchesType && matchesPayment && matchesSource;
    });
  }, [orders, searchTerm, typeFilter, paymentFilter, sourceFilter]);

  const handleViewDetail = (order: OrderItem) => {
    setSelectedOrder(order);
    setSelectedStatus(order.orderStatus);
    setSelectedPaymentType(order.payments?.[0]?.type ?? '');
    setIsDetailOpen(true);
  };

  const handleUpdateOrder = async () => {
    if (!selectedOrder) return;

    setIsSavingOrder(true);
    try {
      await updateOrder(selectedOrder.orderId, {
        status: selectedStatus !== '' ? Number(selectedStatus) : null,
        paymentType: selectedPaymentType !== '' ? Number(selectedPaymentType) : null,
      });

      toast.success('Đã cập nhật đơn hàng thành công');
      setIsDetailOpen(false);
      setSelectedOrder(null);
      await loadOrders(page, size);
    } catch (err: unknown) {
      console.error('Failed to update order:', err);
      toast.error(getErrorMessage(err, 'Không thể cập nhật đơn hàng'));
    } finally {
      setIsSavingOrder(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-gray-800 dark:text-gray-100">

      {/* ── Header & Title ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-brand-600 to-indigo-600 dark:from-brand-400 dark:to-indigo-400 bg-clip-text text-transparent">
            Quản Lý Đơn Hàng
          </h1>
        </div>
      </div>

      {/* ── Filters Section ──────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 shadow-xl shadow-gray-100/50 dark:shadow-none space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* Store Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Cửa Hàng
            </label>
            <select
              value={selectedStoreId}
              onChange={(e) => {
                setSelectedStoreId(e.target.value ? Number(e.target.value) : '');
                setPage(1);
              }}
              disabled={storesLoading}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all outline-none disabled:opacity-50"
            >
              {storesLoading ? (
                <option value="">Đang tải cửa hàng...</option>
              ) : (
                <>
                  <option value="" disabled>-- Chọn cửa hàng --</option>
                  {stores.map((s) => (
                    <option key={s.id || s.storeId} value={s.id || s.storeId}>
                      {s.name || s.storeName}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Trạng Thái Đơn Hàng
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value !== '' ? Number(e.target.value) : '');
                setPage(1);
              }}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all outline-none"
            >
              <option value="">Tất cả trạng thái</option>
              {Object.entries(STATUS_MAPPINGS).map(([code, config]) => (
                <option key={code} value={code}>
                  {config.text}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Loại Hóa Đơn
            </label>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value !== '' ? Number(e.target.value) : '');
              }}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all outline-none"
            >
              <option value="">Tất cả loại hình</option>
              {Object.entries(ORDER_TYPE_MAPPINGS).map(([code, config]) => (
                <option key={code} value={code}>
                  {config.text}
                </option>
              ))}
            </select>
          </div>

          {/* Source Order Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Nguồn Đơn (Kênh)
            </label>
            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value !== '' ? Number(e.target.value) : '');
                setPage(1);
              }}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all outline-none"
            >
              <option value="">Tất cả kênh bán</option>
              {sourceOrders.map((so) => (
                <option key={so.id} value={so.id}>
                  {so.name} ({so.code})
                </option>
              ))}
            </select>
          </div>

          {/* Payment Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Thanh Toán
            </label>
            <select
              value={paymentFilter}
              onChange={(e) => {
                setPaymentFilter(e.target.value !== '' ? Number(e.target.value) : '');
              }}
              disabled={paymentTypesLoading}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all outline-none disabled:opacity-50"
            >
              <option value="">
                {paymentTypesLoading ? 'Đang tải...' : 'Tất cả thanh toán'}
              </option>
              {paymentTypes.map((pt) => {
                const ptId = pt.id ?? pt.paymentTypeId;
                return (
                  <option key={ptId} value={ptId}>
                    {pt.name || `Loại ${ptId}`}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Date Picker */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Khoảng Thời Gian
            </label>
            <DatePicker
              id="orders-date-range"
              mode="range"
              defaultDate={dateRange}
              onChange={handleDateRangeChange}
            />
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-2 border-t border-gray-100 dark:border-gray-800/80">
          {/* Text Search */}
          <div className="w-full md:w-72 flex items-center gap-2">
            <input
              type="text"
              placeholder="Tìm theo Mã Hóa Đơn hoặc ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Hiển thị</span>
            <select
              value={size}
              onChange={(e) => {
                const nextSize = Number(e.target.value);
                setSize(nextSize);
                setPage(1);
                if (selectedStoreId) {
                  void loadOrders(1, nextSize);
                }
              }}
              className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 outline-none focus:border-brand-500 dark:bg-gray-800"
            >
              <option value={10}>10 dòng</option>
              <option value={20}>20 dòng</option>
              <option value={50}>50 dòng</option>
              <option value={100}>100 dòng</option>
            </select>
            <span>trong tổng số <b>{totalItems}</b> đơn hàng</span>
          </div>
        </div>
      </div>

      {/* ── Order List Table ─────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl shadow-gray-100/50 dark:shadow-none overflow-hidden">
        {ordersLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-600"></div>
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Đang tải danh sách đơn hàng...</p>
          </div>
        ) : !selectedStoreId ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="h-16 w-16 bg-amber-50 dark:bg-amber-900/20 text-amber-500 rounded-full flex items-center justify-center mb-4">
              <GridIcon className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300">Vui lòng chọn cửa hàng</h3>
            <p className="text-sm text-gray-400 max-w-sm mt-1">Chọn một cửa hàng trong hệ thống để tải danh sách lịch sử đơn hàng chi tiết.</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="h-16 w-16 bg-gray-50 dark:bg-gray-800/80 text-gray-400 rounded-full flex items-center justify-center mb-4">
              <TaskIcon className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300">Không tìm thấy đơn hàng nào</h3>
            <p className="text-sm text-gray-400 max-w-sm mt-1">Không có đơn hàng nào khớp với bộ lọc hoặc khoảng thời gian bạn đã chọn.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-sm">
              <thead className="bg-[#00a651] text-white">
                <tr>
                  <th className="px-4 py-3.5 text-center font-semibold border-r border-[#009045]">STT</th>
                  <th className="px-4 py-3.5 text-left font-semibold border-r border-[#009045]">Mã Hóa Đơn</th>
                  <th className="px-4 py-3.5 text-center font-semibold border-r border-[#009045]">Loại Đơn</th>
                  <th className="px-4 py-3.5 text-center font-semibold border-r border-[#009045]">Nguồn Đơn</th>
                  <th className="px-4 py-3.5 text-center font-semibold border-r border-[#009045]">Trạng Thái</th>
                  <th className="px-4 py-3.5 text-left font-semibold border-r border-[#009045]">Thanh Toán</th>
                  <th className="px-4 py-3.5 text-left font-semibold border-r border-[#009045]">Thời Gian Đặt</th>
                  <th className="px-4 py-3.5 text-center font-semibold border-r border-[#009045]">Số Sản Phẩm</th>
                  <th className="px-4 py-3.5 text-right font-semibold border-r border-[#009045]">Tổng Cộng</th>
                  <th className="px-4 py-3.5 text-right font-semibold border-r border-[#009045]">Chiết Khấu</th>
                  <th className="px-4 py-3.5 text-right font-semibold border-r border-[#009045]">Thực Thu</th>
                  <th className="px-4 py-3.5 text-center font-semibold">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                {filteredOrders.map((order, index) => {
                  const statusConf = STATUS_MAPPINGS[order.orderStatus] || { text: 'Không xác định', badgeClass: 'bg-gray-100 text-gray-600' };
                  const typeConf = ORDER_TYPE_MAPPINGS[order.orderType] || { text: 'Khác', badgeClass: 'bg-gray-100 text-gray-600' };

                  return (
                    <tr key={order.orderId} className="hover:bg-gray-50/55 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 text-center text-gray-400 border-r dark:border-gray-800">
                        {(page - 1) * size + index + 1}
                      </td>
                      <td className="px-4 py-3 font-semibold text-brand-600 dark:text-brand-400 border-r dark:border-gray-800">
                        {order.invoiceId || `#${order.orderId}`}
                      </td>
                      <td className="px-4 py-3 text-center border-r dark:border-gray-800">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${typeConf.badgeClass}`}>
                          {typeConf.text}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center border-r dark:border-gray-800">
                        {(() => {
                          const matchedSource = sourceOrders.find(
                            (s) => s.id === order.sourceId || s.id === order.sourceType
                          );
                          const sourceName = matchedSource?.name || order.sourceName || 'Tại quầy';
                          const code = matchedSource?.code?.toUpperCase() || '';

                          let badgeStyle = 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
                          if (code.includes('GRAB') || sourceName.toLowerCase().includes('grab')) {
                            badgeStyle = 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800';
                          } else if (code.includes('SHOPEE') || sourceName.toLowerCase().includes('shopee')) {
                            badgeStyle = 'bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800';
                          } else if (code.includes('MANG_DI') || sourceName.toLowerCase().includes('mang đi') || sourceName.toLowerCase().includes('mang về')) {
                            badgeStyle = 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800';
                          }

                          return (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${badgeStyle}`}>
                              {sourceName}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-center border-r dark:border-gray-800">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusConf.badgeClass}`}>
                          {statusConf.text}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-left border-r dark:border-gray-800 text-gray-700 dark:text-gray-300 font-medium">
                        {formatPaymentNames(order)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 border-r dark:border-gray-800">
                        {formatDate(order.checkInDate)}
                      </td>
                      <td className="px-4 py-3 text-center font-medium border-r dark:border-gray-800 text-gray-700 dark:text-gray-300">
                        {order.itemCount}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400 border-r dark:border-gray-800 font-medium">
                        {formatVND(order.totalAmount)}
                      </td>
                      <td className="px-4 py-3 text-right text-red-500 border-r dark:border-gray-800 font-medium">
                        {order.discount > 0 ? `-${formatVND(order.discount)}` : formatVND(0)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100 font-extrabold border-r dark:border-gray-800">
                        {formatVND(order.finalAmount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleViewDetail(order)}
                          className="bg-emerald-50 hover:bg-[#00a651] hover:text-white dark:bg-emerald-950/20 text-emerald-600 border border-emerald-200 dark:border-emerald-900 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
                        >
                          Chi tiết
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Table Footer / Pagination ─────────────────────────────── */}
        {!ordersLoading && filteredOrders.length > 0 && (
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-gray-100 dark:border-gray-800/80 bg-gray-50/50 dark:bg-gray-800/20">
            <span className="text-sm text-gray-500">
              Trang <b>{page}</b> / <b>{totalPages}</b>
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const nextPage = Math.max(page - 1, 1);
                  setPage(nextPage);
                  void loadOrders(nextPage, size);
                }}
                disabled={page === 1}
                className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg px-3.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Trang Trước
              </button>
              <button
                onClick={() => {
                  const nextPage = Math.min(page + 1, totalPages);
                  setPage(nextPage);
                  void loadOrders(nextPage, size);
                }}
                disabled={page === totalPages}
                className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg px-3.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Trang Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Order Detail Modal ────────────────────────────────────── */}
      <Modal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        className="max-w-3xl w-full p-6"
      >
        {selectedOrder && (
          <div className="space-y-6">
            {/* Modal Title */}
            <div className="border-b border-gray-100 dark:border-gray-800 pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-gray-900 dark:text-gray-100">
                  Chi Tiết Đơn Hàng: {selectedOrder.invoiceId || `#${selectedOrder.orderId}`}
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  ID Hệ Thống: <b>{selectedOrder.orderId}</b> | Thời gian: <b>{formatDate(selectedOrder.checkInDate)}</b>
                </p>
              </div>
            </div>

            {/* Main Info Blocks */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
              <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800/80 rounded-xl p-3.5 flex flex-col gap-1">
                <span className="text-2xs font-bold text-gray-400 uppercase tracking-wide">Trạng Thái</span>
                <span className={`inline-flex self-start items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${STATUS_MAPPINGS[selectedOrder.orderStatus]?.badgeClass}`}>
                  {STATUS_MAPPINGS[selectedOrder.orderStatus]?.text || 'Không xác định'}
                </span>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800/80 rounded-xl p-3.5 flex flex-col gap-1">
                <span className="text-2xs font-bold text-gray-400 uppercase tracking-wide">Loại Hình</span>
                <span className={`inline-flex self-start items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${ORDER_TYPE_MAPPINGS[selectedOrder.orderType]?.badgeClass}`}>
                  {ORDER_TYPE_MAPPINGS[selectedOrder.orderType]?.text || 'Khác'}
                </span>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800/80 rounded-xl p-3.5 flex flex-col gap-1">
                <span className="text-2xs font-bold text-gray-400 uppercase tracking-wide">Nguồn Đơn</span>
                <span className="text-xs font-bold text-primary truncate">
                  {sourceOrders.find((s) => s.id === selectedOrder.sourceId || s.id === selectedOrder.sourceType)?.name || selectedOrder.sourceName || 'Tại quầy'}
                </span>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800/80 rounded-xl p-3.5 flex flex-col gap-1">
                <span className="text-2xs font-bold text-gray-400 uppercase tracking-wide">Thanh Toán</span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 truncate">
                  {formatPaymentNames(selectedOrder)}
                </span>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800/80 rounded-xl p-3.5 flex flex-col gap-1">
                <span className="text-2xs font-bold text-gray-400 uppercase tracking-wide">Ghi Chú Đơn</span>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                  {selectedOrder.notes || '(Không ghi chú)'}
                </span>
              </div>
            </div>

            {/* Update Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800/80 rounded-xl p-4 space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Cập Nhật Trạng Thái
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value !== '' ? Number(e.target.value) : '')}
                  className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                >
                  {Object.entries(STATUS_MAPPINGS).map(([code, config]) => (
                    <option key={code} value={code}>
                      {config.text}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800/80 rounded-xl p-4 space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Phương Thức Thanh Toán
                </label>
                <select
                  value={selectedPaymentType}
                  onChange={(e) => setSelectedPaymentType(e.target.value !== '' ? Number(e.target.value) : '')}
                  className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                  disabled={paymentTypesLoading}
                >
                  <option value="">-- Chọn phương thức thanh toán --</option>
                  {paymentTypes.map((paymentType) => {
                    const paymentTypeId = paymentType.id ?? paymentType.paymentTypeId;
                    return (
                      <option key={paymentTypeId} value={paymentTypeId}>
                        {paymentType.name || `Loại ${paymentTypeId}`}
                      </option>
                    );
                  })}
                </select>
                {paymentTypesLoading && (
                  <p className="text-xs text-gray-400">Đang tải danh sách phương thức thanh toán...</p>
                )}
              </div>
            </div>

            {/* Product Details Table */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Danh Sách Món Ăn & Sản Phẩm ({selectedOrder.orderDetails?.length || 0})
              </h3>
              <div className="overflow-x-auto border border-gray-100 dark:border-gray-800 rounded-xl">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                    <tr>
                      <th className="px-4 py-2.5 text-center font-bold">STT</th>
                      <th className="px-4 py-2.5 text-left font-bold">Tên Món</th>
                      <th className="px-4 py-2.5 text-center font-bold">Loại</th>
                      <th className="px-4 py-2.5 text-center font-bold">Số Lượng</th>
                      <th className="px-4 py-2.5 text-right font-bold">Đơn Giá</th>
                      <th className="px-4 py-2.5 text-right font-bold">Thành Tiền</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                    {selectedOrder.orderDetails?.map((detail, index) => (
                      <tr key={detail.orderDetailId} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                        <td className="px-4 py-2 text-center text-gray-400 font-medium">{index + 1}</td>
                        <td className="px-4 py-2 font-bold text-gray-800 dark:text-gray-200">{detail.productName}</td>
                        <td className="px-4 py-2 text-center">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${detail.isAddition ? 'bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-950/20' : 'bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950/20'}`}>
                            {detail.isAddition ? 'Kèm/Món thêm' : 'Món chính'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center font-extrabold text-gray-700 dark:text-gray-300">{detail.quantity}</td>
                        <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400 font-medium">{formatVND(detail.unitPrice)}</td>
                        <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100 font-extrabold">{formatVND(detail.finalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Calculations and Totals */}
            <div className="bg-gray-50 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800/80 rounded-2xl p-4 flex flex-col gap-2 max-w-sm ml-auto">
              <div className="flex justify-between items-center text-xs text-gray-500">
                <span>Tổng Tiền Món:</span>
                <span className="font-semibold text-gray-700 dark:text-gray-300">{formatVND(selectedOrder.totalAmount)}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-red-500">
                <span>Chiết Khấu/Giảm Giá:</span>
                <span className="font-semibold">{selectedOrder.discount > 0 ? `-${formatVND(selectedOrder.discount)}` : formatVND(0)}</span>
              </div>
              <div className="h-px bg-gray-200 dark:bg-gray-800 my-1"></div>
              <div className="flex justify-between items-center text-sm font-extrabold text-gray-900 dark:text-gray-100">
                <span>Thực Thu (Payable):</span>
                <span className="text-brand-600 dark:text-brand-400 text-base">{formatVND(selectedOrder.finalAmount)}</span>
              </div>
            </div>

            {/* Close action */}
            <div className="flex justify-end pt-3 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsDetailOpen(false)}
                  className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl px-5 py-2.5 text-xs transition-all"
                >
                  Đóng
                </button>
                <button
                  onClick={handleUpdateOrder}
                  disabled={isSavingOrder || selectedStatus === ''}
                  className="bg-[#00a651] hover:bg-[#008d46] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl px-5 py-2.5 text-xs transition-all"
                >
                  {isSavingOrder ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
