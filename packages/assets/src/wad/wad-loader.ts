import type { WADFile } from '../types';

export class WADLoader {
  async load(_url: string): Promise<WADFile> {
    // TODO: Implement WAD loading
    return { lumps: new Map() };
  }
}
