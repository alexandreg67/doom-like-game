/**
 * Procedural texture generator for testing and development.
 * Creates simple patterns that can be used as placeholder textures.
 */

import { logger } from '../../utils/logger';

export type TexturePattern = 'checkerboard' | 'brick' | 'stone' | 'wood' | 'metal' | 'concrete';

export interface GenerateTextureOptions {
  size?: number;
  color1?: string;
  color2?: string;
  scale?: number;
}

/**
 * Generates a procedural texture as a data URL
 */
export function generateTexture(
  pattern: TexturePattern,
  options: GenerateTextureOptions = {}
): string {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    throw new Error(
      'generateTexture requires a browser environment with a global document object.'
    );
  }

  const { size = 256, color1 = '#8B4513', color2 = '#DEB887', scale = 8 } = options;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get 2D context from canvas');
  }

  switch (pattern) {
    case 'checkerboard':
      generateCheckerboard(ctx, size, color1, color2, scale);
      break;
    case 'brick':
      generateBrick(ctx, size, scale);
      break;
    case 'stone':
      generateStone(ctx, size);
      break;
    case 'wood':
      generateWood(ctx, size);
      break;
    case 'metal':
      generateMetal(ctx, size);
      break;
    case 'concrete':
      generateConcrete(ctx, size);
      break;
    default:
      generateCheckerboard(ctx, size, color1, color2, scale);
  }

  return canvas.toDataURL('image/jpeg', 0.8);
}

function generateCheckerboard(
  ctx: CanvasRenderingContext2D,
  size: number,
  color1: string,
  color2: string,
  scale: number
) {
  const squareSize = size / scale;

  for (let x = 0; x < scale; x++) {
    for (let y = 0; y < scale; y++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? color1 : color2;
      ctx.fillRect(x * squareSize, y * squareSize, squareSize, squareSize);
    }
  }
}

function generateBrick(ctx: CanvasRenderingContext2D, size: number, scale: number) {
  const brickWidth = size / scale;
  const brickHeight = brickWidth / 2;
  const mortarWidth = 2;

  // Background (mortar)
  ctx.fillStyle = '#A0A0A0';
  ctx.fillRect(0, 0, size, size);

  // Bricks
  ctx.fillStyle = '#8B4513';

  for (let y = 0; y < size; y += brickHeight + mortarWidth) {
    const isOddRow = Math.floor(y / (brickHeight + mortarWidth)) % 2 === 1;
    const xOffset = isOddRow ? brickWidth / 2 : 0;

    for (let x = -brickWidth; x < size; x += brickWidth + mortarWidth) {
      ctx.fillRect(x + xOffset, y, brickWidth - mortarWidth, brickHeight);
    }
  }
}

function generateStone(ctx: CanvasRenderingContext2D, size: number) {
  // Base stone color
  ctx.fillStyle = '#696969';
  ctx.fillRect(0, 0, size, size);

  // Add noise for texture
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 60;
    data[i] = Math.max(0, Math.min(255, (data[i] || 0) + noise)); // R
    data[i + 1] = Math.max(0, Math.min(255, (data[i + 1] || 0) + noise)); // G
    data[i + 2] = Math.max(0, Math.min(255, (data[i + 2] || 0) + noise)); // B
  }

  ctx.putImageData(imageData, 0, 0);

  // Add some darker lines for stone joints
  ctx.strokeStyle = '#505050';
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * size, 0);
    ctx.lineTo(Math.random() * size, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, Math.random() * size);
    ctx.lineTo(size, Math.random() * size);
    ctx.stroke();
  }
}

function generateWood(ctx: CanvasRenderingContext2D, size: number) {
  // Wood grain effect
  const gradient = ctx.createLinearGradient(0, 0, 0, size);
  gradient.addColorStop(0, '#8B4513');
  gradient.addColorStop(0.3, '#A0522D');
  gradient.addColorStop(0.6, '#8B4513');
  gradient.addColorStop(1, '#654321');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Add wood grain lines
  ctx.strokeStyle = '#654321';
  ctx.lineWidth = 1;
  for (let i = 0; i < 20; i++) {
    const y = (i / 20) * size;
    ctx.beginPath();
    ctx.moveTo(0, y + Math.sin(i * 0.5) * 5);
    ctx.lineTo(size, y + Math.sin(i * 0.5 + Math.PI) * 5);
    ctx.stroke();
  }
}

function generateMetal(ctx: CanvasRenderingContext2D, size: number) {
  // Base metallic color
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#C0C0C0');
  gradient.addColorStop(0.5, '#A8A8A8');
  gradient.addColorStop(1, '#808080');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Add scratches and imperfections
  ctx.strokeStyle = '#909090';
  ctx.lineWidth = 1;
  for (let i = 0; i < 30; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * size, Math.random() * size);
    ctx.lineTo(Math.random() * size, Math.random() * size);
    ctx.stroke();
  }
}

function generateConcrete(ctx: CanvasRenderingContext2D, size: number) {
  // Base concrete color
  ctx.fillStyle = '#D3D3D3';
  ctx.fillRect(0, 0, size, size);

  // Add texture with noise
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 40;
    data[i] = Math.max(0, Math.min(255, (data[i] || 0) + noise)); // R
    data[i + 1] = Math.max(0, Math.min(255, (data[i + 1] || 0) + noise)); // G
    data[i + 2] = Math.max(0, Math.min(255, (data[i + 2] || 0) + noise)); // B
  }

  ctx.putImageData(imageData, 0, 0);

  // Add some spots and stains
  ctx.fillStyle = '#A0A0A0';
  for (let i = 0; i < 15; i++) {
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, Math.random() * 8 + 2, 0, 2 * Math.PI);
    ctx.fill();
  }
}

/**
 * Pre-generated texture data URLs for common textures
 * These are static data URLs to avoid Canvas dependency in tests
 */
export const TEXTURE_DATA_URLS = (() => {
  // Skip texture generation during tests to avoid Canvas issues
  if (process.env.VITEST || process.env.NODE_ENV === 'test') {
    logger.warn('[TextureGenerator] Test environment detected, using fallback data URLs');
  }
  // Check if we're in a browser environment and Canvas is fully supported
  else if (
    typeof document !== 'undefined' &&
    typeof document.createElement === 'function' &&
    typeof HTMLCanvasElement !== 'undefined'
  ) {
    try {
      // Test Canvas support before attempting texture generation
      const testCanvas = document.createElement('canvas');
      const testCtx = testCanvas.getContext('2d');
      if (!testCtx) {
        throw new Error('Canvas 2D context not available');
      }

      return {
        default: generateTexture('checkerboard', {
          color1: '#808080',
          color2: '#A0A0A0',
        }),
        wood_floor: generateTexture('wood'),
        stone_floor: generateTexture('stone'),
        concrete_floor: generateTexture('concrete'),
        concrete_ceiling: generateTexture('concrete', {
          color1: '#F0F0F0',
          color2: '#E0E0E0',
        }),
        brick_wall: generateTexture('brick'),
        stone_wall: generateTexture('stone'),
        wood_door: generateTexture('wood', {
          color1: '#8B4513',
          color2: '#A0522D',
        }),
      };
    } catch (_error) {
      logger.warn('[TextureGenerator] Canvas not available, using fallback data URLs');
    }
  }

  // Fallback static data URLs for test environment
  const fallbackDataUrl =
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAALCAABAAEBAREA/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/wD';

  return {
    default: fallbackDataUrl,
    wood_floor: fallbackDataUrl,
    stone_floor: fallbackDataUrl,
    concrete_floor: fallbackDataUrl,
    concrete_ceiling: fallbackDataUrl,
    brick_wall: fallbackDataUrl,
    stone_wall: fallbackDataUrl,
    wood_door: fallbackDataUrl,
  };
})();
