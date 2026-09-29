'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  getStampProgramById,
  updateStampProgram,
  deleteStampProgram,
  CONDITION_TYPE_LABELS,
  REWARD_TYPE_LABELS,
  CreateConditionData,
  CreateRewardTierData,
} from '@/services/stampPrograms';
import { getStores } from '@/services/stores';
import { getProducts } from '@/services/products';
import { getProductCategories } from '@/services/productCategories';
import { useAuthStore } from '@/store/authStore';

const inputCls =
  'w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-brand-400 dark:focus:ring-brand-400/20';
const selectCls = `${inputCls} appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10`;
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5';
const sectionCls =
  'rounded-xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900/50';
const sectionTitleCls = 'mb-5 text-base font-semibold text-gray-900 dark:text-gray-100';
const chipCls =
  'inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300';

export default function StampProgramDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);
  const [program, setProgram] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [stores, setStores] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedStoreIds, setSelectedStoreIds] = useState<number[]>([]);
  const [conditions, setConditions] = useState<CreateConditionData[]>([]);
  const [rewardTiers, setRewardTiers] = useState<CreateRewardTierData[]>([]);
  const [showProductPicker, setShowProductPicker] = useState<{ target: 'condition' | 'tier'; index: number } | null>(null);
  const [productSearch, setProductSearch] = useState('');

  useEffect(() => {
    fetchProgram();
    const brandId = useAuthStore.getState().user?.brandId;
    getStores(1, 200, brandId || undefined)
      .then(res => { if (res?.data) setStores(res.data.items || res.data); })
      .catch(() => {});
    getProducts(1, 500)
      .then(res => {
        if (res?.data) setProducts(Array.isArray(res.data) ? res.data : res.data.items || res.data.data || []);
      })
      .catch(() => {});
    getProductCategories(1, 200, brandId || undefined)
      .then(res => {
        if (res?.data) {
          const list = Array.isArray(res.data) ? res.data : (res.data.items || res.data.data || []);
          setCategories(list);
        }
      })
      .catch(() => {});
  }, [id]);

  const fetchProgram = async () => {
    setLoading(true);
    try {
      const res = await getStampProgramById(id);
      if (res?.data) {
        setProgram(res.data);
        // Pre-populate edit form
        setSelectedStoreIds(
          (res.data.storeNames || []).map((s: string) => Number(s)).filter((n: number) => n > 0)
        );
        setConditions(
          (res.data.conditions || []).map((c: any) => ({
            conditionType: typeof c.conditionType === 'string' ? Number(c.conditionType) : c.conditionType,
            value: c.value,
          }))
        );
        setRewardTiers(
          (res.data.rewardTiers || []).map((t: any) => ({
            stampRequired: t.stampRequired,
            rewardType: typeof t.rewardType === 'string' ? Number(t.rewardType) : t.rewardType,
            rewardValue: t.rewardValue || '',
            rewardDescription: t.rewardDescription,
          }))
        );
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!confirm('Deactivate this program?')) return;
    try {
      const res = await deleteStampProgram(id);
      if (res?.status === 200) { toast.success('Deactivated'); router.push('/stamp-programs'); }
      else toast.error(res?.message);
    } catch (err: any) { toast.error(err?.message); }
  };

  // Product grouping
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
    return productGroups.filter(
      (g: any) =>
        (g.productName || '').toLowerCase().includes(q) ||
        (g.code || '').toLowerCase().includes(q) ||
        g.children.some(
          (c: any) =>
            (c.productName || '').toLowerCase().includes(q) || (c.code || '').toLowerCase().includes(q)
        )
    );
  }, [productGroups, productSearch]);

  const toggleStore = (storeId: number) =>
    setSelectedStoreIds(p => (p.includes(storeId) ? p.filter(id => id !== storeId) : [...p, storeId]));

  const addCondition = () => setConditions(p => [...p, { conditionType: 0, value: '' }]);
  const removeCondition = (i: number) => setConditions(p => p.filter((_, idx) => idx !== i));
  const updateCondition = (i: number, field: string, val: any) =>
    setConditions(p => p.map((c, idx) => (idx === i ? { ...c, [field]: val } : c)));

  const addTier = () =>
    setRewardTiers(p => [...p, { stampRequired: 5, rewardType: 0, rewardValue: '', rewardDescription: '' }]);
  const removeTier = (i: number) => setRewardTiers(p => p.filter((_, idx) => idx !== i));
  const updateTier = (i: number, field: string, val: any) =>
    setRewardTiers(p => p.map((t, idx) => (idx === i ? { ...t, [field]: val } : t)));

  const handleSelectProduct = (product: any) => {
    if (!showProductPicker) return;
    const { target, index } = showProductPicker;
    const codes: string[] = [product.code];
    if (product.generalProductId === null || product.generalProductId === undefined) {
      const parent = productGroups.find(
        g => (g.productId || g.id) === (product.productId || product.id)
      );
      if (parent) parent.children.forEach((c: any) => { if (c.code) codes.push(c.code); });
    }
    const value = [...new Set(codes)].filter(Boolean).join(',');
    if (target === 'condition') updateCondition(index, 'value', value);
    else updateTier(index, 'rewardValue', value);
    setShowProductPicker(null);
    setProductSearch('');
  };

  const productName = (code: string) => {
    const p = products.find((p: any) => p.code === code);
    return p ? p.productName : code;
  };

  const categoryName = (catId: string | number) => {
    const c = categories.find((cat: any) => String(cat.id) === String(catId));
    return c ? (c.cateName || c.name || `Danh mục #${catId}`) : `Danh mục #${catId}`;
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);

    // Validate
    if (conditions.some(c => !c.value.trim())) {
      toast.error('Please fill in all condition values');
      setSubmitting(false);
      return;
    }
    if (rewardTiers.some(t => !t.rewardDescription.trim())) {
      toast.error('Please fill in all reward descriptions');
      setSubmitting(false);
      return;
    }

    try {
      const res = await updateStampProgram(id, {
        displayName: fd.get('displayName') as string,
        description: (fd.get('description') as string) || undefined,
        fromDate: (fd.get('fromDate') as string)
          ? new Date(fd.get('fromDate') as string).toISOString()
          : undefined,
        toDate: (fd.get('toDate') as string)
          ? new Date(fd.get('toDate') as string).toISOString()
          : undefined,
        conditionLogic: fd.get('conditionLogic') as string,
        isActive: fd.get('isActive') === 'on',
        storeIds: selectedStoreIds,
        conditions,
        rewardTiers,
      });
      if (res?.status === 200) {
        toast.success('Updated successfully');
        setEditing(false);
        fetchProgram();
      } else toast.error(res?.message);
    } catch (err: any) {
      toast.error(err?.message || 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const fmtDate = (d: string) => {
    if (!d) return '';
    try { return new Date(d).toISOString().split('T')[0]; } catch { return d; }
  };

  if (loading) return <div className="p-6"><p className="text-gray-500">Loading...</p></div>;
  if (!program) return <div className="p-6"><p className="text-gray-500">Not found</p></div>;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/stamp-programs')}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          >
            ←
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{program.displayName}</h1>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              program.isActive
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
            }`}
          >
            {program.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div className="flex gap-3">
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-600"
            >
              ✎ Edit
            </button>
          )}
          {!editing && (
            <button
              onClick={handleDelete}
              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              Deactivate
            </button>
          )}
        </div>
      </div>

      {!editing ? (
        /* ── Read-Only View ── */
        <div className={sectionCls}>
          <div className="grid grid-cols-2 gap-6">
            <InfoRow label="Brand ID" value={String(program.brandId)} />
            <InfoRow label="Condition Logic" value={program.conditionLogic} />
            <InfoRow label="Description" value={program.description || '—'} />
            <InfoRow label="From Date" value={fmtDate(program.fromDate) || '—'} />
            <InfoRow label="To Date" value={fmtDate(program.toDate) || '—'} />
            <InfoRow
              label="Stores"
              value={program.storeNames?.length > 0 ? program.storeNames.join(', ') : 'All'}
            />
          </div>
          {program.conditions?.length > 0 && (
            <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
              <h3 className={sectionTitleCls}>Conditions</h3>
              <div className="space-y-1">
                {program.conditions.map((c: any, i: number) => {
                  const typeNum = Number(c.conditionType);
                  let displayVal = c.value;
                  if (typeNum === 0) {
                    displayVal = c.value ? c.value.split(',').map((code: string) => productName(code.trim())).join(', ') : '—';
                  } else if (typeNum === 1) {
                    displayVal = categoryName(c.value);
                  }
                  return (
                    <div
                      key={i}
                      className="rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-800/50"
                    >
                      {CONDITION_TYPE_LABELS[typeNum] || c.conditionType}: {displayVal}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {program.rewardTiers?.length > 0 && (
            <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
              <h3 className={sectionTitleCls}>Reward Tiers</h3>
              <div className="space-y-1">
                {program.rewardTiers.map((t: any, i: number) => (
                  <div
                    key={i}
                    className="rounded-lg bg-green-50 px-3 py-2 text-sm dark:bg-green-900/20"
                  >
                    {t.stampRequired} stamps → {t.rewardDescription}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── Edit Form ── */
        <form onSubmit={handleSave}>
          {/* Basic Information */}
          <div className={sectionCls}>
            <h2 className={sectionTitleCls}>Basic Information</h2>
            <div className="grid grid-cols-2 gap-x-5 gap-y-4">
              <div className="col-span-2">
                <label className={labelCls}>Display Name *</label>
                <input
                  name="displayName"
                  defaultValue={program.displayName}
                  required
                  className={inputCls}
                />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Description</label>
                <textarea
                  name="description"
                  defaultValue={program.description || ''}
                  className={inputCls}
                  rows={2}
                />
              </div>
              <div>
                <label className={labelCls}>From Date</label>
                <input
                  name="fromDate"
                  type="date"
                  defaultValue={fmtDate(program.fromDate)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>To Date</label>
                <input
                  name="toDate"
                  type="date"
                  defaultValue={fmtDate(program.toDate)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Condition Logic</label>
                <select
                  name="conditionLogic"
                  defaultValue={program.conditionLogic}
                  className={selectCls}
                >
                  <option value="AND">AND (all conditions)</option>
                  <option value="OR">OR (any condition)</option>
                </select>
              </div>
              <div className="flex items-end pb-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <input
                    name="isActive"
                    type="checkbox"
                    defaultChecked={program.isActive}
                    className="h-4 w-4 rounded border-gray-300 text-brand-500"
                  />
                  Active
                </label>
              </div>
            </div>
          </div>

          {/* Conditions */}
          <div className={sectionCls}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Conditions</h2>
              <button
                type="button"
                onClick={addCondition}
                className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600"
              >
                + Add
              </button>
            </div>
            <div className="space-y-3">
              {conditions.map((c, i) => (
                <div key={i} className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className={labelCls}>Type</label>
                    <select
                      value={c.conditionType}
                      onChange={e => updateCondition(i, 'conditionType', Number(e.target.value))}
                      className={selectCls}
                    >
                      {Object.entries(CONDITION_TYPE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-[2]">
                    <label className={labelCls}>Value</label>
                    {c.conditionType === 0 ? (
                      <button
                        type="button"
                        onClick={() => setShowProductPicker({ target: 'condition', index: i })}
                        className={`${inputCls} flex items-center gap-2 text-left truncate ${
                          c.value ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'
                        }`}
                      >
                        {c.value
                          ? c.value.split(',').map(code => productName(code)).join(', ')
                          : 'Select products...'}
                      </button>
                    ) : c.conditionType === 1 ? (
                      <select
                        value={c.value}
                        onChange={e => updateCondition(i, 'value', e.target.value)}
                        className={selectCls}
                      >
                        <option value="">-- Chọn danh mục sản phẩm --</option>
                        {categories.map((cat: any) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.cateName || cat.name || `Danh mục #${cat.id}`}
                          </option>
                        ))}
                      </select>
                    ) : c.conditionType === 2 ? (
                      <input
                        type="number"
                        value={c.value}
                        onChange={e => updateCondition(i, 'value', e.target.value)}
                        className={inputCls}
                        placeholder="Min bill amount (VND)"
                      />
                    ) : (
                      <input
                        type="number"
                        value={c.value}
                        onChange={e => updateCondition(i, 'value', e.target.value)}
                        className={inputCls}
                        placeholder="Min quantity"
                      />
                    )}
                  </div>
                  {conditions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCondition(i)}
                      className="pb-1 text-sm text-red-400 hover:text-red-600"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Reward Tiers */}
          <div className={sectionCls}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Reward Tiers</h2>
              <button
                type="button"
                onClick={addTier}
                className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600"
              >
                + Add
              </button>
            </div>
            <div className="space-y-3">
              {rewardTiers.map((t, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-gray-100 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-800/30"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Tier #{i + 1}</span>
                    {rewardTiers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTier(i)}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className={labelCls}>Stamps Required</label>
                      <input
                        type="number"
                        value={t.stampRequired}
                        onChange={e => updateTier(i, 'stampRequired', Number(e.target.value))}
                        className={inputCls}
                        min={1}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Reward Type</label>
                      <select
                        value={t.rewardType}
                        onChange={e => updateTier(i, 'rewardType', Number(e.target.value))}
                        className={selectCls}
                      >
                        {Object.entries(REWARD_TYPE_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Reward Value</label>
                      {t.rewardType === 0 ? (
                        <button
                          type="button"
                          onClick={() => setShowProductPicker({ target: 'tier', index: i })}
                          className={`${inputCls} flex items-center gap-2 text-left truncate ${
                            t.rewardValue ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'
                          }`}
                        >
                          {t.rewardValue
                            ? t.rewardValue.split(',').map(code => productName(code)).join(', ')
                            : 'Select product...'}
                        </button>
                      ) : (
                        <input
                          value={t.rewardValue || ''}
                          onChange={e => updateTier(i, 'rewardValue', e.target.value)}
                          className={inputCls}
                          placeholder="Amount / voucher code"
                        />
                      )}
                    </div>
                    <div>
                      <label className={labelCls}>Description</label>
                      <input
                        value={t.rewardDescription}
                        onChange={e => updateTier(i, 'rewardDescription', e.target.value)}
                        className={inputCls}
                        placeholder="e.g. Free hat"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stores */}
          <div className={sectionCls}>
            <h2 className={sectionTitleCls}>Stores</h2>
            <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-lg border border-gray-100 p-3 dark:border-gray-800">
              {stores.length === 0 && (
                <p className="text-sm text-gray-400">Loading stores...</p>
              )}
              {stores.map(store => (
                <label
                  key={store.id || store.storeId}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${
                    selectedStoreIds.includes(store.id || store.storeId)
                      ? 'bg-brand-50/50 dark:bg-brand-900/20'
                      : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedStoreIds.includes(store.id || store.storeId)}
                    onChange={() => toggleStore(store.id || store.storeId)}
                    className="h-4 w-4 rounded border-gray-300 text-brand-500"
                  />
                  {store.name}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-400">Leave unchecked = all stores</p>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                fetchProgram(); // Reset to original data
              }}
              className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-600 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}

      {/* ── Product Picker Modal ── */}
      {showProductPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Select Product</h3>
              <button
                type="button"
                onClick={() => {
                  setShowProductPicker(null);
                  setProductSearch('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <input
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              className={`${inputCls} mb-3`}
              placeholder="Search products..."
              autoFocus
            />
            <div className="max-h-72 overflow-y-auto space-y-1">
              {filteredGroups.length === 0 && (
                <p className="py-4 text-center text-sm text-gray-400">No products found</p>
              )}
              {filteredGroups.map(group => (
                <div key={group.productId || group.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectProduct(group)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-brand-50 dark:hover:bg-brand-900/20 ${
                      (showProductPicker.target === 'condition'
                        ? conditions[showProductPicker.index]?.value
                        : rewardTiers[showProductPicker.index]?.rewardValue
                      )?.includes(group.code)
                        ? 'bg-brand-50 dark:bg-brand-900/30'
                        : ''
                    }`}
                  >
                    <div className="font-medium text-gray-900 dark:text-gray-100">{group.productName}</div>
                    {group.children.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {group.children.map((child: any) => (
                          <button
                            key={child.productId || child.id}
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              handleSelectProduct(child);
                            }}
                            className={`ml-3 block w-full rounded px-2 py-1 text-left text-xs transition-colors hover:bg-brand-50/50 dark:hover:bg-brand-900/10 ${
                              (showProductPicker.target === 'condition'
                                ? conditions[showProductPicker.index]?.value
                                : rewardTiers[showProductPicker.index]?.rewardValue
                              )?.includes(child.code)
                                ? 'text-brand-700 dark:text-brand-400'
                                : 'text-gray-500 dark:text-gray-400'
                            }`}
                          >
                            {child.productName} ({child.code})
                          </button>
                        ))}
                      </div>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
        {label}
      </span>
      <p className="mt-0.5 text-sm text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}
