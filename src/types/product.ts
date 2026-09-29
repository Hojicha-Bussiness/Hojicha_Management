import { Store } from "./store";

export enum ProductTypeEnum {
  Single = 0,
  Combo = 1,
  Room = 2,
  AdditionFee = 3,
  Extra = 5,
  General = 6,
  Detail = 7,
  CardPayment = 8,
  Sample = 9,
}

export const PRODUCT_TYPE_OPTIONS: Array<{ value: ProductTypeEnum; label: string }> = [
  { value: ProductTypeEnum.Single, label: "Single" },
  { value: ProductTypeEnum.Combo, label: "Combo" },
  { value: ProductTypeEnum.Room, label: "Room" },
  { value: ProductTypeEnum.AdditionFee, label: "Addition Fee" },
  { value: ProductTypeEnum.Extra, label: "Extra" },
  { value: ProductTypeEnum.General, label: "General (Parent Product)" },
  { value: ProductTypeEnum.Detail, label: "Detail (Child Product)" },
  { value: ProductTypeEnum.CardPayment, label: "Card Payment" },
  { value: ProductTypeEnum.Sample, label: "Sample" },
];

export interface Product {
  id: number;

  productName?: string;
  productNameEng?: string;

  price: number;

  picUrl?: string;

  catId?: number;
  productCategoryName?: string | null;

  isAvailable: boolean;

  code: string;

  discountPercent?: number;
  discountPrice?: number;

  productType?: number;

  displayOrder?: number;

  hasExtra?: boolean;

  isFixedPrice?: boolean;

  posX?: number | null;
  posY?: number | null;

  colorGroup?: number | null;

  group?: number | null;
  groupId?: number | null;

  isMenuDisplay?: boolean | null;

  generalProductId?: number | null;

  att1?: string | null;
  att2?: string | null;
  att3?: string | null;
  att4?: string | null;
  att5?: string | null;
  att6?: string | null;
  att7?: string | null;
  att8?: string | null;
  att9?: string | null;
  att10?: string | null;

  maxExtra?: number | null;

  description?: string | null;
  descriptionEng?: string | null;

  introduction?: string | null;
  introductionEng?: string | null;

  printGroup?: number | null;

  seoName?: string | null;

  isHomePage?: number | null;

  webContent?: string | null;

  seoKeyWords?: string | null;
  seoDescription?: string | null;

  active: boolean;

  isDefaultChildProduct?: number;

  position?: number | null;

  saleType?: number | null;

  isMostOrdered?: boolean;

  note?: string | null;

  createTime?: string | null;

  ratingTotal?: number | null;

  numOfUserVoted?: number | null;

  status?: number | null;

  alternativeCode?: string | null;

  priceCogs?: number | null;

  memberPoint?: number;
  extraProductCodes?: string[];
}

export interface ProductDetailMapping {
  productDetailId: number;
  productId: number;
  storeId: number;
  price?: number;
  discountPrice?: number;
  discountPercent?: number;
  active?: boolean;
  productName?: string;
  storeName?: string;
  product?: Product;
  store?: Store;
}


export interface ProductCategory {
  id: number;

  categoryName: string;
  categoryNameEng: string;

  type: number;

  isDisplayed: boolean;
  isDisplayedWebsite: boolean;
  isExtra: boolean;

  displayOrder: number;

  adjustmentNote: string;

  seoName: string;
  seoKeyword: string;
  seoDescription: string;

  imageFontAwsomeCss: string;

  parentCateId?: number | null;
  parentCategoryName?: string | null;

  position?: number | null;

  active: boolean;

  brandId?: number | null;

  picUrl: string;
  bannerUrl: string;

  description: string;
  descriptionEng: string;

  bannerDescription: string;
  bannerDescriptionEng: string;

  vat?: number | null;

  children?: ProductCategory[];
}