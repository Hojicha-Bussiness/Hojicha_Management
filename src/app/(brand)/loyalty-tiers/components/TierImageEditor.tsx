'use client';
/* eslint-disable @next/next/no-img-element -- signed brand artwork URLs */

import { useEffect, useMemo } from 'react';
import type { BrandLoyaltyTier } from '@/services/loyaltyTiers';

export interface TierImageEditorProps {
  tier?: BrandLoyaltyTier | null;
  tierNamePreview?: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  badgeFile?: File | null;
  onBadgeFileChange?: (file: File | null) => void;
  removeImage?: boolean;
  onRemoveImageChange?: (remove: boolean) => void;
  removeBadgeImage?: boolean;
  onRemoveBadgeImageChange?: (remove: boolean) => void;
  disabled: boolean;
}

export function TierImageEditor({
  tier,
  tierNamePreview,
  file,
  onFileChange,
  badgeFile = null,
  onBadgeFileChange,
  removeImage = false,
  onRemoveImageChange,
  removeBadgeImage = false,
  onRemoveBadgeImageChange,
  disabled,
}: TierImageEditorProps) {
  const cardPreview = useMemo(
    () => (file ? URL.createObjectURL(file) : ''),
    [file],
  );
  const badgePreview = useMemo(
    () => (badgeFile ? URL.createObjectURL(badgeFile) : ''),
    [badgeFile],
  );

  useEffect(
    () => () => {
      if (cardPreview) URL.revokeObjectURL(cardPreview);
    },
    [cardPreview],
  );

  useEffect(
    () => () => {
      if (badgePreview) URL.revokeObjectURL(badgePreview);
    },
    [badgePreview],
  );

  const displayName = tierNamePreview?.trim() || tier?.tierName || 'Hạng thành viên';
  const cardUrl = cardPreview || (!removeImage ? tier?.imageUrl ?? '' : '');
  const badgeUrl =
    badgePreview || (!removeBadgeImage ? tier?.badgeImageUrl ?? '' : '');

  return (
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
            Hình ảnh bậc hạng trên ứng dụng Mobile
          </h3>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Ảnh nền thẻ hạng và huy hiệu hiển thị đồng bộ tại Trang chủ, Tài khoản, Quyền lợi hạng và Mã QR.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Card background preview + upload */}
        <div className="space-y-2.5 md:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              1. Ảnh nền thẻ hạng (Tỷ lệ khuyến nghị ~2.1:1)
            </span>
            {(cardUrl || file) && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  onFileChange(null);
                  onRemoveImageChange?.(true);
                }}
                className="text-xs font-medium text-error-600 hover:underline disabled:opacity-50 dark:text-error-400"
              >
                Xóa ảnh nền
              </button>
            )}
          </div>

          <div className="relative aspect-[2.1] w-full overflow-hidden rounded-xl border border-gray-200 bg-[#B8C4E8] dark:border-gray-700">
            {cardUrl ? (
              <img
                src={cardUrl}
                alt={`Ảnh nền hạng ${displayName}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-gray-700">
                Chưa có ảnh nền thẻ hạng (dùng màu mặc định trên App)
              </div>
            )}
            <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-white/85 px-3 py-1 text-xs font-bold text-gray-900 shadow-sm backdrop-blur-sm">
              {badgeUrl && (
                <img
                  src={badgeUrl}
                  alt={`Huy hiệu ${displayName}`}
                  className="h-4 w-4 rounded-full object-contain"
                />
              )}
              <span>{displayName}</span>
            </div>
          </div>

          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
            Chọn ảnh nền thẻ (JPG, PNG, WebP — tối đa 10 MB, tự động tối ưu WebP)
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              disabled={disabled}
              onChange={(event) => {
                const next = event.target.files?.[0] ?? null;
                onFileChange(next);
                if (next) onRemoveImageChange?.(false);
              }}
              className="mt-1.5 block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand-600 hover:file:bg-brand-100"
            />
          </label>
        </div>

        {/* Badge icon preview + upload */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              2. Huy hiệu hạng (Badge)
            </span>
            {(badgeUrl || badgeFile) && onBadgeFileChange && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  onBadgeFileChange(null);
                  onRemoveBadgeImageChange?.(true);
                }}
                className="text-xs font-medium text-error-600 hover:underline disabled:opacity-50 dark:text-error-400"
              >
                Xóa huy hiệu
              </button>
            )}
          </div>

          <div className="flex h-28 w-full flex-col items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/50">
            {badgeUrl ? (
              <img
                src={badgeUrl}
                alt={`Huy hiệu hạng ${displayName}`}
                className="h-14 w-14 object-contain"
              />
            ) : (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                {displayName}
              </span>
            )}
            <span className="text-[11px] text-gray-500">
              {badgeUrl ? 'Huy hiệu đang chọn' : 'Dự phòng nhãn tên hạng'}
            </span>
          </div>

          {onBadgeFileChange && (
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Chọn ảnh huy hiệu vuông/trong suốt (PNG, WebP, JPG)
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                disabled={disabled}
                onChange={(event) => {
                  const next = event.target.files?.[0] ?? null;
                  onBadgeFileChange(next);
                  if (next) onRemoveBadgeImageChange?.(false);
                }}
                className="mt-1.5 block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand-600 hover:file:bg-brand-100"
              />
            </label>
          )}
        </div>
      </div>
    </section>
  );
}
