import type { CropVariant, FrameDocument, ImageAsset, Ratio } from './model';

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));

const finiteOr = (value: number, fallback: number): number => (Number.isFinite(value) ? value : fallback);

// 展示比例的安全区间：常见照片（16:9 到 9:16）原样通过，
// 只有接近一条线的极端长宽比才会被拉回可操作的范围。
export const MIN_DISPLAY_RATIO = 0.5;
export const MAX_DISPLAY_RATIO = 2.5;

/** 无效比例（0、负数、NaN、Infinity）兜底为方形，保证下游计算不会得到无效值。 */
export function validRatio(ratio: number): number {
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
}

export function imageRatioOf(width: number, height: number): number {
  return validRatio(width / height);
}

/** 画布展示比例：在真实比例基础上夹到安全区间，避免画面被压到几乎看不见。 */
export function displayRatio(width: number, height: number): number {
  return clamp(imageRatioOf(width, height), MIN_DISPLAY_RATIO, MAX_DISPLAY_RATIO);
}

/** 图片尺寸能用于构图工作台的最低要求：有限且为正。 */
export function hasUsableDimensions(image: ImageAsset): boolean {
  return Number.isFinite(image.width) && Number.isFinite(image.height) && image.width > 0 && image.height > 0;
}

export function normalizeCrop(crop: CropVariant): CropVariant {
  const width = clamp(finiteOr(crop.width, 1), 0.12, 1);
  const height = clamp(finiteOr(crop.height, 1), 0.12, 1);
  return {
    ...crop,
    x: clamp(finiteOr(crop.x, 0), 0, 1 - width),
    y: clamp(finiteOr(crop.y, 0), 0, 1 - height),
    width,
    height,
  };
}

export function cropForRatio(ratio: Ratio, imageRatio: number, current: CropVariant): CropVariant {
  if (ratio === 'free') return { ...current, ratio };
  const [w, h] = ratio.split(':').map(Number);
  const target = w / h;
  const available = validRatio(imageRatio);
  let width = 1;
  let height = 1;
  if (target > available) height = Math.min(1, available / target);
  else width = Math.min(1, target / available);
  return normalizeCrop({
    ...current,
    ratio,
    width,
    height,
    x: (1 - width) / 2,
    y: (1 - height) / 2,
  });
}

export function moveCrop(crop: CropVariant, dx: number, dy: number): CropVariant {
  return normalizeCrop({ ...crop, x: crop.x + dx, y: crop.y + dy });
}

export function resizeCrop(crop: CropVariant, width: number, height: number): CropVariant {
  const nextWidth = width;
  let nextHeight = height;
  if (crop.ratio !== 'free') {
    const [w, h] = crop.ratio.split(':').map(Number);
    nextHeight = nextWidth / (w / h);
  }
  return normalizeCrop({ ...crop, width: nextWidth, height: nextHeight });
}

export function makeVariant(crop: CropVariant, id: string): CropVariant {
  return { ...normalizeCrop(crop), id };
}

export function isFrameDocument(value: unknown): value is FrameDocument {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<FrameDocument>;
  const image = candidate.image;
  const imageOk = image === null || (typeof image === 'object' && image !== null && typeof image.src === 'string' && hasUsableDimensions(image));
  return candidate.version === 1 && typeof candidate.guides === 'object' && candidate.crop !== undefined && Array.isArray(candidate.variants) && imageOk;
}
