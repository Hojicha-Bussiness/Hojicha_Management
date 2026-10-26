const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export type ImageOptimizationPreset = 'banner' | 'card' | 'badge';

export interface OptimizeImageOptions {
  preset?: ImageOptimizationPreset;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

const PRESET_DIMENSIONS: Record<
  ImageOptimizationPreset,
  { maxWidth: number; maxHeight: number; quality: number }
> = {
  banner: { maxWidth: 1440, maxHeight: 1440, quality: 0.86 },
  card: { maxWidth: 1200, maxHeight: 1200, quality: 0.86 },
  badge: { maxWidth: 512, maxHeight: 512, quality: 0.9 },
};

export function validateBrandImageFile(file: File): string | null {
  if (!file || file.size <= 0) {
    return 'Tệp ảnh rỗng hoặc không hợp lệ.';
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `Ảnh "${file.name}" vượt quá giới hạn 10 MB.`;
  }
  const lowerName = file.name.toLowerCase();
  const validExt =
    lowerName.endsWith('.jpg') ||
    lowerName.endsWith('.jpeg') ||
    lowerName.endsWith('.png') ||
    lowerName.endsWith('.webp');
  const validMime =
    !file.type || ALLOWED_MIME_TYPES.has(file.type.toLowerCase());
  if (!validExt || !validMime) {
    return `Ảnh "${file.name}" không đúng định dạng. Chỉ chấp nhận JPG, PNG hoặc WebP.`;
  }
  return null;
}

export async function optimizeImageForUpload(
  file: File,
  options?: OptimizeImageOptions,
): Promise<File> {
  const validationError = validateBrandImageFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof Image === 'undefined'
  ) {
    return file;
  }

  const preset = options?.preset ?? 'banner';
  const defaults = PRESET_DIMENSIONS[preset];
  const maxWidth = options?.maxWidth ?? defaults.maxWidth;
  const maxHeight = options?.maxHeight ?? defaults.maxHeight;
  const quality = options?.quality ?? defaults.quality;

  try {
    const imageUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error('Không đọc được tệp ảnh.'));
        element.src = imageUrl;
      });

      const srcWidth = img.naturalWidth || img.width;
      const srcHeight = img.naturalHeight || img.height;
      if (!srcWidth || !srcHeight) {
        return file;
      }

      const scale = Math.min(1, maxWidth / srcWidth, maxHeight / srcHeight);
      const targetWidth = Math.max(1, Math.round(srcWidth * scale));
      const targetHeight = Math.max(1, Math.round(srcHeight * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return file;
      }

      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((result) => resolve(result), 'image/webp', quality);
      });

      if (!blob || blob.size <= 0) {
        return file;
      }

      if (scale === 1 && blob.size >= file.size && file.type === 'image/webp') {
        return file;
      }

      const baseName = file.name.replace(/\.[^/.]+$/, '') || 'image';
      return new File([blob], `${baseName}.webp`, {
        type: 'image/webp',
        lastModified: Date.now(),
      });
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  } catch {
    return file;
  }
}
