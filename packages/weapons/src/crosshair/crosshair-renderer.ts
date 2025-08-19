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
  private builtStyle?: CrosshairStyle;

  constructor(parentElement: HTMLElement, config: CrosshairConfig) {
    this.config = config;
    // Use the provided parent element as our container
    this.container = parentElement;
    // Ensure the container has the right styles
    this.setupContainerStyles();
    this.crosshairElement = this.createRoot();
    this.container.appendChild(this.crosshairElement);
    this.rebuild();
    console.log('[CROSSHAIR] CrosshairRenderer initialized');
  }

  /**
   * Update crosshair configuration
   */
  public updateConfig(newConfig: Partial<CrosshairConfig>): void {
    this.config = { ...this.config, ...newConfig };
    // Rebuild DOM if style changed
    if (!this.builtStyle || this.builtStyle !== this.config.style) {
      this.rebuild();
    } else {
      this.updateStyle();
    }
  }

  /**
   * Show or hide crosshair
   */
  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.container.style.display = visible ? 'flex' : 'none';
    console.log(
      '[CROSSHAIR] Visibility changed:',
      visible,
      'display:',
      this.container.style.display
    );
  }

  /**
   * Update crosshair size for dynamic behavior
   */
  public setDynamicSize(multiplier: number): void {
    if (this.config.behavior === 'static') return;
    // Use scale to avoid recalculating all measurements each frame
    (this.crosshairElement.style as any).transform = `scale(${multiplier})`;
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
      const easeOut = 1 - (1 - progress) ** 3;
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

  private setupContainerStyles(): void {
    this.container.className = 'crosshair-container';
    // Force the essential display styles
    this.container.style.display = 'flex';
    this.container.style.alignItems = 'center';
    this.container.style.justifyContent = 'center';
    this.container.style.pointerEvents = 'none';
    console.log('[CROSSHAIR] Container styles setup, display:', this.container.style.display);
  }

  private createRoot(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'crosshair-root';
    el.style.position = 'relative';
    el.style.opacity = String(this.config.opacity);
    el.style.transformOrigin = 'center center';
    return el;
  }

  private rebuild(): void {
    // Clear children
    this.crosshairElement.replaceChildren();
    this.builtStyle = this.config.style;
    // Build according to current style
    switch (this.config.style) {
      case 'dot':
        this.crosshairElement.appendChild(this.buildDot());
        break;
      case 'circle':
        this.crosshairElement.appendChild(this.buildCircle());
        break;
      case 'cross':
        this.crosshairElement.appendChild(this.buildCross());
        break;
      case 'custom':
      default:
        // Leave empty for user-provided styles
        break;
    }
    this.updateStyle();
  }

  private updateStyle(): void {
    // Update all built parts with current config
    switch (this.config.style) {
      case 'dot':
        this.updateDot();
        break;
      case 'circle':
        this.updateCircle();
        break;
      case 'cross':
        this.updateCross();
        break;
      case 'custom':
      default:
        break;
    }
    // Also update opacity
    this.crosshairElement.style.opacity = String(this.config.opacity);
  }

  private buildDot(): HTMLElement {
    const dot = document.createElement('div');
    dot.className = 'crosshair-dot';
    dot.style.position = 'absolute';
    dot.style.left = '50%';
    dot.style.top = '50%';
    dot.style.transform = 'translate(-50%, -50%)';
    return dot;
  }

  private updateDot(): void {
    const dot = this.crosshairElement.firstElementChild as HTMLElement | null;
    if (!dot) return;
    const { thickness, color, outlineColor } = this.config;
    dot.style.width = `${thickness}px`;
    dot.style.height = `${thickness}px`;
    dot.style.borderRadius = '50%';
    dot.style.backgroundColor = color;
    dot.style.boxShadow = outlineColor ? `0 0 0 1px ${outlineColor}` : 'none';
  }

  private buildCircle(): HTMLElement {
    const circle = document.createElement('div');
    circle.className = 'crosshair-circle';
    circle.style.position = 'absolute';
    circle.style.left = '50%';
    circle.style.top = '50%';
    circle.style.transform = 'translate(-50%, -50%)';
    circle.style.boxSizing = 'border-box';
    return circle;
  }

  private updateCircle(): void {
    const circle = this.crosshairElement.firstElementChild as HTMLElement | null;
    if (!circle) return;
    const { size, thickness, color, outlineColor } = this.config;
    circle.style.width = `${size}px`;
    circle.style.height = `${size}px`;
    circle.style.border = `${thickness}px solid ${color}`;
    circle.style.borderRadius = '50%';
    circle.style.boxShadow = outlineColor
      ? `0 0 0 1px ${outlineColor}, inset 0 0 0 1px ${outlineColor}`
      : 'none';
  }

  private buildCross(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'crosshair-cross';
    root.style.position = 'absolute';
    root.style.left = '50%';
    root.style.top = '50%';
    root.style.transform = 'translate(-50%, -50%)';

    const makeArm = () => {
      const arm = document.createElement('div');
      arm.style.position = 'absolute';
      return arm;
    };

    const top = makeArm();
    const bottom = makeArm();
    const left = makeArm();
    const right = makeArm();

    top.dataset.arm = 'top';
    bottom.dataset.arm = 'bottom';
    left.dataset.arm = 'left';
    right.dataset.arm = 'right';

    root.appendChild(top);
    root.appendChild(bottom);
    root.appendChild(left);
    root.appendChild(right);

    return root;
  }

  private updateCross(): void {
    const root = this.crosshairElement.firstElementChild as HTMLElement | null;
    if (!root) return;
    const { size, thickness, gap, color, outlineColor } = this.config;

    const half = size / 2;
    const armLen = Math.max(half - gap / 2, 0);

    const applyArm = (arm: HTMLElement, x: number, y: number, w: number, h: number) => {
      arm.style.left = `${x}px`;
      arm.style.top = `${y}px`;
      arm.style.width = `${w}px`;
      arm.style.height = `${h}px`;
      arm.style.backgroundColor = color;
      arm.style.boxShadow = outlineColor ? `0 0 0 1px ${outlineColor}` : 'none';
    };

    // Clear any transform from dynamic scaling (applies to root container instead)
    root.style.width = `${size}px`;
    root.style.height = `${size}px`;

    const top = root.querySelector('[data-arm="top"]') as HTMLElement;
    const bottom = root.querySelector('[data-arm="bottom"]') as HTMLElement;
    const left = root.querySelector('[data-arm="left"]') as HTMLElement;
    const right = root.querySelector('[data-arm="right"]') as HTMLElement;

    // Vertical arms
    applyArm(top, half - thickness / 2, 0, thickness, armLen);
    applyArm(bottom, half - thickness / 2, half + gap / 2, thickness, armLen);

    // Horizontal arms
    applyArm(left, 0, half - thickness / 2, armLen, thickness);
    applyArm(right, half + gap / 2, half - thickness / 2, armLen, thickness);
  }
}
