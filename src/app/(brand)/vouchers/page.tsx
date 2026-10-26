'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import {
  getAdminVouchers,
  generateFloatingVoucher,
  issueVoucherToCustomer,
  batchGenerateVouchers,
  deleteVoucher,
  searchVoucherCustomers,
  AdminVoucherItem,
  BatchGenerateVouchersResult,
} from '@/services/vouchers';
import { getBrands, Brand } from '@/services/brands';
import { DataTable } from '@/components/ui/data-table';
import { SkeletonTable } from '@/components/ui/skeleton-table';
import { Modal } from '@/components/ui/modal';
import { PlusIcon, CopyIcon, TrashBinIcon, CheckCircleIcon } from '@/icons';
import { useAuthStore } from '@/store/authStore';

type ModalTab = 'single' | 'batch';
type VoucherScope = 'floating' | 'customer';

interface SingleVoucherForm {
  brandId: number | '';
  scope: VoucherScope;
  customerId?: number;
  customerName?: string;
  customerPhone?: string;
  code: string;
  rewardType: 1 | 2; // 1 = %, 2 = Amount
  percent: string;
  amount: string;
  maxDiscountAmount: string;
  minOrderAmount: string;
  validityDays: string;
  note: string;
}

const initialSingleForm: SingleVoucherForm = {
  brandId: '',
  scope: 'floating',
  code: '',
  rewardType: 2,
  percent: '15',
  amount: '30000',
  maxDiscountAmount: '50000',
  minOrderAmount: '0',
  validityDays: '30',
  note: '',
};

interface BatchVoucherForm {
  brandId: number | '';
  count: number;
  prefix: string;
  rewardType: 1 | 2;
  percent: string;
  amount: string;
  maxDiscountAmount: string;
  minOrderAmount: string;
  validityDays: string;
  note: string;
}

const initialBatchForm: BatchVoucherForm = {
  brandId: '',
  count: 10,
  prefix: 'VIP',
  rewardType: 1,
  percent: '15',
  amount: '30000',
  maxDiscountAmount: '50000',
  minOrderAmount: '0',
  validityDays: '30',
  note: '',
};

export default function VouchersPage() {
  const { user } = useAuthStore();
  const isAdministrator = user?.role === 'Administrator';
  const userBrandId = user?.brandId ? Number(user.brandId) : null;

  // Brands list
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<number | ''>(
    !isAdministrator && userBrandId ? userBrandId : ''
  );

  // Table & filters state
  const [vouchers, setVouchers] = useState<AdminVoucherItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [rewardTypeFilter, setRewardTypeFilter] = useState<string>('all');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<ModalTab>('single');
  const [singleForm, setSingleForm] = useState<SingleVoucherForm>({
    ...initialSingleForm,
    brandId: !isAdministrator && userBrandId ? userBrandId : '',
  });
  const [batchForm, setBatchForm] = useState<BatchVoucherForm>({
    ...initialBatchForm,
    brandId: !isAdministrator && userBrandId ? userBrandId : '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Customer search state for single modal
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState<any[]>([]);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Batch result state
  const [batchResult, setBatchResult] = useState<BatchGenerateVouchersResult | null>(null);

  // Delete modal state
  const [deletingVoucher, setDeletingVoucher] = useState<AdminVoucherItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Copied code feedback tracking
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Helper to safely get brand Id and Name
  const getBrandId = (b: any): string => String(b?.Id ?? b?.id ?? '');
  const getBrandName = (b: any): string => String(b?.BrandName ?? b?.brandName ?? '');

  // Derived current brand name for non-administrator
  const myBrand = useMemo(() => {
    if (!userBrandId) return null;
    return brands.find((b) => Number(getBrandId(b)) === userBrandId) || null;
  }, [brands, userBrandId]);

  const currentBrandName = useMemo(() => {
    if (isAdministrator) return '';
    return myBrand ? getBrandName(myBrand) : (userBrandId ? `Brand #${userBrandId}` : '');
  }, [isAdministrator, myBrand, userBrandId]);

  // Fetch Brands on mount
  useEffect(() => {
    const loadBrands = async () => {
      try {
        const res = await getBrands(1, 100);
        const list = res?.data?.items || res?.data || [];
        setBrands(list);

        if (!isAdministrator && userBrandId) {
          setSelectedBrandFilter(userBrandId);
          setSingleForm((prev) => ({ ...prev, brandId: userBrandId }));
          setBatchForm((prev) => ({ ...prev, brandId: userBrandId }));
        } else if (list.length > 0) {
          const firstId = Number(getBrandId(list[0]));
          setSingleForm((prev) => ({ ...prev, brandId: prev.brandId || firstId }));
          setBatchForm((prev) => ({ ...prev, brandId: prev.brandId || firstId }));
        }
      } catch (err) {
        console.error('Error loading brands:', err);
      }
    };
    loadBrands();
  }, [isAdministrator, userBrandId]);

  // Debounce search keyword
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedKeyword(keyword);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [keyword]);

  // Fetch Vouchers
  const fetchVouchers = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {
        page,
        size: pageSize,
      };

      const effectiveBrandId = !isAdministrator && userBrandId
        ? userBrandId
        : (selectedBrandFilter !== '' ? selectedBrandFilter : undefined);

      if (effectiveBrandId !== undefined) {
        params.brandId = effectiveBrandId;
      }

      if (debouncedKeyword) params.keyword = debouncedKeyword;
      if (statusFilter !== 'all') params.status = Number(statusFilter);
      if (rewardTypeFilter !== 'all') params.rewardType = Number(rewardTypeFilter);

      const res = await getAdminVouchers(params);
      const data = res?.data?.data || res?.data;
      if (data) {
        setVouchers(data.items || []);
        setTotalItems(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Không thể tải danh sách voucher');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, isAdministrator, userBrandId, selectedBrandFilter, debouncedKeyword, statusFilter, rewardTypeFilter]);

  useEffect(() => {
    fetchVouchers();
  }, [fetchVouchers]);

  // Handle Copy Code
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Đã sao chép mã: ${code}`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Generate random 8-char code
  const generateRandomCode = (prefix = '') => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = prefix ? `${prefix.trim().toUpperCase()}_` : '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // Search Customer debounce
  const handleCustomerSearchChange = (query: string) => {
    setCustomerSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (query.trim().length < 2) {
      setCustomerSearchResults([]);
      return;
    }
    setIsSearchingCustomer(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await searchVoucherCustomers(query.trim());
        setCustomerSearchResults(res?.data || []);
      } catch (err) {
        setCustomerSearchResults([]);
      } finally {
        setIsSearchingCustomer(false);
      }
    }, 500);
  };

  // Submit Single Voucher
  const handleCreateSingleVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetBrandId = !isAdministrator && userBrandId ? userBrandId : Number(singleForm.brandId);
    if (!targetBrandId) {
      toast.error('Vui lòng chọn Thương hiệu');
      return;
    }

    const validityDays = parseInt(singleForm.validityDays, 10) || 30;
    const minOrderAmount = singleForm.minOrderAmount ? parseFloat(singleForm.minOrderAmount) : undefined;
    const cleanCode = singleForm.code.trim().toUpperCase() || undefined;

    let rewardPayload: any = {};
    if (singleForm.rewardType === 1) {
      const pct = parseFloat(singleForm.percent);
      if (!pct || pct <= 0 || pct > 100) {
        toast.error('Phần trăm giảm giá phải từ 1 đến 100%');
        return;
      }
      rewardPayload = {
        rewardType: 1,
        percentageBasisPoints: Math.round(pct * 100),
        maxDiscountAmount: singleForm.maxDiscountAmount ? parseFloat(singleForm.maxDiscountAmount) : undefined,
      };
    } else {
      const amt = parseFloat(singleForm.amount);
      if (!amt || amt <= 0) {
        toast.error('Vui lòng nhập số tiền giảm giá hợp lệ');
        return;
      }
      rewardPayload = {
        rewardType: 2,
        amount: amt,
      };
    }

    setIsSubmitting(true);
    try {
      if (singleForm.scope === 'customer') {
        if (!singleForm.customerId) {
          toast.error('Vui lòng chọn khách hàng để phát voucher');
          setIsSubmitting(false);
          return;
        }
        const res = await issueVoucherToCustomer({
          brandId: targetBrandId,
          customerId: singleForm.customerId,
          code: cleanCode,
          ...rewardPayload,
          minOrderAmount,
          validityDays,
          note: singleForm.note.trim() || undefined,
        });

        const codeCreated = res?.data?.code || res?.data?.Data?.code || cleanCode || 'Thành công';
        toast.success(`🎉 Đã phát voucher "${codeCreated}" trực tiếp vào ví ${singleForm.customerName}!`);
      } else {
        const res = await generateFloatingVoucher({
          brandId: targetBrandId,
          code: cleanCode,
          ...rewardPayload,
          minOrderAmount,
          validityDays,
          note: singleForm.note.trim() || undefined,
        });

        const codeCreated = res?.data?.code || res?.data?.Data?.code || cleanCode || 'Thành công';
        toast.success(`🎉 Tạo mã voucher "${codeCreated}" thành công!`);
      }

      setIsModalOpen(false);
      setSingleForm({
        ...initialSingleForm,
        brandId: !isAdministrator && userBrandId ? userBrandId : '',
      });
      setCustomerSearchQuery('');
      setCustomerSearchResults([]);
      fetchVouchers();
    } catch (err: any) {
      toast.error(err?.message || 'Có lỗi xảy ra khi tạo voucher');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Batch Vouchers
  const handleCreateBatchVouchers = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetBrandId = !isAdministrator && userBrandId ? userBrandId : Number(batchForm.brandId);
    if (!targetBrandId) {
      toast.error('Vui lòng chọn Thương hiệu');
      return;
    }
    if (batchForm.count < 1 || batchForm.count > 500) {
      toast.error('Số lượng mã tạo từ 1 đến 500');
      return;
    }

    const validityDays = parseInt(batchForm.validityDays, 10) || 30;
    const minOrderAmount = batchForm.minOrderAmount ? parseFloat(batchForm.minOrderAmount) : undefined;

    let rewardPayload: any = {};
    if (batchForm.rewardType === 1) {
      const pct = parseFloat(batchForm.percent);
      if (!pct || pct <= 0 || pct > 100) {
        toast.error('Phần trăm giảm giá phải từ 1 đến 100%');
        return;
      }
      rewardPayload = {
        rewardType: 1,
        percentageBasisPoints: Math.round(pct * 100),
        maxDiscountAmount: batchForm.maxDiscountAmount ? parseFloat(batchForm.maxDiscountAmount) : undefined,
      };
    } else {
      const amt = parseFloat(batchForm.amount);
      if (!amt || amt <= 0) {
        toast.error('Vui lòng nhập số tiền giảm giá hợp lệ');
        return;
      }
      rewardPayload = {
        rewardType: 2,
        amount: amt,
      };
    }

    setIsSubmitting(true);
    try {
      const res = await batchGenerateVouchers({
        brandId: targetBrandId,
        count: batchForm.count,
        prefix: batchForm.prefix.trim().toUpperCase() || undefined,
        ...rewardPayload,
        minOrderAmount,
        validityDays,
        note: batchForm.note.trim() || undefined,
      });

      const data = res?.data?.data || res?.data;
      if (data) {
        setBatchResult(data);
        toast.success(`🎉 Đã sinh thành công ${data.count || batchForm.count} mã voucher!`);
        fetchVouchers();
      }
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi khi tạo danh sách voucher hàng loạt');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Voucher
  const handleDeleteVoucher = async () => {
    if (!deletingVoucher) return;
    setIsDeleting(true);
    try {
      await deleteVoucher(deletingVoucher.id);
      toast.success(`Đã hủy/xóa voucher ${deletingVoucher.code}`);
      setDeletingVoucher(null);
      fetchVouchers();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể xóa voucher này');
    } finally {
      setIsDeleting(false);
    }
  };

  // Format date helper
  const formatDate = (val?: string | null) => {
    if (!val) return '—';
    try {
      return new Date(val).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return val;
    }
  };

  // Format currency helper
  const formatCurrency = (val?: number | null) => {
    if (val === undefined || val === null) return '—';
    return Number(val).toLocaleString('vi-VN') + '₫';
  };

  // Status badge helper
  const renderStatusBadge = (item: AdminVoucherItem) => {
    if (item.isExpired || item.status === 5) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40">
          Hết hạn
        </span>
      );
    }
    switch (item.status) {
      case 1:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40">
            Chưa dùng
          </span>
        );
      case 2:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200/60 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/40">
            Đang giữ cho đơn
          </span>
        );
      case 3:
      case 6:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40">
            Đã sử dụng
          </span>
        );
      case 4:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200/60 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40">
            Đã hoàn lại
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {item.statusName}
          </span>
        );
    }
  };

  // Define Table Columns
  const columns = useMemo<ColumnDef<AdminVoucherItem>[]>(() => {
    const list: ColumnDef<AdminVoucherItem>[] = [
      {
        accessorKey: 'code',
        header: 'Mã Voucher',
        cell: ({ row }) => {
          const item = row.original;
          const isCopied = copiedCode === item.code;
          return (
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-gray-900 dark:text-white px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm select-all">
                {item.code}
              </span>
              <button
                type="button"
                onClick={() => handleCopyCode(item.code)}
                title="Sao chép mã"
                className="p-1 rounded text-gray-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-950/50 transition-colors"
              >
                {isCopied ? (
                  <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
                ) : (
                  <CopyIcon className="w-4 h-4" />
                )}
              </button>
            </div>
          );
        },
      },
    ];

    if (isAdministrator) {
      list.push({
        accessorKey: 'brandName',
        header: 'Thương hiệu',
        cell: ({ row }) => (
          <span className="font-medium text-xs text-gray-700 dark:text-gray-300 px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
            {row.original.brandName}
          </span>
        ),
      });
    }

    list.push(
      {
        id: 'reward',
      header: 'Ưu đãi',
      cell: ({ row }) => {
        const item = row.original;
        if (item.rewardType === 1) {
          return (
            <div>
              <span className="font-semibold text-brand-600 dark:text-brand-400">
                Giảm {item.discountPercent || (item.percentageBasisPoints ? item.percentageBasisPoints / 100 : 0)}%
              </span>
              {item.maxDiscountAmount && item.maxDiscountAmount > 0 ? (
                <div className="text-[11px] text-gray-500 dark:text-gray-400">
                  Tối đa {formatCurrency(item.maxDiscountAmount)}
                </div>
              ) : null}
            </div>
          );
        }
        return (
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            Giảm {formatCurrency(item.amount)}
          </span>
        );
      },
    },
    {
      accessorKey: 'minOrderAmount',
      header: 'Đơn tối thiểu',
      cell: ({ row }) => {
        const val = row.original.minOrderAmount;
        if (!val || val <= 0) return <span className="text-gray-400 text-xs">Không yêu cầu</span>;
        return <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{formatCurrency(val)}</span>;
      },
    },
    {
      id: 'owner',
      header: 'Loại / Người nhận',
      cell: ({ row }) => {
        const item = row.original;
        if (item.isFloating) {
          return (
            <span className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/80 px-2 py-0.5 rounded">
              🌐 Mã tự do (Nhập app)
            </span>
          );
        }
        return (
          <div>
            <div className="text-xs font-semibold text-gray-900 dark:text-white">
              👤 {item.customerName || `Khách hàng #${item.customerId}`}
            </div>
            {item.customerPhone ? (
              <div className="text-[11px] text-gray-500">{item.customerPhone}</div>
            ) : null}
          </div>
        );
      },
    },
    {
      id: 'period',
      header: 'Hạn sử dụng',
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="text-xs text-gray-600 dark:text-gray-400">
            <div>Đến: <span className="font-medium text-gray-900 dark:text-gray-100">{formatDate(item.expiresAt)}</span></div>
            <div className="text-[10px] text-gray-400">Tạo: {formatDate(item.issuedAt)}</div>
          </div>
        );
      },
    },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: ({ row }) => renderStatusBadge(row.original),
    },
    {
      id: 'actions',
      header: 'Thao tác',
      cell: ({ row }) => {
        const item = row.original;
        const canDelete = item.status === 0 && !item.isExpired;
        return (
          <div className="flex items-center gap-2">
            {canDelete ? (
              <button
                type="button"
                onClick={() => setDeletingVoucher(item)}
                title="Hủy/Xóa voucher"
                className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
              >
                <TrashBinIcon className="w-4 h-4" />
              </button>
            ) : (
              <span className="text-xs text-gray-400 italic">—</span>
            )}
          </div>
        );
      },
    });

    return list;
  }, [copiedCode, isAdministrator]);

  // Copy all batch codes helper
  const handleCopyAllBatch = () => {
    if (!batchResult?.codes?.length) return;
    navigator.clipboard.writeText(batchResult.codes.join('\n'));
    toast.success(`Đã sao chép ${batchResult.codes.length} mã vào clipboard!`);
  };

  // Download batch codes as .txt
  const handleDownloadBatchTxt = () => {
    if (!batchResult?.codes?.length) return;
    const content = batchResult.codes.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vouchers_${batchResult.brandId}_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            Quản Lý Mã Voucher
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Tạo mã ưu đãi giảm giá, phân phối vào ví khách hàng hoặc phát hành hàng loạt theo chiến dịch.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchVouchers}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-sm disabled:opacity-50"
          >
            Làm mới
          </button>
          <button
            type="button"
            onClick={() => {
              setBatchResult(null);
              if (!isAdministrator && userBrandId) {
                setSingleForm((prev) => ({ ...prev, brandId: userBrandId }));
                setBatchForm((prev) => ({ ...prev, brandId: userBrandId }));
              }
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-lg shadow-sm transition active:scale-[0.98]"
          >
            <PlusIcon className="w-4 h-4" />
            Tạo Voucher Mới
          </button>
        </div>
      </div>

      {/* ── Stats Summary Bento ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Tổng số Voucher</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{totalItems}</div>
          <div className="mt-1 text-[11px] text-gray-400">Tất cả mã voucher</div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Đang hoạt động</div>
          <div className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {vouchers.filter((v) => v.status === 1 && !v.isExpired).length}
          </div>
          <div className="mt-1 text-[11px] text-gray-400">Trang hiện tại</div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-medium text-blue-600 dark:text-blue-400">Đã sử dụng</div>
          <div className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">
            {vouchers.filter((v) => v.status === 3 || v.status === 6).length}
          </div>
          <div className="mt-1 text-[11px] text-gray-400">Trang hiện tại</div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-medium text-amber-600 dark:text-amber-400">Hết hạn / Đã hủy</div>
          <div className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {vouchers.filter((v) => v.isExpired || v.status === 4 || v.status === 5).length}
          </div>
          <div className="mt-1 text-[11px] text-gray-400">Trang hiện tại</div>
        </div>
      </div>

      {/* ── Filter Bar ──────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm">
        <div className={`grid grid-cols-1 ${isAdministrator ? 'sm:grid-cols-2 md:grid-cols-4' : 'sm:grid-cols-3'} gap-3`}>
          {/* Brand selector only for Administrator */}
          {isAdministrator && (
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Thương hiệu
              </label>
              <select
                value={selectedBrandFilter}
                onChange={(e) => {
                  setSelectedBrandFilter(e.target.value ? Number(e.target.value) : '');
                  setPage(1);
                }}
                className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                <option value="">Tất cả thương hiệu</option>
                {brands.map((b) => (
                  <option key={getBrandId(b)} value={getBrandId(b)}>
                    {getBrandName(b)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Search keyword */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tìm kiếm
            </label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Nhập mã, tên khách, số ĐT..."
              className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          {/* Status filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Trạng thái
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="1">Chưa dùng (Khả dụng)</option>
              <option value="2">Đang giữ (Reserved)</option>
              <option value="6">Đã sử dụng (Used)</option>
              <option value="5">Hết hạn (Expired)</option>
              <option value="4">Đã hoàn lại (Released)</option>
            </select>
          </div>

          {/* Reward type filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Loại giảm giá
            </label>
            <select
              value={rewardTypeFilter}
              onChange={(e) => {
                setRewardTypeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
            >
              <option value="all">Tất cả loại ưu đãi</option>
              <option value="1">Giảm phần trăm (%)</option>
              <option value="2">Giảm số tiền (VNĐ)</option>
            </select>
          </div>
        </div>

        {/* Clear filter chip if any active */}
        {((isAdministrator && selectedBrandFilter !== '') || keyword !== '' || statusFilter !== 'all' || rewardTypeFilter !== 'all') && (
          <div className="mt-3 flex items-center justify-end">
            <button
              type="button"
              onClick={() => {
                if (isAdministrator) setSelectedBrandFilter('');
                setKeyword('');
                setStatusFilter('all');
                setRewardTypeFilter('all');
                setPage(1);
              }}
              className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 font-medium hover:underline"
            >
              Xóa bộ lọc
            </button>
          </div>
        )}
      </div>

      {/* ── Table Section ──────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 sm:p-6 shadow-sm">
        {loading ? (
          <SkeletonTable columns={7} rows={8} />
        ) : (
          <DataTable
            columns={columns}
            data={vouchers}
            paginationMode="server"
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
            }}
          />
        )}
      </div>

      {/* ── Modal: Create Voucher (Single & Batch) ───────────────────────── */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          if (!isSubmitting) setIsModalOpen(false);
        }}
        className="max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-4 mb-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Tạo Mã Voucher Ưu Đãi
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Cấp voucher tự do cho khách tự nhập hoặc phát hành hàng loạt theo chiến dịch
            </p>
          </div>
        </div>

        {/* Tabs: Đơn lẻ vs Hàng loạt */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
          <button
            type="button"
            onClick={() => setModalTab('single')}
            className={`py-2.5 px-5 text-sm font-semibold border-b-2 transition-colors ${
              modalTab === 'single'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Tạo Voucher Đơn Lẻ
          </button>
          <button
            type="button"
            onClick={() => setModalTab('batch')}
            className={`py-2.5 px-5 text-sm font-semibold border-b-2 transition-colors ${
              modalTab === 'batch'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Tạo Hàng Loạt (Batch)
          </button>
        </div>

        {/* ── Tab 1: Single Voucher Form ──────────────────────────────── */}
        {modalTab === 'single' && (
          <form onSubmit={handleCreateSingleVoucher} className="space-y-5">
            {/* Brand (only for Administrator) & Scope */}
            {isAdministrator ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Thương hiệu áp dụng <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={singleForm.brandId}
                    onChange={(e) => setSingleForm({ ...singleForm, brandId: Number(e.target.value) })}
                    required
                    className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2.5 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  >
                    <option value="">-- Chọn thương hiệu --</option>
                    {brands.map((b) => (
                      <option key={getBrandId(b)} value={getBrandId(b)}>
                        {getBrandName(b)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Hình thức phát hành
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSingleForm({ ...singleForm, scope: 'floating' })}
                      className={`text-xs font-medium py-2 px-3 rounded-lg border transition ${
                        singleForm.scope === 'floating'
                          ? 'bg-brand-50 border-brand-500 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300'
                          : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      🌐 Mã tự do (Nhập App)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSingleForm({ ...singleForm, scope: 'customer' })}
                      className={`text-xs font-medium py-2 px-3 rounded-lg border transition ${
                        singleForm.scope === 'customer'
                          ? 'bg-brand-50 border-brand-500 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300'
                          : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      👤 Vào ví khách hàng
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Hình thức phát hành
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSingleForm({ ...singleForm, scope: 'floating' })}
                    className={`flex items-center justify-center gap-2 text-xs font-semibold py-2.5 px-4 rounded-xl border transition ${
                      singleForm.scope === 'floating'
                        ? 'bg-brand-50 border-brand-500 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300'
                        : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <span>🌐</span>
                    <span>Mã tự do (Khách tự nhập App)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSingleForm({ ...singleForm, scope: 'customer' })}
                    className={`flex items-center justify-center gap-2 text-xs font-semibold py-2.5 px-4 rounded-xl border transition ${
                      singleForm.scope === 'customer'
                        ? 'bg-brand-50 border-brand-500 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300'
                        : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <span>👤</span>
                    <span>Phát trực tiếp vào ví khách hàng</span>
                  </button>
                </div>
              </div>
            )}

            {/* If Customer Scope: Search customer */}
            {singleForm.scope === 'customer' && (
              <div className="bg-gray-50 dark:bg-gray-800/70 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Tìm kiếm khách hàng mục tiêu <span className="text-rose-500">*</span>
                </label>
                {singleForm.customerId ? (
                  <div className="flex items-center justify-between p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
                      <div>
                        <div className="text-xs font-bold text-gray-900 dark:text-white">
                          {singleForm.customerName}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          SĐT: {singleForm.customerPhone || '—'} (ID: {singleForm.customerId})
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setSingleForm({
                          ...singleForm,
                          customerId: undefined,
                          customerName: undefined,
                          customerPhone: undefined,
                        })
                      }
                      className="text-xs text-rose-500 hover:underline"
                    >
                      Đổi khách hàng
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={customerSearchQuery}
                      onChange={(e) => handleCustomerSearchChange(e.target.value)}
                      placeholder="Gõ ít nhất 2 ký tự tên hoặc số điện thoại..."
                      className="w-full text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                    {isSearchingCustomer && (
                      <div className="absolute right-3 top-2.5 text-xs text-gray-400">Đang tìm...</div>
                    )}
                    {customerSearchResults.length > 0 && (
                      <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                        {customerSearchResults.map((c) => (
                          <div
                            key={c.customerId}
                            onClick={() => {
                              setSingleForm({
                                ...singleForm,
                                customerId: c.customerId,
                                customerName: c.name,
                                customerPhone: c.phone,
                              });
                              setCustomerSearchResults([]);
                              setCustomerSearchQuery('');
                            }}
                            className="p-2.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex justify-between items-center border-b last:border-0 border-gray-100 dark:border-gray-700"
                          >
                            <span className="font-semibold text-gray-900 dark:text-white">{c.name}</span>
                            <span className="text-gray-500">{c.phone}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Voucher Code input + Random button */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Mã Voucher
                </label>
                <button
                  type="button"
                  onClick={() => setSingleForm({ ...singleForm, code: generateRandomCode() })}
                  className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
                >
                  🎲 Tự tạo mã ngẫu nhiên
                </button>
              </div>
              <input
                type="text"
                value={singleForm.code}
                onChange={(e) => setSingleForm({ ...singleForm, code: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                placeholder="VD: CHAOBAN20, COFFEE50 (Để trống để tự tạo)"
                className="w-full font-mono text-sm uppercase rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2.5 tracking-wider focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            {/* Reward Type Selection */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Loại ưu đãi giảm giá <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSingleForm({ ...singleForm, rewardType: 1 })}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition ${
                    singleForm.rewardType === 1
                      ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/30 text-brand-600 dark:text-brand-300'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <span className="text-base font-bold">%</span>
                  <span className="text-xs font-semibold mt-1">Giảm theo % (Phần trăm)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSingleForm({ ...singleForm, rewardType: 2 })}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition ${
                    singleForm.rewardType === 2
                      ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/30 text-brand-600 dark:text-brand-300'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <span className="text-base font-bold">VNĐ</span>
                  <span className="text-xs font-semibold mt-1">Giảm tiền mặt cố định</span>
                </button>
              </div>
            </div>

            {/* Discount values based on rewardType */}
            {singleForm.rewardType === 1 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Phần trăm giảm (%) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={singleForm.percent}
                      onChange={(e) => setSingleForm({ ...singleForm, percent: e.target.value })}
                      placeholder="VD: 15, 20, 50"
                      required
                      className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2.5 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-gray-400">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Giảm tối đa (VNĐ)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={singleForm.maxDiscountAmount}
                    onChange={(e) => setSingleForm({ ...singleForm, maxDiscountAmount: e.target.value })}
                    placeholder="VD: 50000 (Để trống nếu không giới hạn)"
                    className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2.5 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Số tiền giảm (VNĐ) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    value={singleForm.amount}
                    onChange={(e) => setSingleForm({ ...singleForm, amount: e.target.value })}
                    placeholder="VD: 30000, 50000"
                    required
                    className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2.5 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-gray-400">₫</span>
                </div>
              </div>
            )}

            {/* Min order amount & validity days */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Đơn hàng tối thiểu (VNĐ)
                </label>
                <input
                  type="number"
                  min="0"
                  step="5000"
                  value={singleForm.minOrderAmount}
                  onChange={(e) => setSingleForm({ ...singleForm, minOrderAmount: e.target.value })}
                  placeholder="0 = Không yêu cầu"
                  className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2.5 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Thời hạn hiệu lực (Ngày) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={singleForm.validityDays}
                  onChange={(e) => setSingleForm({ ...singleForm, validityDays: e.target.value })}
                  placeholder="VD: 30"
                  required
                  className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2.5 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Note */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Ghi chú / Mục đích phát hành
              </label>
              <input
                type="text"
                value={singleForm.note}
                onChange={(e) => setSingleForm({ ...singleForm, note: e.target.value })}
                placeholder="VD: Tặng khách hàng thân thiết, tri ân sinh nhật..."
                className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            {/* Live Voucher Preview Card */}
            <div className="pt-2">
              <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Xem trước thẻ Voucher
              </div>
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-500 via-indigo-600 to-purple-600 p-4 text-white shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full">
                    {isAdministrator
                      ? (getBrandName(brands.find((b) => getBrandId(b) === String(singleForm.brandId))) || 'Thương hiệu')
                      : 'Voucher'}
                  </span>
                  <span className="text-xs font-mono font-bold tracking-wider bg-black/25 px-2 py-0.5 rounded">
                    {singleForm.code || 'MÃ TỰ TẠO'}
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                    {singleForm.rewardType === 1
                      ? `Giảm ${singleForm.percent || 0}%`
                      : `Giảm ${formatCurrency(Number(singleForm.amount) || 0)}`}
                  </span>
                  {singleForm.rewardType === 1 && singleForm.maxDiscountAmount ? (
                    <span className="text-xs opacity-90">
                      (Tối đa {formatCurrency(Number(singleForm.maxDiscountAmount))})
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] opacity-80 border-t border-white/20 pt-2">
                  <span>
                    {singleForm.minOrderAmount && Number(singleForm.minOrderAmount) > 0
                      ? `Đơn tối thiểu ${formatCurrency(Number(singleForm.minOrderAmount))}`
                      : 'Không yêu cầu đơn tối thiểu'}
                  </span>
                  <span>Hiệu lực {singleForm.validityDays || 30} ngày</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-lg shadow transition disabled:opacity-50"
              >
                {isSubmitting ? 'Đang tạo...' : 'Xác Nhận Tạo Voucher'}
              </button>
            </div>
          </form>
        )}

        {/* ── Tab 2: Batch Generation Form ────────────────────────────── */}
        {modalTab === 'batch' && (
          <form onSubmit={handleCreateBatchVouchers} className="space-y-5">
            {batchResult ? (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircleIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white text-base">
                        Đã sinh thành công {batchResult.codes.length} mã voucher!
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Hạn sử dụng đến: {formatDate(batchResult.expiresAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyAllBatch}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-lg transition"
                    >
                      <CopyIcon className="w-3.5 h-3.5" />
                      Sao chép tất cả
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadBatchTxt}
                      className="px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 transition"
                    >
                      Tải về (.txt)
                    </button>
                  </div>
                </div>

                <div className="max-h-48 overflow-y-auto bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-200 dark:border-gray-800 font-mono text-xs grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {batchResult.codes.map((code) => (
                    <div
                      key={code}
                      onClick={() => handleCopyCode(code)}
                      className="p-1.5 rounded bg-gray-50 dark:bg-gray-800 hover:bg-brand-50 dark:hover:bg-brand-950/50 cursor-pointer flex items-center justify-between group"
                    >
                      <span className="font-bold">{code}</span>
                      <CopyIcon className="w-3 h-3 text-gray-400 group-hover:text-brand-500" />
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBatchResult(null);
                      setIsModalOpen(false);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 transition"
                  >
                    Đóng cửa sổ
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className={isAdministrator ? "grid grid-cols-1 sm:grid-cols-2 gap-4" : ""}>
                  {isAdministrator && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Thương hiệu <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={batchForm.brandId}
                        onChange={(e) => setBatchForm({ ...batchForm, brandId: Number(e.target.value) })}
                        required
                        className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2.5 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      >
                        <option value="">-- Chọn thương hiệu --</option>
                        {brands.map((b) => (
                          <option key={getBrandId(b)} value={getBrandId(b)}>
                            {getBrandName(b)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Số lượng mã cần tạo (1 - 500) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="500"
                      value={batchForm.count}
                      onChange={(e) => setBatchForm({ ...batchForm, count: parseInt(e.target.value, 10) || 1 })}
                      required
                      className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2.5 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Tiền tố mã (Prefix)
                  </label>
                  <input
                    type="text"
                    value={batchForm.prefix}
                    onChange={(e) => setBatchForm({ ...batchForm, prefix: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                    placeholder="VD: SUMMER, T8, FLASH..."
                    className="w-full font-mono text-sm uppercase rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2.5 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Mã sẽ có dạng: <span className="font-mono text-brand-600">{batchForm.prefix || 'CODE'}_XXXXXX</span>
                  </p>
                </div>

                {/* Reward Type Toggle */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Loại ưu đãi áp dụng <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setBatchForm({ ...batchForm, rewardType: 1 })}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition ${
                        batchForm.rewardType === 1
                          ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/30 text-brand-600 dark:text-brand-300'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <span className="text-base font-bold">%</span>
                      <span className="text-xs font-semibold mt-1">Giảm theo % (Phần trăm)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBatchForm({ ...batchForm, rewardType: 2 })}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition ${
                        batchForm.rewardType === 2
                          ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/30 text-brand-600 dark:text-brand-300'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <span className="text-base font-bold">VNĐ</span>
                      <span className="text-xs font-semibold mt-1">Giảm tiền mặt cố định</span>
                    </button>
                  </div>
                </div>

                {batchForm.rewardType === 1 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Phần trăm giảm (%) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={batchForm.percent}
                        onChange={(e) => setBatchForm({ ...batchForm, percent: e.target.value })}
                        required
                        className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2.5 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Giảm tối đa (VNĐ)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={batchForm.maxDiscountAmount}
                        onChange={(e) => setBatchForm({ ...batchForm, maxDiscountAmount: e.target.value })}
                        placeholder="Để trống nếu không giới hạn"
                        className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2.5 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Số tiền giảm (VNĐ) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1000"
                      step="1000"
                      value={batchForm.amount}
                      onChange={(e) => setBatchForm({ ...batchForm, amount: e.target.value })}
                      required
                      className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2.5 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Đơn hàng tối thiểu (VNĐ)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="5000"
                      value={batchForm.minOrderAmount}
                      onChange={(e) => setBatchForm({ ...batchForm, minOrderAmount: e.target.value })}
                      placeholder="0 = Không yêu cầu"
                      className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2.5 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Thời hạn hiệu lực (Ngày) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={batchForm.validityDays}
                      onChange={(e) => setBatchForm({ ...batchForm, validityDays: e.target.value })}
                      required
                      className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2.5 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Ghi chú / Tên chiến dịch
                  </label>
                  <input
                    type="text"
                    value={batchForm.note}
                    onChange={(e) => setBatchForm({ ...batchForm, note: e.target.value })}
                    placeholder="VD: Chiến dịch sinh nhật hè 2026..."
                    className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-lg shadow transition disabled:opacity-50"
                  >
                    {isSubmitting ? 'Đang tạo danh sách mã...' : `Tạo ${batchForm.count} Mã Voucher`}
                  </button>
                </div>
              </>
            )}
          </form>
        )}
      </Modal>

      {/* ── Modal: Delete Confirmation ──────────────────────────────────── */}
      <Modal
        isOpen={!!deletingVoucher}
        onClose={() => !isDeleting && setDeletingVoucher(null)}
        className="max-w-md w-full p-6"
      >
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
            <TrashBinIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Hủy / Xóa Mã Voucher?
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Bạn có chắc muốn hủy mã voucher{' '}
              <span className="font-mono font-bold text-gray-900 dark:text-white">
                {deletingVoucher?.code}
              </span>
              ? Thao tác này sẽ hủy mã và khách hàng sẽ không thể sử dụng nữa.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setDeletingVoucher(null)}
              disabled={isDeleting}
              className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleDeleteVoucher}
              disabled={isDeleting}
              className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow transition disabled:opacity-50"
            >
              {isDeleting ? 'Đang hủy...' : 'Xác Nhận Hủy Mã'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
