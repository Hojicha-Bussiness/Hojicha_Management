'use client';
import React, { useCallback, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { getProducts, deleteProduct } from '@/services/products';
import { useAuthStore } from '@/store/authStore';
import { DataTable } from '@/components/ui/data-table';
import { SkeletonTable } from '@/components/ui/skeleton-table';
import { ColumnDef } from '@tanstack/react-table';
import { PencilIcon } from '@/icons';
import { formatCurrency } from '@/utils/currency';
import { Product, PRODUCT_TYPE_OPTIONS } from '@/types/product';

const PRODUCT_TYPE_MAP: Record<number, string> = Object.fromEntries(
  PRODUCT_TYPE_OPTIONS.map((o) => [o.value, o.label])
);

export default function ProductListPage() {
  const [data, setData] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const fetchData = useCallback(async (pageNum = page, pageSize = size) => {
    setLoading(true);
    try {
      const res = await getProducts(pageNum, pageSize);
      if (res && res.data) {
        setData(res.data.items || res.data);
        setTotalPages(res.data.totalPages || 1);
        setTotalItems(res.data.total || (res.data.items || res.data).length || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, size]);

  useEffect(() => {
    fetchData(page, size);
  }, [fetchData, page, size]);

  const columns = useMemo<ColumnDef<Product>[]>(() => [
    {
      accessorKey: 'id',
      header: 'ID',
      cell: (info) => (
        <span className="text-gray-500 dark:text-gray-400 font-mono text-xs">{String(info.getValue())}</span>
      ),
    },
    {
      accessorKey: 'code',
      header: 'Code',
      cell: (info) => (
        <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
          {String(info.getValue() || '—')}
        </span>
      ),
    },
    {
      accessorKey: 'productName',
      header: 'Product Name',
      cell: (info) => (
        <span className="font-medium text-gray-900 dark:text-white">{String(info.getValue())}</span>
      ),
    },
    {
      accessorKey: 'price',
      header: 'Price',
      cell: ({ row }) => (
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
          {formatCurrency(row.original.price || 0)}
        </span>
      ),
    },
    {
      accessorKey: 'priceCogs',
      header: 'COGS',
      cell: ({ row }) => (
        <span className="text-gray-600 dark:text-gray-400 font-medium">
          {row.original.priceCogs !== null && row.original.priceCogs !== undefined
            ? formatCurrency(row.original.priceCogs)
            : '—'}
        </span>
      ),
    },
    {
      accessorKey: 'productType',
      header: 'Type',
      cell: ({ row }) => {
        const type = row.original.productType ?? 0;
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
            {PRODUCT_TYPE_MAP[type] || `Type ${type}`}
          </span>
        );
      },
    },
    {
      accessorKey: 'productCategoryName',
      header: 'Category',
      cell: ({ row }) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {row.original.productCategoryName || '—'}
        </span>
      ),
    },
    {
      accessorKey: 'displayOrder',
      header: 'Priority',
      cell: (info) => (
        <span className="font-semibold text-amber-600 dark:text-amber-400">
          {String(info.getValue() ?? '0')}
        </span>
      ),
    },
    {
      accessorKey: 'isMostOrdered',
      header: 'Best Seller',
      cell: ({ row }) => {
        const isMostOrdered = row.original.isMostOrdered;
        return isMostOrdered ? (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            ★ Bán chạy
          </span>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        );
      },
    },
    {
      accessorKey: 'active',
      header: 'Status',
      cell: ({ row }) => {
        const isActive = row.original.active;
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${isActive
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
            }`}>
            {isActive ? 'Active' : 'Inactive'}
          </span>
        );
      }
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const id = row.original.id;
        return (
          <div className="flex justify-end gap-3">
            <Link
              href={`/products/${id}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 transition-colors"
            >
              <PencilIcon className="w-4 h-4" />
              Details
            </Link>
            <Link
              href={`/products/${id}/edit`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 transition-colors"
            >
              Edit
            </Link>
          </div>
        );
      }
    }
  ], []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Products Management</h1>
        </div>
        <Link
          href="/products/create"
          className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors font-medium text-sm shadow-sm"
        >
          + Create Product
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow dark:bg-gray-800 p-6">
        {loading ? (
          <SkeletonTable columns={7} rows={8} />
        ) : (
          <DataTable
            columns={columns}
            data={data}
            searchKey="productName"
            searchPlaceholder="Search product by name..."
            paginationMode="server"
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={size}
            onPageChange={setPage}
            onPageSizeChange={(nextSize) => {
              setSize(nextSize);
              setPage(1);
            }}
            defaultPageSize={size}
          />
        )}
      </div>
    </div>
  );
}
