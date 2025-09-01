import { Vector3 } from '@babylonjs/core';
import type { Entity, Transform } from '@doom-like/game-logic';
import type { EnemyStateComponent } from '../components';
import {
  createImp,
  createImpSquad,
  getImpStats,
  initializeImpSystem,
} from '../helpers/imp-helpers';
import { EnemyAISystem, EnemyCombatSystem, EnemyMovementSystem } from '../systems';

/**
 * Imp Demo - Interactive demonstration of Imp behavior
 * Shows complete enemy lifecycle from spawn to death
 */

// Mock entity creation and transform for demo
const createMockEntity = (id: string): Entity => ({
  id,
  components: new Map(),
});

class MockTransform implements Transform {
  id = 'transform';
  constructor(
    public x: number,
    public y: number,
    public z: number
  ) {}
}

/**
 * Demo configuration
 */
interface DemoConfig {
  duration: number; // Demo duration in seconds
  playerMovement: boolean; // Whether to simulate player movement
  enableDebug: boolean; // Enable debug output
  scenario: 'single_imp' | 'imp_squad' | 'combat_test' | 'performance_test';
}

/**
 * Demo metrics tracking
 */
interface DemoMetrics {
  startTime: number;
  frameCount: number;
  stateTransitions: Record<string, number>;
  damageDealt: number;
  distanceTraveled: number;
  avgFrameTime: number;
  peakFrameTime: number;
}

/**
 * Main demo class
 */
export class ImpDemo {
  private aiSystem: EnemyAISystem;
  private movementSystem: EnemyMovementSystem;
  private combatSystem: EnemyCombatSystem;
  private entities: Entity[] = [];
  private playerEntity: Entity;
  private metrics: DemoMetrics;
  private running = false;

  constructor() {
    // Initialize systems
    this.aiSystem = new EnemyAISystem();
    this.movementSystem = new EnemyMovementSystem();
    this.combatSystem = new EnemyCombatSystem();

    // Initialize Imp system
    initializeImpSystem();

    // Create player entity
    this.playerEntity = createMockEntity('player');
    this.playerEntity.components.set('transform', new MockTransform(0, 0, 0));
    this.entities.push(this.playerEntity);

    // Configure systems
    this.aiSystem.setPlayer('player');
    this.combatSystem.setPlayer('player');
    this.movementSystem.setDebugMode(true);

    // Initialize metrics
    this.metrics = {
      startTime: performance.now(),
      frameCount: 0,
      stateTransitions: {},
      damageDealt: 0,
      distanceTraveled: 0,
      avgFrameTime: 0,
      peakFrameTime: 0,
    };
  }

  /**
   * Run a specific demo scenario
   */
  async runDemo(config: DemoConfig): Promise<void> {
    console.log(`\n🎮 [IMP_DEMO] Starting ${config.scenario} scenario`);
    console.log(`⏱️  Duration: ${config.duration}s`);
    console.log(`🎯 Player movement: ${config.playerMovement ? 'enabled' : 'disabled'}`);
    console.log(`🔧 Debug: ${config.enableDebug ? 'enabled' : 'disabled'}\n`);

    // Setup scenario
    this.setupScenario(config.scenario);

    // Run simulation
    this.running = true;
    const startTime = performance.now();
    const endTime = startTime + config.duration * 1000;

    let lastUpdateTime = startTime;
    let frameStartTime = startTime;

    while (performance.now() < endTime && this.running) {
      const currentTime = performance.now();
      const deltaTime = (currentTime - lastUpdateTime) / 1000; // Convert to seconds

      frameStartTime = performance.now();

      // Update player position if movement enabled
      if (config.playerMovement) {
        this.updatePlayerMovement(currentTime - startTime);
      }

      // Update all systems
      this.updateSystems(deltaTime);

      // Collect metrics
      this.updateMetrics(deltaTime, performance.now() - frameStartTime);

      // Debug output
      if (config.enableDebug && this.metrics.frameCount % 60 === 0) {
        this.printDebugInfo();
      }

      lastUpdateTime = currentTime;

      // Simple frame limiting (60 FPS target)
      await this.sleep(16);
    }

    this.running = false;
    this.printFinalReport();
  }

  /**
   * Setup entities for different scenarios
   */
  private setupScenario(scenario: DemoConfig['scenario']): void {
    // Clear existing enemies
    this.entities = this.entities.filter((e) => e.id === 'player');

    switch (scenario) {
      case 'single_imp': {
        console.log('📍 Spawning single Imp at (10, 0, 0)');
        const imp = createImp(createMockEntity, new Vector3(10, 0, 0));
        if (imp) this.entities.push(imp);
        break;
      }

      case 'imp_squad': {
        console.log('📍 Spawning Imp squad in circle formation');
        const squad = createImpSquad(createMockEntity, new Vector3(15, 0, 0), 4, 'circle', 3);
        this.entities.push(...squad);
        break;
      }

      case 'combat_test': {
        console.log('📍 Spawning combat test setup');
        const combatImp = createImp(createMockEntity, new Vector3(2, 0, 0)); // Very close
        if (combatImp) this.entities.push(combatImp);
        break;
      }

      case 'performance_test':
        console.log('📍 Spawning 20 Imps for performance test');
        for (let i = 0; i < 20; i++) {
          const angle = (i / 20) * Math.PI * 2;
          const radius = 10 + (i % 3) * 5; // Varying distances
          const position = new Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
          const perfImp = createImp(createMockEntity, position);
          if (perfImp) this.entities.push(perfImp);
        }
        break;
    }

    console.log(`✅ Setup complete: ${this.entities.length - 1} enemies spawned\n`);
  }

  /**
   * Simulate player movement patterns
   */
  private updatePlayerMovement(elapsedTime: number): void {
    const playerTransform = this.playerEntity.components.get('transform') as MockTransform;
    const time = elapsedTime / 1000; // Convert to seconds

    // Circular movement pattern
    const radius = 8;
    const speed = 0.5; // 0.5 radians per second

    playerTransform.x = Math.cos(time * speed) * radius;
    playerTransform.z = Math.sin(time * speed) * radius;
  }

  /**
   * Update all enemy systems
   */
  private updateSystems(deltaTime: number): void {
    this.aiSystem.update(this.entities, deltaTime);
    this.movementSystem.update(this.entities, deltaTime);
    this.combatSystem.update(this.entities, deltaTime);

    // Process damage events
    const damageEvents = this.combatSystem.getDamageEvents();
    for (const event of damageEvents) {
      this.metrics.damageDealt += event.damage;
    }
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(_deltaTime: number, frameTime: number): void {
    this.metrics.frameCount++;
    this.metrics.avgFrameTime =
      (this.metrics.avgFrameTime * (this.metrics.frameCount - 1) + frameTime) /
      this.metrics.frameCount;
    this.metrics.peakFrameTime = Math.max(this.metrics.peakFrameTime, frameTime);

    // Track state transitions
    for (const entity of this.entities) {
      if (entity.id === 'player') continue;

      const stateComponent = entity.components.get('enemyState') as EnemyStateComponent;
      if (stateComponent?.stateChanged) {
        const state = stateComponent.currentState;
        this.metrics.stateTransitions[state] = (this.metrics.stateTransitions[state] || 0) + 1;
      }
    }
  }

  /**
   * Print debug information during runtime
   */
  private printDebugInfo(): void {
    const enemies = this.entities.filter((e) => e.id !== 'player');
    const aliveEnemies = enemies.filter((e) => {
      const stats = getImpStats(e);
      return stats?.isAlive;
    });

    const aiStats = this.aiSystem.getStats();
    const movementStats = this.movementSystem.getStats(this.entities);
    const combatStats = this.combatSystem.getStats(this.entities);

    console.log(
      `\n🔄 Frame ${this.metrics.frameCount} - ${aliveEnemies.length}/${enemies.length} enemies alive`
    );
    console.log(
      `📊 States: ${Object.entries(aiStats.stateDistribution)
        .map(([state, count]) => `${state}:${count}`)
        .join(' ')}`
    );
    console.log(
      `🏃 Movement: ${movementStats.movingEnemies} moving, ${movementStats.stuckEnemies} stuck`
    );
    console.log(
      `⚔️  Combat: ${combatStats.attackingEnemies} attacking, ${this.metrics.damageDealt} total damage`
    );
    console.log(
      `⚡ Performance: ${this.metrics.avgFrameTime.toFixed(2)}ms avg, ${this.metrics.peakFrameTime.toFixed(2)}ms peak`
    );

    // Individual enemy states
    aliveEnemies.slice(0, 3).forEach((enemy, i) => {
      const stats = getImpStats(enemy);
      const stateComponent = enemy.components.get('enemyState');
      if (stats && stateComponent) {
        console.log(
          `   Imp${i + 1}: ${stats.state} (${stats.health.current}/${stats.health.max} HP)`
        );
      }
    });
  }

  /**
   * Print final demo report
   */
  private printFinalReport(): void {
    const totalTime = (performance.now() - this.metrics.startTime) / 1000;
    const enemies = this.entities.filter((e) => e.id !== 'player');
    const aliveEnemies = enemies.filter((e) => {
      const stats = getImpStats(e);
      return stats?.isAlive;
    });

    console.log(`\n${'='.repeat(60)}`);
    console.log('🎮 IMP DEMO FINAL REPORT');
    console.log('='.repeat(60));
    console.log(`⏱️  Total Duration: ${totalTime.toFixed(2)}s`);
    console.log(`📊 Total Frames: ${this.metrics.frameCount}`);
    console.log(`⚡ Avg FPS: ${(this.metrics.frameCount / totalTime).toFixed(1)}`);
    console.log(`⚔️  Total Damage Dealt: ${this.metrics.damageDealt}`);
    console.log(`🧌 Enemies Alive: ${aliveEnemies.length}/${enemies.length}`);

    console.log('\n📈 State Transitions:');
    for (const [state, count] of Object.entries(this.metrics.stateTransitions)) {
      console.log(`   ${state}: ${count} transitions`);
    }

    const finalAIStats = this.aiSystem.getStats();
    const finalMovementStats = this.movementSystem.getStats(this.entities);
    const finalCombatStats = this.combatSystem.getStats(this.entities);

    console.log('\n📊 Final System Stats:');
    console.log(`   AI: ${finalAIStats.activeEnemies} active enemies`);
    console.log(`   Movement: ${finalMovementStats.averageSpeed.toFixed(1)} avg speed`);
    console.log(`   Combat: ${finalCombatStats.averageHealth.toFixed(1)} avg health %`);

    console.log('\n⚡ Performance Stats:');
    console.log(`   Average Frame Time: ${this.metrics.avgFrameTime.toFixed(3)}ms`);
    console.log(`   Peak Frame Time: ${this.metrics.peakFrameTime.toFixed(3)}ms`);
    console.log(
      `   Target (16.67ms): ${this.metrics.avgFrameTime < 16.67 ? '✅ PASS' : '❌ FAIL'}`
    );

    console.log(`${'='.repeat(60)}\n`);
  }

  /**
   * Stop the demo
   */
  stop(): void {
    this.running = false;
  }

  /**
   * Helper for frame timing
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Predefined demo scenarios
 */
export const DEMO_SCENARIOS = {
  QUICK_TEST: {
    duration: 10,
    playerMovement: true,
    enableDebug: true,
    scenario: 'single_imp' as const,
  },

  COMBAT_DEMO: {
    duration: 30,
    playerMovement: false,
    enableDebug: true,
    scenario: 'combat_test' as const,
  },

  SQUAD_BEHAVIOR: {
    duration: 45,
    playerMovement: true,
    enableDebug: false,
    scenario: 'imp_squad' as const,
  },

  PERFORMANCE_BENCHMARK: {
    duration: 60,
    playerMovement: true,
    enableDebug: false,
    scenario: 'performance_test' as const,
  },
} as const;

/**
 * Run a quick demo for testing
 */
export async function runQuickDemo(): Promise<void> {
  const demo = new ImpDemo();
  await demo.runDemo(DEMO_SCENARIOS.QUICK_TEST);
}

/**
 * Main demo entry point
 */
export async function main(): Promise<void> {
  console.log('🎮 Imp Demo System - Phase 2');
  console.log('Available scenarios:', Object.keys(DEMO_SCENARIOS));

  // Run quick test by default
  await runQuickDemo();
}
