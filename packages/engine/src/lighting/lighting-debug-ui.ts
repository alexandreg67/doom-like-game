import { Color3 } from '@babylonjs/core';
import { Logger } from '../utils/logger';
import type { FogManager } from './fog-manager';
import type { LightManager } from './light-manager';
import type { SectorLightingManager } from './sector-lighting';
import type { LightConfig, LightingMetrics } from './types';

interface DebugUIState {
  isVisible: boolean;
  selectedLightId: string | null;
  metricsUpdateInterval: number;
}

export class LightingDebugUI {
  private lightManager: LightManager;
  // private _sectorLightingManager?: SectorLightingManager;
  // private _fogManager?: FogManager;
  private state: DebugUIState = {
    isVisible: false,
    selectedLightId: null,
    metricsUpdateInterval: 500,
  };
  private uiContainer: HTMLElement | null = null;
  private metricsTimer: number | null = null;

  constructor(lightManager: LightManager) {
    this.lightManager = lightManager;
    this.setupKeyboardControls();
    Logger.info('[DEBUG-UI] LightingDebugUI initialized');
  }

  public setSectorLightingManager(manager: SectorLightingManager): void {
    // this._sectorLightingManager = manager;
    console.debug('SectorLightingManager set:', manager);
  }

  public setFogManager(manager: FogManager): void {
    // this._fogManager = manager;
    console.debug('FogManager set:', manager);
  }

  public toggle(): void {
    if (this.state.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  public show(): void {
    if (this.state.isVisible) return;

    this.state.isVisible = true;
    this.createUI();
    this.startMetricsUpdate();

    Logger.debug('[DEBUG-UI] Lighting debug UI shown');
  }

  public hide(): void {
    if (!this.state.isVisible) return;

    this.state.isVisible = false;
    this.destroyUI();
    this.stopMetricsUpdate();

    Logger.debug('[DEBUG-UI] Lighting debug UI hidden');
  }

  public updateMetrics(): void {
    if (!this.state.isVisible || !this.uiContainer) return;

    const metrics = this.lightManager.getMetrics();
    const metricsElement = this.uiContainer.querySelector('.lighting-metrics');

    if (metricsElement) {
      metricsElement.innerHTML = this.formatMetrics(metrics);
    }
  }

  private setupKeyboardControls(): void {
    document.addEventListener('keydown', (event) => {
      if (event.key === 'F1' && !event.repeat) {
        this.toggle();
        event.preventDefault();
      }

      if (event.key === 'F2' && !event.repeat && this.state.isVisible) {
        this.toggleWireframeShadows();
        event.preventDefault();
      }
    });
  }

  private createUI(): void {
    this.uiContainer = document.createElement('div');
    this.uiContainer.className = 'lighting-debug-ui';
    this.uiContainer.innerHTML = this.generateUIHTML();

    this.applyStyles();
    this.attachEventListeners();

    document.body.appendChild(this.uiContainer);
  }

  private destroyUI(): void {
    if (this.uiContainer) {
      document.body.removeChild(this.uiContainer);
      this.uiContainer = null;
    }
  }

  private generateUIHTML(): string {
    return `
      <div class="lighting-debug-panel">
        <div class="debug-header">
          <h3>Lighting Debug</h3>
          <button class="close-btn" data-action="close">×</button>
        </div>
        
        <div class="debug-section">
          <h4>Performance Metrics</h4>
          <div class="lighting-metrics">
            Loading metrics...
          </div>
        </div>
        
        <div class="debug-section">
          <h4>Light Controls</h4>
          <div class="light-list">
            ${this.generateLightListHTML()}
          </div>
        </div>
        
        <div class="debug-section">
          <h4>Selected Light</h4>
          <div class="light-controls">
            ${this.generateLightControlsHTML()}
          </div>
        </div>
        
        <div class="debug-section">
          <h4>Fog Controls</h4>
          <div class="fog-controls">
            ${this.generateFogControlsHTML()}
          </div>
        </div>
        
        <div class="debug-section">
          <h4>Quick Actions</h4>
          <div class="quick-actions">
            <button data-action="toggle-all-lights">Toggle All Lights</button>
            <button data-action="reset-lights">Reset Lights</button>
            <button data-action="wireframe-shadows">Toggle Shadow Wireframe</button>
          </div>
        </div>
      </div>
    `;
  }

  private generateLightListHTML(): string {
    const lights = this.lightManager.getAllLights();
    if (lights.size === 0) {
      return '<p class="no-lights">No lights available</p>';
    }

    let html = '<ul class="light-items">';
    for (const [lightId, light] of lights) {
      const isSelected = this.state.selectedLightId === lightId;
      const status = light.isActive ? 'active' : 'inactive';

      html += `
        <li class="light-item ${isSelected ? 'selected' : ''}" data-light-id="${lightId}">
          <span class="light-name">${lightId}</span>
          <span class="light-type">${light.config.type}</span>
          <span class="light-status ${status}">${status}</span>
          <button class="light-toggle" data-action="toggle-light" data-light-id="${lightId}">
            ${light.config.enabled ? '👁️' : '🚫'}
          </button>
        </li>
      `;
    }
    html += '</ul>';

    return html;
  }

  private generateLightControlsHTML(): string {
    const selectedLight = this.state.selectedLightId
      ? this.lightManager.getLight(this.state.selectedLightId)
      : null;

    if (!selectedLight) {
      return '<p class="no-selection">Select a light to edit its properties</p>';
    }

    const config = selectedLight.config;

    return `
      <div class="control-group">
        <label>Intensity:</label>
        <input type="range" min="0" max="2" step="0.1" value="${config.intensity}" 
               data-property="intensity" data-light-id="${config.id}">
        <span class="value">${config.intensity}</span>
      </div>
      
      <div class="control-group">
        <label>Color:</label>
        <input type="color" value="${this.colorToHex(config.color)}" 
               data-property="color" data-light-id="${config.id}">
      </div>
      
      ${
        config.type === 'point' || config.type === 'spot'
          ? `
        <div class="control-group">
          <label>Range:</label>
          <input type="range" min="1" max="100" step="1" value="${config.range || 10}" 
                 data-property="range" data-light-id="${config.id}">
          <span class="value">${config.range || 10}</span>
        </div>
      `
          : ''
      }
      
      ${
        config.type === 'spot'
          ? `
        <div class="control-group">
          <label>Angle:</label>
          <input type="range" min="0.1" max="3.14" step="0.1" value="${
            config.angle || Math.PI / 3
          }" 
                 data-property="angle" data-light-id="${config.id}">
          <span class="value">${(((config.angle || Math.PI / 3) * 180) / Math.PI).toFixed(
            1
          )}°</span>
        </div>
      `
          : ''
      }
    `;
  }

  private generateFogControlsHTML(): string {
    return `
      <div class="control-group">
        <label>
          <input type="checkbox" data-fog-property="enabled"> 
          Enable Fog
        </label>
      </div>
      
      <div class="control-group">
        <label>Mode:</label>
        <select data-fog-property="mode">
          <option value="linear">Linear</option>
          <option value="exponential">Exponential</option>
          <option value="exponential2">Exponential²</option>
        </select>
      </div>
      
      <div class="control-group">
        <label>Color:</label>
        <input type="color" value="#3333cc" data-fog-property="color">
      </div>
      
      <div class="control-group">
        <label>Density:</label>
        <input type="range" min="0.001" max="0.5" step="0.001" value="0.1" 
               data-fog-property="density">
        <span class="value">0.1</span>
      </div>
    `;
  }

  private attachEventListeners(): void {
    if (!this.uiContainer) return;

    // Close button
    this.uiContainer.querySelector('.close-btn')?.addEventListener('click', () => this.hide());

    // Light selection
    const lightItems = this.uiContainer.querySelectorAll('.light-item');
    for (const item of lightItems) {
      item.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.hasAttribute('data-action')) return; // Skip if clicking action button

        const lightId = (e.currentTarget as HTMLElement).dataset.lightId;
        this.selectLight(lightId || null);
      });
    }

    // Light toggles
    const toggleButtons = this.uiContainer.querySelectorAll('[data-action="toggle-light"]');
    for (const button of toggleButtons) {
      button.addEventListener('click', (e) => {
        const lightId = (e.target as HTMLElement).dataset.lightId;
        if (lightId) {
          const light = this.lightManager.getLight(lightId);
          this.lightManager.setLightEnabled(lightId, !light?.config.enabled);
          this.refreshUI();
        }
      });
    }

    // Light property controls
    const propertyControls = this.uiContainer.querySelectorAll('[data-property]');
    for (const control of propertyControls) {
      control.addEventListener('input', (e) => this.handleLightPropertyChange(e));
    }

    // Fog controls
    const fogControls = this.uiContainer.querySelectorAll('[data-fog-property]');
    for (const control of fogControls) {
      control.addEventListener('input', (e) => this.handleFogPropertyChange(e));
    }

    // Quick actions
    this.uiContainer
      .querySelector('[data-action="toggle-all-lights"]')
      ?.addEventListener('click', () => {
        this.toggleAllLights();
      });

    this.uiContainer
      .querySelector('[data-action="reset-lights"]')
      ?.addEventListener('click', () => {
        this.resetLights();
      });

    this.uiContainer
      .querySelector('[data-action="wireframe-shadows"]')
      ?.addEventListener('click', () => {
        this.toggleWireframeShadows();
      });
  }

  private handleLightPropertyChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const property = target.dataset.property;
    const lightId = target.dataset.lightId;

    if (!property || !lightId) return;

    const updates: Partial<LightConfig> = {};

    switch (property) {
      case 'intensity':
        updates.intensity = Number.parseFloat(target.value);
        break;
      case 'color':
        updates.color = this.hexToColor3(target.value);
        break;
      case 'range':
        updates.range = Number.parseFloat(target.value);
        break;
      case 'angle':
        updates.angle = Number.parseFloat(target.value);
        break;
    }

    this.lightManager.updateLight(lightId, updates);

    // Update value display
    const valueSpan = target.parentElement?.querySelector('.value');
    if (valueSpan && property !== 'color') {
      valueSpan.textContent = target.value + (property === 'angle' ? '°' : '');
    }
  }

  private handleFogPropertyChange(event: Event): void {
    // Fog property handling would go here
    // For now, just log the change
    Logger.debug('[DEBUG-UI] Fog property changed:', event);
  }

  private selectLight(lightId: string | null): void {
    this.state.selectedLightId = lightId;
    this.refreshUI();
  }

  private toggleAllLights(): void {
    const lights = this.lightManager.getAllLights();
    const anyEnabled = Array.from(lights.values()).some((light) => light.config.enabled);

    for (const [lightId] of lights) {
      this.lightManager.setLightEnabled(lightId, !anyEnabled);
    }

    this.refreshUI();
  }

  private resetLights(): void {
    // Reset all lights to default state
    Logger.debug('[DEBUG-UI] Reset lights requested');
  }

  private toggleWireframeShadows(): void {
    Logger.debug('[DEBUG-UI] Wireframe shadows toggle requested');
  }

  private refreshUI(): void {
    if (!this.state.isVisible) return;

    const lightList = this.uiContainer?.querySelector('.light-list');
    const lightControls = this.uiContainer?.querySelector('.light-controls');

    if (lightList) {
      lightList.innerHTML = this.generateLightListHTML();
    }

    if (lightControls) {
      lightControls.innerHTML = this.generateLightControlsHTML();
    }

    this.attachEventListeners();
  }

  private startMetricsUpdate(): void {
    this.metricsTimer = window.setInterval(() => {
      this.updateMetrics();
    }, this.state.metricsUpdateInterval);
  }

  private stopMetricsUpdate(): void {
    if (this.metricsTimer) {
      window.clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }
  }

  private formatMetrics(metrics: LightingMetrics): string {
    return `
      <div class="metric-row">
        <span class="metric-label">Active Lights:</span>
        <span class="metric-value">${metrics.activeLights}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Shadow Maps:</span>
        <span class="metric-value">${metrics.shadowMapsUsed}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Culling Time:</span>
        <span class="metric-value">${metrics.lightCullingTime.toFixed(3)}ms</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Total Time:</span>
        <span class="metric-value">${metrics.totalLightingTime.toFixed(3)}ms</span>
      </div>
    `;
  }

  private colorToHex(color: Color3): string {
    const r = Math.round(color.r * 255)
      .toString(16)
      .padStart(2, '0');
    const g = Math.round(color.g * 255)
      .toString(16)
      .padStart(2, '0');
    const b = Math.round(color.b * 255)
      .toString(16)
      .padStart(2, '0');
    return `#${r}${g}${b}`;
  }

  private hexToColor3(hex: string): Color3 {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result || result.length < 4) return new Color3(1, 1, 1);

    const r = result[1];
    const g = result[2];
    const b = result[3];

    if (!r || !g || !b) return new Color3(1, 1, 1);

    return new Color3(
      Number.parseInt(r, 16) / 255,
      Number.parseInt(g, 16) / 255,
      Number.parseInt(b, 16) / 255
    );
  }

  private applyStyles(): void {
    if (!this.uiContainer) return;

    const style = document.createElement('style');
    style.textContent = `
      .lighting-debug-ui {
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 10000;
        font-family: 'Courier New', monospace;
        font-size: 12px;
      }
      
      .lighting-debug-panel {
        background: rgba(0, 0, 0, 0.9);
        border: 1px solid #333;
        border-radius: 4px;
        padding: 15px;
        width: 320px;
        max-height: 80vh;
        overflow-y: auto;
        color: #fff;
      }
      
      .debug-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        border-bottom: 1px solid #333;
        padding-bottom: 10px;
      }
      
      .debug-header h3 {
        margin: 0;
        color: #4CAF50;
      }
      
      .close-btn {
        background: #ff4444;
        border: none;
        color: white;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
      }
      
      .debug-section {
        margin-bottom: 20px;
      }
      
      .debug-section h4 {
        margin: 0 0 10px 0;
        color: #2196F3;
        font-size: 14px;
      }
      
      .lighting-metrics .metric-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 5px;
      }
      
      .metric-label {
        color: #ccc;
      }
      
      .metric-value {
        color: #4CAF50;
        font-weight: bold;
      }
      
      .light-items {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      
      .light-item {
        display: flex;
        align-items: center;
        padding: 8px;
        margin-bottom: 5px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 3px;
        cursor: pointer;
        transition: background-color 0.2s;
      }
      
      .light-item:hover {
        background: rgba(255, 255, 255, 0.1);
      }
      
      .light-item.selected {
        background: rgba(33, 150, 243, 0.3);
      }
      
      .light-name {
        flex: 1;
        font-weight: bold;
      }
      
      .light-type {
        color: #999;
        margin-right: 10px;
        font-size: 10px;
      }
      
      .light-status {
        margin-right: 10px;
        font-size: 10px;
      }
      
      .light-status.active {
        color: #4CAF50;
      }
      
      .light-status.inactive {
        color: #999;
      }
      
      .light-toggle {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        font-size: 14px;
      }
      
      .control-group {
        display: flex;
        align-items: center;
        margin-bottom: 10px;
      }
      
      .control-group label {
        min-width: 80px;
        color: #ccc;
        font-size: 11px;
      }
      
      .control-group input, .control-group select {
        flex: 1;
        margin: 0 10px;
        padding: 4px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid #555;
        color: white;
        border-radius: 3px;
      }
      
      .value {
        min-width: 40px;
        color: #4CAF50;
        font-size: 10px;
      }
      
      .quick-actions {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      
      .quick-actions button {
        background: #333;
        border: 1px solid #555;
        color: white;
        padding: 8px;
        border-radius: 3px;
        cursor: pointer;
        font-size: 11px;
      }
      
      .quick-actions button:hover {
        background: #444;
      }
      
      .no-lights, .no-selection {
        color: #999;
        font-style: italic;
        text-align: center;
        padding: 20px;
      }
    `;

    document.head.appendChild(style);
  }
}
