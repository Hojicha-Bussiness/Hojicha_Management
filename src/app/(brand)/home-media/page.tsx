'use client';
/* eslint-disable @next/next/no-img-element -- admin preview renders signed storage URLs and local object URLs */

import React, {
  ChangeEvent,
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useDropzone } from 'react-dropzone';
import { useAuthStore } from '@/store/authStore';
import { optimizeImageForUpload } from '@/services/imageOptimizer';
import {
  ensureHomeMediaDraft,
  getHomeMediaActionOptions,
  getHomeMediaDraft,
  saveHomeMediaSnapshot,
  stageHomeMediaUpload,
  type HomeMediaActionOption,
  type HomeMediaActionOptions,
  type HomeMediaDraft,
  type HomeMediaItem,
  type HomeMediaStageUploadReceipt,
} from '@/services/homeMedia';

type ActiveTab = 'home' | 'account';
type ListGroupKey = 'hero' | 'promotion' | 'about';

type ItemState = Omit<
  HomeMediaItem,
  'actionTargetKey' | 'actionTargetId' | 'actionExternalUrl'
> & {
  localId: string;
  isNew: boolean;
  dirty: boolean;
  selectedFile: File | null;
  stagedReceipt: HomeMediaStageUploadReceipt | null;
  actionTargetKey: string;
  actionTargetId: string;
  actionExternalUrl: string;
  expandedAction: boolean;
};

const LIST_GROUPS: ListGroupKey[] = ['hero', 'promotion', 'about'];
const HOME_GROUPS = ['hero', 'quickAction', 'promotion', 'about'] as const;

const groupMeta: Record<
  string,
  { title: string; subtitle: string; aspectHint: string }
> = {
  hero: {
    title: 'Ảnh đầu trang',
    subtitle:
      'Danh sách banner trượt ngang đầu màn hình Trang chủ. Không giới hạn số lượng, hỗ trợ kéo thả nhiều ảnh và sắp xếp thứ tự.',
    aspectHint: 'Tỷ lệ khuyến nghị 16:9 hoặc 2:1',
  },
  quickAction: {
    title: 'Thao tác nhanh',
    subtitle:
      'Hai ô điều hướng cố định dưới banner đầu trang (Đặt món & Đổi quà).',
    aspectHint: '2 ô cố định',
  },
  promotion: {
    title: 'Ảnh ưu đãi',
    subtitle:
      'Danh sách thẻ chương trình ưu đãi hiển thị trên Trang chủ Mobile. Không giới hạn số lượng, hỗ trợ kéo thả và đổi thứ tự.',
    aspectHint: 'Tỷ lệ khuyến nghị 16:9',
  },
  about: {
    title: 'Ảnh giới thiệu',
    subtitle:
      'Danh sách hình ảnh câu chuyện thương hiệu / Về chúng tôi trên Trang chủ Mobile. Không giới hạn số lượng.',
    aspectHint: 'Tỷ lệ khuyến nghị 16:9 hoặc 4:3',
  },
  account: {
    title: 'Tiện ích Tài khoản',
    subtitle:
      'Ảnh nền cho các ô tiện ích tại màn hình Tài khoản và ảnh tiêu đề Kho ưu đãi. Giữ nguyên số lượng voucher, điểm thưởng và thao tác gốc trên ứng dụng.',
    aspectHint: '3 ô tiện ích + 1 ảnh tiêu đề Kho ưu đãi',
  },
};

const fixedSlotLabels: Record<string, string> = {
  'quick-action-order': 'Đặt hàng / Giao hàng',
  'quick-action-gift': 'Đổi ưu đãi / Quà tặng',
  'account-coupons': 'Kho ưu đãi',
  'account-credits': 'Đổi voucher',
  'account-referrals': 'Giới thiệu bạn bè',
  'account-voucher-header': 'Ảnh tiêu đề / Mascot Kho ưu đãi',
};

const internalRouteVietnameseLabels: Record<string, string> = {
  home: 'Trang chủ',
  menu: 'Thực đơn đặt món',
  stores: 'Danh sách cửa hàng',
  myCoupons: 'Kho ưu đãi của tôi',
  stampCard: 'Thẻ tích tem',
  loyaltyCredits: 'Đổi điểm thưởng',
};

const actionTypeLabels: Record<string, string> = {
  None: 'Không có hành động',
  InternalRoute: 'Mở màn hình trong app',
  Product: 'Mở sản phẩm',
  SpecialOffer: 'Mở ưu đãi Mobile',
  StampProgram: 'Mở chương trình tích tem',
  ExternalHttps: 'Mở liên kết HTTPS',
};

function isListGroup(groupKey: string): groupKey is ListGroupKey {
  return (
    groupKey === 'hero' || groupKey === 'promotion' || groupKey === 'about'
  );
}

function getTabForGroup(groupKey: string): ActiveTab {
  return groupKey === 'account' ? 'account' : 'home';
}

interface DraggableListRowProps {
  groupKey: ListGroupKey;
  index: number;
  total: number;
  onMove: (groupKey: ListGroupKey, fromIndex: number, toIndex: number) => void;
  children: React.ReactNode;
}

function DraggableListRow({
  groupKey,
  index,
  onMove,
  children,
}: DraggableListRowProps) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const itemType = `HOME_MEDIA_CARD_${groupKey.toUpperCase()}`;

  const [{ isDragging }, drag] = useDrag({
    type: itemType,
    item: { index, groupKey },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver }, drop] = useDrop<
    { index: number; groupKey: ListGroupKey },
    void,
    { isOver: boolean }
  >({
    accept: itemType,
    hover: (dragged) => {
      if (dragged.groupKey !== groupKey || dragged.index === index) return;
      onMove(groupKey, dragged.index, index);
      dragged.index = index;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  drag(drop(rowRef));

  return (
    <div
      ref={rowRef}
      className={`transition ${isDragging ? 'opacity-50' : ''} ${
        isOver ? 'ring-2 ring-brand-500/40 rounded-xl' : ''
      }`}
    >
      {children}
    </div>
  );
}

interface SectionMultiDropzoneProps {
  groupKey: ListGroupKey;
  disabled: boolean;
  onFilesAdded: (groupKey: ListGroupKey, files: File[]) => void;
  onAddEmptySlot: (groupKey: ListGroupKey) => void;
}

function SectionMultiDropzone({
  groupKey,
  disabled,
  onFilesAdded,
  onAddEmptySlot,
}: SectionMultiDropzoneProps) {
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        onFilesAdded(groupKey, acceptedFiles);
      }
    },
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    multiple: true,
    noClick: true,
    disabled,
  });

  return (
    <div
      {...getRootProps()}
      className={`flex flex-col gap-3 rounded-xl border-2 border-dashed p-4 transition sm:flex-row sm:items-center sm:justify-between ${
        isDragActive
          ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-500/10'
          : 'border-gray-300 bg-gray-50/70 dark:border-gray-700 dark:bg-gray-800/40'
      }`}
    >
      <input {...getInputProps()} />
      <div className="text-xs text-gray-600 dark:text-gray-300">
        <p className="font-semibold text-gray-800 dark:text-white">
          Kéo thả nhiều ảnh vào đây để thêm nhanh vào {groupMeta[groupKey]?.title}
        </p>
        <p className="mt-0.5 text-gray-500 dark:text-gray-400">
          Hỗ trợ JPG, PNG, WebP (tối đa 10 MB/ảnh, tự động chuẩn hóa WebP khi lưu).
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <button
          type="button"
          disabled={disabled}
          onClick={open}
          className="inline-flex min-h-9 items-center justify-center rounded-lg bg-brand-500 px-3.5 py-2 text-xs font-semibold text-white shadow-theme-xs transition hover:bg-brand-600 disabled:opacity-50"
        >
          Chọn ảnh
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onAddEmptySlot(groupKey)}
          className="inline-flex min-h-9 items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        >
          + Thêm ô trống
        </button>
      </div>
    </div>
  );
}

export default function HomeMediaPage() {
  const user = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [draft, setDraft] = useState<HomeMediaDraft | null>(null);
  const [items, setItems] = useState<ItemState[]>([]);
  const [deletedTabs, setDeletedTabs] = useState<{ home: boolean; account: boolean }>({
    home: false,
    account: false,
  });
  const [options, setOptions] = useState<HomeMediaActionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [stagingStatus, setStagingStatus] = useState('');
  const [message, setMessage] = useState('');
  const [previewMessage, setPreviewMessage] = useState('');
  const [error, setError] = useState('');
  const pendingOperationIdRef = useRef<string | null>(null);

  const mapServerItems = useCallback((serverItems: HomeMediaItem[]): ItemState[] => {
    return serverItems
      .filter((item) => item.groupKey !== 'tier')
      .map((item, idx) => ({
        ...item,
        localId: `srv-${item.id || idx}-${item.contentKey}`,
        isNew: false,
        dirty: false,
        selectedFile: null,
        stagedReceipt: null,
        actionTargetKey: item.actionTargetKey ?? '',
        actionTargetId: item.actionTargetId?.toString() ?? '',
        actionExternalUrl: item.actionExternalUrl ?? '',
        expandedAction: item.actionType !== 'None',
      }));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await ensureHomeMediaDraft();
      const [draftResponse, optionsResponse] = await Promise.all([
        getHomeMediaDraft(),
        getHomeMediaActionOptions(),
      ]);
      const nextDraft = draftResponse.data ?? null;
      setDraft(nextDraft);
      setItems(mapServerItems(nextDraft?.items ?? []));
      setDeletedTabs({ home: false, account: false });
      pendingOperationIdRef.current = null;

      const actionData = optionsResponse.data as
        | HomeMediaActionOptions
        | undefined;
      const localizedRoutes = (actionData?.internalRoutes ?? []).map((opt) => ({
        ...opt,
        label: internalRouteVietnameseLabels[opt.key] ?? opt.label,
      }));
      setOptions([
        ...(actionData?.none ?? []),
        ...localizedRoutes,
        ...(actionData?.products ?? []),
        ...(actionData?.specialOffers ?? []),
        ...(actionData?.stampPrograms ?? []),
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không tải được cấu hình Giao diện Mobile.',
      );
    } finally {
      setLoading(false);
    }
  }, [mapServerItems]);

  useEffect(() => {
    if (user?.role === 'BrandManager') void load();
  }, [load, user?.role]);

  const hasUnsavedChanges = useMemo(
    () =>
      items.some((item) => item.dirty) ||
      deletedTabs.home ||
      deletedTabs.account,
    [deletedTabs.account, deletedTabs.home, items],
  );

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const previewUrls = useMemo(() => {
    const urls = new Map<string, string>();
    items.forEach((item) => {
      if (item.selectedFile) {
        urls.set(item.localId, URL.createObjectURL(item.selectedFile));
      }
    });
    return urls;
  }, [items]);

  useEffect(
    () => () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    },
    [previewUrls],
  );

  const groupedItems = useMemo(() => {
    const groups: Record<string, ItemState[]> = {
      hero: [],
      quickAction: [],
      promotion: [],
      about: [],
      account: [],
    };
    items.forEach((item) => {
      (groups[item.groupKey] ??= []).push(item);
    });
    return groups;
  }, [items]);

  if (user?.role === 'Administrator') return null;
  if (user?.role && user.role !== 'BrandManager') {
    return (
      <div className="p-6 text-error-600">
        Bạn không có quyền chỉnh sửa Giao diện Mobile.
      </div>
    );
  }

  const updateItemByLocalId = (localId: string, patch: Partial<ItemState>) => {
    pendingOperationIdRef.current = null;
    setItems((current) =>
      current.map((item) =>
        item.localId === localId ? { ...item, ...patch, dirty: true } : item,
      ),
    );
  };

  const handleSelectSingleFile = (localId: string, file: File | null) => {
    if (!file) return;
    pendingOperationIdRef.current = null;
    setItems((current) =>
      current.map((item) =>
        item.localId === localId
          ? {
              ...item,
              selectedFile: file,
              stagedReceipt: null,
              dirty: true,
            }
          : item,
      ),
    );
  };

  const handleCardFileDrop = (
    event: DragEvent<HTMLElement>,
    localId: string,
  ) => {
    if (!event.dataTransfer?.files?.length) return;
    event.preventDefault();
    event.stopPropagation();
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile) {
      handleSelectSingleFile(localId, droppedFile);
    }
  };

  const handleAddFilesToGroup = (groupKey: ListGroupKey, files: File[]) => {
    if (!files.length) return;
    pendingOperationIdRef.current = null;
    setItems((current) => {
      const nextIdSeed =
        current.reduce((min, item) => Math.min(min, item.id), 0) - 1;
      const additions: ItemState[] = files.map((file, idx) => ({
        id: nextIdSeed - idx,
        localId: `local-${groupKey}-${Date.now()}-${idx}-${Math.random()
          .toString(36)
          .slice(2, 7)}`,
        contentKey: `${groupKey}-local-${Date.now()}-${idx}`,
        groupKey,
        layoutType: groupKey,
        imageUrl: '',
        storageObjectKey: '',
        actionType: 'None',
        actionTargetKey: '',
        actionTargetId: '',
        actionExternalUrl: '',
        isActive: true,
        isNew: true,
        dirty: true,
        selectedFile: file,
        stagedReceipt: null,
        expandedAction: false,
      }));
      return [...current, ...additions];
    });
    setMessage(
      `Đã thêm ${files.length} ảnh vào "${groupMeta[groupKey].title}". Bấm "Lưu tất cả" để áp dụng lên ứng dụng Mobile.`,
    );
    setError('');
  };

  const handleAddEmptySlot = (groupKey: ListGroupKey) => {
    pendingOperationIdRef.current = null;
    setItems((current) => {
      const nextId =
        current.reduce((min, item) => Math.min(min, item.id), 0) - 1;
      return [
        ...current,
        {
          id: nextId,
          localId: `local-${groupKey}-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 7)}`,
          contentKey: `${groupKey}-local-${Date.now()}`,
          groupKey,
          layoutType: groupKey,
          imageUrl: '',
          storageObjectKey: '',
          actionType: 'None',
          actionTargetKey: '',
          actionTargetId: '',
          actionExternalUrl: '',
          isActive: true,
          isNew: true,
          dirty: true,
          selectedFile: null,
          stagedReceipt: null,
          expandedAction: false,
        },
      ];
    });
    setMessage(
      `Đã thêm 1 ô trống vào "${groupMeta[groupKey].title}". Hãy chọn ảnh rồi bấm "Lưu tất cả".`,
    );
    setError('');
  };

  const handleRemoveListItem = (item: ItemState, indexInGroup = 0) => {
    if (!isListGroup(item.groupKey)) return;
    const cardLabel = getFriendlyCardLabel(item, indexInGroup);
    const sectionTitle = groupMeta[item.groupKey]?.title ?? item.groupKey;
    if (!item.isNew && typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const confirmed = window.confirm(
        `Bạn có chắc muốn xóa "${cardLabel}" thuộc mục "${sectionTitle}"?\n\nLưu ý: Hiện tại ảnh chỉ được gỡ khỏi danh sách chờ lưu. Khi bạn bấm "Lưu tất cả", ảnh sẽ bị gỡ khỏi ứng dụng Mobile và xóa vĩnh viễn trên kho lưu trữ Firebase (nếu không còn dùng ở vị trí khác).`,
      );
      if (!confirmed) return;
    }
    pendingOperationIdRef.current = null;
    setItems((current) =>
      current.filter((candidate) => candidate.localId !== item.localId),
    );
    if (!item.isNew) {
      const tab = getTabForGroup(item.groupKey);
      setDeletedTabs((prev) => ({ ...prev, [tab]: true }));
      setMessage(
        `Đã gỡ "${cardLabel}" khỏi danh sách chờ lưu của "${sectionTitle}" (chưa xóa trên kho lưu trữ). Bấm "Lưu tất cả" để áp dụng và xóa tệp trên Firebase.`,
      );
    } else {
      setMessage(
        `Đã xóa ô chưa lưu khỏi "${sectionTitle}" (xử lý cục bộ, không ảnh hưởng ứng dụng Mobile).`,
      );
    }
    setError('');
  };

  const handleClearFixedSlotImage = (item: ItemState) => {
    const slotLabel = fixedSlotLabels[item.contentKey] ?? item.contentKey;
    if (
      item.imageUrl &&
      typeof window !== 'undefined' &&
      typeof window.confirm === 'function'
    ) {
      const confirmed = window.confirm(
        `Bạn có chắc muốn gỡ ảnh của ô "${slotLabel}"?\n\nKhi bấm "Lưu tất cả", ảnh sẽ được gỡ khỏi ứng dụng Mobile và xóa khỏi kho lưu trữ Firebase (nếu không còn dùng ở vị trí khác).`,
      );
      if (!confirmed) return;
    }
    pendingOperationIdRef.current = null;
    setItems((current) =>
      current.map((candidate) =>
        candidate.localId === item.localId
          ? {
              ...candidate,
              imageUrl: '',
              storageObjectKey: '',
              selectedFile: null,
              stagedReceipt: null,
              dirty: true,
            }
          : candidate,
      ),
    );
    setMessage(
      `Đã gỡ ảnh của ô "${slotLabel}" trong bản chờ lưu. Bấm "Lưu tất cả" để áp dụng.`,
    );
    setError('');
  };

  const handleMoveInGroup = (
    groupKey: ListGroupKey,
    fromIndex: number,
    toIndex: number,
  ) => {
    pendingOperationIdRef.current = null;
    setItems((current) => {
      const groupList = current.filter((item) => item.groupKey === groupKey);
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= groupList.length ||
        toIndex >= groupList.length ||
        fromIndex === toIndex
      ) {
        return current;
      }
      const reordered = [...groupList];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, { ...moved, dirty: true });
      const markedGroup = reordered.map((entry) => ({ ...entry, dirty: true }));

      let cursor = 0;
      return current.map((item) => {
        if (item.groupKey !== groupKey) return item;
        const replacement = markedGroup[cursor];
        cursor += 1;
        return replacement;
      });
    });
  };

  const resolveDisplayImageUrl = (item: ItemState) =>
    previewUrls.get(item.localId) ||
    item.stagedReceipt?.previewImageUrl ||
    item.imageUrl;

  const targetOptions = (type: string) =>
    options.filter((option) => option.type === type);

  const actionTarget = (item: ItemState) =>
    options.find(
      (option) =>
        option.type === item.actionType &&
        `${option.key || option.id || ''}` ===
          (item.actionTargetKey || item.actionTargetId),
    );

  const actionLabel = (item: ItemState) =>
    actionTarget(item)?.label ??
    actionTypeLabels[item.actionType] ??
    item.actionType;

  const getFriendlyCardLabel = (item: ItemState, indexInGroup: number) => {
    if (fixedSlotLabels[item.contentKey]) {
      return fixedSlotLabels[item.contentKey];
    }
    return `Ảnh ${indexInGroup + 1}`;
  };

  const saveCurrentTab = async () => {
    if (!draft) return;

    const tabGroups =
      activeTab === 'account' ? ['account'] : [...HOME_GROUPS];
    const tabItems = items.filter((item) => tabGroups.includes(item.groupKey));
    const tabDirty =
      tabItems.some((item) => item.dirty) ||
      (activeTab === 'home' ? deletedTabs.home : deletedTabs.account);

    for (const groupKey of tabGroups) {
      if (!isListGroup(groupKey)) continue;
      const groupList = groupedItems[groupKey] ?? [];
      const emptyIndex = groupList.findIndex(
        (item) =>
          !item.selectedFile &&
          !item.stagedReceipt?.storageObjectKey &&
          !item.imageUrl,
      );
      if (emptyIndex !== -1) {
        setError(
          `Mục "Ảnh ${emptyIndex + 1}" trong phần "${groupMeta[groupKey].title}" chưa có tệp ảnh. Vui lòng chọn ảnh hoặc bấm Xóa ô trống trước khi lưu.`,
        );
        return;
      }
    }

    if (!tabDirty) {
      setMessage('Không có thay đổi nào cần lưu trong tab này.');
      setError('');
      return;
    }

    setBusy(true);
    setMessage('');
    setError('');

    const itemsNeedingStage = tabItems.filter(
      (item) => item.selectedFile && !item.stagedReceipt,
    );
    const totalToUpload = tabItems.filter(
      (item) => item.selectedFile || item.stagedReceipt,
    ).length;
    let uploadedCount = tabItems.filter((item) => item.stagedReceipt).length;

    const stagedByLocalId = new Map<string, HomeMediaStageUploadReceipt>();
    tabItems.forEach((item) => {
      if (item.stagedReceipt) {
        stagedByLocalId.set(item.localId, item.stagedReceipt);
      }
    });

    try {
      for (const item of itemsNeedingStage) {
        setStagingStatus(
          `Đang tải ảnh lên bộ nhớ tạm (${uploadedCount}/${totalToUpload})...`,
        );
        const optimizedFile = await optimizeImageForUpload(
          item.selectedFile as File,
          { preset: 'banner' },
        );
        const stageRes = await stageHomeMediaUpload(
          optimizedFile,
          item.groupKey,
          item.localId,
        );
        const receipt = stageRes.data;
        if (!receipt?.storageObjectKey) {
          throw new Error(
            stageRes.message || 'Không nhận được biên nhận tải ảnh tạm.',
          );
        }

        stagedByLocalId.set(item.localId, receipt);
        uploadedCount += 1;

        setItems((current) =>
          current.map((candidate) =>
            candidate.localId === item.localId
              ? { ...candidate, stagedReceipt: receipt }
              : candidate,
          ),
        );
        setStagingStatus(
          `Đã tải ${uploadedCount}/${totalToUpload} tệp lên bộ nhớ tạm (chưa áp dụng)...`,
        );
      }

      if (!pendingOperationIdRef.current) {
        pendingOperationIdRef.current = `${activeTab}${Date.now().toString(36)}${Math.random()
          .toString(36)
          .slice(2, 8)}`;
      }

      setStagingStatus('Đang áp dụng thay đổi lên ứng dụng Mobile...');
      const snapshotPayload = {
        operationId: pendingOperationIdRef.current,
        tab: activeTab,
        expectedDraftRevision: draft.concurrencyToken.expectedDraftRevision,
        expectedPublishedRevision:
          draft.concurrencyToken.expectedPublishedRevision,
        expectedRowVersion: draft.concurrencyToken.expectedRowVersion,
        items: tabItems.map((item) => {
          const receipt = stagedByLocalId.get(item.localId) ?? item.stagedReceipt;
          const storageKey =
            receipt?.storageObjectKey ||
            item.storageObjectKey ||
            item.imageUrl ||
            '';
          return {
            id: item.isNew ? null : item.id,
            contentKey: item.contentKey,
            groupKey: item.groupKey,
            layoutType: item.layoutType || item.groupKey,
            imageUrl: receipt?.previewImageUrl || item.imageUrl || storageKey,
            storageObjectKey: storageKey,
            actionType: item.actionType || 'None',
            actionTargetKey: item.actionTargetKey || null,
            actionTargetId: item.actionTargetId
              ? Number(item.actionTargetId)
              : null,
            actionExternalUrl: item.actionExternalUrl || null,
            isActive: true,
          };
        }),
      };

      const saveRes = await saveHomeMediaSnapshot(snapshotPayload);
      const updatedDraft = saveRes.data;
      if (updatedDraft) {
        setDraft(updatedDraft);
        setItems(mapServerItems(updatedDraft.items ?? []));
      } else {
        await load();
      }
      setDeletedTabs((prev) => ({ ...prev, [activeTab]: false }));
      pendingOperationIdRef.current = null;
      setStagingStatus('');

      const purgePending =
        saveRes.status === 202 ||
        updatedDraft?.storagePurgeStatus === 'Pending' ||
        (updatedDraft?.pendingPurgeCount ?? 0) > 0;

      if (purgePending) {
        setMessage(
          saveRes.message ||
            'Đã áp dụng giao diện mới lên ứng dụng Mobile, nhưng tệp ảnh cũ trên kho lưu trữ Firebase đang chờ xóa hoàn tất (PurgePending).',
        );
      } else if (updatedDraft?.storagePurgeStatus === 'Completed') {
        setMessage(
          activeTab === 'home'
            ? 'Đã lưu, áp dụng trực tiếp cấu hình Trang chủ lên ứng dụng Mobile và xóa hoàn tất tệp ảnh cũ trên kho lưu trữ.'
            : 'Đã lưu, áp dụng trực tiếp cấu hình Tài khoản lên ứng dụng Mobile và xóa hoàn tất tệp ảnh cũ trên kho lưu trữ.',
        );
      } else {
        setMessage(
          activeTab === 'home'
            ? 'Đã lưu và áp dụng trực tiếp cấu hình Trang chủ lên ứng dụng Mobile.'
            : 'Đã lưu và áp dụng trực tiếp cấu hình Tài khoản lên ứng dụng Mobile.',
        );
      }
    } catch (err) {
      const rawMessage =
        err instanceof Error ? err.message : 'Không thể lưu cấu hình.';
      if (totalToUpload > 0) {
        setError(
          `Đã tải ${uploadedCount}/${totalToUpload} tệp lên bộ nhớ tạm, chưa áp dụng lên ứng dụng Mobile. ${rawMessage} Bấm "Lưu tất cả" để thử lại phần còn lại mà không mất ảnh đã chọn.`,
        );
      } else {
        setError(rawMessage);
      }
    } finally {
      setBusy(false);
    }
  };

  const displayBrandName =
    draft?.brandName?.trim() || 'Thương hiệu của bạn';

  const previewItems = (group: string) =>
    (groupedItems[group] ?? []).filter(
      (item) =>
        group === 'quickAction' ||
        group === 'account' ||
        Boolean(resolveDisplayImageUrl(item)),
    );

  const renderPreviewImage = (
    item: ItemState,
    label: string,
    className: string,
  ) => {
    const url = resolveDisplayImageUrl(item);
    return (
      <button
        type="button"
        title={`Bấm để kiểm tra đích đến: ${actionLabel(item)}`}
        onClick={() => setPreviewMessage(`${label}: ${actionLabel(item)}`)}
        className={`block overflow-hidden bg-gray-100 text-left ${className}`}
      >
        {url ? (
          <img src={url} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-gray-400">
            Chưa có ảnh
          </div>
        )}
      </button>
    );
  };

  const renderGroupSection = (group: string) => {
    const groupItems = groupedItems[group] ?? [];
    const meta = groupMeta[group] ?? {
      title: group,
      subtitle: '',
      aspectHint: '',
    };
    const listMode = isListGroup(group);

    return (
      <section
        key={group}
        className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {meta.title}
              </h2>
              <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                {groupItems.length} mục
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {meta.subtitle}
            </p>
          </div>
          <span className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            {meta.aspectHint}
          </span>
        </div>

        {listMode && (
          <SectionMultiDropzone
            groupKey={group}
            disabled={busy || !draft}
            onFilesAdded={handleAddFilesToGroup}
            onAddEmptySlot={handleAddEmptySlot}
          />
        )}

        {groupItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-xs text-gray-500 dark:border-gray-700">
            Chưa có ảnh nào trong mục <strong>{meta.title}</strong>. Hãy kéo thả
            ảnh hoặc bấm <strong>Chọn ảnh</strong> ở trên để thêm mới.
          </div>
        ) : (
          <div className="space-y-3">
            {groupItems.map((item, idx) => {
              const cardTitle = getFriendlyCardLabel(item, idx);
              const choices = targetOptions(item.actionType);
              const currentUrl = resolveDisplayImageUrl(item);

              const cardContent = (
                <article
                  onDragOver={(e) => {
                    if (e.dataTransfer?.types?.includes('Files')) {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                  onDrop={(e) => handleCardFileDrop(e, item.localId)}
                  className="rounded-xl border border-gray-200 bg-gray-50/50 p-3.5 transition hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50"
                >
                  <div className="flex flex-col gap-3.5 md:flex-row">
                    <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-100 md:h-24 md:w-40 dark:border-gray-700 dark:bg-gray-900">
                      {currentUrl ? (
                        <img
                          src={currentUrl}
                          alt={cardTitle}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center px-2 text-center text-xs text-gray-400">
                          Kéo ảnh vào ô hoặc bấm Chọn tệp
                        </div>
                      )}
                      <span className="absolute left-2 top-2 rounded bg-black/65 px-2 py-0.5 text-[11px] font-semibold text-white">
                        {cardTitle}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-gray-900 dark:text-white">
                            {cardTitle}
                          </span>
                          {item.stagedReceipt && (
                            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                              Đã tải tạm (chờ lưu)
                            </span>
                          )}
                          {item.dirty && !item.stagedReceipt && (
                            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                              Chưa lưu
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {listMode && (
                            <>
                              <button
                                type="button"
                                disabled={busy || idx === 0}
                                onClick={() =>
                                  handleMoveInGroup(group, idx, idx - 1)
                                }
                                aria-label={`Di chuyển ${cardTitle} lên`}
                                className="inline-flex min-h-8 items-center rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                              >
                                ↑ Lên
                              </button>
                              <button
                                type="button"
                                disabled={
                                  busy || idx === groupItems.length - 1
                                }
                                onClick={() =>
                                  handleMoveInGroup(group, idx, idx + 1)
                                }
                                aria-label={`Di chuyển ${cardTitle} xuống`}
                                className="inline-flex min-h-8 items-center rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                              >
                                ↓ Xuống
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleRemoveListItem(item, idx)}
                                aria-label={`Xóa ${cardTitle}`}
                                className="inline-flex min-h-8 items-center rounded-lg border border-error-200 bg-white px-2.5 py-1 text-xs font-semibold text-error-600 transition hover:bg-error-50 disabled:opacity-40 dark:border-error-500/30 dark:bg-gray-800 dark:text-error-400"
                              >
                                Xóa
                              </button>
                            </>
                          )}
                          {!listMode && currentUrl && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleClearFixedSlotImage(item)}
                              aria-label={`Gỡ ảnh ${cardTitle}`}
                              className="inline-flex min-h-8 items-center rounded-lg border border-error-200 bg-white px-2.5 py-1 text-xs font-semibold text-error-600 transition hover:bg-error-50 disabled:opacity-40 dark:border-error-500/30 dark:bg-gray-800 dark:text-error-400"
                            >
                              Gỡ ảnh
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                          <span>{currentUrl ? 'Thay ảnh' : 'Chọn ảnh'}</span>
                          <input
                            type="file"
                            accept=".jpg,.jpeg,.png,.webp"
                            disabled={busy}
                            onChange={(event: ChangeEvent<HTMLInputElement>) =>
                              handleSelectSingleFile(
                                item.localId,
                                event.target.files?.[0] ?? null,
                              )
                            }
                            className="sr-only"
                          />
                        </label>

                        {group !== 'account' && (
                          <button
                            type="button"
                            onClick={() =>
                              updateItemByLocalId(item.localId, {
                                expandedAction: !item.expandedAction,
                                dirty: item.dirty,
                              })
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                          >
                            <span>Đích khi nhấn:</span>
                            <strong className="text-brand-600 dark:text-brand-400">
                              {actionLabel(item)}
                            </strong>
                            <span>{item.expandedAction ? '▴' : '▾'}</span>
                          </button>
                        )}
                      </div>

                      {group !== 'account' && item.expandedAction && (
                        <div className="grid gap-2.5 rounded-lg border border-gray-200 bg-white p-3 md:grid-cols-2 dark:border-gray-700 dark:bg-gray-900">
                          <label className="text-xs font-medium text-gray-700 dark:text-gray-200">
                            Loại hành động khi khách nhấn ảnh
                            <select
                              value={item.actionType}
                              disabled={busy}
                              onChange={(event) =>
                                updateItemByLocalId(item.localId, {
                                  actionType: event.target.value,
                                  actionTargetKey: '',
                                  actionTargetId: '',
                                  actionExternalUrl: '',
                                })
                              }
                              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-xs dark:border-gray-700 dark:bg-gray-800"
                            >
                              {Object.entries(actionTypeLabels).map(
                                ([type, label]) => (
                                  <option key={type} value={type}>
                                    {label}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>

                          {item.actionType !== 'None' &&
                            item.actionType !== 'ExternalHttps' && (
                              <label className="text-xs font-medium text-gray-700 dark:text-gray-200">
                                Đích đến cụ thể (cùng thương hiệu)
                                <select
                                  value={
                                    item.actionTargetKey || item.actionTargetId
                                  }
                                  disabled={busy}
                                  onChange={(event) => {
                                    const selected = choices.find(
                                      (option) =>
                                        `${option.key || option.id || ''}` ===
                                        event.target.value,
                                    );
                                    updateItemByLocalId(item.localId, {
                                      actionTargetKey: selected?.key ?? '',
                                      actionTargetId:
                                        selected?.id?.toString() ?? '',
                                    });
                                  }}
                                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-xs dark:border-gray-700 dark:bg-gray-800"
                                >
                                  <option value="">
                                    {choices.length
                                      ? 'Chọn đích đến'
                                      : 'Chưa có dữ liệu'}
                                  </option>
                                  {choices.map((option) => (
                                    <option
                                      key={`${option.key}-${option.id}`}
                                      value={option.key || option.id || ''}
                                    >
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            )}

                          {item.actionType === 'ExternalHttps' && (
                            <label className="text-xs font-medium text-gray-700 md:col-span-2 dark:text-gray-200">
                              Liên kết HTTPS được phép
                              <input
                                value={item.actionExternalUrl}
                                disabled={busy}
                                onChange={(event) =>
                                  updateItemByLocalId(item.localId, {
                                    actionExternalUrl: event.target.value,
                                  })
                                }
                                placeholder="https://..."
                                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-xs dark:border-gray-700 dark:bg-gray-800"
                              />
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );

              if (listMode) {
                return (
                  <DraggableListRow
                    key={item.localId}
                    groupKey={group}
                    index={idx}
                    total={groupItems.length}
                    onMove={handleMoveInGroup}
                  >
                    {cardContent}
                  </DraggableListRow>
                );
              }

              return <div key={item.localId}>{cardContent}</div>;
            })}
          </div>
        )}
      </section>
    );
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        {/* Header */}
        <header className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs sm:flex-row sm:items-center sm:justify-between dark:border-gray-800 dark:bg-gray-900">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Giao diện Mobile
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Quản lý trực quan hình ảnh Trang chủ và Tài khoản trên ứng dụng
              khách hàng. Lưu một lần để áp dụng ngay, không qua bước duyệt bản
              nháp.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={busy || !draft}
              onClick={() => void saveCurrentTab()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600 disabled:opacity-50"
            >
              {busy
                ? 'Đang lưu & áp dụng...'
                : activeTab === 'home'
                ? 'Lưu tất cả Trang chủ'
                : 'Lưu tất cả Tài khoản'}
            </button>
          </div>
        </header>

        {/* Cross-editor overview shortcuts */}
        <section
          aria-label="Liên kết nhanh quản lý hình ảnh liên quan"
          className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
          <Link
            href="/loyalty-tiers"
            className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs transition hover:border-brand-400 hover:shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
          >
            <div>
              <span className="font-bold text-gray-900 dark:text-white block">
                Ảnh thẻ hạng &amp; Huy hiệu thành viên
              </span>
              <span className="text-gray-500">
                Quản lý trực tiếp tại trang Đặc quyền thành viên
              </span>
            </div>
            <span className="font-semibold text-brand-600">Mở →</span>
          </Link>

          <Link
            href="/products"
            className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs transition hover:border-brand-400 hover:shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
          >
            <div>
              <span className="font-bold text-gray-900 dark:text-white block">
                Ảnh Sản phẩm (Menu)
              </span>
              <span className="text-gray-500">
                Quản lý trực tiếp tại trang Sản phẩm
              </span>
            </div>
            <span className="font-semibold text-brand-600">Mở →</span>
          </Link>

          <Link
            href="/categories"
            className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs transition hover:border-brand-400 hover:shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
          >
            <div>
              <span className="font-bold text-gray-900 dark:text-white block">
                Ảnh Danh mục món
              </span>
              <span className="text-gray-500">
                Quản lý trực tiếp tại trang Danh mục
              </span>
            </div>
            <span className="font-semibold text-brand-600">Mở →</span>
          </Link>
        </section>

        {/* Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3 dark:border-gray-800">
          <div className="inline-flex rounded-xl border border-gray-200 bg-gray-100 p-1 dark:border-gray-700 dark:bg-gray-800">
            <button
              type="button"
              onClick={() => setActiveTab('home')}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                activeTab === 'home'
                  ? 'bg-white text-brand-600 shadow-theme-xs dark:bg-gray-900 dark:text-white'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-300'
              }`}
            >
              Trang chủ
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('account')}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                activeTab === 'account'
                  ? 'bg-white text-brand-600 shadow-theme-xs dark:bg-gray-900 dark:text-white'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-300'
              }`}
            >
              Tài khoản
            </button>
          </div>
          {stagingStatus && (
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
              {stagingStatus}
            </span>
          )}
        </div>

        {message && (
          <div
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
          >
            {message}
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
          >
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900">
            Đang tải cấu hình Giao diện Mobile...
          </div>
        ) : (
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0 space-y-6">
              {activeTab === 'home'
                ? HOME_GROUPS.map((group) => renderGroupSection(group))
                : renderGroupSection('account')}
            </div>

            {/* Live Mobile Preview */}
            <aside className="xl:sticky xl:top-6 xl:self-start">
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-gray-900 dark:text-white">
                      Xem trước trên Mobile
                    </h2>
                    <p className="text-xs text-gray-500">
                      Bấm vào ảnh để kiểm tra đích điều hướng đã chọn.
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                    Trực tiếp
                  </span>
                </div>

                <div className="mx-auto max-w-[360px] overflow-hidden rounded-[2rem] border-[7px] border-gray-900 bg-gray-100 shadow-xl">
                  <div className="max-h-[720px] overflow-y-auto bg-[#f7f7fa]">
                    <div className="bg-white px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-gray-800">
                      {displayBrandName}
                    </div>
                    {previewMessage && (
                      <div className="mx-3 mt-2 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[11px] font-medium text-blue-700">
                        {previewMessage}
                      </div>
                    )}

                    {activeTab === 'home' ? (
                      <>
                        {previewItems('hero').length > 0 && (
                          <section className="p-3 pb-1">
                            <div className="mb-2 text-[11px] font-semibold text-gray-700">
                              Ảnh đầu trang ({previewItems('hero').length})
                            </div>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                              {previewItems('hero').map((item, idx) => (
                                <div
                                  key={item.localId}
                                  className="w-[260px] shrink-0"
                                >
                                  {renderPreviewImage(
                                    item,
                                    `Ảnh đầu trang ${idx + 1}`,
                                    'h-28 w-full rounded-xl',
                                  )}
                                  <p className="mt-1 truncate text-[10px] text-gray-500">
                                    Ảnh {idx + 1}: {actionLabel(item)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </section>
                        )}

                        {previewItems('quickAction').length > 0 && (
                          <section className="grid grid-cols-2 gap-2 p-3 pb-1">
                            {previewItems('quickAction').map((item, idx) => (
                              <div key={item.localId}>
                                {renderPreviewImage(
                                  item,
                                  getFriendlyCardLabel(item, idx),
                                  'h-16 w-full rounded-xl',
                                )}
                                <p className="mt-1 truncate text-[10px] text-gray-500">
                                  {getFriendlyCardLabel(item, idx)}
                                </p>
                              </div>
                            ))}
                          </section>
                        )}

                        {previewItems('promotion').length > 0 && (
                          <section className="p-3 pb-1">
                            <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-gray-800">
                              <span>
                                Ảnh ưu đãi ({previewItems('promotion').length})
                              </span>
                              <span className="text-brand-600">Xem tất cả</span>
                            </div>
                            <div className="space-y-2">
                              {previewItems('promotion').map((item, idx) => (
                                <div key={item.localId}>
                                  {renderPreviewImage(
                                    item,
                                    `Ảnh ưu đãi ${idx + 1}`,
                                    'h-24 w-full rounded-xl',
                                  )}
                                  <p className="mt-1 truncate text-[10px] text-gray-500">
                                    Ảnh {idx + 1}: {actionLabel(item)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </section>
                        )}

                        {previewItems('about').length > 0 && (
                          <section className="p-3">
                            <div className="mb-2 text-[11px] font-semibold text-gray-700">
                              Ảnh giới thiệu ({previewItems('about').length})
                            </div>
                            <div className="space-y-2">
                              {previewItems('about').map((item, idx) => (
                                <div key={item.localId}>
                                  {renderPreviewImage(
                                    item,
                                    `Ảnh giới thiệu ${idx + 1}`,
                                    'h-24 w-full rounded-xl',
                                  )}
                                  <p className="mt-1 truncate text-[10px] text-gray-500">
                                    Ảnh {idx + 1}: {actionLabel(item)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </section>
                        )}
                      </>
                    ) : (
                      <section className="p-3">
                        <div className="mb-2 text-[11px] font-semibold text-gray-700">
                          Tài khoản — Ô tiện ích
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {previewItems('account').map((item, idx) => {
                            const url = resolveDisplayImageUrl(item);
                            const label = getFriendlyCardLabel(item, idx);
                            return (
                              <div
                                key={item.localId}
                                className={`relative overflow-hidden rounded-xl bg-white shadow-xs ${
                                  item.contentKey === 'account-coupons'
                                    ? 'row-span-2 min-h-36'
                                    : 'h-16'
                                }`}
                              >
                                {url && (
                                  <img
                                    src={url}
                                    alt={label}
                                    className="absolute inset-0 h-full w-full object-cover"
                                  />
                                )}
                                <div className="relative p-2.5 text-[11px] font-bold text-gray-800">
                                  {label}
                                  <div className="mt-0.5 text-base font-extrabold">
                                    0
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    )}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>
    </DndProvider>
  );
}
