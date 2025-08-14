export interface MapData {
  sectors: Sector[];
  lines: Line[];
}

export interface Sector {
  id: string;
  floorHeight: number;
  ceilingHeight: number;
}

export interface Line {
  id: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
}
