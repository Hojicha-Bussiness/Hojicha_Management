'use client';
/* eslint-disable @next/next/no-img-element -- signed brand artwork URLs */

import React from 'react';
import type { BrandLoyaltyTier } from '@/services/loyaltyTiers';
import type { LoyaltyRewardPolicy } from '@/services/loyaltyRewards';
import {
  ShootingStarIcon,
  DollarLineIcon,
  BoxCubeIcon,
  TaskIcon,
  PencilIcon,
} from '@/icons';

type TierPreviewCardProps = {
  tier: BrandLoyaltyTier;
  policy?: LoyaltyRewardPolicy;
  busy: boolean;
  onEdit: (tier: BrandLoyaltyTier) => void;
  onToggle: (tier: BrandLoyaltyTier) => void;
  onConfigurePolicy: (tier: BrandLoyaltyTier) => void;
};

const formatVnd = (value: number) =>
  `${new Intl.NumberFormat('vi-VN').format(Math.round(value))}₫`;

const getTierTheme = (tierName: string, sortOrder: number) => {
  const lower = tierName.toLowerCase();
  if (lower.includes('đồng') || lower.includes('bronze') || sortOrder === 0) {
    return {
      solidBg: 'bg-[#78350F]', // Solid Amber 900 / Bronze
      badgeBg: 'bg-black/20 text-amber-100 border-amber-500/30',
      multiplierBg: 'bg-black/20 text-white border-white/20',
    };
  }
  if (lower.includes('bạc') || lower.includes('silver') || sortOrder === 10) {
    return {
      solidBg: 'bg-[#334155]', // Solid Slate 700 / Silver
      badgeBg: 'bg-black/20 text-slate-100 border-slate-400/30',
      multiplierBg: 'bg-black/20 text-white border-white/20',
    };
  }
  if (lower.includes('vàng') || lower.includes('gold') || sortOrder === 20) {
    return {
      solidBg: 'bg-[#B45309]', // Solid Amber 700 / Gold
      badgeBg: 'bg-black/20 text-yellow-100 border-yellow-300/30',
      multiplierBg: 'bg-black/20 text-white border-white/20',
    };
  }
  if (
    lower.includes('kim cương') ||
    lower.includes('diamond') ||
    lower.includes('platinum') ||
    sortOrder >= 30
  ) {
    return {
      solidBg: 'bg-[#4338CA]', // Solid Indigo 700 / Diamond
      badgeBg: 'bg-black/20 text-indigo-100 border-indigo-300/30',
      multiplierBg: 'bg-black/20 text-white border-white/20',
    };
  }
  return {
    solidBg: 'bg-[#465FFF]', // Solid Brand 500
    badgeBg: 'bg-black/20 text-white border-white/20',
    multiplierBg: 'bg-black/20 text-white border-white/20',
  };
};

export function TierPreviewCard({
  tier,
  policy,
  busy,
  onEdit,
  onToggle,
  onConfigurePolicy,
}: TierPreviewCardProps) {
  const theme = getTierTheme(tier.tierName, tier.sortOrder);

  const effectiveVoucherCount = policy
    ? policy.active
      ? policy.monthlyCount
      : 0
    : tier.monthlyVoucherCount;

  return (
    <div className="group flex flex-col rounded-xl border border-gray-200 bg-white shadow-theme-sm transition-all duration-200 hover:shadow-theme-md dark:border-gray-800 dark:bg-gray-800 overflow-hidden">
      <div className="relative aspect-[2.1] overflow-hidden bg-[#B8C4E8]">
        {tier.imageUrl && <img src={tier.imageUrl} alt={`Ảnh hạng ${tier.tierName}`} className="h-full w-full object-cover" />}
        <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-white/85 px-3 py-1 shadow-sm backdrop-blur-sm">
          {tier.badgeImageUrl && (
            <img
              src={tier.badgeImageUrl}
              alt={`Huy hiệu ${tier.tierName}`}
              className="h-4 w-4 object-contain"
            />
          )}
          <span className="font-bold text-gray-900 text-xs">{tier.tierName}</span>
        </div>
        {!tier.imageUrl && <span className="absolute bottom-3 left-4 text-xs text-gray-700">Chưa cấu hình ảnh nền</span>}
      </div>
      {/* 1. VIP CARD HEADER - CLEAN SOLID COLOR */}
      <div className={`p-5 text-white ${theme.solidBg}`}>
        {/* Header Badges */}
        <div className="flex items-center justify-between gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-theme-xs font-semibold ${theme.badgeBg}`}
          >
            <ShootingStarIcon className="w-3.5 h-3.5 shrink-0" />
            <span>Thứ tự #{tier.sortOrder}</span>
          </span>

          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-theme-xs font-semibold ${
              tier.active
                ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'
                : 'bg-rose-500/20 text-rose-200 border border-rose-400/30'
            }`}
          >
            {tier.active ? 'Đang áp dụng' : 'Tạm ẩn'}
          </span>
        </div>

        {/* Tier Title & Multiplier */}
        <div className="mt-4 flex items-end justify-between gap-2">
          <div>
            <span className="text-theme-xs font-medium uppercase tracking-wider text-white/80 block">
              Hạng thành viên
            </span>
            <h3 className="text-theme-xl font-bold tracking-tight text-white mt-0.5">
              {tier.tierName}
            </h3>
          </div>

          <div
            className={`rounded-lg px-2.5 py-1 text-theme-xs font-bold border ${theme.multiplierBg}`}
          >
            x{tier.earnMultiplier} Tích điểm
          </div>
        </div>

        {/* Minimum Spend */}
        <div className="mt-4 pt-3 border-t border-white/15">
          <span className="text-theme-xs text-white/80 block">
            Chi tiêu tối thiểu để đạt hạng
          </span>
          <div className="text-title-sm font-extrabold text-white mt-0.5 tracking-tight">
            {formatVnd(tier.minSpend)}
          </div>
        </div>
      </div>

      {/* 2. PRIVILEGES LIST */}
      <div className="flex-1 p-5 space-y-3.5 bg-gray-50/50 dark:bg-gray-800/50">
        <span className="text-theme-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 block">
          Đặc quyền của hạng
        </span>

        <div className="space-y-2.5">
          {/* Monthly Voucher */}
          <div className="flex items-center justify-between text-theme-sm">
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <div className="flex size-6 shrink-0 items-center justify-center rounded bg-brand-50 text-brand-500 dark:bg-brand-500/10">
                <DollarLineIcon className="w-3.5 h-3.5 shrink-0" />
              </div>
              <span>Voucher định kỳ</span>
            </div>
            <span
              className={`font-semibold text-theme-xs sm:text-theme-sm ${
                effectiveVoucherCount > 0
                  ? 'text-brand-600 dark:text-brand-400'
                  : 'text-gray-400'
              }`}
            >
              {effectiveVoucherCount > 0
                ? `${effectiveVoucherCount} voucher / tháng`
                : 'Không có'}
            </span>
          </div>

          {/* Monthly Free Upsize */}
          <div className="flex items-center justify-between text-theme-sm">
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <div className="flex size-6 shrink-0 items-center justify-center rounded bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10">
                <ShootingStarIcon className="w-3.5 h-3.5 shrink-0" />
              </div>
              <span>Upsize ly miễn phí</span>
            </div>
            <span
              className={`font-semibold text-theme-xs sm:text-theme-sm ${
                tier.freeUpsize > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-gray-400'
              }`}
            >
              {tier.freeUpsize > 0
                ? `${tier.freeUpsize} lần / tháng`
                : 'Không có'}
            </span>
          </div>

          {/* Stamp Threshold */}
          <div className="flex items-center justify-between text-theme-sm">
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <div className="flex size-6 shrink-0 items-center justify-center rounded bg-amber-50 text-amber-500 dark:bg-amber-500/10">
                <TaskIcon className="w-3.5 h-3.5 shrink-0" />
              </div>
              <span>Đổi quà tem</span>
            </div>
            <span className="font-semibold text-theme-xs sm:text-theme-sm text-gray-800 dark:text-gray-200">
              {tier.stampThreshold > 0
                ? `${tier.stampThreshold} tem / quà`
                : 'Mặc định'}
            </span>
          </div>

          {/* Birthday Reward */}
          {tier.birthdayReward && (
            <div className="flex items-center justify-between text-theme-sm">
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <div className="flex size-6 shrink-0 items-center justify-center rounded bg-purple-50 text-purple-500 dark:bg-purple-500/10">
                  <BoxCubeIcon className="w-3.5 h-3.5 shrink-0" />
                </div>
                <span>Quà sinh nhật</span>
              </div>
              <span
                className="font-semibold text-theme-xs sm:text-theme-sm text-purple-600 dark:text-purple-400 truncate max-w-[130px]"
                title={tier.birthdayReward}
              >
                {tier.birthdayReward}
              </span>
            </div>
          )}

          {/* Upgrade Reward */}
          {tier.upgradeRewardDescription && (
            <div className="flex items-center justify-between text-theme-sm">
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <div className="flex size-6 shrink-0 items-center justify-center rounded bg-blue-50 text-blue-500 dark:bg-blue-500/10">
                  <ShootingStarIcon className="w-3.5 h-3.5 shrink-0" />
                </div>
                <span>Quà thăng hạng</span>
              </div>
              <span
                className="font-semibold text-theme-xs sm:text-theme-sm text-blue-600 dark:text-blue-400 truncate max-w-[130px]"
                title={tier.upgradeRewardDescription}
              >
                {tier.upgradeRewardDescription}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 3. CARD ACTIONS FOOTER WITH TOGGLE SWITCH */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onConfigurePolicy(tier)}
          disabled={busy}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white px-3 py-2 text-theme-sm font-medium shadow-theme-xs transition active:scale-[0.98] disabled:opacity-50"
        >
          <DollarLineIcon className="w-4 h-4 shrink-0" />
          <span>Quyền lợi</span>
        </button>

        <button
          type="button"
          onClick={() => onEdit(tier)}
          disabled={busy}
          title="Chỉnh sửa hạng"
          className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/60 p-2 text-gray-700 dark:text-gray-300 transition active:scale-95 disabled:opacity-50"
        >
          <PencilIcon className="w-4 h-4 shrink-0" />
        </button>

        {/* NÚT CÔNG TẮC BẬT / TẮT (TOGGLE SWITCH) */}
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
      </div>
    </div>
  );
}
