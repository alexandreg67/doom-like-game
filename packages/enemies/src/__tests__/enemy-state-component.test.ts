import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EnemyStateUtils, createEnemyStateComponent } from '../components/enemy-state-component';
import { EnemyState } from '../types';

describe('EnemyStateComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createEnemyStateComponent', () => {
    it('should create state component with default IDLE state', () => {
      const component = createEnemyStateComponent();

      expect(component.id).toBe('enemyState');
      expect(component.currentState).toBe(EnemyState.IDLE);
      expect(component.previousState).toBe(EnemyState.IDLE);
      expect(component.timeInState).toBe(0);
      expect(component.stateChanged).toBe(false);
      expect(component.nextState).toBeUndefined();
      expect(component.nextStateTimer).toBeUndefined();
    });

    it('should create state component with custom initial state', () => {
      const component = createEnemyStateComponent(EnemyState.CHASE);

      expect(component.currentState).toBe(EnemyState.CHASE);
      expect(component.previousState).toBe(EnemyState.CHASE);
    });

    it('should set stateStartTime to current performance time', () => {
      const mockTime = 1000;
      vi.spyOn(performance, 'now').mockReturnValue(mockTime);

      const component = createEnemyStateComponent();

      expect(component.stateStartTime).toBe(mockTime);
    });
  });

  describe('EnemyStateUtils', () => {
    let component: ReturnType<typeof createEnemyStateComponent>;

    beforeEach(() => {
      component = createEnemyStateComponent(EnemyState.IDLE);
    });

    describe('transitionTo', () => {
      it('should transition to new state correctly', () => {
        const mockTime = 2000;

        EnemyStateUtils.transitionTo(component, EnemyState.CHASE, mockTime);

        expect(component.currentState).toBe(EnemyState.CHASE);
        expect(component.previousState).toBe(EnemyState.IDLE);
        expect(component.stateStartTime).toBe(mockTime);
        expect(component.timeInState).toBe(0);
        expect(component.stateChanged).toBe(true);
        expect(component.nextState).toBeUndefined();
        expect(component.nextStateTimer).toBeUndefined();
      });

      it('should not transition to same state', () => {
        const initialTime = component.stateStartTime;

        EnemyStateUtils.transitionTo(component, EnemyState.IDLE);

        expect(component.currentState).toBe(EnemyState.IDLE);
        expect(component.stateStartTime).toBe(initialTime);
        expect(component.stateChanged).toBe(false);
      });

      it('should clear scheduled transitions', () => {
        component.nextState = EnemyState.ATTACK;
        component.nextStateTimer = 1.5;

        EnemyStateUtils.transitionTo(component, EnemyState.CHASE);

        expect(component.nextState).toBeUndefined();
        expect(component.nextStateTimer).toBeUndefined();
      });
    });

    describe('scheduleTransition', () => {
      it('should schedule future state transition', () => {
        EnemyStateUtils.scheduleTransition(component, EnemyState.ATTACK, 2.0);

        expect(component.nextState).toBe(EnemyState.ATTACK);
        expect(component.nextStateTimer).toBe(2.0);
      });
    });

    describe('updateState', () => {
      it('should reset state change flag', () => {
        component.stateChanged = true;

        EnemyStateUtils.updateState(component, 0.016, 1000);

        expect(component.stateChanged).toBe(false);
      });

      it('should update timeInState correctly', () => {
        const startTime = 1000;
        const currentTime = 2500;
        component.stateStartTime = startTime;

        EnemyStateUtils.updateState(component, 0.016, currentTime);

        expect(component.timeInState).toBe(1.5); // (2500 - 1000) / 1000
      });

      it('should handle scheduled transitions', () => {
        component.nextState = EnemyState.ATTACK;
        component.nextStateTimer = 0.5;

        EnemyStateUtils.updateState(component, 1.0); // deltaTime > timer

        expect(component.currentState).toBe(EnemyState.ATTACK);
        expect(component.nextState).toBeUndefined();
        expect(component.nextStateTimer).toBeUndefined();
      });

      it('should count down scheduled transition timer', () => {
        component.nextState = EnemyState.ATTACK;
        component.nextStateTimer = 2.0;

        EnemyStateUtils.updateState(component, 0.5);

        expect(component.nextStateTimer).toBe(1.5);
        expect(component.currentState).toBe(EnemyState.IDLE); // Should not transition yet
      });
    });

    describe('isInState', () => {
      it('should return true for current state', () => {
        expect(EnemyStateUtils.isInState(component, EnemyState.IDLE)).toBe(true);
      });

      it('should return false for different state', () => {
        expect(EnemyStateUtils.isInState(component, EnemyState.CHASE)).toBe(false);
      });

      it('should return true if in any of multiple states', () => {
        expect(EnemyStateUtils.isInState(component, EnemyState.CHASE, EnemyState.IDLE)).toBe(true);
      });

      it('should return false if not in any of multiple states', () => {
        expect(EnemyStateUtils.isInState(component, EnemyState.CHASE, EnemyState.ATTACK)).toBe(
          false
        );
      });
    });

    describe('justEnteredState', () => {
      it('should return true when just entered specified state', () => {
        component.stateChanged = true;
        component.currentState = EnemyState.CHASE;

        expect(EnemyStateUtils.justEnteredState(component, EnemyState.CHASE)).toBe(true);
      });

      it('should return false when state changed to different state', () => {
        component.stateChanged = true;
        component.currentState = EnemyState.ATTACK;

        expect(EnemyStateUtils.justEnteredState(component, EnemyState.CHASE)).toBe(false);
      });

      it('should return false when in state but state did not change', () => {
        component.stateChanged = false;
        component.currentState = EnemyState.CHASE;

        expect(EnemyStateUtils.justEnteredState(component, EnemyState.CHASE)).toBe(false);
      });
    });

    describe('hasBeenInStateFor', () => {
      it('should return true when in state for sufficient time', () => {
        component.currentState = EnemyState.CHASE;
        component.timeInState = 2.0;

        expect(EnemyStateUtils.hasBeenInStateFor(component, EnemyState.CHASE, 1.5)).toBe(true);
      });

      it('should return false when in state for insufficient time', () => {
        component.currentState = EnemyState.CHASE;
        component.timeInState = 1.0;

        expect(EnemyStateUtils.hasBeenInStateFor(component, EnemyState.CHASE, 1.5)).toBe(false);
      });

      it('should return false when not in specified state', () => {
        component.currentState = EnemyState.IDLE;
        component.timeInState = 2.0;

        expect(EnemyStateUtils.hasBeenInStateFor(component, EnemyState.CHASE, 1.5)).toBe(false);
      });

      it('should return true when time exactly matches minimum', () => {
        component.currentState = EnemyState.ATTACK;
        component.timeInState = 1.5;

        expect(EnemyStateUtils.hasBeenInStateFor(component, EnemyState.ATTACK, 1.5)).toBe(true);
      });
    });
  });
});
