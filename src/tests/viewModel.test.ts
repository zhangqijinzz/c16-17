import { beforeEach, describe, expect, it } from 'vitest';
import { FrameSenseViewModel } from '../viewModel';
import { EMPTY_DOCUMENT, type FrameDocument, type ImageAsset } from '../model';
import type { FrameRepository } from '../repository';
import type { ImageService } from '../service';

class MemoryRepository implements FrameRepository {
  document: FrameDocument = structuredClone(EMPTY_DOCUMENT);
  fail = false;
  load() { return structuredClone(this.document); }
  save(document: FrameDocument) { if (this.fail) throw new Error('no storage'); this.document = structuredClone(document); }
}

class FakeImageService implements ImageService {
  asset: ImageAsset = { src: 'data:image/svg+xml,test', width: 1200, height: 800, name: 'test.svg' };
  readFile() { return Promise.resolve(this.asset); }
  demo() { return this.asset; }
}

describe('FrameSenseViewModel', () => {
  let repository: MemoryRepository;
  let images: FakeImageService;
  let vm: FrameSenseViewModel;
  beforeEach(() => { repository = new MemoryRepository(); images = new FakeImageService(); vm = new FrameSenseViewModel(repository, images); });

  it('initializes empty and loads a demo image', async () => {
    await vm.initialize();
    expect(vm.getSnapshot().phase).toBe('ready');
    vm.loadDemo();
    expect(vm.getSnapshot().document.image?.name).toBe('test.svg');
    expect(repository.document.image).not.toBeNull();
  });

  it('updates guides, subject, ratio, and variants', () => {
    vm.loadDemo();
    vm.toggleGuide('center');
    vm.markSubject(0.2, 0.8);
    vm.setRatio('1:1');
    vm.saveVariant();
    expect(vm.getSnapshot().document.guides.center).toBe(true);
    expect(vm.getSnapshot().document.subject).toEqual({ x: 0.2, y: 0.8 });
    expect(vm.getSnapshot().document.crop.ratio).toBe('1:1');
    expect(vm.getSnapshot().document.variants).toHaveLength(1);
  });

  it('keeps edits in memory and reports persistence failure', () => {
    repository.fail = true;
    vm.loadDemo();
    expect(vm.getSnapshot().phase).toBe('error');
    expect(vm.getSnapshot().document.image).not.toBeNull();
    expect(vm.getSnapshot().error).toContain('本地保存失败');
  });

  it('rejects images without usable dimensions and keeps the current workbench', async () => {
    vm.loadDemo();
    images.asset = { src: 'data:image/svg+xml,broken', width: 0, height: 0, name: 'broken.svg' };
    await vm.importImage(new File(['x'], 'broken.svg'));
    const state = vm.getSnapshot();
    expect(state.phase).toBe('error');
    expect(state.error).toContain('尺寸信息');
    expect(state.document.image?.name).toBe('test.svg');
    expect(repository.document.image?.name).toBe('test.svg');
  });

  it('recovers when a valid image is imported after a broken one', async () => {
    images.asset = { src: 'data:,broken', width: 0, height: 0, name: 'broken.svg' };
    await vm.importImage(new File(['x'], 'broken.svg'));
    expect(vm.getSnapshot().phase).toBe('error');
    expect(vm.getSnapshot().document.image).toBeNull();
    images.asset = { src: 'data:,ok', width: 800, height: 600, name: 'ok.png' };
    await vm.importImage(new File(['x'], 'ok.png'));
    expect(vm.getSnapshot().phase).toBe('editing');
    expect(vm.getSnapshot().error).toBeNull();
    expect(vm.getSnapshot().document.image?.name).toBe('ok.png');
  });

  it('applies ratio crops safely on extreme panorama images', () => {
    images.asset = { src: 'data:,pano', width: 10000, height: 50, name: 'pano.jpg' };
    vm.loadDemo();
    vm.setRatio('1:1');
    const crop = vm.getSnapshot().document.crop;
    expect(Number.isFinite(crop.width)).toBe(true);
    expect(crop.width).toBeGreaterThanOrEqual(0.12);
    expect(crop.x + crop.width).toBeLessThanOrEqual(1);
  });
});
