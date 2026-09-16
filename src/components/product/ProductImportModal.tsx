'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { parseExcelFile, ParsedProductRow, CategoryLookup, ParentProductLookup } from '@/utils/excelProductParser';
import { downloadProductTemplate } from '@/utils/productTemplate';
import {
  importProductsFromExcel,
  ImportResult,
  getProducts,
} from '@/services/products';
import { getStores } from '@/services/stores';
import { getProductCategories } from '@/services/productCategories';
import { useAuthStore } from '@/store/authStore';
import { Store } from '@/types/store';
import { PRODUCT_TYPE_OPTIONS, ProductTypeEnum } from '@/types/product';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRODUCT_TYPE_MAP: Record<number, string> = Object.fromEntries(
  PRODUCT_TYPE_OPTIONS.map((o) => [o.value, o.label])
);

type Step = 'upload' | 'preview' | 'stores' | 'importing' | 'done';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string; icon: string }[] = [
    { key: 'upload', label: 'Upload File', icon: '📂' },
    { key: 'preview', label: 'Xem Trước', icon: '👁' },
    { key: 'stores', label: 'Chọn Cửa Hàng', icon: '🏪' },
    { key: 'importing', label: 'Đang Import', icon: '⚙️' },
    { key: 'done', label: 'Hoàn Thành', icon: '✅' },
  ];

  const currentIdx = steps.findIndex((s) => s.key === step);

  return (
    <div className="flex items-center gap-0 mb-6 overflow-x-auto pb-1">
      {steps.map((s, idx) => {
        const isDone = idx < currentIdx;
        const isActive = idx === currentIdx;
        return (
          <React.Fragment key={s.key}>
            <div className="flex flex-col items-center min-w-[72px]">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all
                  ${isDone
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : isActive
                    ? 'bg-brand-500 border-brand-500 text-white shadow-lg shadow-brand-200 dark:shadow-brand-900/30'
                    : 'bg-gray-100 border-gray-200 text-gray-400 dark:bg-gray-700 dark:border-gray-600'
                  }`}
              >
                {isDone ? '✓' : s.icon}
              </div>
              <span
                className={`text-[10px] mt-1 font-medium text-center leading-tight
                  ${isActive ? 'text-brand-600 dark:text-brand-400' : isDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}
              >
                {s.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1 rounded transition-all ${
                  idx < currentIdx ? 'bg-emerald-400' : 'bg-gray-200 dark:bg-gray-600'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ProductImportModal({ isOpen, onClose, onImportComplete }: Props) {
  const brandId = useAuthStore.getState().user?.brandId;

  const [step, setStep] = useState<Step>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedProductRow[]>([]);

  // Lookup data fetched from API
  const [categories, setCategories] = useState<CategoryLookup[]>([]);
  const [parentProducts, setParentProducts] = useState<ParentProductLookup[]>([]);
  const [refDataLoading, setRefDataLoading] = useState(false);

  // Stores
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreIds, setSelectedStoreIds] = useState<number[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);

  // Import progress
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [progressLog, setProgressLog] = useState<Array<{ row: number; ok: boolean; msg?: string }>>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // ── Fetch reference data (categories + parent products) once when modal opens ──
  useEffect(() => {
    if (!isOpen) return;

    setRefDataLoading(true);

    const fetchAll = async () => {
      try {
        const [catRes, prodRes] = await Promise.all([
          getProductCategories(1, 500, brandId ?? undefined),
          getProducts(1, 500),
        ]);

        const cats: CategoryLookup[] = (catRes?.data?.items || catRes?.data || []).map(
          (c: { id: number; categoryName?: string }) => ({
            id: c.id,
            name: c.categoryName ?? '',
          })
        );
        setCategories(cats);

        const allProducts = prodRes?.data?.items || prodRes?.data || [];
        const parents: ParentProductLookup[] = allProducts
          .filter((p: { productType?: number }) => Number(p.productType) === ProductTypeEnum.General)
          .map((p: { id: number; productName?: string; code?: string }) => ({
            id: p.id,
            name: p.productName ?? '',
            code: p.code ?? '',
          }));
        setParentProducts(parents);
      } catch {
        toast.error('Không tải được dữ liệu tham chiếu (danh mục / sản phẩm cha)');
      } finally {
        setRefDataLoading(false);
      }
    };

    fetchAll();
  }, [isOpen, brandId]);

  // Fetch stores once modal opens
  useEffect(() => {
    if (!isOpen) return;
    setStoresLoading(true);
    getStores(1, 1000, brandId ?? undefined)
      .then((res) => setStores(res?.data?.items || res?.data || []))
      .catch(() => toast.error('Không tải được danh sách cửa hàng'))
      .finally(() => setStoresLoading(false));
  }, [isOpen, brandId]);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [progressLog]);

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setStep('upload');
        setFileName('');
        setParsedRows([]);
        setParseWarnings([]);
        setSelectedStoreIds([]);
        setProgress({ current: 0, total: 0 });
        setProgressLog([]);
        setImportResult(null);
      }, 300);
    }
  }, [isOpen]);

  // ── Download template with live API data ──────────────────────────────────────

  const handleDownloadTemplate = () => {
    downloadProductTemplate({ categories, parentProducts });
    toast.success('Đang tải file template...');
  };

  // ── File handling ─────────────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Chỉ chấp nhận file .xlsx hoặc .xls');
      return;
    }
    setFileName(file.name);
    try {
      const result = await parseExcelFile(file, { categories, parentProducts });
      if (result.errors.length > 0) {
        toast.error(result.errors[0]);
        return;
      }
      const allWarnings = result.rows.flatMap((r) => r.warnings);
      setParseWarnings(allWarnings);
      setParsedRows(result.rows);
      setStep('preview');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Không đọc được file');
    }
  }, [categories, parentProducts]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // ── Store selection ───────────────────────────────────────────────────────────

  const toggleStore = (id: number) =>
    setSelectedStoreIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );

  const toggleAllStores = () =>
    setSelectedStoreIds((prev) =>
      prev.length === stores.length ? [] : stores.map((s) => s.id)
    );

  // ── Import ────────────────────────────────────────────────────────────────────

  const handleImport = async () => {
    setStep('importing');
    setProgress({ current: 0, total: parsedRows.length });
    setProgressLog([]);

    const result = await importProductsFromExcel(
      parsedRows,
      selectedStoreIds,
      (current, total, rowIndex, success) => {
        setProgress({ current, total });
        setProgressLog((prev) => [...prev, { row: rowIndex, ok: success }]);
      }
    );

    setImportResult(result);
    setStep('done');

    if (result.failed === 0) {
      toast.success(`✅ Import thành công ${result.success} sản phẩm!`);
    } else {
      toast.warning(`⚠️ ${result.success} thành công, ${result.failed} thất bại`);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  if (!isOpen) return null;

  const progressPct =
    progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={step !== 'importing' ? onClose : undefined}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📥</span>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Import Sản Phẩm từ Excel</h2>
              {fileName && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-mono">{fileName}</p>
              )}
            </div>
          </div>
          {step !== 'importing' && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <StepIndicator step={step} />

          {/* ── STEP: UPLOAD ── */}
          {step === 'upload' && (
            <div className="space-y-5">
              {/* Download template */}
              <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl">
                <span className="text-2xl shrink-0 mt-0.5">📋</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Bước 1: Tải file mẫu</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                    File template đã có sẵn danh sách danh mục và sản phẩm cha từ hệ thống
                  </p>
                  {refDataLoading && (
                    <p className="text-xs text-blue-400 mt-1 flex items-center gap-1">
                      <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Đang tải dữ liệu danh mục...
                    </p>
                  )}
                  {!refDataLoading && (
                    <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">
                      {categories.length} danh mục · {parentProducts.length} sản phẩm cha
                    </p>
                  )}
                </div>
                <button
                  onClick={handleDownloadTemplate}
                  disabled={refDataLoading}
                  className="shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Tải Template
                </button>
              </div>

              {/* Reference data preview pills */}
              {!refDataLoading && (categories.length > 0 || parentProducts.length > 0) && (
                <div className="flex flex-wrap gap-2">
                  {categories.slice(0, 6).map((c) => (
                    <span key={c.id} className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg text-xs text-indigo-700 dark:text-indigo-300">
                      📁 {c.name}
                    </span>
                  ))}
                  {categories.length > 6 && (
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg text-xs text-gray-500">
                      +{categories.length - 6} danh mục
                    </span>
                  )}
                </div>
              )}

              {/* Drop zone */}
              <div
                onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-10 cursor-pointer transition-all
                  ${isDragging
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 scale-[1.02]'
                    : 'border-gray-300 dark:border-gray-600 hover:border-brand-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={onFileChange}
                />
                <div className={`text-5xl transition-transform ${isDragging ? 'scale-125' : ''}`}>
                  📊
                </div>
                <div className="text-center">
                  <p className="font-semibold text-gray-700 dark:text-gray-300">
                    Kéo thả file vào đây hoặc click để chọn
                  </p>
                  <p className="text-sm text-gray-400 mt-1">Chỉ hỗ trợ .xlsx và .xls</p>
                </div>
              </div>

              {/* Tips */}
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                <p className="font-semibold mb-2">💡 Lưu ý:</p>
                <p>• Cột <strong>CategoryName</strong>: điền đúng tên danh mục theo sheet "📋 Danh Mục" trong template</p>
                <p>• Cột <strong>CatId</strong>: nếu điền ID thì ưu tiên hơn CategoryName</p>
                <p>• Khi <strong>ProductType = 7</strong> (Detail) thì cần điền <strong>ParentProductId</strong></p>
                <p>• Các cột bắt buộc: ProductName, Code, Price, CategoryName (hoặc CatId), ProductType</p>
              </div>
            </div>
          )}

          {/* ── STEP: PREVIEW ── */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Tìm thấy <span className="font-bold text-gray-900 dark:text-white">{parsedRows.length}</span> sản phẩm
                </p>
                {parseWarnings.length > 0 && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    ⚠️ {parseWarnings.length} cảnh báo
                  </span>
                )}
              </div>

              {parseWarnings.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 max-h-24 overflow-y-auto">
                  {parseWarnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-700 dark:text-amber-300">{w}</p>
                  ))}
                </div>
              )}

              {/* Preview table */}
              <div className="rounded-xl border dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-gray-500 font-semibold uppercase tracking-wide">#</th>
                        <th className="px-3 py-2 text-left text-gray-500 font-semibold uppercase tracking-wide">Code</th>
                        <th className="px-3 py-2 text-left text-gray-500 font-semibold uppercase tracking-wide">Tên sản phẩm</th>
                        <th className="px-3 py-2 text-left text-gray-500 font-semibold uppercase tracking-wide">Giá</th>
                        <th className="px-3 py-2 text-left text-gray-500 font-semibold uppercase tracking-wide">Danh mục</th>
                        <th className="px-3 py-2 text-left text-gray-500 font-semibold uppercase tracking-wide">Loại</th>
                        <th className="px-3 py-2 text-left text-gray-500 font-semibold uppercase tracking-wide">OK?</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                      {parsedRows.map((row) => {
                        const catName = categories.find((c) => c.id === row.data.CatId)?.name;
                        return (
                          <tr
                            key={row.rowIndex}
                            className={`transition-colors ${
                              row.warnings.length > 0
                                ? 'bg-amber-50 dark:bg-amber-950/10'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                            }`}
                          >
                            <td className="px-3 py-2 text-gray-400 font-mono">{row.rowIndex}</td>
                            <td className="px-3 py-2 font-mono text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50">
                              {row.data.Code || '—'}
                            </td>
                            <td className="px-3 py-2 font-medium text-gray-900 dark:text-white max-w-[180px] truncate">
                              {row.data.ProductName}
                            </td>
                            <td className="px-3 py-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                              {row.data.Price.toLocaleString()}đ
                            </td>
                            <td className="px-3 py-2">
                              {catName ? (
                                <span className="text-indigo-700 dark:text-indigo-300 font-medium">{catName}</span>
                              ) : (
                                <span className="text-gray-400">ID: {row.data.CatId}</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 font-medium">
                                {PRODUCT_TYPE_MAP[row.data.ProductType ?? 0] ?? `Type ${row.data.ProductType}`}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              {row.warnings.length > 0 ? (
                                <span className="text-amber-600 dark:text-amber-400 cursor-help" title={row.warnings.join('\n')}>
                                  ⚠️ {row.warnings.length}
                                </span>
                              ) : (
                                <span className="text-emerald-500">✓</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP: STORES ── */}
          {step === 'stores' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Chọn cửa hàng để áp dụng cho <strong>{parsedRows.length}</strong> sản phẩm.
                Có thể chọn nhiều hoặc bỏ qua.
              </p>

              {storesLoading ? (
                <div className="flex items-center justify-center py-8 text-gray-400">
                  <svg className="animate-spin w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Đang tải cửa hàng...
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {selectedStoreIds.length} / {stores.length} cửa hàng được chọn
                    </span>
                    <button
                      onClick={toggleAllStores}
                      className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium transition-colors"
                    >
                      {selectedStoreIds.length === stores.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                    {stores.map((store) => {
                      const isSelected = selectedStoreIds.includes(store.id);
                      return (
                        <label
                          key={store.id}
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all
                            ${isSelected
                              ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-brand-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleStore(store.id)}
                            className="w-4 h-4 rounded accent-brand-500"
                          />
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                            {store.name || `Store #${store.id}`}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── STEP: IMPORTING ── */}
          {step === 'importing' && (
            <div className="space-y-5">
              <div className="text-center">
                <div className="text-4xl mb-3">⚙️</div>
                <p className="font-semibold text-gray-800 dark:text-white text-lg">Đang import sản phẩm...</p>
                <p className="text-sm text-gray-500 mt-1">
                  {progress.current} / {progress.total} sản phẩm
                </p>
              </div>

              {/* Progress bar */}
              <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                  className="h-3 rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-right text-sm font-bold text-brand-600 dark:text-brand-400">{progressPct}%</p>

              {/* Log */}
              <div className="bg-gray-900 dark:bg-black rounded-xl p-4 font-mono text-xs max-h-40 overflow-y-auto space-y-1">
                {progressLog.map((entry, i) => (
                  <p key={i} className={entry.ok ? 'text-emerald-400' : 'text-red-400'}>
                    {entry.ok ? '✓' : '✗'} Dòng {entry.row} — {entry.ok ? 'OK' : 'Lỗi'}
                    {entry.msg && `: ${entry.msg}`}
                  </p>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          )}

          {/* ── STEP: DONE ── */}
          {step === 'done' && importResult && (
            <div className="space-y-5">
              <div className="text-center py-4">
                <div className="text-5xl mb-4">
                  {importResult.failed === 0 ? '🎉' : '⚠️'}
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  {importResult.failed === 0 ? 'Import hoàn thành!' : 'Import có lỗi'}
                </h3>
                <div className="flex justify-center gap-6 mt-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{importResult.success}</p>
                    <p className="text-sm text-gray-500">Thành công</p>
                  </div>
                  {importResult.failed > 0 && (
                    <div className="text-center">
                      <p className="text-3xl font-bold text-red-500">{importResult.failed}</p>
                      <p className="text-sm text-gray-500">Thất bại</p>
                    </div>
                  )}
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-4 max-h-40 overflow-y-auto">
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2">Chi tiết lỗi:</p>
                  <div className="space-y-1">
                    {importResult.errors.map((e, i) => (
                      <p key={i} className="text-xs text-red-600 dark:text-red-400">
                        • Dòng {e.row}: {e.message}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t dark:border-gray-700 shrink-0 bg-gray-50 dark:bg-gray-800/50">
          <button
            onClick={() => {
              if (step === 'preview') setStep('upload');
              else if (step === 'stores') setStep('preview');
              else onClose();
            }}
            disabled={step === 'importing'}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-40 transition-colors"
          >
            {step === 'done' || step === 'upload' ? 'Đóng' : '← Quay lại'}
          </button>

          <div className="flex gap-3">
            {step === 'preview' && (
              <button
                onClick={() => setStep('stores')}
                className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
              >
                Tiếp tục → Chọn cửa hàng
              </button>
            )}
            {step === 'stores' && (
              <button
                onClick={handleImport}
                disabled={storesLoading}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-colors shadow-sm disabled:opacity-60 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Bắt đầu Import ({parsedRows.length})
              </button>
            )}
            {step === 'done' && (
              <button
                onClick={() => {
                  onImportComplete();
                  onClose();
                }}
                className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-bold rounded-xl transition-colors shadow-sm"
              >
                Xem danh sách sản phẩm ✓
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
