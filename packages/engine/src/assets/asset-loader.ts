export class AssetLoader {
  private loadedAssets = new Map<string, HTMLImageElement | ArrayBuffer>();

  public async loadTexture(url: string): Promise<HTMLImageElement> {
    const cached = this.loadedAssets.get(url);
    if (cached && cached instanceof HTMLImageElement) {
      return cached;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.loadedAssets.set(url, img);
        resolve(img);
      };
      img.onerror = () => reject(new Error(`Failed to load texture: ${url}`));
      img.src = url;
    });
  }

  public async loadAudio(url: string): Promise<ArrayBuffer> {
    const cached = this.loadedAssets.get(url);
    if (cached && cached instanceof ArrayBuffer) {
      return cached;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load audio: ${url}`);
    }

    const buffer = await response.arrayBuffer();
    this.loadedAssets.set(url, buffer);
    return buffer;
  }

  public async loadWAD(url: string): Promise<ArrayBuffer> {
    // Future: Parse custom WAD-like format
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load WAD: ${url}`);
    }

    return response.arrayBuffer();
  }

  public dispose(): void {
    this.loadedAssets.clear();
  }
}
