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
  let imageService: FakeImageService;
  let vm: FrameSenseViewModel;
  beforeEach(() => { repository = new MemoryRepository(); imageService = new FakeImageService(); vm = new FrameSenseViewModel(repository, imageService); });

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
    const loaded = vm.getSnapshot().document;
    imageService.asset = { src: 'data:image/svg+xml,bad', width: 0, height: 0, name: 'broken.svg' };
    await vm.importImage(new File(['x'], 'broken.svg'));
    const state = vm.getSnapshot();
    expect(state.phase).toBe('error');
    expect(state.error).toContain('换一张');
    expect(state.document).toEqual(loaded);
    expect(repository.document.image?.name).toBe('test.svg');
  });

  it('imports images with usable dimensions, including extreme panoramas', async () => {
    const panorama: ImageAsset = { src: 'data:image/svg+xml,pano', width: 12000, height: 30, name: 'pano.svg' };
    imageService.asset = panorama;
    await vm.importImage(new File(['x'], 'pano.svg'));
    const state = vm.getSnapshot();
    expect(state.phase).toBe('editing');
    expect(state.error).toBeNull();
    expect(state.document.image).toEqual(panorama);
  });
});
