/**
 * Crosshair renderer using HTML/CSS overlay
 * Follows 2025 FPS best practices for crosshair design
 */

import type { CrosshairConfig, CrosshairStyle } from '../types';

export class CrosshairRenderer {
  private container: HTMLElement;
  private crosshairElement: HTMLElement;
  private config: CrosshairConfig;
  private isVisible = true;
  private animationFrame?: number;

  constructor(parentElement: HTMLElement, config: CrosshairConfig) {
    this.config = config;
    this.container = this.createContainer(parentElement);
    this.crosshairElement = this.createCrosshair();
    this.container.appendChild(this.crosshairElement);
    this.updateStyle();
  }

  /**
   * Update crosshair configuration
   */
  public updateConfig(newConfig: Partial<CrosshairConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.updateStyle();
  }

  /**
   * Show or hide crosshair
   */
  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.container.style.display = visible ? 'block' : 'none';
  }

  /**
   * Update crosshair size for dynamic behavior
   */
  public setDynamicSize(multiplier: number): void {
    if (this.config.behavior === 'static') return;

    const baseSize = this.config.size;
    const newSize = baseSize * multiplier;
    
    this.crosshairElement.style.setProperty('--crosshair-size', `${newSize}px`);
    this.crosshairElement.style.setProperty('--crosshair-gap', `${this.config.gap * multiplier}px`);
  }

  /**
   * Animate crosshair expansion (for firing feedback)
   */
  public animateExpansion(duration = 100): void {
    if (!this.config.expandOnFire) return;

    const expansionAmount = this.config.expansionAmount || 1.5;
    
    // Cancel any existing animation
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }

    const startTime = performance.now();
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-out animation
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentMultiplier = 1 + (expansionAmount - 1) * (1 - easeOut);
      
      this.setDynamicSize(currentMultiplier);
      
      if (progress < 1) {
        this.animationFrame = requestAnimationFrame(animate);
      }
    };
    
    this.animationFrame = requestAnimationFrame(animate);
  }

  /**
   * Get crosshair element for custom styling
   */
  public getElement(): HTMLElement {
    return this.crosshairElement;
  }

  /**
   * Cleanup renderer
   */
  public dispose(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    this.container.remove();
  }

  private createContainer(parent: HTMLElement): HTMLElement {
    const container = document.createElement('div');
    container.className = 'crosshair-container';
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    parent.appendChild(container);
    return container;
  }

  private createCrosshair(): HTMLElement {
    const element = document.createElement('div');
    element.className = `crosshair crosshair-${this.config.style}`;
    return element;
  }

  private updateStyle(): void {
    const { style, size, thickness, gap, color, outlineColor, opacity } = this.config;
    
    // Set CSS custom properties
    this.crosshairElement.style.setProperty('--crosshair-size', `${size}px`);
    this.crosshairElement.style.setProperty('--crosshair-thickness', `${thickness}px`);
    this.crosshairElement.style.setProperty('--crosshair-gap', `${gap}px`);
    this.crosshairElement.style.setProperty('--crosshair-color', color);
    this.crosshairElement.style.setProperty('--crosshair-outline', outlineColor || 'transparent');
    this.crosshairElement.style.setProperty('--crosshair-opacity', opacity.toString());

    // Apply style-specific classes
    this.crosshairElement.className = `crosshair crosshair-${style}`;
    this.crosshairElement.style.cssText = this.getStyleCSS(style);
  }

  private getStyleCSS(style: CrosshairStyle): string {
    const baseCSS = `
      position: relative;
      width: var(--crosshair-size);
      height: var(--crosshair-size);
      opacity: var(--crosshair-opacity);
    `;

    switch (style) {
      case 'dot':
        return baseCSS + `
          background-color: var(--crosshair-color);
          border-radius: 50%;
          width: var(--crosshair-thickness);
          height: var(--crosshair-thickness);
          box-shadow: 0 0 0 1px var(--crosshair-outline);
        `;

      case 'cross':
        return baseCSS + `
          &::before, &::after {
            content: '';
            position: absolute;
            background-color: var(--crosshair-color);
            box-shadow: 0 0 0 1px var(--crosshair-outline);
          }
          &::before {
            left: 50%;
            top: 0;
            width: var(--crosshair-thickness);
            height: calc(50% - var(--crosshair-gap) / 2);
            transform: translateX(-50%);
          }
          &::after {
            left: 50%;
            bottom: 0;
            width: var(--crosshair-thickness);
            height: calc(50% - var(--crosshair-gap) / 2);
            transform: translateX(-50%);
          }
          &::before {
            box-shadow: 
              0 0 0 1px var(--crosshair-outline),
              calc(var(--crosshair-gap) / 2 + var(--crosshair-thickness) / 2) 
              calc(50% + var(--crosshair-gap) / 2) 0 0 var(--crosshair-color),
              calc(var(--crosshair-gap) / 2 + var(--crosshair-thickness) / 2) 
              calc(50% + var(--crosshair-gap) / 2) 0 1px var(--crosshair-outline),
              calc(-var(--crosshair-gap) / 2 - var(--crosshair-thickness) / 2) 
              calc(50% + var(--crosshair-gap) / 2) 0 0 var(--crosshair-color),
              calc(-var(--crosshair-gap) / 2 - var(--crosshair-thickness) / 2) 
              calc(50% + var(--crosshair-gap) / 2) 0 1px var(--crosshair-outline);
          }
        `;

      case 'circle':
        return baseCSS + `
          border: var(--crosshair-thickness) solid var(--crosshair-color);
          border-radius: 50%;
          box-sizing: border-box;
          box-shadow: 
            0 0 0 1px var(--crosshair-outline),
            inset 0 0 0 1px var(--crosshair-outline);
        `;

      case 'custom':
        return baseCSS; // Custom styles should be provided via CSS classes

      default:
        return baseCSS;
    }
  }
}