export type ImageRect = {
  id: string;
  width: number;
  height: number;
};

export type Placement = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AtlasResult = {
  width: number;
  height: number;
  placements: Placement[];
};

/**
 * Simple shelf bin-packer for texture atlases.
 * Deterministic, fast and good for small sets used in dev tools.
 * Not optimal but easy to reason about. Fits images into rows (shelves)
 * until maxWidth is reached, then opens a new shelf.
 */
export function packAtlas(images: ImageRect[], maxWidth = 2048): AtlasResult {
  // sort by height descending to reduce wasted vertical space
  const items = images.slice().sort((a, b) => b.height - a.height);

  const placements: Placement[] = [];

  let atlasWidth = 0;
  let atlasHeight = 0;

  let shelfX = 0;
  let shelfY = 0;
  let shelfHeight = 0;

  for (const img of items) {
    if (img.width > maxWidth) {
      // clamp to maxWidth (caller should resize externally in production)
      // place on its own shelf
      if (shelfX !== 0) {
        // finish current shelf
        shelfY += shelfHeight;
        atlasHeight = Math.max(atlasHeight, shelfY);
        shelfX = 0;
        shelfHeight = 0;
      }

      const x = 0;
      const y = shelfY;
      placements.push({
        id: img.id,
        x,
        y,
        width: Math.min(img.width, maxWidth),
        height: img.height,
      });
      atlasWidth = Math.max(atlasWidth, Math.min(img.width, maxWidth));
      shelfY += img.height;
      atlasHeight = Math.max(atlasHeight, shelfY);
      continue;
    }

    if (shelfX + img.width > maxWidth) {
      // move to next shelf
      shelfY += shelfHeight;
      atlasHeight = Math.max(atlasHeight, shelfY);
      shelfX = 0;
      shelfHeight = 0;
    }

    const x = shelfX;
    const y = shelfY;
    placements.push({ id: img.id, x, y, width: img.width, height: img.height });

    shelfX += img.width;
    shelfHeight = Math.max(shelfHeight, img.height);
    atlasWidth = Math.max(atlasWidth, shelfX);
  }

  atlasHeight = Math.max(atlasHeight, shelfY + shelfHeight);

  // Round up to power-of-two could be optional; keep tight fit for now
  return { width: atlasWidth, height: atlasHeight, placements };
}
