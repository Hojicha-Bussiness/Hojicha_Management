import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const homeMediaServiceSource = readFileSync(
  new URL('./homeMedia.ts', import.meta.url),
  'utf8',
);
const homeMediaPageSource = readFileSync(
  new URL('../app/(brand)/home-media/page.tsx', import.meta.url),
  'utf8',
);

test('homeMedia service exposes stageHomeMediaUpload and saveHomeMediaSnapshot with operationId, tab, and storagePurgeStatus', () => {
  assert.match(homeMediaServiceSource, /export const stageHomeMediaUpload =/);
  assert.match(homeMediaServiceSource, /\$\{ADMIN_HOME_MEDIA_ENDPOINT\}\/stage/);
  assert.match(homeMediaServiceSource, /form\.append\('GroupKey', groupKey\)/);
  assert.match(homeMediaServiceSource, /form\.append\('ClientUploadId', clientUploadId\)/);

  assert.match(homeMediaServiceSource, /export const saveHomeMediaSnapshot =/);
  assert.match(homeMediaServiceSource, /\$\{ADMIN_HOME_MEDIA_ENDPOINT\}\/save/);
  assert.match(homeMediaServiceSource, /operationId: string/);
  assert.match(homeMediaServiceSource, /tab: 'home' \| 'account' \| 'all'/);
  assert.match(homeMediaServiceSource, /storagePurgeStatus\?: 'None' \| 'Completed' \| 'Pending' \| string/);
  assert.match(homeMediaServiceSource, /pendingPurgeCount\?: number/);
});

test('home-media page uses direct-save workflow without Draft/Publish buttons, supports multi-file dropzone, local empty slot, and distinguishes UI removal from storage purge', () => {
  // No Draft/Publish buttons in main UI
  assert.doesNotMatch(homeMediaPageSource, /Publish Home|Unpublish Home|Xuất bản bản nháp/);
  assert.match(homeMediaPageSource, /Lưu tất cả Trang chủ/);
  assert.match(homeMediaPageSource, /Lưu tất cả Tài khoản/);

  // Unlimited list groups + multi-file dropzone + local empty slot
  assert.match(homeMediaPageSource, /LIST_GROUPS: ListGroupKey\[\] = \['hero', 'promotion', 'about'\]/);
  assert.match(homeMediaPageSource, /\+ Thêm ô trống/);
  assert.match(homeMediaPageSource, /↑ Lên/);
  assert.match(homeMediaPageSource, /↓ Xuống/);

  // Fixed Account slots including voucher warehouse header
  assert.match(homeMediaPageSource, /'account-coupons': 'Kho ưu đãi'/);
  assert.match(homeMediaPageSource, /'account-credits': 'Đổi voucher'/);
  assert.match(homeMediaPageSource, /'account-referrals': 'Giới thiệu bạn bè'/);
  assert.match(homeMediaPageSource, /'account-voucher-header': 'Ảnh tiêu đề \/ Mascot Kho ưu đãi'/);

  // Distinguishes UI list removal vs Pending/Completed Firebase storage purge
  assert.match(homeMediaPageSource, /saveRes\.status === 202/);
  assert.match(homeMediaPageSource, /storagePurgeStatus === 'Pending'/);
  assert.match(homeMediaPageSource, /storagePurgeStatus === 'Completed'/);
});
