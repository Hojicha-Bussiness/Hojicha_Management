'use client';
/* eslint-disable @next/next/no-img-element -- admin preview accepts signed storage URLs from configured brands. */

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { getBrandLoyaltyTiers } from '@/services/loyaltyTiers';
import {
  addHomeMediaHero,
  deleteHomeMediaItem,
  ensureHomeMediaDraft,
  getHomeMediaActionOptions,
  getHomeMediaDraft,
  publishHomeMedia,
  unpublishHomeMedia,
  updateHomeMediaItem,
  type HomeMediaActionOption,
  type HomeMediaActionOptions,
  type HomeMediaDraft,
  type HomeMediaItem,
} from '@/services/homeMedia';

type ItemState = Omit<HomeMediaItem, 'actionTargetKey' | 'actionTargetId' | 'actionExternalUrl'> & {
  isNew: boolean;
  dirty: boolean;
  selectedFile: File | null;
  actionTargetKey: string;
  actionTargetId: string;
  actionExternalUrl: string;
};

const groupLabels: Record<string, string> = {
  hero: 'Hero banner',
  quickAction: 'Thao tác nhanh',
  promotion: 'Chương trình ưu đãi',
  about: 'Về chúng tôi',
  tier: 'Ảnh thẻ hạng — Account',
  account: 'Ảnh tiện ích — Account',
};

const accountLabels: Record<string, string> = {
  'account-coupons': 'Kho ưu đãi',
  'account-credits': 'Đổi voucher',
  'account-referrals': 'Giới thiệu bạn bè',
};

const actionTypeLabels: Record<string, string> = {
  None: 'Không có hành động',
  InternalRoute: 'Mở màn hình trong app',
  Product: 'Mở sản phẩm',
  SpecialOffer: 'Mở ưu đãi Mobile',
  StampProgram: 'Mở chương trình tích điểm',
  ExternalHttps: 'Mở liên kết HTTPS',
};

export default function HomeMediaPage() {
  const user = useAuthStore((state) => state.user);
  const [draft, setDraft] = useState<HomeMediaDraft | null>(null);
  const [items, setItems] = useState<ItemState[]>([]);
  const [options, setOptions] = useState<HomeMediaActionOption[]>([]);
  const [tierNames, setTierNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [previewMessage, setPreviewMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await ensureHomeMediaDraft();
      const [draftResponse, optionsResponse, tiersResponse] = await Promise.all([
        getHomeMediaDraft(),
        getHomeMediaActionOptions(),
        getBrandLoyaltyTiers(),
      ]);
      setTierNames(Object.fromEntries(
        (tiersResponse.data ?? []).map((tier) => [`tier-card-${tier.id}`, tier.tierName]),
      ));
      const nextDraft = draftResponse.data;
      setDraft(nextDraft ?? null);
      setItems(
        (nextDraft?.items ?? []).map((item) => ({
          ...item,
          isNew: false,
          dirty: false,
          selectedFile: null,
          actionTargetKey: item.actionTargetKey ?? '',
          actionTargetId: item.actionTargetId?.toString() ?? '',
          actionExternalUrl: item.actionExternalUrl ?? '',
        })),
      );
      const actionData = optionsResponse.data as HomeMediaActionOptions | undefined;
      setOptions([
        ...(actionData?.none ?? []),
        ...(actionData?.internalRoutes ?? []),
        ...(actionData?.products ?? []),
        ...(actionData?.specialOffers ?? []),
        ...(actionData?.stampPrograms ?? []),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được cấu hình Home.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'BrandManager') void load();
  }, [load, user?.role]);

  const groupedItems = useMemo(() => {
    const groups = items.reduce<Record<string, ItemState[]>>((result, item) => {
      (result[item.groupKey] ??= []).push(item);
      return result;
    }, {});
    const heroes = groups.hero ?? [];
    const heroesWithImages = heroes.filter((item) => item.selectedFile || item.imageUrl);
    const newEmptyHeroes = heroes.filter((item) =>
      (item.isNew || /^hero-[0-9a-f]{32}$/i.test(item.contentKey))
      && !item.selectedFile
      && !item.imageUrl,
    );
    const firstHero = heroes[0];
    groups.hero = heroesWithImages.length > 0
      ? [...heroesWithImages, ...newEmptyHeroes]
      : newEmptyHeroes.length > 0
        ? [
            ...(firstHero ? [firstHero] : []),
            ...newEmptyHeroes.filter((item) => item.id !== firstHero?.id),
          ]
        : firstHero ? [firstHero] : [];
    return groups;
  }, [items]);

  const previewUrls = useMemo(() => {
    const urls = new Map<number, string>();
    items.forEach((item) => {
      if (item.selectedFile) urls.set(item.id, URL.createObjectURL(item.selectedFile));
    });
    return urls;
  }, [items]);

  useEffect(() => () => {
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [previewUrls]);

  if (user?.role === 'Administrator') return null;
  if (user?.role && user.role !== 'BrandManager') {
    return <div className="p-6 text-error-600">Bạn không có quyền chỉnh sửa Home.</div>;
  }

  const updateItem = (id: number, patch: Partial<ItemState>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch, dirty: true } : item)));
  };

  const saveAll = async () => {
    if (!draft) return;

    const pendingItems = items.filter((item) => item.dirty);
    const incompleteItem = pendingItems.find((item) => item.isNew && !item.selectedFile);
    if (incompleteItem) {
      setError(`Vui lòng chọn ảnh cho ${incompleteItem.contentKey} trước khi Lưu Draft.`);
      return;
    }

    if (pendingItems.length === 0) {
      setMessage('Không có thay đổi nào cần lưu.');
      setError('');
      return;
    }

    setBusy(true);
    setMessage('');
    setError('');
    try {
      let currentDraft = draft;

      // Each request increments DraftRevision, so refresh the token between items.
      for (const item of pendingItems) {
        if (item.isNew) {
          await addHomeMediaHero(
            item.selectedFile as File,
            item.actionType,
            item.actionTargetKey,
            item.actionTargetId,
            item.actionExternalUrl,
            currentDraft.concurrencyToken,
          );
        } else {
          await updateHomeMediaItem(
            item,
            item.selectedFile,
            item.actionType,
            item.actionTargetKey,
            item.actionTargetId,
            item.actionExternalUrl,
            currentDraft.concurrencyToken,
          );
        }

        const refreshedDraft = await getHomeMediaDraft();
        if (!refreshedDraft.data) throw new Error('Không nhận được Draft mới sau khi lưu ảnh.');
        currentDraft = refreshedDraft.data;
      }

      setMessage(`Đã lưu Draft toàn bộ ${pendingItems.length} ảnh/thay đổi.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được ảnh.');
    } finally {
      setBusy(false);
    }
  };

  const addHero = async () => {
    if (!draft) return;
    const newId = items.reduce((minimum, item) => Math.min(minimum, item.id), 0) - 1;
    setItems((current) => [...current, {
      id: newId,
      contentKey: `hero-new-${Date.now()}`,
      groupKey: 'hero',
      layoutType: 'hero',
      imageUrl: '',
      actionType: 'None',
      actionTargetKey: '',
      actionTargetId: '',
      actionExternalUrl: '',
      isActive: true,
      isNew: true,
      dirty: true,
      selectedFile: null,
    }]);
    setMessage('Đã thêm một ô Hero. Chọn ảnh trong ô mới rồi bấm Lưu Draft.');
    setError('');
  };

  const removeHero = async (item: ItemState) => {
    if (item.isNew) {
      setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
      setMessage('Đã bỏ ô Hero mới.');
      return;
    }
    if (!draft || !window.confirm(`Xóa hẳn ${item.contentKey} khỏi Draft và Firebase?`)) return;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      await deleteHomeMediaItem(item.id, draft.concurrencyToken);
      setMessage(`Đã xóa Hero: ${item.contentKey}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không xóa được Hero.');
    } finally {
      setBusy(false);
    }
  };

  const publish = async (unpublish = false) => {
    if (!draft) return;
    setBusy(true);
    setError('');
    try {
      if (unpublish) await unpublishHomeMedia(draft.concurrencyToken);
      else await publishHomeMedia(draft.concurrencyToken);
      setMessage(unpublish ? 'Đã gỡ bản Publish.' : 'Đã Publish Home.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish thất bại.');
    } finally {
      setBusy(false);
    }
  };

  const targetOptions = (type: string) => options.filter((option) => option.type === type);
  const imageUrl = (item: ItemState) => previewUrls.get(item.id) ?? item.imageUrl;
  const actionTarget = (item: ItemState) => options.find(
    (option) => option.type === item.actionType
      && `${option.key || option.id || ''}` === (item.actionTargetKey || item.actionTargetId),
  );
  const actionLabel = (item: ItemState) => actionTarget(item)?.label
    ?? actionTypeLabels[item.actionType]
    ?? item.actionType;
  const handlePreviewClick = (item: ItemState) => {
    setPreviewMessage(`${item.contentKey}: ${actionLabel(item)}`);
  };

  const previewItems = (group: string) => groupedItems[group] ?? [];
  const renderPreviewImage = (item: ItemState, className: string) => (
    <button
      type="button"
      title={`Bấm để xem hành động: ${actionLabel(item)}`}
      onClick={() => handlePreviewClick(item)}
      className={`block overflow-hidden bg-gray-100 text-left ${className}`}
    >
      {imageUrl(item) ? <img src={imageUrl(item)} alt={item.contentKey} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-gray-400">Chưa có ảnh</div>}
    </button>
  );

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Ảnh Home Mobile & thẻ hạng</h1>
          <p className="mt-1 text-sm text-gray-500">BrandManager đổi ảnh, chọn hành động khi bấm và Publish riêng.</p>
        </div>
        <div className="flex gap-2">
          <button disabled={busy || !draft} onClick={() => void publish(true)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">Gỡ Publish</button>
          <button disabled={busy || !draft} onClick={() => void saveAll()} className="rounded-lg border border-brand-500 px-4 py-2 text-sm font-semibold text-brand-600 disabled:opacity-50">Lưu Draft</button>
          <button disabled={busy || !draft} onClick={() => void publish()} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Publish</button>
        </div>
      </div>
      {message && <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}
      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading ? <div className="rounded-xl bg-white p-6 text-sm text-gray-500">Đang tải...</div> : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-6">
            {['hero', ...Object.keys(groupedItems).filter((group) => group !== 'hero')].map((group) => {
              const groupItems = groupedItems[group] ?? [];
              return (
                <section key={group} className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-white">{groupLabels[group] ?? group}</h2>
                    <span className="text-sm text-gray-500">{groupItems.length} ảnh</span>
                    {group === 'tier' && <p className="mt-1 text-xs text-gray-500">Ảnh nền tại Account và màn hình quyền lợi. Thay ảnh, Lưu Draft rồi Publish để áp dụng.</p>}
                    {group === 'account' && <p className="mt-1 text-xs text-gray-500">Thay ảnh nền các ô tiện ích tại Account. Nội dung, số liệu và hành động bấm được giữ nguyên.</p>}
                  </div>
                  {group === 'hero' && (
                    <button disabled={busy || !draft} onClick={() => void addHero()} className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">+ Thêm Hero</button>
                  )}
                </div>
                <div className="space-y-3">
                  {groupItems.map((item) => {
                    const choices = targetOptions(item.actionType);
                    return (
                      <article key={item.id} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                        <div className="flex flex-col gap-3 md:flex-row">
                          <div className="h-24 w-full shrink-0 overflow-hidden rounded-lg bg-gray-100 md:h-20 md:w-36">
                            {imageUrl(item) ? <img src={imageUrl(item)} alt={item.contentKey} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-gray-400">Chưa có ảnh</div>}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <span className="truncate font-semibold text-gray-800 dark:text-white">{tierNames[item.contentKey] ?? accountLabels[item.contentKey] ?? item.contentKey}</span>
                              <span className="shrink-0 text-xs text-gray-500">Draft</span>
                            </div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-200">
                              Ảnh mới
                              <input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={(event: ChangeEvent<HTMLInputElement>) => updateItem(item.id, { selectedFile: event.target.files?.[0] ?? null })} className="mt-1 block w-full text-xs" />
                            </label>
                            {group !== 'tier' && group !== 'account' && <div className="mt-2 grid gap-2 md:grid-cols-2">
                              <label className="text-xs font-medium text-gray-700 dark:text-gray-200">
                                Khi bấm vào ảnh
                                <select value={item.actionType} onChange={(event) => updateItem(item.id, { actionType: event.target.value, actionTargetKey: '', actionTargetId: '' })} className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs">
                                  {Object.entries(actionTypeLabels).map(([type, label]) => <option key={type} value={type}>{label}</option>)}
                                </select>
                              </label>
                              {item.actionType !== 'None' && item.actionType !== 'ExternalHttps' && (
                                <label className="text-xs font-medium text-gray-700 dark:text-gray-200">
                                  Đích đến
                                  <select value={item.actionTargetKey || item.actionTargetId} onChange={(event) => { const selected = choices.find((option) => `${option.key || option.id || ''}` === event.target.value); updateItem(item.id, { actionTargetKey: selected?.key ?? '', actionTargetId: selected?.id?.toString() ?? '' }); }} className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs">
                                    <option value="">{choices.length ? 'Chọn đích đến' : 'Chưa có dữ liệu'}</option>
                                    {choices.map((option) => <option key={`${option.key}-${option.id}`} value={option.key || option.id || ''}>{option.label}</option>)}
                                  </select>
                                </label>
                              )}
                            </div>}
                            {item.actionType === 'ExternalHttps' && <input value={item.actionExternalUrl} onChange={(event) => updateItem(item.id, { actionExternalUrl: event.target.value })} placeholder="https://..." className="mt-2 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs" />}
                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs text-gray-500">{group === 'tier' ? 'Ảnh nền thẻ hạng thành viên' : group === 'account' ? 'Ảnh nền tiện ích Account' : `Hành động: ${actionLabel(item)}`}</span>
                              <div className="flex gap-2">
                                {group === 'hero' && <button disabled={busy} onClick={() => void removeHero(item)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 disabled:opacity-50">Xóa</button>}
                                {item.dirty && <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">Chưa lưu</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
                </section>
              );
            })}
          </div>

          <aside className="xl:sticky xl:top-6 xl:self-start">
            <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-800 dark:text-white">Preview Home Mobile</h2>
                  <p className="text-xs text-gray-500">Bấm ảnh để xem hành động đã chọn.</p>
                </div>
                <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] text-gray-500">Draft</span>
              </div>
              <div className="mx-auto max-w-[360px] overflow-hidden rounded-[2rem] border-[7px] border-gray-900 bg-gray-100 shadow-xl">
                <div className="max-h-[720px] overflow-y-auto bg-[#f7f7fa]">
                  <div className="bg-white px-4 py-3 text-center text-xs font-bold tracking-wide text-gray-800">PASSION COFFEE</div>
                  {previewMessage && <div className="mx-3 mt-2 rounded-lg bg-blue-50 px-2 py-1.5 text-[10px] text-blue-700">{previewMessage}</div>}
                  {previewItems('hero').length > 0 && (
                    <section className="p-3 pb-1">
                      <div className="mb-2 text-[11px] font-semibold text-gray-700">Hero banner</div>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {previewItems('hero').map((item) => <div key={item.id} className="w-[260px] shrink-0">{renderPreviewImage(item, 'h-28 w-full rounded-xl')}<p className="mt-1 truncate text-[10px] text-gray-500">{actionLabel(item)}</p></div>)}
                      </div>
                    </section>
                  )}
                  {previewItems('quickAction').length > 0 && (
                    <section className="grid grid-cols-2 gap-2 p-3 pb-1">
                      {previewItems('quickAction').map((item) => <div key={item.id}>{renderPreviewImage(item, 'h-16 w-full rounded-xl')}<p className="mt-1 truncate text-[10px] text-gray-500">{actionLabel(item)}</p></div>)}
                    </section>
                  )}
                  {previewItems('promotion').length > 0 && (
                    <section className="p-3 pb-1">
                      <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-gray-800"><span>Chương trình ưu đãi</span><span className="text-blue-600">Xem tất cả</span></div>
                      <div className="space-y-2">{previewItems('promotion').map((item) => <div key={item.id}>{renderPreviewImage(item, 'h-24 w-full rounded-xl')}<p className="mt-1 truncate text-[10px] text-gray-500">{actionLabel(item)}</p></div>)}</div>
                    </section>
                  )}
                  {previewItems('about').length > 0 && (
                    <section className="p-3">
                      <div className="mb-2 text-[11px] font-semibold text-gray-700">Về chúng tôi</div>
                      <div className="space-y-2">{previewItems('about').map((item) => <div key={item.id}>{renderPreviewImage(item, 'h-24 w-full rounded-xl')}<p className="mt-1 truncate text-[10px] text-gray-500">{actionLabel(item)}</p></div>)}</div>
                    </section>
                  )}
                  {previewItems('tier').length > 0 && (
                    <section className="p-3">
                      <div className="mb-2 text-[11px] font-semibold text-gray-700">Account — Thẻ hạng</div>
                      <div className="space-y-2">
                        {previewItems('tier').map((item) => (
                          <div key={item.id} className="relative h-36 overflow-hidden rounded-xl bg-[#B8C4E8]">
                            {imageUrl(item) && <img src={imageUrl(item)} alt={tierNames[item.contentKey] ?? item.contentKey} className="h-full w-full object-cover" />}
                            <span className="absolute left-4 top-4 text-sm font-bold text-gray-900">{tierNames[item.contentKey] ?? item.contentKey}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                  {previewItems('account').length > 0 && (
                    <section className="p-3">
                      <div className="mb-2 text-[11px] font-semibold text-gray-700">Account — Tiện ích</div>
                      <div className="grid grid-cols-2 gap-2">
                        {previewItems('account').map((item) => (
                          <div key={item.id} className={`relative overflow-hidden rounded-xl bg-white ${item.contentKey === 'account-coupons' ? 'row-span-2 min-h-36' : 'h-16'}`}>
                            {imageUrl(item) && <img src={imageUrl(item)} alt={accountLabels[item.contentKey]} className="absolute inset-0 h-full w-full object-cover" />}
                            <div className="relative p-2 text-[11px] font-bold text-gray-700">{accountLabels[item.contentKey]}<div className="text-lg">0</div></div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
