export interface WADFile {
  lumps: Map<string, ArrayBuffer>;
}

export interface Texture {
  name: string;
  width: number;
  height: number;
  data: ArrayBuffer;
}

export interface Sound {
  name: string;
  duration: number;
  data: ArrayBuffer;
}
