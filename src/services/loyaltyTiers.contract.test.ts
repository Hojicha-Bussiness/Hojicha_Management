import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const loyaltyTiersServiceSource = readFileSync(
  new URL('./loyaltyTiers.ts', import.meta.url),
  'utf8',
);
const tierEditorSource = readFileSync(
  new URL(
    '../app/(brand)/loyalty-tiers/components/TierImageEditor.tsx',
    import.meta.url,
  ),
  'utf8',
);
const loyaltyTiersPageSource = readFileSync(
  new URL('../app/(brand)/loyalty-tiers/page.tsx', import.meta.url),
  'utf8',
);

test('loyaltyTiers service preserves imageUrl and badgeImageUrl and posts Image, BadgeImage, RemoveImage, RemoveBadgeImage', () => {
  assert.match(loyaltyTiersServiceSource, /imageUrl\?: string \| null/);
  assert.match(loyaltyTiersServiceSource, /badgeImageUrl\?: string \| null/);
  assert.match(loyaltyTiersServiceSource, /form\.append\('Image', image\)/);
  assert.match(
    loyaltyTiersServiceSource,
    /form\.append\('BadgeImage', options\.badgeImage\)/,
  );
  assert.match(
    loyaltyTiersServiceSource,
    /form\.append\('RemoveImage', 'true'\)/,
  );
  assert.match(
    loyaltyTiersServiceSource,
    /form\.append\('RemoveBadgeImage', 'true'\)/,
  );
});

test('TierImageEditor and loyalty-tiers page manage both card background and badge artwork with WebP optimization', () => {
  assert.match(tierEditorSource, /Ảnh nền thẻ hạng/);
  assert.match(tierEditorSource, /Huy hiệu hạng \(Badge\)/);
  assert.match(tierEditorSource, /Xóa ảnh nền/);
  assert.match(tierEditorSource, /Xóa huy hiệu/);
  assert.match(loyaltyTiersPageSource, /optimizeImageForUpload/);
  assert.match(loyaltyTiersPageSource, /preset: 'badge'/);
});
