import { type Engine, type Scene, Texture } from '@babylonjs/core';

export interface LoadedAsset {
  type: 'texture' | 'audio' | 'wad';
  data: HTMLImageElement | ArrayBuffer | Texture;
  lastAccessed: number;
}

export interface AssetLoaderOptions {
  maxRetries?: number;
  retryDelay?: number;
  cacheMaxAge?: number;
}

export class AssetLoader {
  private loadedAssets = new Map<string, LoadedAsset>();
  private options: Required<AssetLoaderOptions>;

  constructor(_engine: Engine, options: AssetLoaderOptions = {}) {
    this.options = {
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 1000,
      cacheMaxAge: options.cacheMaxAge ?? 5 * 60 * 1000, // 5 minutes
    };
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = this.options.maxRetries
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.options.retryDelay * (attempt + 1))
          );
        }
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }

  private isAssetCached(url: string): boolean {
    const cached = this.loadedAssets.get(url);
    if (!cached) return false;

    const isExpired = Date.now() - cached.lastAccessed > this.options.cacheMaxAge;
    if (isExpired) {
      this.removeFromCache(url);
      return false;
    }

    return true;
  }

  private removeFromCache(url: string): void {
    const cached = this.loadedAssets.get(url);
    if (cached?.type === 'texture' && cached.data instanceof Texture) {
      cached.data.dispose();
    }
    this.loadedAssets.delete(url);
  }

  public async loadTexture(url: string): Promise<HTMLImageElement> {
    if (this.isAssetCached(url)) {
      const cached = this.loadedAssets.get(url);
      if (cached && cached.type === 'texture' && cached.data instanceof HTMLImageElement) {
        cached.lastAccessed = Date.now();
        return cached.data;
      }
    }

    return this.retryOperation(async () => {
      return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          this.loadedAssets.set(url, {
            type: 'texture',
            data: img,
            lastAccessed: Date.now(),
          });
          resolve(img);
        };
        img.onerror = () => reject(new Error(`Failed to load texture: ${url}`));
        img.src = url;
      });
    });
  }

  public async loadBabylonTexture(
    url: string,
    scene: Scene,
    _name?: string,
    options: { invertY?: boolean; fallbackExtensions?: string[] } = {}
  ): Promise<Texture> {
    if (this.isAssetCached(url)) {
      const cached = this.loadedAssets.get(url);
      if (cached && cached.type === 'texture' && cached.data instanceof Texture) {
        cached.lastAccessed = Date.now();
        return cached.data;
      }
    }

    return this.retryOperation(async () => {
      const texture = new Texture(url, scene, {
        noMipmap: false,
        invertY: options.invertY ?? true, // Use provided invertY option, default to true
        samplingMode: Texture.TRILINEAR_SAMPLINGMODE,
      });

      return new Promise<Texture>((resolve, reject) => {
        console.log(`[AssetLoader] Starting to load texture: ${url}`);
        console.log(`[AssetLoader] Texture isReady before load: ${texture.isReady()}`);

        // Note: onErrorObservable might not be available on all Texture types
        // We'll rely on the timeout mechanism for error handling
        const timeoutId = setTimeout(() => {
          console.error(`[AssetLoader] Texture loading timeout for: ${url}`);
          console.error(
            `[AssetLoader] Texture state at timeout - isReady: ${texture.isReady()}, loadingError: ${texture.loadingError}`
          );
          texture.dispose();
          reject(new Error(`Failed to load Babylon texture: ${url} (timeout)`));
        }, 10000); // 10 second timeout

        texture.onLoadObservable.addOnce(() => {
          console.log(
            `[AssetLoader] Texture loaded successfully: ${url}, size: ${texture.getSize().width}x${texture.getSize().height}`
          );
          console.log(`[AssetLoader] Texture isReady after load: ${texture.isReady()}`);
          clearTimeout(timeoutId);
          this.loadedAssets.set(url, {
            type: 'texture',
            data: texture,
            lastAccessed: Date.now(),
          });
          resolve(texture);
        });

        // Check if texture has error observable
        if ('onErrorObservable' in texture) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (texture as any).onErrorObservable.addOnce((error: unknown) => {
            console.error(`[AssetLoader] Texture loading error for ${url}:`, error);
            clearTimeout(timeoutId);
            texture.dispose();
            reject(new Error(`Failed to load Babylon texture: ${url} (error)`));
          });
        }
      });
    });
  }

  public async loadAudio(url: string): Promise<ArrayBuffer> {
    if (this.isAssetCached(url)) {
      const cached = this.loadedAssets.get(url);
      if (cached && cached.type === 'audio' && cached.data instanceof ArrayBuffer) {
        cached.lastAccessed = Date.now();
        return cached.data;
      }
    }

    return this.retryOperation(async () => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `Failed to load audio: ${url} - ${response.status}: ${response.statusText}`
        );
      }

      const buffer = await response.arrayBuffer();
      this.loadedAssets.set(url, {
        type: 'audio',
        data: buffer,
        lastAccessed: Date.now(),
      });
      return buffer;
    });
  }

  public async loadWAD(url: string): Promise<ArrayBuffer> {
    if (this.isAssetCached(url)) {
      const cached = this.loadedAssets.get(url);
      if (cached && cached.type === 'wad' && cached.data instanceof ArrayBuffer) {
        cached.lastAccessed = Date.now();
        return cached.data;
      }
    }

    return this.retryOperation(async () => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load WAD: ${url} - ${response.status}: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      this.loadedAssets.set(url, {
        type: 'wad',
        data: buffer,
        lastAccessed: Date.now(),
      });
      return buffer;
    });
  }

  public preloadTexture(url: string, scene: Scene): Promise<Texture> {
    return this.loadBabylonTexture(url, scene);
  }

  public getCacheSize(): number {
    return this.loadedAssets.size;
  }

  public clearExpiredAssets(): void {
    const now = Date.now();
    for (const [url, asset] of this.loadedAssets) {
      if (now - asset.lastAccessed > this.options.cacheMaxAge) {
        this.removeFromCache(url);
      }
    }
  }

  public dispose(): void {
    for (const [url] of this.loadedAssets) {
      this.removeFromCache(url);
    }
    this.loadedAssets.clear();
  }
}
