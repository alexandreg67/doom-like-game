import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { Scene } from '@babylonjs/core/scene';
import { logger } from '../utils/logger';
import type { AtlasResult, Placement } from './atlas-builder';
import { placementToUV } from './uv-mapping';
import { TEXTURE_DATA_URLS } from '../fixtures/textures/texture-generator';

function isPromise(v: unknown): v is Promise<unknown> {
  return (
    typeof v === 'object' && v !== null && typeof (v as { then?: unknown }).then === 'function'
  );
}

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
  // registry for build-time or runtime atlases (name -> atlas result)
  private atlasRegistry = new Map<string, AtlasResult>();
  // map atlasName -> loaded atlas texture handle
  private atlasTextureRegistry = new Map<string, Promise<TextureHandle>>();
  // cache maps path -> { promise, lastAccess, sizeEstimate }
  private cache = new Map<
    string,
    { promise: Promise<TextureHandle>; lastAccess: number; size?: number }
  >();
  private maxEntries: number;
  private ttlMs: number;

  constructor(
    private scene: Scene | unknown,
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
        // Check if this is a known procedural texture first
        const textureName = path.replace('/textures/', '').replace('.jpg', '');
        const dataUrl = TEXTURE_DATA_URLS[textureName as keyof typeof TEXTURE_DATA_URLS];
        
        const actualPath = dataUrl || path;
        
        const tex = new Texture(
          actualPath,
          this.scene as Scene,
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
            // If no fallback specified, try the default procedural texture
            if (!dataUrl && textureName !== 'default') {
              const defaultTex = new Texture(
                TEXTURE_DATA_URLS.default,
                this.scene as Scene,
                true,
                false,
                Texture.TRILINEAR_SAMPLINGMODE,
                () => {
                  resolve({ path, texture: defaultTex });
                },
                () => reject(new Error(`Failed to load texture ${path}: ${message}`))
              );
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

  /**
   * Register an atlas mapping by name. Useful for runtime lookup of placements -> UVs.
   */
  registerAtlas(name: string, atlas: AtlasResult) {
    this.atlasRegistry.set(name, atlas);
  }

  getAtlasPlacement(atlasName: string, id: string): Placement | undefined {
    const atlas = this.atlasRegistry.get(atlasName);
    return atlas?.placements.find((p) => p.id === id);
  }

  /**
   * Return normalized UV coordinates {u0,v0,u1,v1} for a placement id inside a named atlas.
   * Returns undefined when atlas or placement is not known.
   */
  getUV(atlasName: string, id: string) {
    const atlas = this.atlasRegistry.get(atlasName);
    if (!atlas) return undefined;
    const p = atlas.placements.find((pl) => pl.id === id);
    if (!p) return undefined;
    return placementToUV(p, atlas.width, atlas.height);
  }

  /**
   * Load an atlas image into the manager and register its mapping.
   * atlasResult should come from a build-time packer (placements + width/height).
   */
  async loadAtlasImage(name: string, atlasImagePath: string, atlasResult: AtlasResult) {
    this.registerAtlas(name, atlasResult);
    // start loading the atlas image as a single texture and store the promise
    const p = this.load(atlasImagePath).then((h) => {
      // store resolved handle as the atlas texture
      return h;
    });
    this.atlasTextureRegistry.set(name, p);
    return p;
  }

  /**
   * Return the atlas texture handle and UV rect for a placement id. Promise because atlas image may be loading.
   */
  async getSubTexture(
    atlasName: string,
    id: string
  ): Promise<(TextureHandle & { uv: ReturnType<typeof placementToUV> }) | undefined> {
    const atlas = this.atlasRegistry.get(atlasName);
    if (!atlas) return undefined;
    const placement = atlas.placements.find((pl) => pl.id === id);
    if (!placement) return undefined;
    const texP = this.atlasTextureRegistry.get(atlasName);
    if (!texP) return undefined;
    try {
      const handle = await texP;
      const uv = placementToUV(placement, atlas.width, atlas.height);
      return { ...handle, uv };
    } catch (err) {
      logger.error(`Failed to load atlas image for ${atlasName}:`, err);
      return undefined;
    }
  }

  release(path: string) {
    const e = this.cache.get(path);
    if (e) {
      // dispose if resolved, handle errors and await if dispose is async
      e.promise
        .then(async (h) => {
          try {
            const disposable = h.texture as unknown as {
              dispose?: () => void | Promise<void>;
            };
            const res = disposable.dispose?.();
            if (isPromise(res)) await res;
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
