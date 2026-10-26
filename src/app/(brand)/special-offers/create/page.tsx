'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  createSpecialOffer,
  BENEFIT_TYPE_LABELS,
  REDEMPTION_FLOW_LABELS,
  CreateSpecialOfferData,
  CreateBenefitItem,
} from '@/services/specialOffers';
import { getStores } from '@/services/stores';
import { getProducts } from '@/services/products';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/services/apiClient';

const inputCls = 'w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-brand-400 dark:focus:ring-brand-400/20';
const selectCls = `${inputCls} appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10`;
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5';
const sectionCls = 'rounded-xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900/50';
const sectionTitleCls = 'mb-5 text-base font-semibold text-gray-900 dark:text-gray-100';
const chipCls = 'inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300';

export default function CreateSpecialOfferPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [stores, setStores] = useState<any[]>([]);
  const [selectedStoreIds, setSelectedStoreIds] = useState<number[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<any[]>([]);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [showProductModal, setShowProductModal] = useState<{ idx: number } | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [benefitRows, setBenefitRows] = useState<CreateBenefitItem[]>([
    { benefitType: 0, sortOrder: 0 }
  ]);

  useEffect(() => {
    fetchStores();
    fetchProducts();
  }, []);

  const fetchStores = async () => {
    try {
      const brandId = useAuthStore.getState().user?.brandId;
      const res = await getStores(1, 200, brandId || undefined);
      if (res?.data) setStores(res.data.items || res.data);
    } catch { /* ignore */ }
  };

  const fetchProducts = async () => {
    try {
      const res = await getProducts(1, 500);
      if (res?.data) setProducts(Array.isArray(res.data) ? res.data : res.data.items || res.data.data || []);
    } catch { /* ignore */ }
  };

  const toggleStore = (storeId: number) =>
    setSelectedStoreIds(p => p.includes(storeId) ? p.filter(id => id !== storeId) : [...p, storeId]);

  const searchCustomers = (q: string) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (q.length < 2) { setCustomerResults([]); return; }
    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await api.get(`/admin/super-vip/customers/search?q=${encodeURIComponent(q)}`);
        setCustomerResults(res?.data || []);
      } catch { setCustomerResults([]); }
      finally { setSearching(false); }
    }, 1000);
  };

  const toggleCustomer = (customer: any) =>
    setSelectedCustomers(p =>
      p.find(c => c.customerId === customer.customerId)
        ? p.filter(c => c.customerId !== customer.customerId)
        : [...p, customer]);

  const removeCustomer = (id: number) => setSelectedCustomers(p => p.filter(c => c.customerId !== id));

  // Benefit row handlers
  const addBenefitRow = () => setBenefitRows(p => [...p, { benefitType: 0, sortOrder: p.length }]);
  const removeBenefitRow = (idx: number) => setBenefitRows(p => p.filter((_, i) => i !== idx).map((r, i) => ({ ...r, sortOrder: i })));
  const updateBenefitRow = (idx: number, field: string, value: any) =>
    setBenefitRows(p => p.map((r, i) => i === idx ? { ...r, [field]: value } : r));

  const setProductForRow = (idx: number, product: any) => {
    setBenefitRows(p => p.map((r, i) => i === idx ? { ...r, buyProductCode: product?.code || undefined } : r));
  };

  const filteredProducts = products.filter((p: any) =>
    !productSearch || (p.productName || p.code || '').toLowerCase().includes(productSearch.toLowerCase())
  );

  const label = (text: string, required?: boolean) => (
    <label className={labelCls}>{text}{required && <span className="ml-0.5 text-red-400">*</span>}</label>
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);

    const applyFromTime = fd.get('applyFromTime') as string;
    const applyToTime = fd.get('applyToTime') as string;

    const fromDateStr = fd.get('fromDate') as string;
    const toDateStr = fd.get('toDate') as string;

    const payload: CreateSpecialOfferData = {
      displayName: fd.get('displayName') as string,
      description: (fd.get('description') as string) || undefined,
      sortOrder: Number(fd.get('sortOrder')) || 0,
      fromDate: fromDateStr ? (fromDateStr.includes('T') ? new Date(fromDateStr).toISOString() : new Date(`${fromDateStr}T00:00:00.000Z`).toISOString()) : undefined,
      toDate: toDateStr ? (toDateStr.includes('T') ? new Date(toDateStr).toISOString() : new Date(`${toDateStr}T23:59:59.999Z`).toISOString()) : undefined,
      applyFromTime: applyFromTime ? parseInt(applyFromTime.replace(':', ''), 10) : undefined,
      applyToTime: applyToTime ? parseInt(applyToTime.replace(':', ''), 10) : undefined,
      isRecurring: fd.get('isRecurring') === 'on',
      maxUsagePerCustomer: fd.get('maxUsagePerCustomer') ? Number(fd.get('maxUsagePerCustomer')) : undefined,
      redemptionFlow: Number(fd.get('redemptionFlow')),
      isStackable: fd.get('isStackable') === 'on',
      isSelfSelect: fd.get('isSelfSelect') === 'on',
      customerIds: selectedCustomers.map(c => c.customerId),
      storeIds: selectedStoreIds,
      benefitItems: benefitRows,
    };

    try {
      const res = await createSpecialOffer(payload);
      if (res?.status === 201 || res?.status === 200) {
        toast.success('Created successfully');
        router.push('/special-offers');
      } else {
        toast.error(res?.message || 'Failed to create');
      }
    } catch (err: any) {
      toast.error(err?.message || 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mx-auto max-w-5xl space-y-8 p-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => router.back()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Create Special Offer</h1>
            <p className="mt-0.5 text-sm text-gray-500">Configure promotional benefits for selected customers</p>
          </div>
        </div>

        {/* Basic Information */}
        <div className={sectionCls}>
          <h2 className={sectionTitleCls}>Basic Information</h2>
          <div className="grid grid-cols-2 gap-x-5 gap-y-4">
            <div className="col-span-2">{label('Display Name', true)}
              <input name="displayName" required className={inputCls} placeholder="e.g. Ưu đãi mùa hè" />
            </div>
            <div className="col-span-2">{label('Description')}
              <textarea name="description" className={inputCls} rows={2} placeholder="Describe the offer..." />
            </div>
            <div>{label('Redemption Flow')}
              <select name="redemptionFlow" className={selectCls}>
                {Object.entries(REDEMPTION_FLOW_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
              </select>
            </div>
            <div>{label('Sort Order')}
              <input name="sortOrder" type="number" className={inputCls} defaultValue={0} />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-5 border-t border-gray-100 pt-4 dark:border-gray-800">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <input name="isSelfSelect" type="checkbox" className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500/20" />
              Self-select at POS
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <input name="isStackable" type="checkbox" className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500/20" defaultChecked />
              Stackable
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <input name="isRecurring" type="checkbox" className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500/20" />
              Recurring
            </label>
          </div>
        </div>

        {/* Benefit Items (multi-row) */}
        <div className={sectionCls}>
          <div className="flex items-center justify-between">
            <h2 className={sectionTitleCls}>Benefit Items</h2>
            <button type="button" onClick={addBenefitRow}
              className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-600">+ Add item</button>
          </div>
          <div className="space-y-4">
            {benefitRows.map((row, idx) => (
              <div key={idx} className="rounded-lg border border-gray-100 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-800/30">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Item #{idx + 1}</span>
                  {benefitRows.length > 1 && (
                    <button type="button" onClick={() => removeBenefitRow(idx)}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors">Remove</button>
                  )}
                </div>
                <div className="grid grid-cols-12 gap-x-3 gap-y-3">
                  {/* Product selector */}
                  <div className="col-span-4">
                    <label className={labelCls}>Product</label>
                    <button type="button" onClick={() => { setProductSearch(''); setShowProductModal({ idx }); }}
                      className={`${inputCls} flex items-center gap-2 text-left truncate ${row.buyProductCode ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}>
                      {row.buyProductCode || 'Select product...'}
                    </button>
                  </div>
                  {/* Benefit Type */}
                  <div className="col-span-3">
                    <label className={labelCls}>Type</label>
                    <select value={row.benefitType} onChange={e => updateBenefitRow(idx, 'benefitType', Number(e.target.value))} className={selectCls}>
                      {Object.entries(BENEFIT_TYPE_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                    </select>
                  </div>
                  {/* Discount Amount */}
                  <div className="col-span-2">
                    <label className={labelCls}>Amount</label>
                    <input type="number" value={row.discountAmount ?? ''} onChange={e => updateBenefitRow(idx, 'discountAmount', e.target.value ? Number(e.target.value) : undefined)}
                      className={inputCls} placeholder="20000" />
                  </div>
                  {/* Discount Rate */}
                  <div className="col-span-2">
                    <label className={labelCls}>Rate (%)</label>
                    <input type="number" step="0.1" value={row.discountRate ?? ''} onChange={e => updateBenefitRow(idx, 'discountRate', e.target.value ? Number(e.target.value) : undefined)}
                      className={inputCls} placeholder="10" />
                  </div>
                  {/* Min Quantity */}
                  <div className="col-span-1">
                    <label className={labelCls}>Min Qty</label>
                    <input type="number" value={row.minQuantity ?? ''} onChange={e => updateBenefitRow(idx, 'minQuantity', e.target.value ? Number(e.target.value) : undefined)}
                      className={inputCls} placeholder="1" />
                  </div>
                </div>
              </div>
            ))}
            {benefitRows.length === 0 && (
              <button type="button" onClick={addBenefitRow}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 p-6 text-sm text-gray-400 transition-colors hover:border-brand-300 hover:text-brand-500 dark:border-gray-700">
                + Add first benefit item
              </button>
            )}
          </div>
        </div>

        {/* Time Constraints */}
        <div className={sectionCls}>
          <h2 className={sectionTitleCls}>Time Constraints</h2>
          <div className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4">
            <div>{label('From Date')}<input name="fromDate" type="date" className={inputCls} /></div>
            <div>{label('To Date')}<input name="toDate" type="date" className={inputCls} /></div>
            <div>{label('From Time')}<input name="applyFromTime" type="time" className={inputCls} /></div>
            <div>{label('To Time')}<input name="applyToTime" type="time" className={inputCls} /></div>
          </div>
          <p className="mt-3 text-xs text-gray-400">Leave empty for no time restriction.</p>
        </div>

        {/* Usage Limits */}
        <div className={sectionCls}>
          <h2 className={sectionTitleCls}>Usage Limits</h2>
          <div className="grid grid-cols-3 gap-x-5 gap-y-4">
            <div>{label('Max Per Customer')}<input name="maxUsagePerCustomer" type="number" className={inputCls} placeholder="1" /></div>
            <div>{label('Max Per Day')}<input name="maxUsagePerDay" type="number" className={inputCls} placeholder="50" /></div>
            <div>{label('Max Per Store')}<input name="maxUsagePerStore" type="number" className={inputCls} placeholder="10" /></div>
          </div>
        </div>

        {/* Target Customers */}
        <div className={sectionCls}>
          <div className="flex items-center justify-between">
            <h2 className={sectionTitleCls}>Target Customers</h2>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">{selectedCustomers.length} selected</span>
          </div>
          {selectedCustomers.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {selectedCustomers.map(c => (
                <span key={c.customerId} className={chipCls}>
                  {c.name}
                  <button type="button" onClick={() => removeCustomer(c.customerId)}
                    className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-brand-400 hover:bg-brand-200 hover:text-brand-600 dark:hover:bg-brand-800">&times;</button>
                </span>
              ))}
            </div>
          )}
          <button type="button" onClick={() => setShowCustomerModal(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 p-4 text-sm text-gray-400 transition-colors hover:border-brand-300 hover:text-brand-500 dark:border-gray-700 dark:hover:border-brand-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Search & Add Customers
          </button>
        </div>

        {/* Stores */}
        <div className={sectionCls}>
          <div className="flex items-center justify-between">
            <h2 className={sectionTitleCls}>Stores</h2>
            {stores.length > 0 && (
              <div className="flex gap-1.5">
                <button type="button" onClick={() => setSelectedStoreIds(stores.map(s => s.id || s.storeId))}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${selectedStoreIds.length === stores.length ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'}`}>All</button>
                <button type="button" onClick={() => setSelectedStoreIds([])}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${selectedStoreIds.length === 0 ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'}`}>None</button>
              </div>
            )}
          </div>
          <div className="mt-3 max-h-48 space-y-0.5 overflow-y-auto rounded-lg border border-gray-100 p-2 dark:border-gray-800">
            {stores.length === 0 && <p className="py-6 text-center text-sm text-gray-400">Loading stores...</p>}
            {stores.map(store => (
              <label key={store.id || store.storeId}
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${selectedStoreIds.includes(store.id || store.storeId) ? 'bg-brand-50/50 dark:bg-brand-900/10' : ''}`}>
                <input type="checkbox" checked={selectedStoreIds.includes(store.id || store.storeId)}
                  onChange={() => toggleStore(store.id || store.storeId)}
                  className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500/20" />
                <span className="text-gray-700 dark:text-gray-300">{store.name}</span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-400">Leave unchecked to apply to all stores.</p>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button type="button" onClick={() => router.back()}
            className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800">Cancel</button>
          <button type="submit" disabled={submitting}
            className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50">
            {submitting ? 'Creating...' : 'Create Offer'}
          </button>
        </div>
      </div>

      {/* Customer Search Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowCustomerModal(false)}>
          <div className="mx-4 flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-2xl dark:bg-gray-900" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Select Customers</h3>
              <button type="button" onClick={() => setShowCustomerModal(false)}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto px-5 py-4">
              <input type="text" value={customerSearch} onChange={e => { setCustomerSearch(e.target.value); searchCustomers(e.target.value); }}
                placeholder="Type name, phone or email..." autoFocus
                className="mb-3 w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-100" />
              {searching && <p className="py-4 text-center text-sm text-gray-400">Searching...</p>}
              {customerResults.length > 0 && (
                <div className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-100 dark:divide-gray-800 dark:border-gray-800">
                  {customerResults.map(c => {
                    const sel = selectedCustomers.some(s => s.customerId === c.customerId);
                    return (
                      <div key={c.customerId} onClick={() => toggleCustomer(c)}
                        className={`flex cursor-pointer items-center gap-3 px-3.5 py-3 text-sm transition-colors ${sel ? 'bg-brand-50/50 dark:bg-brand-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                        <input type="checkbox" checked={sel} readOnly className="h-4 w-4 rounded border-gray-300 text-brand-500" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate dark:text-gray-100">{c.name}</p>
                          <p className="text-xs text-gray-500 truncate">{[c.phone, c.email].filter(Boolean).join(' · ')}</p>
                        </div>
                        <span className="shrink-0 text-xs text-gray-400">#{c.customerId}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {customerSearch.length >= 2 && customerResults.length === 0 && !searching && <p className="py-8 text-center text-sm text-gray-400">No customers found</p>}
              {customerSearch.length < 2 && <p className="py-8 text-center text-sm text-gray-400">Type at least 2 characters to search</p>}
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 dark:border-gray-800">
              <span className="text-sm text-gray-500">{selectedCustomers.length} customer{selectedCustomers.length !== 1 ? 's' : ''} selected</span>
              <button type="button" onClick={() => setShowCustomerModal(false)}
                className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Product Search Modal (for benefit items) */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowProductModal(null)}>
          <div className="mx-4 flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-2xl dark:bg-gray-900" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Select Product</h3>
              <button type="button" onClick={() => setShowProductModal(null)}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto px-5 py-4">
              <input type="text" value={productSearch} onChange={e => setProductSearch(e.target.value)}
                placeholder="Search products..." autoFocus
                className="mb-3 w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-100" />
              <div className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-100 dark:divide-gray-800 dark:border-gray-800">
                {filteredProducts.length === 0 && <p className="py-8 text-center text-sm text-gray-400">No products found</p>}
                {filteredProducts.map((p: any) => (
                  <div key={p.productId || p.code} onClick={() => {
                    setProductForRow(showProductModal.idx, p);
                    setShowProductModal(null);
                  }}
                    className="flex cursor-pointer items-center gap-3 px-3.5 py-3 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate dark:text-gray-100">{p.productName}</p>
                      <p className="text-xs text-gray-500">Code: {p.code}</p>
                    </div>
                    {p.price && <span className="shrink-0 text-xs font-medium text-gray-500">{Number(p.price).toLocaleString('vi-VN')}₫</span>}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end border-t border-gray-100 px-5 py-3 dark:border-gray-800">
              <button type="button" onClick={() => setShowProductModal(null)}
                className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600">Done</button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
