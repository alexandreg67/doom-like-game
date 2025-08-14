import type { MapData } from '../types';

export class MapEditor {
  private mapData: MapData = {
    sectors: [],
    lineDefs: [],
    vertices: [],
    sideDefs: [],
  };

  createSector(_floorHeight: number, _ceilingHeight: number): void {
    // TODO: Implement sector creation
  }

  export(): MapData {
    return this.mapData;
  }
}
