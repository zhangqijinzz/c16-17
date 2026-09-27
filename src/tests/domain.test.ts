import { describe, expect, it } from 'vitest';
import { cropForRatio, displayRatio, isFrameDocument, MAX_DISPLAY_RATIO, MIN_DISPLAY_RATIO, moveCrop, normalizeCrop, resizeCrop } from '../domain';
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

describe('ratio fallbacks for unusable or extreme images', () => {
  it('falls back to a square frame when the image ratio is not usable', () => {
    for (const bad of [NaN, 0, -3, Infinity]) {
      const crop = cropForRatio('16:9', bad, DEFAULT_CROP);
      expect(Number.isFinite(crop.width)).toBe(true);
      expect(Number.isFinite(crop.height)).toBe(true);
      expect(Number.isFinite(crop.x)).toBe(true);
      expect(Number.isFinite(crop.y)).toBe(true);
      expect(crop.width).toBeGreaterThan(0);
      expect(crop.height).toBeGreaterThan(0);
    }
    const crop = cropForRatio('16:9', NaN, DEFAULT_CROP);
    expect(crop.width).toBe(1);
    expect(crop.height).toBeCloseTo(9 / 16);
  });

  it('keeps the crop inside the image for extreme panorama ratios', () => {
    const crop = cropForRatio('1:1', 200, DEFAULT_CROP);
    expect(crop.width).toBeGreaterThanOrEqual(0.12);
    expect(crop.x).toBeGreaterThanOrEqual(0);
    expect(crop.x + crop.width).toBeLessThanOrEqual(1);
  });

  it('normalizes NaN crop values back to a valid frame', () => {
    const crop = normalizeCrop({ id: 'current', x: NaN, y: NaN, width: NaN, height: NaN, ratio: 'free' });
    expect(crop).toEqual({ id: 'current', x: 0, y: 0, width: 1, height: 1, ratio: 'free' });
  });

  it('only clamps the display ratio for extreme shapes', () => {
    expect(displayRatio(1200, 800)).toBeCloseTo(1.5);
    expect(displayRatio(1080, 1920)).toBeCloseTo(0.5625);
    expect(displayRatio(10000, 50)).toBe(MAX_DISPLAY_RATIO);
    expect(displayRatio(50, 10000)).toBe(MIN_DISPLAY_RATIO);
    expect(displayRatio(0, 0)).toBe(1);
  });

  it('rejects stored documents whose image has no usable dimensions', () => {
    const broken = { ...structuredClone(EMPTY_DOCUMENT), image: { src: 'data:,x', width: 0, height: 0, name: 'bad.svg' } };
    const usable = { ...structuredClone(EMPTY_DOCUMENT), image: { src: 'data:,x', width: 800, height: 600, name: 'ok.png' } };
    expect(isFrameDocument(broken)).toBe(false);
    expect(isFrameDocument(usable)).toBe(true);
    expect(isFrameDocument(EMPTY_DOCUMENT)).toBe(true);
  });
});
