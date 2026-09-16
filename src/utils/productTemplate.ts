import * as XLSX from 'xlsx';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TemplateCategoryItem {
  id: number;
  name: string;
}

export interface TemplateParentProductItem {
  id: number;
  name: string;
  code: string;
}

export interface TemplateData {
  categories: TemplateCategoryItem[];
  parentProducts: TemplateParentProductItem[];
}

// ─── Column definitions ───────────────────────────────────────────────────────

// NOTE: Thứ tự này phải khớp với COLUMN_ALIASES trong excelProductParser.ts
const TEMPLATE_HEADERS = [
  'ProductName',
  'ProductNameEng',
  'Code',
  'Price',
  'PriceCogs',
  'CategoryName',     // Người dùng điền tên danh mục → parser tự resolve sang CatId
  'CatId',            // Hoặc điền thẳng ID (ưu tiên hơn CategoryName)
  'ProductType',      // Số 0-9, xem sheet ProductType Legend
  'ParentProductId',  // ID sản phẩm cha (khi ProductType=7)
  'DisplayOrder',
  'Active',
  'IsAvailable',
];

const HEADER_NOTES: Record<string, string> = {
  ProductName:    '(*) Tên sản phẩm – bắt buộc',
  ProductNameEng: 'Tên tiếng Anh – tuỳ chọn',
  Code:           '(*) Mã sản phẩm – bắt buộc, phải duy nhất',
  Price:          '(*) Giá bán – số nguyên VD: 45000',
  PriceCogs:      'Giá vốn – tuỳ chọn VD: 20000',
  CategoryName:   'Tên danh mục – xem sheet 📋 Danh Mục để copy',
  CatId:          'ID danh mục – nếu điền thì ưu tiên hơn CategoryName',
  ProductType:    '(*) Loại: 0=Single | 1=Combo | 5=Extra | 6=General | 7=Detail – xem sheet ProductType',
  ParentProductId:'ID sản phẩm cha – chỉ cần khi ProductType=7, xem sheet 📋 SP Cha',
  DisplayOrder:   'Thứ tự hiển thị – số nguyên (mặc định 0)',
  Active:         'TRUE hoặc FALSE (mặc định TRUE)',
  IsAvailable:    'TRUE hoặc FALSE (mặc định TRUE)',
};

const PRODUCT_TYPE_ROWS = [
  [0, 'Single',      'Sản phẩm đơn lẻ (thông thường)'],
  [1, 'Combo',       'Combo nhiều sản phẩm'],
  [2, 'Room',        'Phòng / Khu vực'],
  [3, 'AdditionFee', 'Phụ phí bổ sung'],
  [5, 'Extra',       'Topping / Thêm vào (điền vào cột ExtraProductCodes)'],
  [6, 'General',     'Sản phẩm cha – Parent (không có giá riêng)'],
  [7, 'Detail',      'Sản phẩm con – Child (cần điền ParentProductId)'],
  [8, 'CardPayment', 'Thanh toán thẻ'],
  [9, 'Sample',      'Mẫu / Demo'],
];

// ─── Public API ───────────────────────────────────────────────────────────────

export function downloadProductTemplate(templateData?: TemplateData): void {
  const workbook = XLSX.utils.book_new();
  const { categories = [], parentProducts = [] } = templateData ?? {};

  // ── Sheet 1: Products ──────────────────────────────────────────────────────
  // Row 1 = HEADERS (sheet_to_json dùng row này làm keys — không được thay đổi)
  const sampleRows = buildSampleRows(categories, parentProducts);

  const productRows = [TEMPLATE_HEADERS, ...sampleRows];
  const productSheet = XLSX.utils.aoa_to_sheet(productRows);

  productSheet['!cols'] = TEMPLATE_HEADERS.map((h) => ({
    wch: Math.max(h.length + 4, (HEADER_NOTES[h]?.length ?? 0) + 2, 20),
  }));
  productSheet['!freeze'] = { xSplit: 0, ySplit: 1 };

  // Data validation: ProductType (column H = index 7)
  const ptValues = PRODUCT_TYPE_ROWS.map((r) => r[0]).join(',');
  (productSheet as any)['!datavalidations'] = [
    {
      sqref: 'H2:H10000',
      type: 'list',
      formula1: `"${ptValues}"`,
      showDropDown: false,
    },
  ];

  XLSX.utils.book_append_sheet(workbook, productSheet, 'Products');

  // ── Sheet 2: Danh Mục (Categories) ───────────────────────────────────────
  const catRows: (string | number)[][] = [
    ['CatId', 'CategoryName', '← Copy giá trị cột này vào sheet Products'],
  ];
  if (categories.length > 0) {
    categories.forEach((c) => catRows.push([c.id, c.name, '']));
  } else {
    catRows.push(['', '(Không có dữ liệu – vui lòng đăng nhập lại và thử lại)', '']);
  }
  const catSheet = XLSX.utils.aoa_to_sheet(catRows);
  catSheet['!cols'] = [{ wch: 8 }, { wch: 40 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(workbook, catSheet, '📋 Danh Mục');

  // ── Sheet 3: Parent Products ───────────────────────────────────────────────
  const ppRows: (string | number)[][] = [
    ['ParentProductId', 'ProductName', 'Code', '← Dùng khi ProductType = 7 (Detail)'],
  ];
  if (parentProducts.length > 0) {
    parentProducts.forEach((p) =>
      ppRows.push([p.id, p.name, p.code, ''])
    );
  } else {
    ppRows.push(['', '(Chưa có sản phẩm General nào trong hệ thống)', '', '']);
  }
  const ppSheet = XLSX.utils.aoa_to_sheet(ppRows);
  ppSheet['!cols'] = [{ wch: 16 }, { wch: 40 }, { wch: 14 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(workbook, ppSheet, '📋 SP Cha');

  // ── Sheet 4: ProductType Legend ───────────────────────────────────────────
  const ptRows = [
    ['Giá trị (ProductType)', 'Tên loại', 'Mô tả'],
    ...PRODUCT_TYPE_ROWS,
  ];
  const ptSheet = XLSX.utils.aoa_to_sheet(ptRows);
  ptSheet['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 55 }];
  XLSX.utils.book_append_sheet(workbook, ptSheet, 'ProductType Legend');

  // ── Sheet 5: Hướng dẫn ────────────────────────────────────────────────────
  const guideRows: (string | number)[][] = [
    ['#', 'Tên cột', 'Mô tả / Hướng dẫn'],
    ...TEMPLATE_HEADERS.map((h, i) => [i + 1, h, HEADER_NOTES[h] ?? '']),
    ['', '', ''],
    ['', 'Lưu ý quan trọng:', ''],
    ['', '1.', 'Dòng đầu tiên (header) KHÔNG được xoá hoặc sửa tên cột'],
    ['', '2.', 'Điền CategoryName HOẶC CatId (không cần cả hai)'],
    ['', '3.', 'Nếu ProductType = 7 (Detail) thì bắt buộc có ParentProductId'],
    ['', '4.', 'Price, CatId, ProductType phải là số'],
    ['', '5.', 'Các cột (*) là bắt buộc'],
  ];
  const guideSheet = XLSX.utils.aoa_to_sheet(guideRows);
  guideSheet['!cols'] = [{ wch: 4 }, { wch: 20 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(workbook, guideSheet, 'Hướng dẫn');

  XLSX.writeFile(workbook, 'product_import_template.xlsx');
}

// ─── Build sample rows with real category/parent data ─────────────────────────

function buildSampleRows(
  categories: TemplateCategoryItem[],
  parentProducts: TemplateParentProductItem[]
): (string | number)[][] {
  const cat1 = categories[0];
  const cat2 = categories[1] ?? categories[0];
  const parent1 = parentProducts[0];

  // Row 1: General/Single product
  const row1: Record<string, string | number> = {
    ProductName: 'Trà Sữa Hojicha',
    ProductNameEng: 'Hojicha Milk Tea',
    Code: 'TSH001',
    Price: 45000,
    PriceCogs: 18000,
    CategoryName: cat1?.name ?? 'Trà Sữa',
    CatId: cat1?.id ?? 1,
    ProductType: 6,
    ParentProductId: '',
    DisplayOrder: 1,
    Active: 'TRUE',
    IsAvailable: 'TRUE',
  };

  // Row 2: Detail/Child — references parent above
  const row2: Record<string, string | number> = {
    ProductName: 'Trà Sữa Hojicha Size M',
    ProductNameEng: 'Hojicha Milk Tea M',
    Code: 'TSH001M',
    Price: 45000,
    PriceCogs: 18000,
    CategoryName: cat1?.name ?? 'Trà Sữa',
    CatId: cat1?.id ?? 1,
    ProductType: 7,
    ParentProductId: parent1?.id ?? '(ID sản phẩm cha)',
    DisplayOrder: 1,
    Active: 'TRUE',
    IsAvailable: 'TRUE',
  };

  // Row 3: Single in different category
  const row3: Record<string, string | number> = {
    ProductName: 'Bánh Mì Pate',
    ProductNameEng: 'Pate Bread',
    Code: 'BMP001',
    Price: 25000,
    PriceCogs: 10000,
    CategoryName: cat2?.name ?? 'Bánh',
    CatId: cat2?.id ?? 2,
    ProductType: 0,
    ParentProductId: '',
    DisplayOrder: 2,
    Active: 'TRUE',
    IsAvailable: 'TRUE',
  };

  return [row1, row2, row3].map((row) =>
    TEMPLATE_HEADERS.map((h) => (row[h] as string | number) ?? '')
  );
}
