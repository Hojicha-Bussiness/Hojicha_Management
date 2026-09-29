'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createStampProgram, CONDITION_TYPE_LABELS, REWARD_TYPE_LABELS, CreateConditionData, CreateRewardTierData } from '@/services/stampPrograms';
import { getStores } from '@/services/stores';
import { getProducts } from '@/services/products';
import { getProductCategories } from '@/services/productCategories';
import { useAuthStore } from '@/store/authStore';

const inputCls = 'w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-100';
const selectCls = `${inputCls} appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10`;
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5';
const sectionCls = 'rounded-xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900/50';

export default function CreateStampProgramPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [stores, setStores] = useState<any[]>([]);
  const [selectedStoreIds, setSelectedStoreIds] = useState<number[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [showProductPicker, setShowProductPicker] = useState<{ target: 'condition' | 'tier'; index: number } | null>(null);
  const [productSearch, setProductSearch] = useState('');

  const [conditions, setConditions] = useState<CreateConditionData[]>([{ conditionType: 0, value: '' }]);
  const [rewardTiers, setRewardTiers] = useState<CreateRewardTierData[]>([{ stampRequired: 5, rewardType: 0, rewardValue: '', rewardDescription: '' }]);

  useEffect(() => {
    const brandId = useAuthStore.getState().user?.brandId;
    getStores(1, 200, brandId || undefined).then(res => {
      if (res?.data) setStores(res.data.items || res.data);
    }).catch(() => {});
    getProducts(1, 500).then(res => {
      if (res?.data) setProducts(Array.isArray(res.data) ? res.data : res.data.items || res.data.data || []);
    }).catch(() => {});
    getProductCategories(1, 200, brandId || undefined).then(res => {
      if (res?.data) setCategories(Array.isArray(res.data) ? res.data : res.data.items || []);
    }).catch(() => {});
  }, []);

  // Group products: parents first, children nested
  const productGroups = useMemo(() => {
    const parents = products.filter((p: any) => !p.generalProductId);
    const children = products.filter((p: any) => p.generalProductId);
    return parents.map((parent: any) => ({
      ...parent,
      children: children.filter((c: any) => c.generalProductId === (parent.productId || parent.id)),
    }));
  }, [products]);

  const filteredGroups = useMemo(() => {
    if (!productSearch) return productGroups;
    const q = productSearch.toLowerCase();
    return productGroups.filter((g: any) =>
      (g.productName || '').toLowerCase().includes(q) ||
      (g.code || '').toLowerCase().includes(q) ||
      g.children.some((c: any) =>
        (c.productName || '').toLowerCase().includes(q) || (c.code || '').toLowerCase().includes(q)
      )
    );
  }, [productGroups, productSearch]);

  const addCondition = () => setConditions(p => [...p, { conditionType: 0, value: '' }]);
  const removeCondition = (i: number) => setConditions(p => p.filter((_, idx) => idx !== i));
  const updateCondition = (i: number, field: string, val: any) => setConditions(p => p.map((c, idx) => idx === i ? { ...c, [field]: val } : c));

  const addTier = () => setRewardTiers(p => [...p, { stampRequired: 5, rewardType: 0, rewardValue: '', rewardDescription: '' }]);
  const removeTier = (i: number) => setRewardTiers(p => p.filter((_, idx) => idx !== i));
  const updateTier = (i: number, field: string, val: any) => setRewardTiers(p => p.map((t, idx) => idx === i ? { ...t, [field]: val } : t));

  const toggleStore = (id: number) => setSelectedStoreIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const handleSelectProduct = (product: any) => {
    if (!showProductPicker) return;
    const { target, index } = showProductPicker;
    const codes: string[] = [product.code];
    // If parent selected, include all children's codes
    if (product.generalProductId === null || product.generalProductId === undefined) {
      const parent = productGroups.find((g: any) => (g.productId || g.id) === (product.productId || product.id));
      if (parent) {
        parent.children.forEach((c: any) => { if (c.code) codes.push(c.code); });
      }
    }
    const value = [...new Set(codes)].filter(Boolean).join(',');
    if (target === 'condition') {
      updateCondition(index, 'value', value);
    } else {
      updateTier(index, 'rewardValue', value);
    }
    setShowProductPicker(null);
    setProductSearch('');
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const brandId = useAuthStore.getState().user?.brandId || 0;

    try {
      const res = await createStampProgram({
        brandId,
        displayName: fd.get('displayName') as string,
        description: (fd.get('description') as string) || undefined,
        fromDate: (fd.get('fromDate') as string) ? new Date(fd.get('fromDate') as string).toISOString() : undefined,
        toDate: (fd.get('toDate') as string) ? new Date(fd.get('toDate') as string).toISOString() : undefined,
        conditionLogic: fd.get('conditionLogic') as string || 'AND',
        storeIds: selectedStoreIds,
        conditions,
        rewardTiers,
      });
      if (res?.status === 201 || res?.status === 200) {
        toast.success('Created successfully');
        router.push('/stamp-programs');
      } else toast.error(res?.message || 'Failed');
    } catch (err: any) { toast.error(err?.message || 'Error'); }
    finally { setSubmitting(false); }
  };

  const productName = (code: string) => {
    const p = products.find((p: any) => p.code === code);
    return p ? p.productName : code;
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mx-auto max-w-4xl space-y-8 p-6">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => router.back()} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">←</button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Create Stamp Program</h1>
        </div>

        <div className={sectionCls}>
          <h2 className="mb-5 text-base font-semibold">Basic Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Display Name *</label>
              <input name="displayName" required className={inputCls} placeholder="e.g. Tích stamp mùa hè" />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Description</label>
              <textarea name="description" className={inputCls} rows={2} placeholder="Mô tả chương trình..." />
            </div>
            <div>
              <label className={labelCls}>From Date</label>
              <input name="fromDate" type="date" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>To Date</label>
              <input name="toDate" type="date" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Condition Logic</label>
              <select name="conditionLogic" className={selectCls}>
                <option value="AND">AND (tất cả điều kiện)</option>
                <option value="OR">OR (chỉ cần 1 điều kiện)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Conditions */}
        <div className={sectionCls}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Conditions</h2>
            <button type="button" onClick={addCondition} className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600">+ Add</button>
          </div>
          <div className="space-y-3">
            {conditions.map((c, i) => (
              <div key={i} className="flex items-end gap-3">
                <div className="flex-1">
                  <label className={labelCls}>Type</label>
                  <select value={c.conditionType} onChange={e => updateCondition(i, 'conditionType', Number(e.target.value))} className={selectCls}>
                    {Object.entries(CONDITION_TYPE_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                  </select>
                </div>
                <div className="flex-[2]">
                  <label className={labelCls}>Value</label>
                  {c.conditionType === 0 ? (
                    <button type="button" onClick={() => setShowProductPicker({ target: 'condition', index: i })}
                      className={`${inputCls} flex items-center gap-2 text-left truncate ${c.value ? 'text-gray-900' : 'text-gray-400'}`}>
                      {c.value ? c.value.split(',').map(code => productName(code)).join(', ') : 'Select products...'}
                    </button>
                  ) : c.conditionType === 1 ? (
                    <select
                      value={c.value}
                      onChange={e => updateCondition(i, 'value', e.target.value)}
                      className={selectCls}
                    >
                      <option value="">Chọn danh mục sản phẩm...</option>
                      {categories.map((cat: any) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.cateName || cat.name}
                        </option>
                      ))}
                    </select>
                  ) : c.conditionType === 2 ? (
                    <input type="number" value={c.value} onChange={e => updateCondition(i, 'value', e.target.value)} className={inputCls} placeholder="Min bill amount (VND)" />
                  ) : (
                    <input type="number" value={c.value} onChange={e => updateCondition(i, 'value', e.target.value)} className={inputCls} placeholder="Min quantity" />
                  )}
                </div>
                {conditions.length > 1 && <button type="button" onClick={() => removeCondition(i)} className="pb-1 text-red-400 text-sm">Remove</button>}
              </div>
            ))}
          </div>
        </div>

        {/* Reward Tiers */}
        <div className={sectionCls}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Reward Tiers</h2>
            <button type="button" onClick={addTier} className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600">+ Add</button>
          </div>
          <div className="space-y-3">
            {rewardTiers.map((t, i) => (
              <div key={i} className="rounded-lg border border-gray-100 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-800/30">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-gray-500">Tier #{i + 1}</span>
                  {rewardTiers.length > 1 && <button type="button" onClick={() => removeTier(i)} className="text-xs text-red-400">Remove</button>}
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className={labelCls}>Stamps Required</label>
                    <input type="number" value={t.stampRequired} onChange={e => updateTier(i, 'stampRequired', Number(e.target.value))} className={inputCls} min={1} />
                  </div>
                  <div>
                    <label className={labelCls}>Reward Type</label>
                    <select value={t.rewardType} onChange={e => updateTier(i, 'rewardType', Number(e.target.value))} className={selectCls}>
                      {Object.entries(REWARD_TYPE_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Reward Value</label>
                    {t.rewardType === 0 ? (
                      <button type="button" onClick={() => setShowProductPicker({ target: 'tier', index: i })}
                        className={`${inputCls} flex items-center gap-2 text-left truncate ${t.rewardValue ? 'text-gray-900' : 'text-gray-400'}`}>
                        {t.rewardValue ? t.rewardValue.split(',').map(code => productName(code)).join(', ') : 'Select product...'}
                      </button>
                    ) : (
                      <input value={t.rewardValue || ''} onChange={e => updateTier(i, 'rewardValue', e.target.value)} className={inputCls} placeholder="Amount / voucher code" />
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Description</label>
                    <input value={t.rewardDescription} onChange={e => updateTier(i, 'rewardDescription', e.target.value)} className={inputCls} placeholder="e.g. Tặng nón" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stores */}
        <div className={sectionCls}>
          <h2 className="mb-4 text-base font-semibold">Stores</h2>
          <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-lg border border-gray-100 p-3 dark:border-gray-800">
            {stores.map(store => (
              <label key={store.id || store.storeId} className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${selectedStoreIds.includes(store.id || store.storeId) ? 'bg-brand-50/50' : ''}`}>
                <input type="checkbox" checked={selectedStoreIds.includes(store.id || store.storeId)} onChange={() => toggleStore(store.id || store.storeId)} className="h-4 w-4 rounded border-gray-300 text-brand-500" />
                {store.name}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-400">Leave unchecked = all stores</p>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.back()} className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={submitting} className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-600 disabled:opacity-50">
            {submitting ? 'Creating...' : 'Create Program'}
          </button>
        </div>
      </div>

      {/* Product Picker Modal */}
      {showProductPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => { setShowProductPicker(null); setProductSearch(''); }}>
          <div className="mx-4 flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-2xl dark:bg-gray-900" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Select Product</h3>
              <button type="button" onClick={() => { setShowProductPicker(null); setProductSearch(''); }} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto px-5 py-4">
              <input type="text" value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="Search products..." autoFocus
                className="mb-3 w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-100" />
              <div className="space-y-1">
                {filteredGroups.length === 0 && <p className="py-8 text-center text-sm text-gray-400">No products found</p>}
                {filteredGroups.map((group: any) => (
                  <div key={group.productId || group.id}>
                    <button type="button" onClick={() => handleSelectProduct(group)}
                      className="flex w-full items-center gap-3 rounded-lg px-3.5 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors text-left">
                      {group.productName}
                      {group.code && <span className="text-xs text-gray-400">({group.code})</span>}
                      {group.children.length > 0 && <span className="text-xs text-gray-400 ml-auto">+{group.children.length} variants</span>}
                    </button>
                    {group.children.length > 0 && (
                      <div className="ml-6 space-y-0.5 border-l-2 border-gray-100 pl-3 dark:border-gray-700">
                        {group.children.map((child: any) => (
                          <button key={child.productId || child.id} type="button" onClick={() => handleSelectProduct(child)}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left">
                            {child.productName}
                            {child.code && <span className="text-xs text-gray-400">({child.code})</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
