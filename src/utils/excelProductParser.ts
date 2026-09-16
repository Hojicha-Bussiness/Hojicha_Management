import * as XLSX from 'xlsx';
import { CreateProductRequest } from '@/services/products';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedProductRow {
  rowIndex: number;
  data: CreateProductRequest;
  warnings: string[];
}

export interface ParseResult {
  rows: ParsedProductRow[];
  errors: string[];
  totalRows: number;
}

// ─── Column name mapping (Excel header → field name) ─────────────────────────
// Supports both Vietnamese and English headers, and common typos

const COLUMN_ALIASES: Record<string, keyof RawRow> = {
  // ProductName
  productname: 'ProductName',
  'tên sản phẩm': 'ProductName',
  'ten san pham': 'ProductName',
  'product name': 'ProductName',
  name: 'ProductName',

  // ProductNameEng
  productnameeng: 'ProductNameEng',
  'tên tiếng anh': 'ProductNameEng',
  'ten tieng anh': 'ProductNameEng',
  'product name eng': 'ProductNameEng',
  'english name': 'ProductNameEng',

  // Code
  code: 'Code',
  'mã sản phẩm': 'Code',
  'ma san pham': 'Code',
  'product code': 'Code',
  sku: 'Code',

  // Price
  price: 'Price',
  'giá bán': 'Price',
  'gia ban': 'Price',
  'selling price': 'Price',

  // PriceCogs
  pricecogs: 'PriceCogs',
  cogs: 'PriceCogs',
  'giá vốn': 'PriceCogs',
  'gia von': 'PriceCogs',
  'cost price': 'PriceCogs',

  // CatId
  catid: 'CatId',
  categoryid: 'CatId',
  'id danh mục': 'CatId',
  'danh mục': 'CatId',
  'category id': 'CatId',
  category: 'CatId',

  // ProductType
  producttype: 'ProductType',
  'loại sản phẩm': 'ProductType',
  'loai san pham': 'ProductType',
  'product type': 'ProductType',
  type: 'ProductType',

  // GeneralProductId
  generalproductid: 'GeneralProductId',
  'id sản phẩm cha': 'GeneralProductId',
  parentid: 'GeneralProductId',
  'parent id': 'GeneralProductId',
  'id cha': 'GeneralProductId',

  // DisplayOrder
  displayorder: 'DisplayOrder',
  'thứ tự': 'DisplayOrder',
  'thu tu': 'DisplayOrder',
  priority: 'DisplayOrder',
  'display order': 'DisplayOrder',

  // Active
  active: 'Active',
  'kích hoạt': 'Active',
  'kich hoat': 'Active',

  // IsAvailable
  isavailable: 'IsAvailable',
  available: 'IsAvailable',
  'có sẵn': 'IsAvailable',
  'co san': 'IsAvailable',

  // IsMostOrdered
  ismostordered: 'IsMostOrdered',
  'bán chạy': 'IsMostOrdered',
  bestseller: 'IsMostOrdered',
  'best seller': 'IsMostOrdered',
};

interface RawRow {
  ProductName?: string;
  ProductNameEng?: string;
  Code?: string;
  Price?: number | string;
  PriceCogs?: number | string;
  CatId?: number | string;
  ProductType?: number | string;
  GeneralProductId?: number | string | null;
  DisplayOrder?: number | string;
  Active?: boolean | string | number;
  IsAvailable?: boolean | string | number;
  IsMostOrdered?: boolean | string | number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseBoolean(val: boolean | string | number | undefined, defaultVal = true): boolean {
  if (val === undefined || val === null || val === '') return defaultVal;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  const s = String(val).trim().toLowerCase();
  if (['true', '1', 'yes', 'có', 'co', 'x'].includes(s)) return true;
  if (['false', '0', 'no', 'không', 'khong', ''].includes(s)) return false;
  return defaultVal;
}

function parseNumber(val: number | string | undefined | null): number | null {
  if (val === undefined || val === null || val === '') return null;
  const n = Number(String(val).replace(/,/g, '').trim());
  return isNaN(n) ? null : n;
}

function normalizeHeader(header: string): keyof RawRow | null {
  const key = header.trim().toLowerCase();
  return (COLUMN_ALIASES[key] as keyof RawRow) ?? null;
}

// ─── Main Parser ──────────────────────────────────────────────────────────────

export function parseExcelFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // Use the first sheet
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          return resolve({ rows: [], errors: ['File Excel không có sheet nào.'], totalRows: 0 });
        }

        const sheet = workbook.Sheets[sheetName];
        // Convert to array-of-objects using raw headers
        const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
          defval: '',
          raw: false, // keep as strings for proper boolean/number parsing
        });

        if (rawRows.length === 0) {
          return resolve({ rows: [], errors: ['Sheet không có dữ liệu.'], totalRows: 0 });
        }

        // Map raw headers → normalised field names
        const firstRow = rawRows[0];
        const headerMap: Record<string, keyof RawRow> = {};
        for (const rawHeader of Object.keys(firstRow)) {
          const normalized = normalizeHeader(rawHeader);
          if (normalized) {
            headerMap[rawHeader] = normalized;
          }
        }

        // Safety: if none of the headers were recognised, bail early with a helpful message
        if (Object.keys(headerMap).length === 0) {
          return resolve({
            rows: [],
            errors: [
              `Không nhận ra cột nào trong file. Hãy dùng file template mẫu (Download Template). ` +
              `Các cột hiện tại: ${Object.keys(firstRow).slice(0, 5).join(', ')}...`,
            ],
            totalRows: 0,
          });
        }

        const parsed: ParsedProductRow[] = [];
        const globalErrors: string[] = [];

        rawRows.forEach((raw, idx) => {
          // idx=0 → Excel row 2 (row 1 is the header read by sheet_to_json)
          const rowNum = idx + 2;
          const mapped: RawRow = {};

          for (const [rawKey, normalizedKey] of Object.entries(headerMap)) {
            (mapped as Record<string, unknown>)[normalizedKey] = raw[rawKey];
          }

          const warnings: string[] = [];

          // ── Validate required fields ──────────────────────────────────────
          const productName = String(mapped.ProductName || '').trim();
          const code = String(mapped.Code || '').trim();
          const priceRaw = parseNumber(mapped.Price as string);
          const catIdRaw = parseNumber(mapped.CatId as string);

          if (!productName) {
            warnings.push(`Dòng ${rowNum}: Thiếu ProductName`);
          }
          if (!code) {
            warnings.push(`Dòng ${rowNum}: Thiếu Code`);
          }
          if (priceRaw === null) {
            warnings.push(`Dòng ${rowNum}: Price không hợp lệ`);
          }
          if (catIdRaw === null) {
            warnings.push(`Dòng ${rowNum}: CatId không hợp lệ`);
          }

          // Skip rows that are clearly empty
          if (!productName && !code && priceRaw === null) {
            return;
          }

          const productTypeRaw = parseNumber(mapped.ProductType as string);
          // Empty string GeneralProductId means "no parent" → null (not 0)
          const generalProductIdStr = String(mapped.GeneralProductId ?? '').trim();
          const generalProductIdRaw = generalProductIdStr === '' ? null : parseNumber(generalProductIdStr);
          const displayOrderRaw = parseNumber(mapped.DisplayOrder as string);
          const priceCogs = parseNumber(mapped.PriceCogs as string);

          const row: CreateProductRequest = {
            ProductName: productName || 'N/A',
            ProductNameEng: String(mapped.ProductNameEng || '').trim() || undefined,
            Code: code || undefined,
            Price: priceRaw ?? 0,
            PriceCogs: priceCogs !== null ? priceCogs : undefined,
            CatId: catIdRaw ?? 0,
            ProductType: productTypeRaw ?? 0,
            GeneralProductId: generalProductIdRaw ?? null,
            DisplayOrder: displayOrderRaw ?? 0,
            Active: parseBoolean(mapped.Active as string, true),
            IsAvailable: parseBoolean(mapped.IsAvailable as string, true),
          } as CreateProductRequest & { DisplayOrder?: number; IsMostOrdered?: boolean };

          parsed.push({ rowIndex: rowNum, data: row, warnings });
        });

        resolve({
          rows: parsed,
          errors: globalErrors,
          totalRows: rawRows.length,
        });
      } catch (err: unknown) {
        reject(new Error(`Không thể đọc file Excel: ${err instanceof Error ? err.message : String(err)}`));
      }
    };

    reader.onerror = () => reject(new Error('Không thể đọc file'));
    reader.readAsArrayBuffer(file);
  });
}
