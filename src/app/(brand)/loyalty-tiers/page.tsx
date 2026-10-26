'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/modal';
import { SkeletonTable } from '@/components/ui/skeleton-table';
import { useAuthStore } from '@/store/authStore';
import {
  BrandLoyaltyTier,
  BrandLoyaltyTierPayload,
  createBrandLoyaltyTier,
  deleteBrandLoyaltyTier,
  getBrandLoyaltyTiers,
  updateBrandLoyaltyTier,
  uploadTierImage,
} from '@/services/loyaltyTiers';
import { getLoyaltyRewardPolicies, type LoyaltyRewardPolicy } from '@/services/loyaltyRewards';
import { getBrandProducts } from '@/services/loyaltyProducts';
import { optimizeImageForUpload } from '@/services/imageOptimizer';
import { RewardPolicyEditor } from './components/RewardPolicyEditor';
import { TierPreviewCard } from './components/TierPreviewCard';
import { TierImageEditor } from './components/TierImageEditor';
import type { LoyaltyProductOption } from '@/services/loyaltyProductContracts';
import {
  CheckLineIcon,
  CloseLineIcon,
  GridIcon,
  PencilIcon,
  PlusIcon,
  ShootingStarIcon,
  TableIcon,
  TrashBinIcon,
  DollarLineIcon,
  BoxCubeIcon,
  TaskIcon,
} from '@/icons';

type TierFormState = {
  tierName: string;
  minSpend: string;
  earnMultiplier: string;
  stampThreshold: string;
  freeUpsize: string;
  monthlyVoucherCount: string;
  birthdayReward: string;
  upgradeRewardDescription: string;
  sortOrder: string;
  active: boolean;
};

type TierActionsProps = {
  tier: BrandLoyaltyTier;
  busy: boolean;
  onEdit: (tier: BrandLoyaltyTier) => void;
  onToggle: (tier: BrandLoyaltyTier) => void;
  onDeactivate: (tier: BrandLoyaltyTier) => void;
};

type RequestError = {
  message?: unknown;
  data?: {
    message?: unknown;
  };
};

const emptyForm: TierFormState = {
  tierName: '',
  minSpend: '0',
  earnMultiplier: '1',
  stampThreshold: '9',
  freeUpsize: '0',
  monthlyVoucherCount: '0',
  birthdayReward: '',
  upgradeRewardDescription: '',
  sortOrder: '0',
  active: true,
};

const inputClass =
  'mt-1.5 block min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-theme-sm text-gray-900 shadow-theme-xs transition placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-brand-400 dark:disabled:bg-gray-800/60';

const labelClass = 'text-theme-sm font-medium text-gray-700 dark:text-gray-300';

const formatVnd = (value: number) =>
  `${new Intl.NumberFormat('vi-VN').format(Math.round(value))}₫`;

const getTierForm = (tier?: BrandLoyaltyTier): TierFormState => {
  if (!tier) return { ...emptyForm };

  return {
    tierName: tier.tierName,
    minSpend: String(tier.minSpend),
    earnMultiplier: String(tier.earnMultiplier),
    stampThreshold: String(tier.stampThreshold),
    freeUpsize: String(tier.freeUpsize),
    monthlyVoucherCount: String(tier.monthlyVoucherCount),
    birthdayReward: tier.birthdayReward ?? '',
    upgradeRewardDescription: tier.upgradeRewardDescription ?? '',
    sortOrder: String(tier.sortOrder),
    active: tier.active,
  };
};

const toPayload = (form: TierFormState): BrandLoyaltyTierPayload => ({
  tierName: form.tierName.trim(),
  minSpend: Number(form.minSpend),
  earnMultiplier: Number(form.earnMultiplier),
  stampThreshold: Number(form.stampThreshold),
  freeUpsize: Number(form.freeUpsize),
  monthlyVoucherCount: Number(form.monthlyVoucherCount),
  birthdayReward: form.birthdayReward.trim() || null,
  upgradeRewardDescription: form.upgradeRewardDescription.trim() || null,
  sortOrder: Number(form.sortOrder),
  active: form.active,
});

const tierToPayload = (tier: BrandLoyaltyTier, active: boolean) => ({
  tierName: tier.tierName,
  minSpend: tier.minSpend,
  earnMultiplier: tier.earnMultiplier,
  stampThreshold: tier.stampThreshold,
  freeUpsize: tier.freeUpsize,
  monthlyVoucherCount: tier.monthlyVoucherCount,
  birthdayReward: tier.birthdayReward ?? null,
  upgradeRewardDescription: tier.upgradeRewardDescription ?? null,
  sortOrder: tier.sortOrder,
  active,
});

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === 'object' && error !== null) {
    const requestError = error as RequestError;
    if (typeof requestError.data?.message === 'string')
      return requestError.data.message;
    if (typeof requestError.message === 'string') return requestError.message;
  }
  return fallback;
};

function TierActions({
  tier,
  busy,
  onEdit,
  onToggle,
  onDeactivate,
}: TierActionsProps) {
  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={() => onEdit(tier)}
        disabled={busy}
        aria-label={`Sửa ${tier.tierName}`}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-theme-sm font-medium text-brand-500 transition hover:bg-brand-50 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:cursor-not-allowed disabled:opacity-50 dark:text-brand-400 dark:hover:bg-brand-500/10"
      >
        <PencilIcon className="w-4 h-4 shrink-0" />
        <span className="hidden sm:inline">Sửa</span>
      </button>

      {/* CÔNG TẮC BẬT / TẮT (TOGGLE SWITCH) */}
      <button
        type="button"
        role="switch"
        aria-checked={tier.active}
        onClick={() => onToggle(tier)}
        disabled={busy}
        title={tier.active ? 'Đang áp dụng (Bấm để tắt)' : 'Đã tạm ẩn (Bấm để bật)'}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-50 ${
          tier.active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
            tier.active ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>

      {tier.active && (
        <button
          type="button"
          onClick={() => onDeactivate(tier)}
          disabled={busy}
          aria-label={`Vô hiệu hóa ${tier.tierName}`}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-theme-sm font-medium text-error-500 transition hover:bg-error-50 hover:text-error-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error-500/40 disabled:cursor-not-allowed disabled:opacity-50 dark:text-error-400 dark:hover:bg-error-500/10"
        >
          <TrashBinIcon className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">Xóa</span>
        </button>
      )}
    </div>
  );
}

export default function LoyaltyTiersPage() {
  const { user, isHydrated } = useAuthStore();
  const brandId = user?.brandId ?? null;
  const [tiers, setTiers] = useState<BrandLoyaltyTier[]>([]);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<BrandLoyaltyTier | null>(null);
  const [tierImageFile, setTierImageFile] = useState<File | null>(null);
  const [tierBadgeFile, setTierBadgeFile] = useState<File | null>(null);
  const [removeTierImage, setRemoveTierImage] = useState(false);
  const [removeTierBadgeImage, setRemoveTierBadgeImage] = useState(false);
  const [form, setForm] = useState<TierFormState>({ ...emptyForm });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [policies, setPolicies] = useState<LoyaltyRewardPolicy[]>([]);
  const [products, setProducts] = useState<LoyaltyProductOption[]>([]);
  const [loadingConfiguration, setLoadingConfiguration] = useState(true);
  const [configurationError, setConfigurationError] = useState('');

  const fetchTiers = useCallback(async () => {
    if (!brandId) {
      setTiers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError('');
    try {
      const response = await getBrandLoyaltyTiers();
      setTiers(Array.isArray(response.data) ? response.data : []);
    } catch (error: unknown) {
      setLoadError(getErrorMessage(error, 'Không thể tải danh sách bậc hạng.'));
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  const fetchConfiguration = useCallback(async () => {
    if (!brandId) {
      setPolicies([]);
      setProducts([]);
      setLoadingConfiguration(false);
      return;
    }

    setLoadingConfiguration(true);
    setConfigurationError('');
    const [policyResult, productResult] = await Promise.allSettled([
      getLoyaltyRewardPolicies(),
      getBrandProducts(),
    ]);
    const errors: string[] = [];

    if (policyResult.status === 'fulfilled')
      setPolicies(
        Array.isArray(policyResult.value.data) ? policyResult.value.data : [],
      );
    else errors.push('Không thể tải policy quyền lợi.');
    if (productResult.status === 'fulfilled')
      setProducts(productResult.value);
    else errors.push('Không thể tải sản phẩm của thương hiệu.');

    setConfigurationError(errors.join(' '));
    setLoadingConfiguration(false);
  }, [brandId]);

  useEffect(() => {
    if (isHydrated) void fetchTiers();
  }, [fetchTiers, isHydrated]);

  useEffect(() => {
    if (isHydrated) void fetchConfiguration();
  }, [fetchConfiguration, isHydrated]);

  const activeCount = useMemo(
    () => tiers.filter((tier) => tier.active).length,
    [tiers],
  );

  const openCreateModal = () => {
    setTierImageFile(null);
    setTierBadgeFile(null);
    setRemoveTierImage(false);
    setRemoveTierBadgeImage(false);
    setEditingTier(null);
    setForm({ ...emptyForm, sortOrder: String((tiers.length + 1) * 10) });
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (tier: BrandLoyaltyTier) => {
    setTierImageFile(null);
    setTierBadgeFile(null);
    setRemoveTierImage(false);
    setRemoveTierBadgeImage(false);
    setEditingTier(tier);
    setForm(getTierForm(tier));
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setIsModalOpen(false);
    setFormError('');
  };

  const [selectedPolicyTierId, setSelectedPolicyTierId] = useState<number | null>(null);

  const activeTiers = useMemo(() => tiers.filter((t) => t.active), [tiers]);

  const activeSelectedTier = useMemo(() => {
    if (selectedPolicyTierId) {
      const found = activeTiers.find((t) => t.id === selectedPolicyTierId);
      if (found) return found;
    }
    return activeTiers[0] ?? null;
  }, [activeTiers, selectedPolicyTierId]);

  const handleConfigurePolicyScroll = (tier: BrandLoyaltyTier) => {
    setSelectedPolicyTierId(tier.id);
    const heading = document.getElementById('reward-policy-heading');
    heading?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const validateForm = () => {
    const minSpend = Number(form.minSpend);
    const multiplier = Number(form.earnMultiplier);
    const stampThreshold = Number(form.stampThreshold);
    const freeUpsize = Number(form.freeUpsize);
    const monthlyVoucherCount = Number(form.monthlyVoucherCount);
    const sortOrder = Number(form.sortOrder);

    if (!form.tierName.trim()) return 'Vui lòng nhập tên bậc hạng.';
    if (!Number.isFinite(minSpend) || minSpend < 0)
      return 'Mức chi tiêu phải là số không âm.';
    if (!Number.isFinite(multiplier) || multiplier <= 0)
      return 'Hệ số tích điểm phải lớn hơn 0.';
    if (!Number.isInteger(stampThreshold) || stampThreshold <= 0)
      return 'Ngưỡng tem phải là số nguyên lớn hơn 0.';
    if (!Number.isInteger(freeUpsize) || freeUpsize < 0)
      return 'Free Upsize phải là số nguyên không âm.';
    if (!Number.isInteger(monthlyVoucherCount) || monthlyVoucherCount < 0)
      return 'Voucher tháng phải là số nguyên không âm.';
    if (!Number.isInteger(sortOrder) || sortOrder < 0)
      return 'Thứ tự sắp xếp phải là số nguyên không âm.';
    return '';
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!brandId) {
      setFormError('Không xác định được thương hiệu hiện tại.');
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSubmitting(true);
    setFormError('');
    const wasEditing = Boolean(editingTier);
    try {
      const payload = toPayload(form);
      const response = editingTier
        ? await updateBrandLoyaltyTier(editingTier.id, payload)
        : await createBrandLoyaltyTier(payload);

      if (response.status !== 200 && response.status !== 201) {
        throw new Error(response.message || 'Không thể lưu bậc hạng.');
      }

      const savedTier = response.data ?? editingTier;
      if (savedTier) {
        setEditingTier(savedTier);
      }

      const hasArtworkChanges = Boolean(
        tierImageFile ||
          tierBadgeFile ||
          removeTierImage ||
          removeTierBadgeImage,
      );

      if (savedTier && hasArtworkChanges) {
        try {
          const optimizedCard = tierImageFile
            ? await optimizeImageForUpload(tierImageFile, { preset: 'card' })
            : null;
          const optimizedBadge = tierBadgeFile
            ? await optimizeImageForUpload(tierBadgeFile, { preset: 'badge' })
            : null;

          const imageResponse = await uploadTierImage(
            savedTier.id,
            optimizedCard,
            {
              badgeImage: optimizedBadge,
              removeImage: removeTierImage,
              removeBadgeImage: removeTierBadgeImage,
            },
          );
          if (imageResponse.status !== 200) {
            throw new Error(
              imageResponse.message ||
                'Đã lưu thông tin bậc hạng nhưng chưa tải được ảnh hạng. Bấm Lưu thay đổi để thử lại phần ảnh.',
            );
          }
          setTierImageFile(null);
          setTierBadgeFile(null);
          setRemoveTierImage(false);
          setRemoveTierBadgeImage(false);
        } catch (artworkError: unknown) {
          await fetchTiers();
          setFormError(
            getErrorMessage(
              artworkError,
              'Đã lưu thông tin bậc hạng nhưng tải ảnh chưa thành công. Bấm Lưu thay đổi để thử lại phần ảnh.',
            ),
          );
          return;
        }
      }

      toast.success(
        wasEditing ? 'Đã cập nhật bậc hạng.' : 'Đã tạo bậc hạng mới.',
      );
      setIsModalOpen(false);
      await fetchTiers();
    } catch (error: unknown) {
      setFormError(getErrorMessage(error, 'Không thể lưu bậc hạng.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetActive = async (tier: BrandLoyaltyTier, active: boolean) => {
    if (!brandId) return;
    setBusyId(tier.id);
    try {
      const response = await updateBrandLoyaltyTier(
        tier.id,
        tierToPayload(tier, active),
      );
      if (response.status !== 200)
        throw new Error(
          response.message || 'Không thể cập nhật trạng thái.',
        );
      await fetchTiers();
      toast.success(
        active ? `Đã bật ${tier.tierName}.` : `Đã tắt ${tier.tierName}.`,
      );
    } catch (error: unknown) {
      toast.error(
        getErrorMessage(error, 'Không thể cập nhật trạng thái bậc hạng.'),
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleToggle = (tier: BrandLoyaltyTier) => {
    void handleSetActive(tier, !tier.active);
  };

  const handleDeactivate = async (tier: BrandLoyaltyTier) => {
    if (!brandId) return;
    setBusyId(tier.id);
    try {
      const response = await deleteBrandLoyaltyTier(tier.id);
      if (response.status !== 200)
        throw new Error(
          response.message || 'Không thể vô hiệu hóa bậc hạng.',
        );
      await fetchTiers();
      toast.success(`Đã vô hiệu hóa ${tier.tierName}.`, {
        action: {
          label: 'Hoàn tác',
          onClick: () => void handleSetActive(tier, true),
        },
      });
    } catch (error: unknown) {
      toast.error(
        getErrorMessage(error, 'Không thể vô hiệu hóa bậc hạng.'),
      );
    } finally {
      setBusyId(null);
    }
  };

  if (!isHydrated || loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        <div className="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
        <SkeletonTable columns={9} rows={5} />
      </div>
    );
  }

  if (!brandId) {
    return (
      <div className="mx-auto max-w-3xl p-4 md:p-6">
        <div className="rounded-xl border border-warning-200 bg-warning-50 p-6 text-center dark:border-warning-500/30 dark:bg-warning-500/10">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Không xác định được thương hiệu
          </h1>
          <p className="mt-2 text-theme-sm text-gray-600 dark:text-gray-300">
            Vui lòng đăng nhập bằng tài khoản quản lý thương hiệu để quản lý
            đặc quyền thành viên.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6 text-gray-800 dark:text-gray-100">
      {/* 1. PAGE HEADER */}
      <header className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs sm:flex-row sm:items-center sm:justify-between sm:p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-start gap-3.5">
          <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-400">
            <ShootingStarIcon className="w-6 h-6 shrink-0" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-title-sm dark:text-white tracking-tight">
              Đặc quyền thành viên &amp; Bậc hạng
            </h1>
            <p className="mt-1 max-w-2xl text-theme-sm text-gray-500 dark:text-gray-400">
              Thiết lập mức chi tiêu, quyền lợi và hệ số tích điểm độc quyền cho
              thương hiệu của bạn.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* VIEW MODE TOGGLE */}
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              title="Chế độ Thẻ VIP trực quan"
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-theme-xs font-semibold transition ${
                viewMode === 'cards'
                  ? 'bg-white text-brand-600 shadow-theme-xs dark:bg-gray-700 dark:text-white'
                  : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              <GridIcon className="w-4 h-4 shrink-0" />
              <span>Thẻ VIP</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              title="Chế độ Bảng chi tiết"
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-theme-xs font-semibold transition ${
                viewMode === 'table'
                  ? 'bg-white text-brand-600 shadow-theme-xs dark:bg-gray-700 dark:text-white'
                  : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              <TableIcon className="w-4 h-4 shrink-0" />
              <span>Bảng số liệu</span>
            </button>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-500 px-5 py-3 text-theme-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600 active:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 active:scale-95"
          >
            <PlusIcon className="w-4 h-4 shrink-0" />
            Thêm bậc hạng
          </button>
        </div>
      </header>

      {/* ERROR ALERT */}
      {loadError && (
        <div
          className="flex flex-col gap-3 rounded-xl border border-error-200 bg-error-50 p-4 text-theme-sm text-error-600 sm:flex-row sm:items-center sm:justify-between dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400"
          role="alert"
        >
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => void fetchTiers()}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-error-200 px-4 font-medium transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error-500/40 dark:border-error-500/30 dark:hover:bg-error-500/10"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* 2. STATS SUMMARY BAR */}
      <section
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
        aria-label="Tổng quan bậc hạng"
      >
        <p className="text-theme-sm text-gray-600 dark:text-gray-300">
          Đang cấu hình{' '}
          <span className="font-bold text-gray-900 dark:text-white">
            {tiers.length}
          </span>{' '}
          bậc hạng thành viên
        </p>
        <span className="inline-flex items-center gap-2 rounded-full bg-success-50 px-3 py-1 text-theme-xs font-medium text-success-600 dark:bg-success-500/10 dark:text-success-400">
          <span
            className="h-1.5 w-1.5 rounded-full bg-success-500"
            aria-hidden="true"
          />
          {activeCount} đang hoạt động
        </span>
      </section>

      {/* 3. TIERS CONTENT: CARD VIEW OR TABLE VIEW */}
      {tiers.length === 0 && !loadError ? (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white p-12 text-center shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-400">
            <ShootingStarIcon className="w-7 h-7 shrink-0" />
          </div>
          <h2 className="mt-4 text-theme-xl font-bold text-gray-900 dark:text-white">
            Chưa có bậc hạng nào
          </h2>
          <p className="mx-auto mt-2 max-w-md text-theme-sm text-gray-500 dark:text-gray-400">
            Tạo bậc hạng đầu tiên để bắt đầu thiết lập chương trình thành viên
            và phân phối voucher tự động.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-500 px-5 py-3 text-theme-sm font-medium text-white transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          >
            <PlusIcon className="h-4 w-4" />
            Tạo bậc hạng ngay
          </button>
        </section>
      ) : viewMode === 'cards' ? (
        /* A. INTERACTIVE VIP CARDS GRID */
        <section
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          aria-label="Danh sách thẻ VIP trực quan"
        >
          {tiers.map((tier) => (
            <TierPreviewCard
              key={tier.id}
              tier={tier}
              policy={policies.find((p) => p.tierId === tier.id && p.trigger === 1)}
              busy={busyId === tier.id}
              onEdit={openEditModal}
              onToggle={handleToggle}
              onConfigurePolicy={handleConfigurePolicyScroll}
            />
          ))}
        </section>
      ) : (
        /* B. STRUCTURED DATA TABLE */
        <section
          className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
          aria-label="Danh sách bậc hạng dạng bảng"
        >
          <div className="overflow-x-auto">
            <table className="min-w-[1120px] w-full text-left">
              <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/60">
                <tr>
                  {[
                    'Bậc hạng',
                    'Chi tiêu tối thiểu',
                    'Hệ số tích điểm',
                    'Tem đổi quà',
                    'Free Upsize',
                    'Voucher tháng',
                    'Ưu đãi sinh nhật',
                    'Quà thăng hạng',
                    'Trạng thái',
                    'Thao tác',
                  ].map((heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className="px-4 py-3.5 text-theme-xs font-semibold text-gray-500 first:pl-6 last:pr-6 dark:text-gray-400"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {tiers.map((tier, index) => {
                  const monthlyPolicy = policies.find(
                    (p) => p.tierId === tier.id && p.trigger === 1,
                  );
                  const effectiveCount = monthlyPolicy
                    ? monthlyPolicy.active
                      ? monthlyPolicy.monthlyCount
                      : 0
                    : tier.monthlyVoucherCount;

                  return (
                    <tr
                      key={tier.id}
                      className="transition hover:bg-gray-50/70 dark:hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-4 first:pl-6">
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-theme-xs font-bold ${
                              index % 4 === 0
                                ? 'bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-400'
                                : index % 4 === 1
                                ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                                : index % 4 === 2
                                ? 'bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-400'
                                : 'bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-400'
                            }`}
                          >
                            {index + 1}
                          </span>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {tier.tierName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-theme-sm font-semibold text-gray-800 dark:text-gray-200">
                        {formatVnd(tier.minSpend)}
                      </td>
                      <td className="px-4 py-4 text-theme-sm font-bold text-brand-500 dark:text-brand-400">
                        {tier.earnMultiplier.toFixed(1)}x
                      </td>
                      <td className="px-4 py-4 text-theme-sm text-gray-600 dark:text-gray-300">
                        {tier.stampThreshold} tem
                      </td>
                      <td className="px-4 py-4 text-theme-sm text-gray-600 dark:text-gray-300">
                        {tier.freeUpsize} lượt
                      </td>
                      <td className="px-4 py-4 text-theme-sm text-gray-600 dark:text-gray-300">
                        {effectiveCount} voucher
                      </td>
                    <td className="max-w-[180px] px-4 py-4 text-theme-sm text-gray-600 dark:text-gray-300">
                      {tier.birthdayReward || '—'}
                    </td>
                    <td className="max-w-[180px] px-4 py-4 text-theme-sm text-gray-600 dark:text-gray-300">
                      {tier.upgradeRewardDescription || '—'}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-theme-xs font-medium ${
                          tier.active
                            ? 'bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-400'
                            : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            tier.active ? 'bg-success-500' : 'bg-gray-400'
                          }`}
                          aria-hidden="true"
                        />
                        {tier.active ? 'Đang bật' : 'Đã tắt'}
                      </span>
                    </td>
                    <td className="px-4 py-3 last:pr-6">
                      <TierActions
                        tier={tier}
                        busy={busyId === tier.id}
                        onEdit={openEditModal}
                        onToggle={handleToggle}
                        onDeactivate={handleDeactivate}
                      />
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* CONFIGURATION NOTICES */}
      {configurationError && (
        <div
          className="rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-theme-sm text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300"
          role="alert"
        >
          {configurationError} Một số bộ chọn có thể chưa có dữ liệu; hãy thử
          tải lại trang sau khi API sẵn sàng.
        </div>
      )}

      {/* 4. REWARD POLICIES SECTION */}
      <section className="space-y-4" aria-labelledby="reward-policy-heading">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-theme-xs font-bold uppercase tracking-wider text-brand-500 dark:text-brand-400">
              CẤU HÌNH QUYỀN LỢI THỰC THI
            </p>
            <h2
              id="reward-policy-heading"
              className="mt-1 text-title-sm font-bold text-gray-900 dark:text-white"
            >
              Voucher và Ưu đãi theo Hạng
            </h2>
            <p className="mt-1 max-w-2xl text-theme-sm text-gray-500 dark:text-gray-400">
              Thiết lập chính sách voucher phát tự động vào Ví khách hàng khi đạt đủ điều kiện.
            </p>
          </div>

          {/* TIER TABS SELECTOR */}
          {activeTiers.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center bg-gray-50 dark:bg-gray-800 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
              {activeTiers.map((tier) => {
                const isSelected = activeSelectedTier?.id === tier.id;
                const policyCount = policies.filter((p) => p.tierId === tier.id).length;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setSelectedPolicyTierId(tier.id)}
                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-theme-sm font-bold transition-all active:scale-95 ${
                      isSelected
                        ? 'bg-brand-500 text-white shadow-theme-xs'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/60 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700/60'
                    }`}
                  >
                    <span>{tier.tierName}</span>
                    {policyCount > 0 && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-theme-xs font-bold ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {policyCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {loadingConfiguration ? (
          <div className="h-48 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
        ) : !activeSelectedTier ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-5 py-8 text-center text-theme-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
            Tạo ít nhất một bậc hạng để cấu hình quyền lợi.
          </div>
        ) : (
          <div id={`reward-policy-${activeSelectedTier.id}`} key={activeSelectedTier.id}>
            <RewardPolicyEditor
              tier={activeSelectedTier}
              policies={policies.filter(
                (policy) => policy.tierId === activeSelectedTier.id,
              )}
              products={products}
              loadingProducts={loadingConfiguration}
              onSaved={async () => {
                await Promise.all([fetchConfiguration(), fetchTiers()]);
              }}
            />
          </div>
        )}
      </section>

      {/* 5. REFINED TIER MODAL (DESIGN.md ROUNDED-3XL & GROUPED LOGIC) */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        className="max-h-[calc(100vh-2rem)] max-w-3xl overflow-y-auto p-6 sm:p-8 rounded-3xl"
        showCloseButton
      >
        <div className="pr-8 border-b border-gray-200 dark:border-gray-800 pb-4">
          <span className="text-theme-xs font-bold uppercase tracking-wider text-brand-500 dark:text-brand-400">
            {editingTier ? 'Cập nhật cấu hình hạng' : 'Tạo mới bậc hạng'}
          </span>
          <h2 className="mt-1 text-title-sm font-bold text-gray-900 dark:text-white">
            {editingTier
              ? `Chỉnh sửa bậc: ${editingTier.tierName}`
              : 'Thêm bậc hạng thành viên'}
          </h2>
          <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
            Vui lòng điền các thông tin và điều kiện áp dụng cho hạng thành viên.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <TierImageEditor
            key={editingTier?.id ?? 'new-tier'}
            tier={editingTier}
            tierNamePreview={form.tierName}
            file={tierImageFile}
            onFileChange={setTierImageFile}
            badgeFile={tierBadgeFile}
            onBadgeFileChange={setTierBadgeFile}
            removeImage={removeTierImage}
            onRemoveImageChange={setRemoveTierImage}
            removeBadgeImage={removeTierBadgeImage}
            onRemoveBadgeImageChange={setRemoveTierBadgeImage}
            disabled={submitting}
          />
          {/* GROUP 1: BASIC INFORMATION */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-800/40 space-y-4">
            <div className="flex items-center gap-2 text-theme-sm font-bold text-gray-900 dark:text-white">
              <BoxCubeIcon className="size-4 text-brand-500" />
              <span>1. Thông tin định danh hạng</span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label htmlFor="tierName" className={labelClass}>
                  Tên bậc hạng *
                </label>
                <input
                  id="tierName"
                  value={form.tierName}
                  maxLength={100}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      tierName: event.target.value,
                    }))
                  }
                  className={inputClass}
                  placeholder="Ví dụ: Bạc, Vàng, Kim Cương..."
                  required
                />
              </div>

              <div>
                <label htmlFor="sortOrder" className={labelClass}>
                  Thứ tự ưu tiên *
                </label>
                <input
                  id="sortOrder"
                  type="number"
                  min="0"
                  step="1"
                  value={form.sortOrder}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      sortOrder: event.target.value,
                    }))
                  }
                  className={inputClass}
                  required
                />
              </div>
            </div>
          </div>

          {/* GROUP 2: SPEND THRESHOLDS & EARNING MULTIPLIER */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-800/40 space-y-4">
            <div className="flex items-center gap-2 text-theme-sm font-bold text-gray-900 dark:text-white">
              <DollarLineIcon className="w-4 h-4 shrink-0 text-brand-500" />
              <span>2. Điều kiện chi tiêu &amp; Tích lũy</span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="minSpend" className={labelClass}>
                  Chi tiêu tối thiểu (VNĐ) *
                </label>
                <input
                  id="minSpend"
                  type="number"
                  min="0"
                  step="1000"
                  value={form.minSpend}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      minSpend: event.target.value,
                    }))
                  }
                  className={inputClass}
                  required
                />
                <span className="mt-1 block text-theme-xs font-semibold text-brand-600 dark:text-brand-400">
                  Hiển thị: {formatVnd(Number(form.minSpend) || 0)}
                </span>
              </div>

              <div>
                <label htmlFor="earnMultiplier" className={labelClass}>
                  Hệ số tích điểm *
                </label>
                <input
                  id="earnMultiplier"
                  type="number"
                  min="0.01"
                  step="0.1"
                  value={form.earnMultiplier}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      earnMultiplier: event.target.value,
                    }))
                  }
                  className={inputClass}
                  required
                />
                <span className="mt-1 block text-theme-xs text-gray-500">
                  VD: 1.5x (tích 1.5 lần điểm)
                </span>
              </div>

              <div>
                <label htmlFor="stampThreshold" className={labelClass}>
                  Ngưỡng tem đổi quà *
                </label>
                <input
                  id="stampThreshold"
                  type="number"
                  min="1"
                  step="1"
                  value={form.stampThreshold}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      stampThreshold: event.target.value,
                    }))
                  }
                  className={inputClass}
                  required
                />
                <span className="mt-1 block text-theme-xs text-gray-500">
                  Mặc định 9 hoặc 10 tem
                </span>
              </div>
            </div>
          </div>

          {/* GROUP 3: MONTHLY PRIVILEGES & REWARDS */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-800/40 space-y-4">
            <div className="flex items-center gap-2 text-theme-sm font-bold text-gray-900 dark:text-white">
              <ShootingStarIcon className="w-4 h-4 shrink-0 text-brand-500" />
              <span>3. Đặc quyền định kỳ hàng tháng</span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="monthlyVoucherCount" className={labelClass}>
                  Số voucher phát / tháng *
                </label>
                <input
                  id="monthlyVoucherCount"
                  type="number"
                  min="0"
                  step="1"
                  value={form.monthlyVoucherCount}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      monthlyVoucherCount: event.target.value,
                    }))
                  }
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label htmlFor="freeUpsize" className={labelClass}>
                  Số lần Free Upsize / tháng *
                </label>
                <input
                  id="freeUpsize"
                  type="number"
                  min="0"
                  step="1"
                  value={form.freeUpsize}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      freeUpsize: event.target.value,
                    }))
                  }
                  className={inputClass}
                  required
                />
              </div>
            </div>
          </div>

          {/* ACTIVE STATUS TOGGLE */}
          <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/40">
            <div>
              <span className="block font-bold text-theme-sm text-gray-900 dark:text-white">
                Kích hoạt áp dụng hạng thành viên này
              </span>
              <span className="block text-theme-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {form.active
                  ? 'Bậc hạng đang được áp dụng và hiển thị trên toàn hệ thống.'
                  : 'Bậc hạng đang tắt sẽ không xuất hiện trên App và không được dùng để tính quyền lợi.'}
              </span>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={form.active}
              onClick={() => setForm((current) => ({ ...current, active: !current.active }))}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500/30 ${
                form.active ? 'bg-brand-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  form.active ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* ERROR DISPLAY */}
          {formError && (
            <p
              className="rounded-lg border border-error-200 bg-error-50 px-3.5 py-3 text-theme-sm text-error-600 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400"
              role="alert"
            >
              {formError}
            </p>
          )}

          {/* MODAL ACTIONS */}
          <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-5 sm:flex-row sm:justify-end dark:border-gray-800">
            <button
              type="button"
              onClick={closeModal}
              disabled={submitting}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-300 px-5 py-3 text-theme-sm font-medium text-gray-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-500 px-6 py-3 text-theme-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:cursor-not-allowed disabled:opacity-60 active:scale-95"
            >
              {submitting && (
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  aria-hidden="true"
                />
              )}
              {submitting
                ? 'Đang lưu...'
                : editingTier
                ? 'Lưu thay đổi'
                : 'Tạo bậc hạng'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
