'use client';
import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  getPromotionById,
  updatePromotion,
  updatePromotionDetail,
  updateStoreMapping,
  generateVouchers,
  getVouchersByPromotion,
  PROMOTION_TYPE_LABELS,
  GIFT_TYPE_LABELS,
  APPLY_LEVEL_LABELS,
  UpdatePromotionData,
  createPromotionDetail,
  CreatePromotionDetailData,
  addStoreMapping,
} from '@/services/promotions';
import { getProductCategories } from '@/services/productCategories';
import { getProducts } from '@/services/products';
import { getStores } from '@/services/stores';
import { useAuthStore } from '@/store/authStore';

type TabKey = 'overview' | 'details' | 'stores' | 'vouchers';

export default function PromotionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const promotionId = Number(params.id);

  const [promo, setPromo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [editingDetailId, setEditingDetailId] = useState<number | null>(null);
  const [editingDetailData, setEditingDetailData] = useState<any>({});
  const [addingDetail, setAddingDetail] = useState(false);
  const [newDetailData, setNewDetailData] = useState<any>({});

  // Store state
  const [stores, setStores] = useState<any[]>([]);
  const [addingStore, setAddingStore] = useState(false);
  const [selectedNewStoreIds, setSelectedNewStoreIds] = useState<number[]>([]);
  const [addingStoreLoading, setAddingStoreLoading] = useState(false);
  const [storeSearch, setStoreSearch] = useState('');

  // Editing state
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<UpdatePromotionData>({});
  const [saving, setSaving] = useState(false);

  // Voucher state
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [vouchersLoading, setVouchersLoading] = useState(false);
  const [genCount, setGenCount] = useState(10);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (promotionId) {
      fetchPromotion();
      fetchCategories();
      fetchProducts();
      fetchStores();
    }
  }, [promotionId]);

  useEffect(() => {
    if (activeTab === 'vouchers' && vouchers.length === 0) fetchVouchers();
  }, [activeTab]);

  const fetchPromotion = async () => {
    setLoading(true);
    try {
      const res = await getPromotionById(promotionId);
      if (res && res.data) {
        setPromo(res.data);
        setEditData({
          promotionName: res.data.promotionName,
          shortDescription: res.data.shortDescription,
          description: res.data.description,
          imageUrl: res.data.imageUrl,
          applyLevel: res.data.applyLevel,
          giftType: res.data.giftType,
          promotionType: res.data.promotionType,
          isForMember: res.data.isForMember,
          fromDate: res.data.fromDate,
          toDate: res.data.toDate,
          applyFromTime: res.data.applyFromTime,
          applyToTime: res.data.applyToTime,
          isVoucher: res.data.isVoucher,
          isApplyOnce: res.data.isApplyOnce,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await getProductCategories(1, 500);
      if (res && res.data) {
        const cats = Array.isArray(res.data) ? res.data : res.data.items || res.data.data || [];
        setCategories(cats);
      }
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await getProducts(1, 500);
      if (res && res.data) {
        const prods = Array.isArray(res.data) ? res.data : res.data.items || res.data.data || [];
        setProducts(prods);
      }
    } catch (err) {
      console.error('Failed to load products', err);
    }
  };

  const fetchStores = async () => {
    try {
      const brandId = useAuthStore.getState().user?.brandId;
      const res = await getStores(1, 200, brandId || undefined);
      if (res && res.data) {
        setStores(res.data.items || res.data);
      }
    } catch (err) {
      console.error('Failed to load stores', err);
    }
  };

  const fetchVouchers = async () => {
    setVouchersLoading(true);
    try {
      const res = await getVouchersByPromotion(promotionId, 1, 100);
      if (res && res.data) {
        setVouchers(res.data.items || res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setVouchersLoading(false);
    }
  };

  const handleSaveOverview = async () => {
    setSaving(true);
    try {
      await updatePromotion(promotionId, editData);
      toast.success('Promotion updated!');
      setEditing(false);
      fetchPromotion();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStoreMapping = async (mappingId: number, currentActive: boolean) => {
    try {
      await updateStoreMapping(mappingId, { active: !currentActive });
      toast.success('Store mapping updated!');
      fetchPromotion();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const handleAddStores = async () => {
    if (selectedNewStoreIds.length === 0) return;
    setAddingStoreLoading(true);
    try {
      await Promise.all(selectedNewStoreIds.map((storeId) => addStoreMapping(promotionId, storeId)));
      toast.success(`Đã thêm ${selectedNewStoreIds.length} cửa hàng vào promotion!`);
      setAddingStore(false);
      setSelectedNewStoreIds([]);
      setStoreSearch('');
      fetchPromotion();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setAddingStoreLoading(false);
    }
  };

  const handleGenerateVouchers = async () => {
    if (genCount <= 0) return;
    setGenerating(true);
    try {
      await generateVouchers(promotionId, { count: genCount });
      toast.success(`${genCount} voucher(s) generated!`);
      fetchVouchers();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const setNewEd = (field: string, value: any) => setNewDetailData((prev: any) => ({ ...prev, [field]: value }));

  const handleSaveNewDetail = async () => {
    try {
      const payload: any = {
        buyProductCode: newDetailData.buyProductCode || '',
        giftProductCode: newDetailData.giftProductCode || '',
        discountRate: newDetailData.discountRate,
        discountAmount: newDetailData.discountAmount,
        minOrderAmount: newDetailData.minOrderAmount,
        maxOrderAmount: newDetailData.maxOrderAmount,
        minBuyQuantity: newDetailData.minBuyQuantity,
        maxBuyQuantity: newDetailData.maxBuyQuantity,
        giftQuantity: newDetailData.giftQuantity,
        promotionDetailCode: newDetailData.promotionDetailCode || undefined,
      };

      // Convert giftProductCode if Category ID
      const isGiftType = promo.giftType === 1;
      if (payload.giftProductCode && isGiftType && !payload.giftProductCode.toString().startsWith('P:')) {
        payload.giftProductCode = String(Number(payload.giftProductCode));
      }

      await createPromotionDetail(promotionId, payload);
      toast.success('Detail rule added!');
      setAddingDetail(false);
      fetchPromotion();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
  };

  /* ─── helpers ─── */
  const fmtDate = (d: string | null) => {
    if (!d) return 'N/A';
    try { return new Date(d).toLocaleDateString('vi-VN'); } catch { return d; }
  };

  const tabClasses = (key: TabKey) =>
    `px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${activeTab === key
      ? 'bg-brand-500 text-white shadow-sm'
      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
    }`;

  const inputCls = 'w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-colors';
  const labelCls = 'block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300';

  /* ─── render ─── */
  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  if (!promo) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <p className="text-red-500">Promotion not found.</p>
        <button onClick={() => router.back()} className="mt-4 text-brand-500 hover:underline">← Back</button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/promotions')} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
          &larr; Back
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{promo.promotionName}</h1>
          <p className="text-sm text-gray-400 font-mono">{promo.promotionCode}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${promo.active
          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
          }`}>
          {promo.active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b dark:border-gray-700 pb-2">
        <button className={tabClasses('overview')} onClick={() => setActiveTab('overview')}>Overview</button>
        <button className={tabClasses('details')} onClick={() => setActiveTab('details')}>
          Detail Rules ({promo.details?.length || 0})
        </button>
        <button className={tabClasses('stores')} onClick={() => setActiveTab('stores')}>
          Stores ({promo.storeMappings?.length || 0})
        </button>
        <button className={tabClasses('vouchers')} onClick={() => setActiveTab('vouchers')}>Vouchers</button>
      </div>

      {/* ─── Tab: Overview ─── */}
      {activeTab === 'overview' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 space-y-6">
          {!editing ? (
            <>
              <div className="flex justify-end">
                <button onClick={() => setEditing(true)} className="text-sm font-medium text-brand-500 hover:text-brand-600 transition-colors">
                  ✎ Edit
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <InfoRow label="Promotion Type" value={PROMOTION_TYPE_LABELS[promo.promotionType] || promo.promotionType} />
                <InfoRow label="Gift Type" value={GIFT_TYPE_LABELS[promo.giftType] || promo.giftType} />
                <InfoRow label="Apply Level" value={APPLY_LEVEL_LABELS[promo.applyLevel] || promo.applyLevel} />
                <InfoRow label="Members Only" value={promo.isForMember ? 'Yes' : 'No'} />
                <InfoRow label="Period" value={`${fmtDate(promo.fromDate)} → ${fmtDate(promo.toDate)}`} />
                <InfoRow label="Apply Hours" value={
                  promo.applyFromTime != null ? `${promo.applyFromTime}:00 – ${promo.applyToTime}:00` : 'All day'
                } />
                <InfoRow label="Is Voucher" value={promo.isVoucher ? 'Yes' : 'No'} />
                <InfoRow label="Apply Once" value={promo.isApplyOnce ? 'Yes' : 'No'} />
              </div>
              {promo.shortDescription && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Short Description</h3>
                  <p className="text-sm dark:text-gray-200">{promo.shortDescription}</p>
                </div>
              )}
              {promo.description && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Description</h3>
                  <p className="text-sm dark:text-gray-200 whitespace-pre-wrap">{promo.description}</p>
                </div>
              )}
            </>
          ) : (
            /* ─── Edit form ─── */
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Promotion Name</label>
                  <input className={inputCls} value={editData.promotionName || ''} onChange={(e) => setEditData((p) => ({ ...p, promotionName: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Promotion Type</label>
                  <select className={inputCls} value={editData.promotionType ?? ''} onChange={(e) => setEditData((p) => ({ ...p, promotionType: Number(e.target.value) }))}>
                    {Object.entries(PROMOTION_TYPE_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Gift Type</label>
                  <select className={inputCls} value={editData.giftType ?? ''} onChange={(e) => setEditData((p) => ({ ...p, giftType: Number(e.target.value) }))}>
                    {Object.entries(GIFT_TYPE_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Apply Level</label>
                  <select className={inputCls} value={editData.applyLevel ?? ''} onChange={(e) => setEditData((p) => ({ ...p, applyLevel: Number(e.target.value) }))}>
                    {Object.entries(APPLY_LEVEL_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>From Date</label>
                  <input type="date" className={inputCls} value={editData.fromDate ? editData.fromDate.split('T')[0] : ''} onChange={(e) => setEditData((p) => ({ ...p, fromDate: new Date(e.target.value).toISOString() }))} />
                </div>
                <div>
                  <label className={labelCls}>To Date</label>
                  <input type="date" className={inputCls} value={editData.toDate ? editData.toDate.split('T')[0] : ''} onChange={(e) => setEditData((p) => ({ ...p, toDate: new Date(e.target.value).toISOString() }))} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Short Description</label>
                <input className={inputCls} value={editData.shortDescription || ''} onChange={(e) => setEditData((p) => ({ ...p, shortDescription: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea rows={3} className={inputCls} value={editData.description || ''} onChange={(e) => setEditData((p) => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editData.isForMember || false} onChange={(e) => setEditData((p) => ({ ...p, isForMember: e.target.checked }))} className="w-4 h-4 rounded text-brand-500" />
                  <span className="text-sm dark:text-gray-300">Members Only</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editData.isVoucher || false} onChange={(e) => setEditData((p) => ({ ...p, isVoucher: e.target.checked }))} className="w-4 h-4 rounded text-brand-500" />
                  <span className="text-sm dark:text-gray-300">Is Voucher</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editData.isApplyOnce || false} onChange={(e) => setEditData((p) => ({ ...p, isApplyOnce: e.target.checked }))} className="w-4 h-4 rounded text-brand-500" />
                  <span className="text-sm dark:text-gray-300">Apply Once</span>
                </label>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setEditing(false)} className="px-4 py-2 border rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  Cancel
                </button>
                <button onClick={handleSaveOverview} disabled={saving} className="px-5 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors font-medium disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Tab: Detail Rules ─── */}
      {activeTab === 'details' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center gap-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex-1">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>💡 Tip:</strong> Click <strong>✎ Edit</strong> on any rule to modify all fields. GiftType: <strong>{GIFT_TYPE_LABELS[promo.giftType] || promo.giftType}</strong>
              </p>
            </div>
            {!addingDetail && (
              <button
                onClick={() => {
                  setAddingDetail(true);
                  setNewDetailData({});
                }}
                className="px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium text-sm transition-colors shadow-sm whitespace-nowrap"
              >
                + Add Rule
              </button>
            )}
          </div>

          {/* New Rule Form */}
          {addingDetail && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 border-2 border-brand-500/30 space-y-4">
              <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200">
                Add New Rule
              </h3>
              <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                {/* BuyProductCode picker */}
                <div>
                  <label className={labelCls}>Áp dụng theo (Buy Product)</label>
                  <div className="flex gap-3 mb-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="radio" name="newBuyMode" checked={!newDetailData.buyProductCode?.toString().startsWith('P:')}
                        onChange={() => setNewEd('buyProductCode', undefined)} className="w-4 h-4 text-brand-500" />
                      <span className="text-sm font-medium dark:text-gray-300">Category</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="radio" name="newBuyMode" checked={newDetailData.buyProductCode?.toString().startsWith('P:') || false}
                        onChange={() => setNewEd('buyProductCode', 'P:')} className="w-4 h-4 text-brand-500" />
                      <span className="text-sm font-medium dark:text-gray-300">Sản phẩm cụ thể</span>
                    </label>
                  </div>
                  {newDetailData.buyProductCode?.toString().startsWith('P:') ? (
                    <div>
                      <input type="text" placeholder="🔍 Tìm sản phẩm..." className={`${inputCls} mb-2`}
                        value={newDetailData._buySearch || ''} onChange={(e) => setNewEd('_buySearch', e.target.value)} />
                      <div className="max-h-[180px] overflow-y-auto border rounded-lg dark:border-gray-600 p-2 space-y-1">
                        {products.filter((p: any) => { const s = (newDetailData._buySearch || '').toLowerCase(); return !s || (p.productName || '').toLowerCase().includes(s) || String(p.id || p.productId).includes(s); }).map((prod: any) => {
                          const pid = String(prod.id || prod.productId);
                          const sids = newDetailData.buyProductCode?.toString().slice(2).split(',').filter(Boolean) || [];
                          const chk = sids.includes(pid);
                          return (<label key={pid} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-sm ${chk ? 'bg-brand-50 dark:bg-brand-900/20 border border-brand-300' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                            <input type="checkbox" checked={chk} onChange={() => { const n = chk ? sids.filter((x: string) => x !== pid) : [...sids, pid]; setNewEd('buyProductCode', n.length > 0 ? `P:${n.join(',')}` : 'P:'); }} className="w-4 h-4 rounded text-brand-500" />
                            <span className={chk ? 'font-semibold text-brand-700 dark:text-brand-300' : 'text-gray-700 dark:text-gray-300'}>{prod.productName}</span>
                            <span className="text-xs text-gray-400 ml-auto">ID: {pid}</span>
                          </label>);
                        })}
                      </div>
                    </div>
                  ) : (
                    <select className={inputCls} value={newDetailData.buyProductCode || ''} onChange={(e) => setNewEd('buyProductCode', e.target.value || null)}>
                      <option value="">-- Không áp dụng theo category --</option>
                      {categories.map((cat: any) => (<option key={cat.id} value={cat.id}>{cat.categoryName} (ID: {cat.id})</option>))}
                    </select>
                  )}
                </div>

                {/* GiftProductCode picker (only for GiftType=1) */}
                {promo.giftType === 1 && (
                  <div>
                    <label className={labelCls}>Sản phẩm tặng (Gift Product)</label>
                    <div className="flex gap-3 mb-2">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="radio" name="newGiftMode" checked={!newDetailData.giftProductCode?.toString().startsWith('P:')}
                          onChange={() => setNewEd('giftProductCode', undefined)} className="w-4 h-4 text-brand-500" />
                        <span className="text-sm font-medium dark:text-gray-300">Tặng theo Category</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="radio" name="newGiftMode" checked={newDetailData.giftProductCode?.toString().startsWith('P:') || false}
                          onChange={() => setNewEd('giftProductCode', 'P:')} className="w-4 h-4 text-brand-500" />
                        <span className="text-sm font-medium dark:text-gray-300">Sản phẩm cụ thể</span>
                      </label>
                    </div>
                    {newDetailData.giftProductCode?.toString().startsWith('P:') ? (
                      <div>
                        <input type="text" placeholder="🔍 Tìm sản phẩm tặng..." className={`${inputCls} mb-2`}
                          value={newDetailData._giftSearch || ''} onChange={(e) => setNewEd('_giftSearch', e.target.value)} />
                        <div className="max-h-[180px] overflow-y-auto border rounded-lg dark:border-gray-600 p-2 space-y-1">
                          {products.filter((p: any) => { const s = (newDetailData._giftSearch || '').toLowerCase(); return !s || (p.productName || '').toLowerCase().includes(s) || String(p.id || p.productId).includes(s); }).map((prod: any) => {
                            const pid = String(prod.id || prod.productId);
                            const sids = newDetailData.giftProductCode?.toString().slice(2).split(',').filter(Boolean) || [];
                            const chk = sids.includes(pid);
                            return (<label key={pid} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-sm ${chk ? 'bg-purple-50 dark:bg-purple-900/20 border border-purple-300' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                              <input type="checkbox" checked={chk} onChange={() => { const n = chk ? sids.filter((x: string) => x !== pid) : [...sids, pid]; setNewEd('giftProductCode', n.length > 0 ? `P:${n.join(',')}` : 'P:'); }} className="w-4 h-4 rounded text-purple-500" />
                              <span className={chk ? 'font-semibold text-purple-700 dark:text-purple-300' : 'text-gray-700 dark:text-gray-300'}>{prod.productName}</span>
                              <span className="text-xs text-gray-400 ml-auto">ID: {pid}</span>
                            </label>);
                          })}
                        </div>
                      </div>
                    ) : (
                      <select className={inputCls} value={newDetailData.giftProductCode || ''} onChange={(e) => setNewEd('giftProductCode', e.target.value || null)}>
                        <option value="">-- Chọn category tặng --</option>
                        {categories.map((cat: any) => (<option key={cat.id} value={cat.id}>{cat.categoryName} (ID: {cat.id})</option>))}
                      </select>
                    )}
                  </div>
                )}

                {/* Numeric fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {promo.giftType !== 1 && (<>
                    <div>
                      <label className={labelCls}>Giảm giá (%)</label>
                      <input type="number" step="0.01" min="0" max="100" className={inputCls} value={newDetailData.discountRate ?? ''} onChange={(e) => setNewEd('discountRate', e.target.value ? Number(e.target.value) : null)} />
                    </div>
                    <div>
                      <label className={labelCls}>Giảm giá (tiền)</label>
                      <input type="number" step="1000" min="0" className={inputCls} value={newDetailData.discountAmount ?? ''} onChange={(e) => setNewEd('discountAmount', e.target.value ? Number(e.target.value) : null)} />
                    </div>
                  </>)}
                  <div>
                    <label className={labelCls}>Giá trị đơn hàng tối thiểu</label>
                    <input type="number" step="1000" min="0" className={inputCls} value={newDetailData.minOrderAmount ?? ''} onChange={(e) => setNewEd('minOrderAmount', e.target.value ? Number(e.target.value) : null)} />
                  </div>
                  <div>
                    <label className={labelCls}>Giá trị đơn hàng tối đa</label>
                    <input type="number" step="1000" min="0" className={inputCls} value={newDetailData.maxOrderAmount ?? ''} onChange={(e) => setNewEd('maxOrderAmount', e.target.value ? Number(e.target.value) : null)} />
                  </div>
                  <div>
                    <label className={labelCls}>Số lượng mua tối thiểu</label>
                    <input type="number" min="1" className={inputCls} value={newDetailData.minBuyQuantity ?? ''} onChange={(e) => setNewEd('minBuyQuantity', e.target.value ? Number(e.target.value) : null)} />
                  </div>
                  <div>
                    <label className={labelCls}>Số lượng được giảm tối đa</label>
                    <input type="number" min="1" className={inputCls} value={newDetailData.maxBuyQuantity ?? ''} onChange={(e) => setNewEd('maxBuyQuantity', e.target.value ? Number(e.target.value) : null)} />
                  </div>
                  {promo.giftType === 1 && (
                    <div>
                      <label className={labelCls}>Số lượng tặng</label>
                      <input type="number" min="1" className={inputCls} value={newDetailData.giftQuantity ?? ''} onChange={(e) => setNewEd('giftQuantity', e.target.value ? Number(e.target.value) : null)} />
                    </div>
                  )}
                  <div>
                    <label className={labelCls}>Rule Code (Optional)</label>
                    <input className={inputCls} value={newDetailData.promotionDetailCode || ''} onChange={(e) => setNewEd('promotionDetailCode', e.target.value)} placeholder="e.g. SUMMER26-R1" />
                  </div>
                </div>

                {/* Save/Cancel */}
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setAddingDetail(false)} className="px-4 py-2 text-sm border rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">Cancel</button>
                  <button onClick={handleSaveNewDetail} className="px-5 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors font-medium">Save Changes</button>
                </div>
              </div>
            </div>
          )}

          {promo.details && promo.details.length > 0 ? (
            promo.details.map((d: any, i: number) => {
              const isEditing = editingDetailId === d.promotionDetailId;
              const isGiftType = promo.giftType === 1;
              const ed = editingDetailData;
              const setEd = (field: string, value: any) => setEditingDetailData((prev: any) => ({ ...prev, [field]: value }));
              const catName = categories.find((c: any) => c.id == d.buyProductCode)?.categoryName;
              return (
                <div key={d.promotionDetailId} className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200">
                      Rule #{i + 1} — <span className="font-mono text-xs">{d.promotionDetailCode || 'N/A'}</span>
                    </h3>
                    {!isEditing && (
                      <button onClick={() => { setEditingDetailId(d.promotionDetailId); setEditingDetailData({ ...d }); }}
                        className="text-xs font-medium text-brand-500 hover:text-brand-600 transition-colors">✎ Edit</button>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                      {/* BuyProductCode picker */}
                      <div>
                        <label className={labelCls}>Áp dụng theo (Buy Product)</label>
                        <div className="flex gap-3 mb-2">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input type="radio" name={`editBuyMode-${i}`} checked={!ed.buyProductCode?.toString().startsWith('P:')}
                              onChange={() => setEd('buyProductCode', undefined)} className="w-4 h-4 text-brand-500" />
                            <span className="text-sm font-medium dark:text-gray-300">Category</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input type="radio" name={`editBuyMode-${i}`} checked={ed.buyProductCode?.toString().startsWith('P:') || false}
                              onChange={() => setEd('buyProductCode', 'P:')} className="w-4 h-4 text-brand-500" />
                            <span className="text-sm font-medium dark:text-gray-300">Sản phẩm cụ thể</span>
                          </label>
                        </div>
                        {ed.buyProductCode?.toString().startsWith('P:') ? (
                          <div>
                            <input type="text" placeholder="🔍 Tìm sản phẩm..." className={`${inputCls} mb-2`}
                              value={ed._buySearch || ''} onChange={(e) => setEd('_buySearch', e.target.value)} />
                            <div className="max-h-[180px] overflow-y-auto border rounded-lg dark:border-gray-600 p-2 space-y-1">
                              {products.filter((p: any) => { const s = (ed._buySearch || '').toLowerCase(); return !s || (p.productName || '').toLowerCase().includes(s) || String(p.id || p.productId).includes(s); }).map((prod: any) => {
                                const pid = String(prod.id || prod.productId);
                                const sids = ed.buyProductCode?.toString().slice(2).split(',').filter(Boolean) || [];
                                const chk = sids.includes(pid);
                                return (<label key={pid} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-sm ${chk ? 'bg-brand-50 dark:bg-brand-900/20 border border-brand-300' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                                  <input type="checkbox" checked={chk} onChange={() => { const n = chk ? sids.filter((x: string) => x !== pid) : [...sids, pid]; setEd('buyProductCode', n.length > 0 ? `P:${n.join(',')}` : 'P:'); }} className="w-4 h-4 rounded text-brand-500" />
                                  <span className={chk ? 'font-semibold text-brand-700 dark:text-brand-300' : 'text-gray-700 dark:text-gray-300'}>{prod.productName}</span>
                                  <span className="text-xs text-gray-400 ml-auto">ID: {pid}</span>
                                </label>);
                              })}
                            </div>
                          </div>
                        ) : (
                          <select className={inputCls} value={ed.buyProductCode || ''} onChange={(e) => setEd('buyProductCode', e.target.value || null)}>
                            <option value="">-- Không áp dụng theo category --</option>
                            {categories.map((cat: any) => (<option key={cat.id} value={cat.id}>{cat.categoryName} (ID: {cat.id})</option>))}
                          </select>
                        )}
                      </div>

                      {/* GiftProductCode picker (only for GiftType=1) */}
                      {isGiftType && (
                        <div>
                          <label className={labelCls}>Sản phẩm tặng (Gift Product)</label>
                          <div className="flex gap-3 mb-2">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input type="radio" name={`editGiftMode-${i}`} checked={!ed.giftProductCode?.toString().startsWith('P:')}
                                onChange={() => setEd('giftProductCode', undefined)} className="w-4 h-4 text-brand-500" />
                              <span className="text-sm font-medium dark:text-gray-300">Tặng theo Category</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input type="radio" name={`editGiftMode-${i}`} checked={ed.giftProductCode?.toString().startsWith('P:') || false}
                                onChange={() => setEd('giftProductCode', 'P:')} className="w-4 h-4 text-brand-500" />
                              <span className="text-sm font-medium dark:text-gray-300">Sản phẩm cụ thể</span>
                            </label>
                          </div>
                          {ed.giftProductCode?.toString().startsWith('P:') ? (
                            <div>
                              <input type="text" placeholder="🔍 Tìm sản phẩm tặng..." className={`${inputCls} mb-2`}
                                value={ed._giftSearch || ''} onChange={(e) => setEd('_giftSearch', e.target.value)} />
                              <div className="max-h-[180px] overflow-y-auto border rounded-lg dark:border-gray-600 p-2 space-y-1">
                                {products.filter((p: any) => { const s = (ed._giftSearch || '').toLowerCase(); return !s || (p.productName || '').toLowerCase().includes(s) || String(p.id || p.productId).includes(s); }).map((prod: any) => {
                                  const pid = String(prod.id || prod.productId);
                                  const sids = ed.giftProductCode?.toString().slice(2).split(',').filter(Boolean) || [];
                                  const chk = sids.includes(pid);
                                  return (<label key={pid} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-sm ${chk ? 'bg-purple-50 dark:bg-purple-900/20 border border-purple-300' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                                    <input type="checkbox" checked={chk} onChange={() => { const n = chk ? sids.filter((x: string) => x !== pid) : [...sids, pid]; setEd('giftProductCode', n.length > 0 ? `P:${n.join(',')}` : 'P:'); }} className="w-4 h-4 rounded text-purple-500" />
                                    <span className={chk ? 'font-semibold text-purple-700 dark:text-purple-300' : 'text-gray-700 dark:text-gray-300'}>{prod.productName}</span>
                                    <span className="text-xs text-gray-400 ml-auto">ID: {pid}</span>
                                  </label>);
                                })}
                              </div>
                            </div>
                          ) : (
                            <select className={inputCls} value={ed.giftProductCode || ''} onChange={(e) => setEd('giftProductCode', e.target.value || null)}>
                              <option value="">-- Chọn category tặng --</option>
                              {categories.map((cat: any) => (<option key={cat.id} value={cat.id}>{cat.categoryName} (ID: {cat.id})</option>))}
                            </select>
                          )}
                        </div>
                      )}

                      {/* Numeric fields */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {!isGiftType && (<>
                          <div>
                            <label className={labelCls}>Giảm giá (%)</label>
                            <input type="number" step="0.01" min="0" max="100" className={inputCls} value={ed.discountRate ?? ''} onChange={(e) => setEd('discountRate', e.target.value ? Number(e.target.value) : null)} />
                          </div>
                          <div>
                            <label className={labelCls}>Giảm giá (tiền)</label>
                            <input type="number" step="1000" min="0" className={inputCls} value={ed.discountAmount ?? ''} onChange={(e) => setEd('discountAmount', e.target.value ? Number(e.target.value) : null)} />
                          </div>
                        </>)}
                        <div>
                          <label className={labelCls}>Giá trị đơn hàng tối thiểu</label>
                          <input type="number" step="1000" min="0" className={inputCls} value={ed.minOrderAmount ?? ''} onChange={(e) => setEd('minOrderAmount', e.target.value ? Number(e.target.value) : null)} />
                        </div>
                        <div>
                          <label className={labelCls}>Giá trị đơn hàng tối đa</label>
                          <input type="number" step="1000" min="0" className={inputCls} value={ed.maxOrderAmount ?? ''} onChange={(e) => setEd('maxOrderAmount', e.target.value ? Number(e.target.value) : null)} />
                        </div>
                        <div>
                          <label className={labelCls}>Số lượng mua tối thiểu</label>
                          <input type="number" min="1" className={inputCls} value={ed.minBuyQuantity ?? ''} onChange={(e) => setEd('minBuyQuantity', e.target.value ? Number(e.target.value) : null)} />
                        </div>
                        <div>
                          <label className={labelCls}>Số lượng được giảm tối đa</label>
                          <input type="number" min="1" className={inputCls} value={ed.maxBuyQuantity ?? ''} onChange={(e) => setEd('maxBuyQuantity', e.target.value ? Number(e.target.value) : null)} />
                        </div>
                        {isGiftType && (
                          <div>
                            <label className={labelCls}>Số lượng tặng</label>
                            <input type="number" min="1" className={inputCls} value={ed.giftQuantity ?? ''} onChange={(e) => setEd('giftQuantity', e.target.value ? Number(e.target.value) : null)} />
                          </div>
                        )}
                      </div>

                      {/* Save/Cancel */}
                      <div className="flex justify-end gap-2 pt-2">
                        <button onClick={() => setEditingDetailId(null)} className="px-4 py-2 text-sm border rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">Cancel</button>
                        <button onClick={async () => {
                          try {
                            const payload: any = {};
                            if (ed.buyProductCode !== d.buyProductCode) payload.buyProductCode = ed.buyProductCode || '';
                            if (ed.giftProductCode !== d.giftProductCode) payload.giftProductCode = ed.giftProductCode || '';
                            if (ed.discountRate !== d.discountRate) payload.discountRate = ed.discountRate;
                            if (ed.discountAmount !== d.discountAmount) payload.discountAmount = ed.discountAmount;
                            if (ed.minOrderAmount !== d.minOrderAmount) payload.minOrderAmount = ed.minOrderAmount;
                            if (ed.maxOrderAmount !== d.maxOrderAmount) payload.maxOrderAmount = ed.maxOrderAmount;
                            if (ed.minBuyQuantity !== d.minBuyQuantity) payload.minBuyQuantity = ed.minBuyQuantity;
                            if (ed.maxBuyQuantity !== d.maxBuyQuantity) payload.maxBuyQuantity = ed.maxBuyQuantity;
                            if (ed.giftQuantity !== d.giftQuantity) payload.giftQuantity = ed.giftQuantity;
                            await updatePromotionDetail(d.promotionDetailId, payload);
                            toast.success('Detail rule updated!');
                            setEditingDetailId(null);
                            fetchPromotion();
                          } catch (err: any) { toast.error(`Error: ${err.message}`); }
                        }} className="px-5 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors font-medium">Save Changes</button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <InfoRow label="Buy Product" value={d.buyProductCode?.toString().startsWith('P:') ? `SP: ${d.buyProductCode.slice(2)}` : catName ? `${catName} (${d.buyProductCode})` : d.buyProductCode || '—'} />
                      <InfoRow label="Min Buy Qty" value={d.minBuyQuantity ?? '—'} />
                      <InfoRow label="Max Buy Qty" value={d.maxBuyQuantity ?? '—'} />
                      <InfoRow label="Discount Rate" value={d.discountRate != null ? `${d.discountRate}%` : '—'} />
                      <InfoRow label="Discount Amount" value={d.discountAmount != null ? `${Number(d.discountAmount).toLocaleString()}₫` : '—'} />
                      <InfoRow label="Min Order" value={d.minOrderAmount != null ? `${d.minOrderAmount.toLocaleString()}₫` : '—'} />
                      <InfoRow label="Max Order" value={d.maxOrderAmount != null ? `${d.maxOrderAmount.toLocaleString()}₫` : '—'} />
                      <InfoRow label="Gift Product" value={d.giftProductCode?.toString().startsWith('P:') ? `SP: ${d.giftProductCode.slice(2)}` : d.giftProductCode ? `Cat ${d.giftProductCode}` : '—'} />
                      <InfoRow label="Gift Qty" value={d.giftQuantity ?? '—'} />
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 text-center text-gray-400">No detail rules configured.</div>
          )}
        </div>
      )}

      {/* ─── Tab: Store Mappings ─── */}
      {activeTab === 'stores' && (
        <div className="space-y-4">
          {/* Header + Add Store button */}
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {promo.storeMappings?.length || 0} cửa hàng đang được gán
            </p>
            {!addingStore && (
              <button
                onClick={() => { setAddingStore(true); setSelectedNewStoreIds([]); setStoreSearch(''); }}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium text-sm transition-colors shadow-sm"
              >
                + Add Store
              </button>
            )}
          </div>

          {/* Add Store Panel */}
          {addingStore && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 border-2 border-brand-500/30 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200">Thêm cửa hàng vào promotion</h3>
                <span className="text-xs text-gray-400">{stores.length} cửa hàng khả dụng</span>
              </div>
              <input
                type="text"
                placeholder="🔍 Tìm theo tên, mã cửa hàng, địa chỉ..."
                className={inputCls}
                value={storeSearch}
                onChange={(e) => setStoreSearch(e.target.value)}
              />
              {(() => {
                const assignedIds = new Set((promo.storeMappings || []).map((m: any) => m.storeId));
                const availableStores = stores.filter((s: any) => {
                  const id = s.id || s.storeId;
                  if (assignedIds.has(id)) return false;
                  const search = storeSearch.toLowerCase();
                  if (!search) return true;
                  return (
                    (s.name || '').toLowerCase().includes(search) ||
                    (s.storeCode || '').toLowerCase().includes(search) ||
                    (s.address || '').toLowerCase().includes(search) ||
                    String(id).includes(search)
                  );
                });
                return availableStores.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">
                    {storeSearch ? 'Không tìm thấy cửa hàng phù hợp.' : 'Tất cả cửa hàng đã được gán vào promotion này.'}
                  </p>
                ) : (
                  <div className="max-h-[300px] overflow-y-auto border rounded-lg dark:border-gray-600 divide-y dark:divide-gray-700">
                    {availableStores.map((s: any) => {
                      const sid = s.id || s.storeId;
                      const checked = selectedNewStoreIds.includes(sid);
                      return (
                        <label key={sid} className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer text-sm transition-all ${checked ? 'bg-brand-50 dark:bg-brand-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => setSelectedNewStoreIds((prev) => checked ? prev.filter((id) => id !== sid) : [...prev, sid])}
                            className="w-4 h-4 rounded text-brand-500 mt-0.5 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium truncate ${checked ? 'text-brand-700 dark:text-brand-300' : 'text-gray-800 dark:text-gray-200'}`}>
                              {s.name || `Store ${sid}`}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {s.storeCode?.trim() && (
                                <span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">
                                  {s.storeCode.trim()}
                                </span>
                              )}
                              {s.address && (
                                <span className="text-xs text-gray-400 truncate">{s.address}</span>
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-gray-400 shrink-0">#{sid}</span>
                        </label>
                      );
                    })}
                  </div>
                );
              })()}
              {selectedNewStoreIds.length > 0 && (
                <p className="text-xs text-brand-600 dark:text-brand-400 font-medium">
                  ✓ Đã chọn {selectedNewStoreIds.length} cửa hàng
                </p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => { setAddingStore(false); setSelectedNewStoreIds([]); setStoreSearch(''); }}
                  className="px-4 py-2 text-sm border rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddStores}
                  disabled={selectedNewStoreIds.length === 0 || addingStoreLoading}
                  className="px-5 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors font-medium disabled:opacity-50"
                >
                  {addingStoreLoading ? 'Đang thêm…' : `Thêm ${selectedNewStoreIds.length > 0 ? `(${selectedNewStoreIds.length})` : ''}`}
                </button>
              </div>
            </div>
          )}

          {/* Existing store mappings table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
            {promo.storeMappings && promo.storeMappings.length > 0 ? (
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 uppercase text-xs">
                  <tr>
                    <th className="px-5 py-3">Store ID</th>
                    <th className="px-5 py-3">Store Name</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-700">
                  {promo.storeMappings.map((m: any) => (
                    <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-5 py-3 font-mono text-gray-600 dark:text-gray-300">{m.storeId}</td>
                      <td className="px-5 py-3 text-gray-800 dark:text-white font-medium">{m.storeName || '—'}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.active ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                          {m.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => handleToggleStoreMapping(m.id, m.active)}
                          className={`text-xs font-medium ${m.active ? 'text-red-500 hover:text-red-700' : 'text-green-500 hover:text-green-700'} transition-colors`}
                        >
                          {m.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-6 text-center text-gray-400">No stores assigned.</div>
            )}
          </div>
        </div>
      )}


      {/* ─── Tab: Vouchers ─── */}
      {activeTab === 'vouchers' && (
        <div className="space-y-4">
          {/* Generate vouchers */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 flex items-end gap-4">
            <div className="flex-1">
              <label className={labelCls}>Number of vouchers to generate</label>
              <input
                type="number"
                min={1}
                max={1000}
                className={inputCls}
                value={genCount}
                onChange={(e) => setGenCount(Number(e.target.value))}
              />
            </div>
            <button
              onClick={handleGenerateVouchers}
              disabled={generating}
              className="px-5 py-2.5 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors font-medium disabled:opacity-50 whitespace-nowrap"
            >
              {generating ? 'Generating…' : 'Generate Vouchers'}
            </button>
          </div>

          {/* Voucher list */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
            {vouchersLoading ? (
              <div className="p-6 text-center text-gray-400">Loading vouchers…</div>
            ) : vouchers.length > 0 ? (
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 uppercase text-xs">
                  <tr>
                    <th className="px-5 py-3">ID</th>
                    <th className="px-5 py-3">Code</th>
                    <th className="px-5 py-3">Qty</th>
                    <th className="px-5 py-3">Used</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-700">
                  {vouchers.map((v: any) => (
                    <tr key={v.voucherId} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{v.voucherId}</td>
                      <td className="px-5 py-3 font-mono font-medium text-gray-800 dark:text-white">{v.voucherCode}</td>
                      <td className="px-5 py-3 dark:text-gray-300">{v.quantity}</td>
                      <td className="px-5 py-3 dark:text-gray-300">{v.usedQuantity}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${v.active ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                          {v.active ? 'Active' : 'Used/Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400 text-xs">{fmtDate(v.createdDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-6 text-center text-gray-400">No vouchers yet. Generate some above.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Tiny reusable component ─── */
function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <span className="text-gray-500 dark:text-gray-400 font-medium">{label}</span>
      <p className="mt-0.5 text-gray-800 dark:text-white">{String(value)}</p>
    </div>
  );
}
