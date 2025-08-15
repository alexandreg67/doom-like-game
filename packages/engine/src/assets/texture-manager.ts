import { Texture } from '@babylonjs/core/Materials/Textures/texture';

export type LoadOptions = {
  wrapU?: 'repeat' | 'clamp';
  wrapV?: 'repeat' | 'clamp';
  scale?: number;
  offset?: { u: number; v: number };
  rotation?: number;
  sampling?: 'nearest' | 'linear' | 'trilinear';
  fallback?: string;
};

export type TextureHandle = {
  path: string;
  texture: Texture;
};

/** Prototype minimal d'un TextureManager. Ne gère pas encore LRU ni TTL. */
export class TextureManager {
  // cache maps path -> { promise, lastAccess, sizeEstimate }
  private cache = new Map<
    string,
    { promise: Promise<TextureHandle>; lastAccess: number; size?: number }
  >();
  private maxEntries: number;
  private ttlMs: number;

  constructor(
    private scene: unknown,
    opts?: { maxEntries?: number; ttlMs?: number }
  ) {
    this.maxEntries = opts?.maxEntries ?? 200;
    this.ttlMs = opts?.ttlMs ?? 5 * 60 * 1000; // 5 minutes
  }

  load(path: string, options?: LoadOptions): Promise<TextureHandle> {
    const existing = this.cache.get(path);
    if (existing) {
      existing.lastAccess = Date.now();
      return existing.promise;
    }

    const p = new Promise<TextureHandle>((resolve, reject) => {
      try {
        const tex = new Texture(
          path,
          this.scene as any,
          true,
          false,
          Texture.TRILINEAR_SAMPLINGMODE,
          () => {
            resolve({ path, texture: tex });
          },
          (message) => {
            // try fallback if provided
            if (options?.fallback) {
              this.load(options.fallback)
                .then(resolve)
                .catch(() => reject(new Error(`Failed to load texture ${path}: ${message}`)));
              return;
            }
            reject(new Error(`Failed to load texture ${path}: ${message}`));
          }
        );
        // options handling (simple): sampling
        if (options?.sampling === 'nearest') tex.updateSamplingMode(Texture.NEAREST_SAMPLINGMODE);
        if (options?.sampling === 'linear') tex.updateSamplingMode(Texture.BILINEAR_SAMPLINGMODE);
        // TODO: wrap, scale, offset, rotation
      } catch (err) {
        reject(err);
      }
    });

    this.cache.set(path, { promise: p, lastAccess: Date.now() });
    this.ensureCapacity();
    return p;
  }

  get(path: string): Promise<TextureHandle> | undefined {
    const e = this.cache.get(path);
    if (!e) return undefined;
    // check TTL
    if (Date.now() - e.lastAccess > this.ttlMs) {
      this.cache.delete(path);
      return undefined;
    }
    e.lastAccess = Date.now();
    return e.promise;
  }

  preload(paths: string[]): Promise<TextureHandle[]> {
    return Promise.all(paths.map((p) => this.load(p)));
  }

  release(path: string) {
    const e = this.cache.get(path);
    if (e) {
      // dispose if resolved
      e.promise.then((h) => h.texture.dispose?.());
    }
    this.cache.delete(path);
  }

  private ensureCapacity() {
    if (this.cache.size <= this.maxEntries) return;
    // evict least-recently-used
    const items = Array.from(this.cache.entries());
    items.sort((a, b) => a[1].lastAccess - b[1].lastAccess);
    while (this.cache.size > this.maxEntries) {
      const key = items.shift();
      if (!key) break;
      this.release(key[0]);
    }
  }
}

export default TextureManager;
