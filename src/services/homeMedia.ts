import { apiClient } from './apiClient';

export type HomeMediaItem = {
  id: number;
  contentKey: string;
  groupKey: 'hero' | 'promotion' | 'about' | string;
  layoutType: string;
  imageUrl: string;
  actionType: string;
  actionTargetKey?: string | null;
  actionTargetId?: number | null;
  actionExternalUrl?: string | null;
  isActive: boolean;
};

export type HomeMediaDraft = {
  brandId: number;
  draftRevision: number;
  publishedRevision: number;
  concurrencyToken: {
    expectedDraftRevision: number;
    expectedPublishedRevision: number;
    expectedRowVersion: string;
  };
  items: HomeMediaItem[];
};

export type HomeMediaActionOption = {
  type: string;
  key: string;
  label: string;
  id?: number | null;
};

export type HomeMediaActionOptions = {
  none: HomeMediaActionOption[];
  internalRoutes: HomeMediaActionOption[];
  products: HomeMediaActionOption[];
  specialOffers: HomeMediaActionOption[];
  stampPrograms: HomeMediaActionOption[];
};

type ApiResponse<T> = { data?: T; message?: string };

const ADMIN_HOME_MEDIA_ENDPOINT = '/admin/home-media';

export const ensureHomeMediaDraft = () =>
  apiClient<ApiResponse<HomeMediaDraft>>(ADMIN_HOME_MEDIA_ENDPOINT, { method: 'POST' });

export const getHomeMediaDraft = () =>
  apiClient<ApiResponse<HomeMediaDraft>>(ADMIN_HOME_MEDIA_ENDPOINT);

export const getHomeMediaActionOptions = () =>
  apiClient<ApiResponse<HomeMediaActionOptions>>(`${ADMIN_HOME_MEDIA_ENDPOINT}/action-options`);

export const addHomeMediaHero = (
  image: File,
  actionType: string,
  actionTargetKey: string,
  actionTargetId: string,
  actionExternalUrl: string,
  token: HomeMediaDraft['concurrencyToken'],
) => {
  const form = new FormData();
  form.append('Image', image);
  form.append('GroupKey', 'hero');
  form.append('ActionType', actionType);
  if (actionTargetKey) form.append('ActionTargetKey', actionTargetKey);
  if (actionTargetId) form.append('ActionTargetId', actionTargetId);
  if (actionExternalUrl) form.append('ActionExternalUrl', actionExternalUrl);
  form.append('ExpectedDraftRevision', token.expectedDraftRevision.toString());
  form.append('ExpectedPublishedRevision', token.expectedPublishedRevision.toString());
  if (token.expectedRowVersion) form.append('ExpectedRowVersion', token.expectedRowVersion);
  return apiClient<ApiResponse<HomeMediaDraft>>(`${ADMIN_HOME_MEDIA_ENDPOINT}/items`, {
    method: 'POST',
    body: form,
  });
};

export const updateHomeMediaItem = (
  item: Pick<HomeMediaItem, 'id'>,
  image: File | null,
  actionType: string,
  actionTargetKey: string,
  actionTargetId: string,
  actionExternalUrl: string,
  token: HomeMediaDraft['concurrencyToken'],
) => {
  const form = new FormData();
  if (image) form.append('Image', image);
  form.append('ActionType', actionType);
  if (actionTargetKey) form.append('ActionTargetKey', actionTargetKey);
  if (actionTargetId) form.append('ActionTargetId', actionTargetId);
  if (actionExternalUrl) form.append('ActionExternalUrl', actionExternalUrl);
  form.append('ExpectedDraftRevision', token.expectedDraftRevision.toString());
  form.append('ExpectedPublishedRevision', token.expectedPublishedRevision.toString());
  if (token.expectedRowVersion) form.append('ExpectedRowVersion', token.expectedRowVersion);
  return apiClient<ApiResponse<unknown>>(`${ADMIN_HOME_MEDIA_ENDPOINT}/items/${item.id}`, {
    method: 'PUT',
    body: form,
  });
};

export const deleteHomeMediaItem = (itemId: number, token: HomeMediaDraft['concurrencyToken']) =>
  apiClient<ApiResponse<unknown>>(`${ADMIN_HOME_MEDIA_ENDPOINT}/items/${itemId}`, {
    method: 'DELETE',
    body: JSON.stringify(token),
  });

export const publishHomeMedia = (token: HomeMediaDraft['concurrencyToken']) =>
  apiClient<ApiResponse<unknown>>(`${ADMIN_HOME_MEDIA_ENDPOINT}/publish`, {
    method: 'POST',
    body: JSON.stringify(token),
  });

export const unpublishHomeMedia = (token: HomeMediaDraft['concurrencyToken']) =>
  apiClient<ApiResponse<unknown>>(`${ADMIN_HOME_MEDIA_ENDPOINT}/unpublish`, {
    method: 'POST',
    body: JSON.stringify(token),
  });
