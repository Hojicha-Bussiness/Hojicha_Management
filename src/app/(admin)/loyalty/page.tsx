'use client';
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { api } from '@/services/apiClient';
import {
  addSuperVip,
  removeSuperVip,
  changeTier,
  issueVoucherToUser,
  generateVoucherCode,
  ManualVoucherPayload,
} from '@/services/loyalty';
import { DataTable } from '@/components/ui/data-table';
import { SkeletonTable } from '@/components/ui/skeleton-table';
import { Modal } from '@/components/ui/modal';
import { ColumnDef } from '@tanstack/react-table';
import { PlusIcon } from '@/icons';

type Tab = 'stats' | 'supervip' | 'voucher';

// ─── Voucher form state ────────────────────────────────────────────────────────
interface VoucherForm {
  rewardType: 1 | 2;
  percentageBasisPoints: string;
  amount: string;
  maxDiscountAmount: string;
  minOrderAmount: string;
  validityDays: string;
  code: string;
  note: string;
}

const defaultVoucherForm: VoucherForm = {
  rewardType: 2,
  percentageBasisPoints: '',
  amount: '',
  maxDiscountAmount: '',
  minOrderAmount: '',
  validityDays: '30',
  code: '',
  note: '',
};

export default function LoyaltyAdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('stats');
  const [stats, setStats] = useState<any>(null);
  const [superVips, setSuperVips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [brands, setBrands] = useState<any[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<number | ''>('');

  const [submitting, setSubmitting] = useState(false);
  const [searching, setSearching] = useState(false);

  // ── Voucher tab state ─────────────────────────────────────────────────────
  const [voucherForm, setVoucherForm] = useState<VoucherForm>(defaultVoucherForm);
  const [voucherBrandId, setVoucherBrandId] = useState<number | ''>('');
  const [voucherCustomerSearch, setVoucherCustomerSearch] = useState('');
  const [voucherCustomerResults, setVoucherCustomerResults] = useState<any[]>([]);
  const [voucherTargetCustomer, setVoucherTargetCustomer] = useState<any>(null);
  const [voucherSearching, setVoucherSearching] = useState(false);
  const [voucherSubmitting, setVoucherSubmitting] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  // Load brands on mount
  useEffect(() => {
    api.get('/brands?page=1&size=50').then(res => {
      const items = res?.data?.items || res?.data || [];
      setBrands(items);
      if (items.length > 0) {
        setSelectedBrandId(items[0].id);
        setVoucherBrandId(items[0].id);
      }
    }).catch(() => {});
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'stats') {
        const url = selectedBrandId ? `/loyalty/stats?brandId=${selectedBrandId}` : '/loyalty/stats';
        const res = await api.get(url);
        setStats(res?.data || null);
      } else if (activeTab === 'supervip') {
        const res = await api.get('/admin/super-vip/list');
        setSuperVips(res?.data || []);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load data');
    } finally { setLoading(false); }
  }, [activeTab, selectedBrandId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Super VIP customer search ─────────────────────────────────────────────
  const searchTimeout = React.useRef<ReturnType<typeof setTimeout>>(undefined);
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

  const handleAdd = async () => {
    if (!selectedCustomer) { toast.error('Select a customer'); return; }
    setSubmitting(true);
    try {
      await addSuperVip(selectedCustomer.customerId);
      toast.success(`Super VIP added: ${selectedCustomer.name}`);
      setShowModal(false);
      setSelectedCustomer(null);
      setCustomerSearch('');
      setCustomerResults([]);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || 'Failed');
    } finally { setSubmitting(false); }
  };

  // ── Voucher tab customer search ───────────────────────────────────────────
  const voucherSearchTimeout = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const searchVoucherCustomers = (q: string) => {
    if (voucherSearchTimeout.current) clearTimeout(voucherSearchTimeout.current);
    if (q.length < 2) { setVoucherCustomerResults([]); return; }
    setVoucherSearching(true);
    voucherSearchTimeout.current = setTimeout(async () => {
      try {
        const res = await api.get(`/admin/super-vip/customers/search?q=${encodeURIComponent(q)}`);
        setVoucherCustomerResults(res?.data || []);
      } catch { setVoucherCustomerResults([]); }
      finally { setVoucherSearching(false); }
    }, 800);
  };

  const buildVoucherPayload = (): ManualVoucherPayload | null => {
    if (!voucherBrandId) { toast.error('Vui lòng chọn Brand'); return null; }
    const validityDays = parseInt(voucherForm.validityDays) || 30;

    const base: ManualVoucherPayload = {
      brandId: Number(voucherBrandId),
      rewardType: voucherForm.rewardType,
      validityDays,
      code: voucherForm.code.trim() || undefined,
      note: voucherForm.note.trim() || undefined,
      minOrderAmount: voucherForm.minOrderAmount ? parseFloat(voucherForm.minOrderAmount) : undefined,
    };

    if (voucherForm.rewardType === 1) {
      const bps = parseInt(voucherForm.percentageBasisPoints);
      if (!bps || bps <= 0) { toast.error('Vui lòng nhập % giảm giá hợp lệ'); return null; }
      base.percentageBasisPoints = bps;
      base.maxDiscountAmount = voucherForm.maxDiscountAmount ? parseFloat(voucherForm.maxDiscountAmount) : undefined;
    } else {
      const amt = parseFloat(voucherForm.amount);
      if (!amt || amt <= 0) { toast.error('Vui lòng nhập số tiền giảm hợp lệ'); return null; }
      base.amount = amt;
    }

    return base;
  };

  const handleIssueToUser = async () => {
    if (!voucherTargetCustomer) { toast.error('Vui lòng chọn khách hàng'); return; }
    const payload = buildVoucherPayload();
    if (!payload) return;
    payload.customerId = voucherTargetCustomer.customerId;
    setVoucherSubmitting(true);
    try {
      const res = await issueVoucherToUser(payload);
      const code = res?.data?.code ?? res?.data?.Data?.code;
      toast.success(`✅ Đã phát voucher "${code}" vào ví ${voucherTargetCustomer.name}`);
      setGeneratedCode(code);
      setVoucherForm(defaultVoucherForm);
      setVoucherTargetCustomer(null);
      setVoucherCustomerSearch('');
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi phát voucher');
    } finally { setVoucherSubmitting(false); }
  };

  const handleGenerateCode = async () => {
    const payload = buildVoucherPayload();
    if (!payload) return;
    setVoucherSubmitting(true);
    setGeneratedCode(null);
    try {
      const res = await generateVoucherCode(payload);
      const code = res?.data?.code ?? res?.data?.Data?.code;
      setGeneratedCode(code ?? null);
      toast.success(`✅ Mã voucher "${code}" đã được tạo`);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi tạo mã voucher');
    } finally { setVoucherSubmitting(false); }
  };

  const updateVoucherForm = (field: keyof VoucherForm, value: string | number) => {
    setVoucherForm(prev => ({ ...prev, [field]: value }));
  };

  // ── Columns ───────────────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<any>[]>(() => [
    { accessorKey: 'externalId', header: 'ID' },
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'phone', header: 'Phone' },
    { accessorKey: 'balance', header: 'Points',
      cell: ({ row }) => row.original.balance ?? 0,
    },
    { accessorKey: 'currentTierName', header: 'Tier',
      cell: ({ row }) => {
        const item = row.original;
        const currentTier = item.isSuperVip ? 'SUPERVIP' : 'BASESPEND';
        return (
          <select
            value={currentTier}
            onChange={async (e) => {
              const val = e.target.value;
              try {
                if (val === 'SUPERVIP') {
                  await addSuperVip(Number(item.externalId));
                  toast.success(`Super VIP status activated: ${item.name}`);
                } else {
                  await removeSuperVip(Number(item.externalId));
                  toast.success(`Reset to spend-based tier: ${item.name}`);
                }
                fetchAll();
              } catch (err: any) {
                toast.error(err.message || 'Failed to update tier');
              }
            }}
            className="border rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="BASESPEND">Normal ({item.currentTierName || 'Member'})</option>
            <option value="SUPERVIP">SUPER VIP</option>
          </select>
        );
      }
    },
    { accessorKey: 'enrolledAt', header: 'Member Since',
      cell: ({ row }) => {
        const d = row.original.enrolledAt;
        return d ? new Date(d).toLocaleDateString('vi-VN') : '—';
      },
    },
  ], [fetchAll]);

  const inputCls = 'w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500';
  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Loyalty Management</h1>
        {activeTab === 'stats' && brands.length > 0 && (
          <select
            value={selectedBrandId}
            onChange={e => setSelectedBrandId(Number(e.target.value))}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
          >
            {brands.map((b: any) => (
              <option key={b.id} value={b.id}>{b.brandName}</option>
            ))}
          </select>
        )}
      </div>

      {/* ── Tab bar ── */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {([
          { key: 'stats', label: 'Stats' },
          { key: 'supervip', label: 'Members' },
          { key: 'voucher', label: '🎟 Phát Voucher' },
        ] as { key: Tab; label: string }[]).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-brand-500 text-brand-500'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Stats tab ── */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-theme-sm dark:bg-gray-800 p-6">
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">Total Customers</p>
            <p className="text-title-sm text-gray-900 dark:text-white font-bold mt-1">
              {stats?.totalCustomers?.toLocaleString('vi-VN') ?? '—'}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-theme-sm dark:bg-gray-800 p-6">
            <h3 className="text-title-sm text-gray-900 dark:text-white font-bold mb-5">Tier Distribution</h3>
            <div className="space-y-4">
              {stats?.tierDistribution?.length > 0 ? (
                stats.tierDistribution.map((t: any, i: number) => {
                  const total = stats.totalCustomers || 1;
                  const pct = Math.round((t.count / total) * 100);
                  const colors = ['#465FFF', '#6366F1', '#0EA5E9', '#8B5CF6'];
                  return (
                    <div key={i} className="flex items-center gap-4">
                      <span className="text-theme-sm font-medium text-gray-700 dark:text-gray-300 w-20">{t.tier}</span>
                      <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: colors[i % colors.length] }} />
                      </div>
                      <span className="text-theme-sm text-gray-500 dark:text-gray-400 w-16 text-right">{t.count}</span>
                      <span className="text-theme-xs text-gray-400 w-12 text-right">{pct}%</span>
                    </div>
                  );
                })
              ) : (
                <p className="text-theme-sm text-gray-400">Loading...</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Members tab ── */}
      {activeTab === 'supervip' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-2">
              <PlusIcon /> Add Super VIP
            </button>
          </div>
          <div className="bg-white rounded-lg shadow dark:bg-gray-800 p-6">
            {loading ? <SkeletonTable columns={6} rows={5} /> : (
              <DataTable columns={columns} data={superVips} searchKey="name" searchPlaceholder="Search..." />
            )}
          </div>
        </div>
      )}

      {/* ── Voucher tab ── */}
      {activeTab === 'voucher' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Form cấu hình voucher */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-theme-sm p-6 space-y-5">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Cấu hình Voucher</h2>

            {/* Brand */}
            <div>
              <label className={labelCls}>Brand <span className="text-red-500">*</span></label>
              <select value={voucherBrandId} onChange={e => setVoucherBrandId(Number(e.target.value))} className={inputCls}>
                <option value="">-- Chọn Brand --</option>
                {brands.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.brandName}</option>
                ))}
              </select>
            </div>

            {/* Loại giảm giá */}
            <div>
              <label className={labelCls}>Loại giảm giá <span className="text-red-500">*</span></label>
              <div className="flex gap-3">
                {([
                  { value: 2, label: 'Tiền cố định (đ)' },
                  { value: 1, label: 'Phần trăm (%)' },
                ] as { value: 1 | 2; label: string }[]).map(opt => (
                  <label key={opt.value}
                    className={`flex-1 flex items-center gap-2 px-4 py-3 border-2 rounded-lg cursor-pointer transition-colors text-sm font-medium ${
                      voucherForm.rewardType === opt.value
                        ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400'
                        : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                    }`}>
                    <input type="radio" className="sr-only" value={opt.value}
                      checked={voucherForm.rewardType === opt.value}
                      onChange={() => updateVoucherForm('rewardType', opt.value)} />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Giá trị giảm */}
            {voucherForm.rewardType === 1 ? (
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Giảm (%) — basis points <span className="text-red-500">*</span></label>
                  <input type="number" min={1} max={10000} placeholder="Ví dụ: 1500 = 15%"
                    value={voucherForm.percentageBasisPoints}
                    onChange={e => updateVoucherForm('percentageBasisPoints', e.target.value)}
                    className={inputCls} />
                  <p className="text-xs text-gray-400 mt-1">100 basis points = 1%. Nhập 1500 cho giảm 15%.</p>
                </div>
                <div>
                  <label className={labelCls}>Giảm tối đa (đ)</label>
                  <input type="number" min={0} placeholder="Ví dụ: 50000"
                    value={voucherForm.maxDiscountAmount}
                    onChange={e => updateVoucherForm('maxDiscountAmount', e.target.value)}
                    className={inputCls} />
                </div>
              </div>
            ) : (
              <div>
                <label className={labelCls}>Số tiền giảm (đ) <span className="text-red-500">*</span></label>
                <input type="number" min={1000} placeholder="Ví dụ: 20000"
                  value={voucherForm.amount}
                  onChange={e => updateVoucherForm('amount', e.target.value)}
                  className={inputCls} />
              </div>
            )}

            {/* Đơn hàng tối thiểu */}
            <div>
              <label className={labelCls}>Đơn hàng tối thiểu (đ)</label>
              <input type="number" min={0} placeholder="Không bắt buộc"
                value={voucherForm.minOrderAmount}
                onChange={e => updateVoucherForm('minOrderAmount', e.target.value)}
                className={inputCls} />
            </div>

            {/* Hạn sử dụng */}
            <div>
              <label className={labelCls}>Hạn sử dụng (ngày) <span className="text-red-500">*</span></label>
              <input type="number" min={1} max={365}
                value={voucherForm.validityDays}
                onChange={e => updateVoucherForm('validityDays', e.target.value)}
                className={inputCls} />
            </div>

            {/* Mã tuỳ chỉnh (optional) */}
            <div>
              <label className={labelCls}>Mã tuỳ chỉnh (tùy chọn)</label>
              <input type="text" maxLength={20} placeholder="Để trống để tự generate"
                value={voucherForm.code}
                onChange={e => updateVoucherForm('code', e.target.value.toUpperCase())}
                className={`${inputCls} font-mono tracking-widest`} />
            </div>

            {/* Ghi chú */}
            <div>
              <label className={labelCls}>Ghi chú nội bộ</label>
              <input type="text" placeholder="Ví dụ: Bù lỗi cho khách hàng X"
                value={voucherForm.note}
                onChange={e => updateVoucherForm('note', e.target.value)}
                className={inputCls} />
            </div>

            {/* Nút generate code */}
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                Tạo mã nhập tay — khách hàng tự nhập trên app để nhận vào ví
              </p>
              <button
                onClick={handleGenerateCode}
                disabled={voucherSubmitting}
                className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {voucherSubmitting ? '⏳ Đang tạo...' : '🔑 Generate Mã Nhập Tay'}
              </button>

              {generatedCode && (
                <div className="mt-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-lg">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-1">Mã voucher đã tạo:</p>
                  <div className="flex items-center gap-3">
                    <code className="text-2xl font-mono font-bold tracking-[0.3em] text-emerald-700 dark:text-emerald-300">
                      {generatedCode}
                    </code>
                    <button
                      onClick={() => { navigator.clipboard.writeText(generatedCode); toast.success('Đã copy mã!'); }}
                      className="text-xs px-2 py-1 bg-emerald-100 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300 rounded hover:bg-emerald-200 transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Gửi mã này cho khách. Họ vào app → Ví → Nhập mã voucher.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Panel phát cho user */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-theme-sm p-6 space-y-5">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Phát vào Ví Khách Hàng</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Tìm khách hàng và phát voucher trực tiếp vào ví — khách không cần nhập mã.
            </p>

            {/* Tìm kiếm khách hàng */}
            <div className="relative">
              <label className={labelCls}>Tìm khách hàng</label>
              <input
                type="text"
                value={voucherCustomerSearch}
                onChange={e => {
                  setVoucherCustomerSearch(e.target.value);
                  searchVoucherCustomers(e.target.value);
                }}
                placeholder="Tên, SĐT hoặc email..."
                className={inputCls}
              />
              {voucherSearching && (
                <p className="text-xs text-gray-400 mt-1">Đang tìm kiếm...</p>
              )}
              {voucherCustomerResults.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {voucherCustomerResults.map((c: any) => (
                    <div
                      key={c.customerId}
                      onClick={() => {
                        setVoucherTargetCustomer(c);
                        setVoucherCustomerSearch(c.name);
                        setVoucherCustomerResults([]);
                      }}
                      className="px-4 py-3 hover:bg-blue-50 dark:hover:bg-gray-600 cursor-pointer flex justify-between items-center border-b border-gray-100 dark:border-gray-600 last:border-0"
                    >
                      <div>
                        <p className="font-medium text-sm text-gray-800 dark:text-gray-100">{c.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{c.phone} · {c.email}</p>
                      </div>
                      <span className="text-xs text-gray-400 dark:text-gray-500">ID: {c.customerId}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Hiển thị customer đã chọn */}
            {voucherTargetCustomer && (
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                <div>
                  <p className="font-semibold text-sm text-blue-800 dark:text-blue-200">{voucherTargetCustomer.name}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    {voucherTargetCustomer.phone} · ID: {voucherTargetCustomer.customerId}
                  </p>
                </div>
                <button
                  onClick={() => { setVoucherTargetCustomer(null); setVoucherCustomerSearch(''); }}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  ✕ Bỏ chọn
                </button>
              </div>
            )}

            {/* Preview voucher sẽ phát */}
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-2 text-sm">
              <p className="font-medium text-gray-700 dark:text-gray-300">Preview voucher:</p>
              <div className="flex flex-wrap gap-2">
                {voucherBrandId && (
                  <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded text-xs">
                    Brand: {brands.find((b: any) => b.id === voucherBrandId)?.brandName ?? voucherBrandId}
                  </span>
                )}
                {voucherForm.rewardType === 2 && voucherForm.amount && (
                  <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded text-xs">
                    Giảm: {Number(voucherForm.amount).toLocaleString('vi-VN')}đ
                  </span>
                )}
                {voucherForm.rewardType === 1 && voucherForm.percentageBasisPoints && (
                  <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded text-xs">
                    Giảm: {(Number(voucherForm.percentageBasisPoints) / 100).toFixed(0)}%
                    {voucherForm.maxDiscountAmount ? ` (tối đa ${Number(voucherForm.maxDiscountAmount).toLocaleString('vi-VN')}đ)` : ''}
                  </span>
                )}
                {voucherForm.minOrderAmount && (
                  <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 rounded text-xs">
                    Tối thiểu: {Number(voucherForm.minOrderAmount).toLocaleString('vi-VN')}đ
                  </span>
                )}
                <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded text-xs">
                  HSD: {voucherForm.validityDays || 30} ngày
                </span>
              </div>
            </div>

            {/* Nút phát */}
            <div className="pt-2">
              <button
                onClick={handleIssueToUser}
                disabled={voucherSubmitting || !voucherTargetCustomer}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {voucherSubmitting ? (
                  <>⏳ Đang phát...</>
                ) : (
                  <>🎁 Phát Voucher vào Ví {voucherTargetCustomer ? `(${voucherTargetCustomer.name})` : ''}</>
                )}
              </button>
              {!voucherTargetCustomer && (
                <p className="text-xs text-center text-gray-400 mt-2">Chọn khách hàng để kích hoạt nút phát</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Add Super VIP ── */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setSelectedCustomer(null); setCustomerSearch(''); setCustomerResults([]); }} className="max-w-lg">
        <div className="p-6">
          <h2 className="text-lg font-bold mb-4">Add Super VIP</h2>

          {!selectedCustomer ? (
            <div className="space-y-3">
              <label className="block text-sm font-medium">Search Customer</label>
              <input type="text" value={customerSearch} onChange={e => { setCustomerSearch(e.target.value); searchCustomers(e.target.value); }}
                placeholder="Type name, phone or email..." className="w-full border rounded-lg px-3 py-2 text-sm" />
              {searching && <p className="text-sm text-gray-400">Searching...</p>}
              {customerResults.length > 0 && (
                <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
                  {customerResults.map((c: any) => (
                    <div key={c.customerId}
                      onClick={() => { setSelectedCustomer(c); setCustomerResults([]); }}
                      className="px-3 py-2 hover:bg-blue-50 cursor-pointer flex justify-between items-center">
                      <div>
                        <p className="font-medium text-sm">{c.name}</p>
                        <p className="text-xs text-gray-500">{c.phone} · {c.email}</p>
                      </div>
                      <span className="text-xs text-gray-400">ID: {c.customerId}</span>
                    </div>
                  ))}
                </div>
              )}
              {customerSearch.length >= 2 && customerResults.length === 0 && !searching && (
                <p className="text-sm text-gray-400">No customers found</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div>
                  <p className="font-medium">{selectedCustomer.name}</p>
                  <p className="text-xs text-gray-500">{selectedCustomer.phone} · ID: {selectedCustomer.customerId}</p>
                </div>
                <button onClick={() => setSelectedCustomer(null)} className="text-gray-400 hover:text-red-500 text-sm">Change</button>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => { setShowModal(false); setSelectedCustomer(null); setCustomerSearch(''); }}
                  className="px-4 py-2 border rounded text-sm">Cancel</button>
                <button onClick={handleAdd} disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                  {submitting ? 'Saving...' : 'Add Super VIP'}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
