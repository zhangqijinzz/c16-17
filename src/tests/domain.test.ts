import { describe, expect, it } from 'vitest';
import { cropForRatio, isFrameDocument, isUsableImage, moveCrop, normalizeCrop, resizeCrop } from '../domain';
import { DEFAULT_CROP, EMPTY_DOCUMENT } from '../model';

describe('crop domain rules', () => {
  it('fits a 1:1 crop inside a wide image and centers it', () => {
    const crop = cropForRatio('1:1', 1.5, DEFAULT_CROP);
    expect(crop.width).toBeCloseTo(2 / 3);
    expect(crop.height).toBe(1);
    expect(crop.x).toBeCloseTo(1 / 6);
  });

  it('clamps movement to the image boundary', () => {
    const crop = moveCrop({ ...DEFAULT_CROP, width: 0.5, height: 0.5 }, 0.9, -0.9);
    expect(crop.x).toBe(0.5);
    expect(crop.y).toBe(0);
  });

  it('keeps a selected ratio while resizing', () => {
    const crop = resizeCrop({ ...DEFAULT_CROP, ratio: '16:9', width: 0.5, height: 0.28125 }, 0.8, 0.8);
    expect(crop.width).toBe(0.8);
    expect(crop.height).toBeCloseTo(0.45);
  });
});

describe('invalid dimension fallbacks', () => {
  it.each([NaN, 0, -3, Infinity])('never produces invalid crops for imageRatio %s', (imageRatio) => {
    const crop = cropForRatio('16:9', imageRatio, DEFAULT_CROP);
    for (const value of [crop.x, crop.y, crop.width, crop.height]) {
      expect(Number.isFinite(value)).toBe(true);
    }
    expect(crop.width).toBeGreaterThanOrEqual(0.12);
    expect(crop.height).toBeGreaterThanOrEqual(0.12);
    expect(crop.x + crop.width).toBeLessThanOrEqual(1);
    expect(crop.y + crop.height).toBeLessThanOrEqual(1);
  });

  it('repairs non-finite crop values instead of propagating them', () => {
    const crop = normalizeCrop({ ...DEFAULT_CROP, x: NaN, y: Infinity, width: NaN, height: -Infinity });
    expect(crop).toMatchObject({ x: 0, y: 0, width: 1, height: 1 });
  });

  it('falls back to a sane ratio when the stored ratio string is damaged', () => {
    const crop = resizeCrop({ ...DEFAULT_CROP, ratio: '0:0', width: 0.5, height: 0.5 }, 0.8, 0.8);
    expect(Number.isFinite(crop.height)).toBe(true);
    expect(crop.width).toBe(0.8);
    expect(crop.height).toBeCloseTo(0.8);
  });
});

describe('image usability guard', () => {
  it.each([
    [{ src: 'a', width: 0, height: 0, name: 'a' }, false],
    [{ src: 'a', width: 1200, height: 0, name: 'a' }, false],
    [{ src: 'a', width: -5, height: 800, name: 'a' }, false],
    [{ src: 'a', width: NaN, height: 800, name: 'a' }, false],
    [{ src: 'a', width: 1200, height: 800, name: 'a' }, true],
    [{ src: 'a', width: 12000, height: 30, name: 'a' }, true],
    [null, false],
    [undefined, false],
  ])('isUsableImage(%o) → %s', (image, expected) => {
    expect(isUsableImage(image as never)).toBe(expected);
  });

  it('rejects stored documents whose image has no usable dimensions', () => {
    const damaged = { ...structuredClone(EMPTY_DOCUMENT), image: { src: 'a', width: 0, height: 0, name: 'a' } };
    expect(isFrameDocument(damaged)).toBe(false);
    const healthy = { ...structuredClone(EMPTY_DOCUMENT), image: { src: 'a', width: 1200, height: 800, name: 'a' } };
    expect(isFrameDocument(healthy)).toBe(true);
    expect(isFrameDocument(structuredClone(EMPTY_DOCUMENT))).toBe(true);
  });
});
