import * as XLSX from 'xlsx';

// ─── Template column definitions ──────────────────────────────────────────────

const TEMPLATE_HEADERS = [
  'ProductName',
  'ProductNameEng',
  'Code',
  'Price',
  'PriceCogs',
  'CatId',
  'ProductType',
  'GeneralProductId',
  'DisplayOrder',
  'Active',
  'IsAvailable',
];

const HEADER_NOTES: Record<string, string> = {
  ProductName: 'Tên sản phẩm (bắt buộc)',
  ProductNameEng: 'Tên tiếng Anh (tuỳ chọn)',
  Code: 'Mã sản phẩm (bắt buộc, duy nhất)',
  Price: 'Giá bán – số nguyên, VD: 45000',
  PriceCogs: 'Giá vốn – tuỳ chọn, VD: 20000',
  CatId: 'ID danh mục (bắt buộc) – xem sheet "Danh mục"',
  ProductType:
    '0=Single | 1=Combo | 2=Room | 3=AdditionFee | 5=Extra | 6=General | 7=Detail | 8=CardPayment | 9=Sample',
  GeneralProductId: 'ID sản phẩm cha (chỉ cần khi ProductType=7)',
  DisplayOrder: 'Thứ tự hiển thị – số nguyên (mặc định 0)',
  Active: 'TRUE hoặc FALSE (mặc định TRUE)',
  IsAvailable: 'TRUE hoặc FALSE (mặc định TRUE)',
};

const SAMPLE_DATA = [
  {
    ProductName: 'Trà Sữa Hojicha',
    ProductNameEng: 'Hojicha Milk Tea',
    Code: 'TSH001',
    Price: 45000,
    PriceCogs: 18000,
    CatId: 1,
    ProductType: 0,
    GeneralProductId: '',
    DisplayOrder: 1,
    Active: 'TRUE',
    IsAvailable: 'TRUE',
  },
  {
    ProductName: 'Trà Sữa Hojicha M',
    ProductNameEng: 'Hojicha Milk Tea M',
    Code: 'TSH001M',
    Price: 45000,
    PriceCogs: 18000,
    CatId: 1,
    ProductType: 7,
    GeneralProductId: 10,
    DisplayOrder: 1,
    Active: 'TRUE',
    IsAvailable: 'TRUE',
  },
  {
    ProductName: 'Trà Sữa Hojicha L',
    ProductNameEng: 'Hojicha Milk Tea L',
    Code: 'TSH001L',
    Price: 50000,
    PriceCogs: 20000,
    CatId: 1,
    ProductType: 7,
    GeneralProductId: 10,
    DisplayOrder: 2,
    Active: 'TRUE',
    IsAvailable: 'TRUE',
  },
];

const PRODUCT_TYPE_LEGEND = [
  { Value: 0, Label: 'Single', Note: 'Sản phẩm đơn lẻ' },
  { Value: 1, Label: 'Combo', Note: 'Combo sản phẩm' },
  { Value: 2, Label: 'Room', Note: 'Phòng / Khu vực' },
  { Value: 3, Label: 'AdditionFee', Note: 'Phụ phí' },
  { Value: 5, Label: 'Extra', Note: 'Topping / Thêm vào' },
  { Value: 6, Label: 'General', Note: 'Sản phẩm cha (Parent)' },
  { Value: 7, Label: 'Detail', Note: 'Sản phẩm con (Child) – cần GeneralProductId' },
  { Value: 8, Label: 'CardPayment', Note: 'Thanh toán thẻ' },
  { Value: 9, Label: 'Sample', Note: 'Mẫu / Demo' },
];

// ─── Public API ───────────────────────────────────────────────────────────────

export function downloadProductTemplate(): void {
  const workbook = XLSX.utils.book_new();

  // ── Sheet 1: Products (headers in Row 1 so sheet_to_json works correctly) ──
  const productRows = [
    // Row 1: ACTUAL HEADERS — sheet_to_json uses this row as keys
    TEMPLATE_HEADERS,
    // Row 2+: sample data
    ...SAMPLE_DATA.map((row) =>
      TEMPLATE_HEADERS.map((h) => (row as Record<string, unknown>)[h] ?? '')
    ),
  ];

  const productSheet = XLSX.utils.aoa_to_sheet(productRows);

  // Column widths based on header + note length
  productSheet['!cols'] = TEMPLATE_HEADERS.map((h) => ({
    wch: Math.max(h.length + 4, (HEADER_NOTES[h]?.length ?? 0) + 4, 22),
  }));

  // Freeze top header row
  productSheet['!freeze'] = { xSplit: 0, ySplit: 1 };

  XLSX.utils.book_append_sheet(workbook, productSheet, 'Products');

  // ── Sheet 2: Hướng dẫn (column notes) ────────────────────────────────────
  const guideRows = [
    ['Cột', 'Tên trường', 'Mô tả / Hướng dẫn'],
    ...TEMPLATE_HEADERS.map((h, i) => [String(i + 1), h, HEADER_NOTES[h] ?? '']),
  ];
  const guideSheet = XLSX.utils.aoa_to_sheet(guideRows);
  guideSheet['!cols'] = [{ wch: 6 }, { wch: 22 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(workbook, guideSheet, 'Hướng dẫn');

  // ── Sheet 3: ProductType legend ───────────────────────────────────────────
  const legendSheet = XLSX.utils.json_to_sheet(PRODUCT_TYPE_LEGEND);
  legendSheet['!cols'] = [{ wch: 10 }, { wch: 18 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(workbook, legendSheet, 'ProductType Legend');

  // ── Download ───────────────────────────────────────────────────────────────
  XLSX.writeFile(workbook, 'product_import_template.xlsx');
}
