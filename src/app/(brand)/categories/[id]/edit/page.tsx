'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getProductCategoryById, updateProductCategory, getProductCategories } from '@/services/productCategories';
import { getStores, Store } from '@/services/stores';
import { useAuthStore } from '@/store/authStore';

export default function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = React.use(params);

  const [category, setCategory] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCategoryAndCategories();
  }, [resolvedParams.id]);

  const fetchCategoryAndCategories = async () => {
    try {
      const brandId = useAuthStore.getState().user?.brandId;
      const [categoryRes, categoriesRes, storesRes] = await Promise.all([
        getProductCategoryById(resolvedParams.id, brandId || undefined),
        getProductCategories(1, 100, brandId || undefined),
        getStores(1, 1000, brandId || undefined)
      ]);

      if (categoryRes && categoryRes.data) {
        setCategory(categoryRes.data);
      }
      if (categoriesRes && categoriesRes.data) {
        setCategories(categoriesRes.data.items || categoriesRes.data || []);
      }
      if (storesRes && storesRes.data) {
        setStores(storesRes.data.items || storesRes.data || []);
      }
    } catch (error) {
      console.error('Error fetching category data:', error);
      toast.error('Failed to load category data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const payload = new FormData();

    payload.append('CateName', formData.get('CateName') as string);
    if (formData.get('CateNameEng')) {
      payload.append('CateNameEng', formData.get('CateNameEng') as string);
    }

    payload.append('Type', Number(formData.get('Type')).toString());

    payload.append('IsDisplayed', formData.get('IsDisplayed') === 'on' ? 'true' : 'false');
    payload.append('IsDisplayedWebsite', formData.get('IsDisplayedWebsite') === 'on' ? 'true' : 'false');
    payload.append('IsExtra', formData.get('IsExtra') === 'on' ? 'true' : 'false');

    payload.append('DisplayOrder', Number(formData.get('DisplayOrder') || 0).toString());

    if (formData.get('AdjustmentNote')) {
      payload.append('AdjustmentNote', formData.get('AdjustmentNote') as string);
    }

    const storeId = formData.get('StoreId');
    if (storeId) {
      payload.append('StoreId', Number(storeId).toString());
    }

    if (formData.get('SeoName')) {
      payload.append('SeoName', formData.get('SeoName') as string);
    }
    if (formData.get('SeoKeyword')) {
      payload.append('SeoKeyword', formData.get('SeoKeyword') as string);
    }
    if (formData.get('SeoDescription')) {
      payload.append('SeoDescription', formData.get('SeoDescription') as string);
    }

    if (formData.get('ImageFontAwsomeCss')) {
      payload.append('ImageFontAwsomeCss', formData.get('ImageFontAwsomeCss') as string);
    }

    const parentCateId = formData.get('ParentCateId');
    if (parentCateId) {
      payload.append('ParentCateId', Number(parentCateId).toString());
    }

    const position = formData.get('Position');
    if (position) {
      payload.append('Position', Number(position).toString());
    }

    payload.append('Active', formData.get('Active') === 'on' ? 'true' : 'false');

    const brandId = formData.get('BrandId') || useAuthStore.getState().user?.brandId;
    if (brandId) {
      payload.append('BrandId', brandId.toString());
    }

    if (formData.get('Description')) {
      payload.append('Description', formData.get('Description') as string);
    }
    if (formData.get('DescriptionEng')) {
      payload.append('DescriptionEng', formData.get('DescriptionEng') as string);
    }

    if (formData.get('BannerDescription')) {
      payload.append('BannerDescription', formData.get('BannerDescription') as string);
    }
    if (formData.get('BannerDescriptionEng')) {
      payload.append('BannerDescriptionEng', formData.get('BannerDescriptionEng') as string);
    }

    for (let i = 1; i <= 10; i++) {
      const attVal = formData.get(`Att${i}`);
      if (attVal) {
        payload.append(`Att${i}`, attVal as string);
      }
    }

    const vat = formData.get('Vat');
    if (vat) {
      payload.append('Vat', Number(vat).toString());
    }

    const imageFile = formData.get('imageFile') as File;
    if (imageFile && imageFile.size > 0) {
      payload.append('imageFile', imageFile);
    } else {
      payload.append('imageFile', '');
    }

    const bannerFile = formData.get('bannerFile') as File;
    if (bannerFile && bannerFile.size > 0) {
      payload.append('bannerFile', bannerFile);
    } else {
      payload.append('bannerFile', '');
    }

    try {
      await updateProductCategory(Number(resolvedParams.id), payload);
      toast.success('Category updated successfully!');
      router.push('/categories');
    } catch (err: any) {
      toast.error(`Error updating category: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="bg-white rounded-xl shadow p-6 space-y-6">
            {[...Array(4)].map((_, idx) => (
              <div key={idx} className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="h-10 bg-gray-200 rounded"></div>
                  <div className="h-10 bg-gray-200 rounded"></div>
                  <div className="h-10 bg-gray-200 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Filter out the category itself to avoid circular parenting
  const parentOptions = categories
    .filter((item) => Number(item.id) !== Number(resolvedParams.id))
    .map((item) => ({
      label: item.categoryName,
      value: item.id
    }));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.back()}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400"
        >
          &larr; Back
        </button>

        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
          Edit Category: {category?.cateName}
        </h1>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
        <form onSubmit={handleUpdate} className="space-y-8">
          <input type="hidden" name="BrandId" value={category?.brandId || ''} />

          {/* BASIC */}
          <div>
            <h2 className="text-lg font-semibold mb-4 dark:text-white">
              Basic Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Category Name"
                name="CateName"
                required
                defaultValue={category?.cateName || ''}
              />

              <Input
                label="English Name"
                name="CateNameEng"
                defaultValue={category?.cateNameEng || ''}
              />

              <Select
                label="Parent Category"
                name="ParentCateId"
                defaultValue={category?.parentCateId || ''}
                options={parentOptions}
              />

              <Input
                label="Type"
                name="Type"
                type="number"
                defaultValue={category?.type != null ? String(category.type) : '1'}
              />

              <Input
                label="Display Order"
                name="DisplayOrder"
                type="number"
                defaultValue={category?.displayOrder != null ? String(category.displayOrder) : '0'}
              />

              <Input
                label="Position"
                name="Position"
                type="number"
                defaultValue={category?.position != null ? String(category.position) : ''}
              />

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Cửa Hàng (Store)
                </label>
                <select
                  name="StoreId"
                  defaultValue={category?.storeId != null ? String(category.storeId) : ''}
                  className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="">Áp dụng tất cả cửa hàng (Mặc định)</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="VAT (%)"
                name="Vat"
                type="number"
                step="0.01"
                defaultValue={category?.vat != null ? String(category.vat) : ''}
              />

              <Input
                label="FontAwesome CSS"
                name="ImageFontAwsomeCss"
                defaultValue={category?.imageFontAwsomeCss || ''}
              />
            </div>
          </div>

          {/* SEO */}
          <div>
            <h2 className="text-lg font-semibold mb-4 dark:text-white">
              SEO Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="SEO Name"
                name="SeoName"
                defaultValue={category?.seoName || ''}
              />

              <Input
                label="SEO Keyword"
                name="SeoKeyword"
                defaultValue={category?.seoKeyword || ''}
              />

              <Input
                label="SEO Description"
                name="SeoDescription"
                defaultValue={category?.seoDescription || ''}
              />
            </div>
          </div>

          {/* MEDIA */}
          <div>
            <h2 className="text-lg font-semibold mb-4 dark:text-white">
              Media
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                  Category Image (Optional)
                </label>
                <input
                  type="file"
                  name="imageFile"
                  accept="image/*"
                  className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                {category?.picUrl && (
                  <p className="text-xs text-blue-500 mt-1">
                    Current image exists:{' '}
                    <a
                      href={category.picUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      View
                    </a>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                  Banner Image (Optional)
                </label>
                <input
                  type="file"
                  name="bannerFile"
                  accept="image/*"
                  className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                {category?.bannerUrl && (
                  <p className="text-xs text-blue-500 mt-1">
                    Current banner exists:{' '}
                    <a
                      href={category.bannerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      View
                    </a>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* DESCRIPTION */}
          <div>
            <h2 className="text-lg font-semibold mb-4 dark:text-white">
              Description
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Textarea
                label="Description"
                name="Description"
                defaultValue={category?.description || ''}
              />

              <Textarea
                label="Description English"
                name="DescriptionEng"
                defaultValue={category?.descriptionEng || ''}
              />

              <Textarea
                label="Banner Description"
                name="BannerDescription"
                defaultValue={category?.bannerDescription || ''}
              />

              <Textarea
                label="Banner Description English"
                name="BannerDescriptionEng"
                defaultValue={category?.bannerDescriptionEng || ''}
              />

              <Textarea
                label="Adjustment Note"
                name="AdjustmentNote"
                defaultValue={category?.adjustmentNote || ''}
              />
            </div>
          </div>

          {/* ATTRIBUTES */}
          <div>
            <h2 className="text-lg font-semibold mb-4 dark:text-white">
              Attributes
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, index) => {
                const attKey = `att${index + 1}`;
                return (
                  <Input
                    key={index}
                    label={`Att ${index + 1}`}
                    name={`Att${index + 1}`}
                    defaultValue={category?.[attKey] || ''}
                  />
                );
              })}
            </div>
          </div>

          {/* FLAGS */}
          <div>
            <h2 className="text-lg font-semibold mb-4 dark:text-white">
              Settings
            </h2>

            <div className="flex flex-wrap gap-6">
              <Checkbox
                label="Active"
                name="Active"
                defaultChecked={category?.active}
              />

              <Checkbox
                label="Display"
                name="IsDisplayed"
                defaultChecked={category?.isDisplayed}
              />

              <Checkbox
                label="Display Website"
                name="IsDisplayedWebsite"
                defaultChecked={category?.isDisplayedWebsite}
              />

              <Checkbox
                label="Extra Category"
                name="IsExtra"
                defaultChecked={category?.isExtra}
              />
            </div>
          </div>

          {/* ACTION */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-5 py-2 border rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Updating...' : 'Update Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Input(props: any) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1 dark:text-gray-300">
        {props.label}
      </label>

      <input
        {...props}
        className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
      />
    </div>
  );
}

function Textarea(props: any) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1 dark:text-gray-300">
        {props.label}
      </label>

      <textarea
        {...props}
        rows={4}
        className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
      />
    </div>
  );
}

function Checkbox(props: any) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        {...props}
        className="w-4 h-4"
      />

      <label className="text-sm dark:text-gray-300">
        {props.label}
      </label>
    </div>
  );
}

function Select({
  label,
  name,
  options,
  defaultValue
}: {
  label: string;
  name: string;
  options: any[];
  defaultValue?: any;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1 dark:text-gray-300">
        {label}
      </label>

      <select
        name={name}
        defaultValue={defaultValue}
        className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
      >
        <option value="">Select</option>

        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  );
}
