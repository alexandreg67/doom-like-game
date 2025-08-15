import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { logger } from '../utils/logger';

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

/** Prototype minimal d'un TextureManager. Gère LRU (éviction) et TTL (expiration) pour les textures en cache. */
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
    // public entry: create a fresh attempts set to detect circular fallbacks
    return this._load(path, options, new Set<string>());
  }

  private _load(
    path: string,
    options: LoadOptions | undefined,
    attempts: Set<string>
  ): Promise<TextureHandle> {
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
            // try fallback if provided, guard against circular fallback chains
            if (options?.fallback) {
              const fb = options.fallback;
              if (attempts.has(fb)) {
                reject(new Error(`Circular fallback detected for texture path: ${fb}`));
                return;
              }
              attempts.add(fb);
              this._load(fb, options, attempts)
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
      // dispose if resolved, handle errors and await if dispose is async
      e.promise
        .then(async (h) => {
          try {
            const res: any = (h.texture as any).dispose?.();
            if (res && typeof res.then === 'function') await res;
          } catch (err) {
            // don't throw from release; log for debugging
            logger.error(`Error disposing texture for path ${path}:`, err);
          }
        })
        .catch((_) => {
          // promise rejected: nothing to dispose
        });
    }
    this.cache.delete(path);
  }

  private ensureCapacity() {
    if (this.cache.size <= this.maxEntries) return;
    // evict least-recently-used
    const items = Array.from(this.cache.entries());
    items.sort((a, b) => a[1].lastAccess - b[1].lastAccess);
    const numToEvict = this.cache.size - this.maxEntries;
    for (let i = 0; i < numToEvict; i++) {
      const key = items[i];
      if (!key) break;
      this.release(key[0]);
    }
  }
}

export default TextureManager;
