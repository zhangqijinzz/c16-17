import type { CropVariant, FrameDocument, ImageAsset, Ratio } from './model';

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));
const finite = (value: number, fallback: number): number => (Number.isFinite(value) ? value : fallback);

/** 图片必须带有明确的正数尺寸，工作台才能计算构图比例。 */
export function isUsableImage(image: ImageAsset | null | undefined): boolean {
  return !!image && Number.isFinite(image.width) && Number.isFinite(image.height) && image.width > 0 && image.height > 0;
}

/** 解析 '16:9' 这类比例字符串，解析失败时回退到 1，绝不产出 NaN/Infinity。 */
function ratioValue(ratio: string): number {
  const [w, h] = ratio.split(':').map(Number);
  const value = w / h;
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function normalizeCrop(crop: CropVariant): CropVariant {
  const width = clamp(finite(crop.width, 1), 0.12, 1);
  const height = clamp(finite(crop.height, 1), 0.12, 1);
  return {
    ...crop,
    x: clamp(finite(crop.x, 0), 0, 1 - width),
    y: clamp(finite(crop.y, 0), 0, 1 - height),
    width,
    height,
  };
}

export function cropForRatio(ratio: Ratio, imageRatio: number, current: CropVariant): CropVariant {
  if (ratio === 'free') return { ...current, ratio };
  const target = ratioValue(ratio);
  const safeImageRatio = Number.isFinite(imageRatio) && imageRatio > 0 ? imageRatio : 1;
  let width = 1;
  let height = 1;
  if (target > safeImageRatio) height = Math.min(1, safeImageRatio / target);
  else width = Math.min(1, target / safeImageRatio);
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
    nextHeight = nextWidth / ratioValue(crop.ratio);
  }
  return normalizeCrop({ ...crop, width: nextWidth, height: nextHeight });
}

export function makeVariant(crop: CropVariant, id: string): CropVariant {
  return { ...normalizeCrop(crop), id };
}

export function isFrameDocument(value: unknown): value is FrameDocument {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<FrameDocument>;
  if (candidate.version !== 1 || typeof candidate.guides !== 'object' || candidate.crop === undefined || !Array.isArray(candidate.variants)) return false;
  return candidate.image === null || isUsableImage(candidate.image);
}
