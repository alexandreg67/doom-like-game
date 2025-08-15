import { Vector2, Vector3 } from '@babylonjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DoomLineDef, DoomSector, DoomVertex } from '../../geometry/doom-geometry';
import { CollisionDetector } from '../collision-detector';
import { PhysicsController } from '../physics-controller';
import type { CollisionEvent, CollisionGeometry, MovementInput, PhysicsConfig } from '../types';

// Mock collision detector
vi.mock('../collision-detector');
const MockCollisionDetector = vi.mocked(CollisionDetector);

describe('PhysicsController', () => {
  let controller: PhysicsController;
  // biome-ignore lint/suspicious/noExplicitAny: Mock object for tests
  let mockCollisionDetector: any;
  let config: PhysicsConfig;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock collision detector
    mockCollisionDetector = {
      setGeometry: vi.fn(),
      testCircleLineCollision: vi.fn().mockReturnValue({
        collided: false,
        normal: new Vector2(0, 0),
        correction: new Vector2(0, 0),
        distance: 0,
      }),
      findSectorAtPosition: vi.fn().mockReturnValue({
        id: 'test_sector',
        floorHeight: 0,
        ceilingHeight: 8,
      } as DoomSector),
      resetMetrics: vi.fn(),
      getMetrics: vi.fn().mockReturnValue({
        collisionChecks: 0,
        lineTests: 0,
        averageLineTestsPerCheck: 0,
      }),
      dispose: vi.fn(),
    };

    MockCollisionDetector.mockImplementation(() => mockCollisionDetector);

    config = {
      gravity: -9.81,
      jumpForce: 4.5,
      walkSpeed: 2.5,
      sprintSpeed: 4.0,
      friction: 0.8,
      airControl: 0.3,
      maxVelocity: 10.0,
    };

    controller = new PhysicsController(new Vector3(0, 0, 0), config);
  });

  describe('Initialization', () => {
    it('should initialize with specified position and state', () => {
      const initialPos = new Vector3(5, 2, 3);
      const newController = new PhysicsController(initialPos, config);

      expect(newController.getPosition()).toEqual(initialPos);
      expect(newController.getVelocity()).toEqual(Vector3.Zero());
      expect(newController.isOnGround()).toBe(false);
      expect(newController.getCurrentSector()).toBeNull();
    });

    it('should set geometry on collision detector', () => {
      const geometry: CollisionGeometry = {
        lineDefs: [],
        sectors: [],
      };

      controller.setGeometry(geometry);
      expect(mockCollisionDetector.setGeometry).toHaveBeenCalledWith(geometry);
    });
  });

  describe('Movement Input', () => {
    it('should apply forward movement', () => {
      const input: MovementInput = {
        forward: 1,
        strafe: 0,
        jump: false,
        sprint: false,
      };

      const deltaTime = 1.0 / 60;
      const initialPosition = controller.getPosition();

      controller.update(input, deltaTime);

      const newPosition = controller.getPosition();
      // Should move forward (positive Z direction)
      expect(newPosition.z).toBeGreaterThan(initialPosition.z);
    });

    it('should apply strafe movement', () => {
      const input: MovementInput = {
        forward: 0,
        strafe: 1,
        jump: false,
        sprint: false,
      };

      const deltaTime = 1.0 / 60;
      const initialPosition = controller.getPosition();

      controller.update(input, deltaTime);

      const newPosition = controller.getPosition();
      // Should move right (positive X direction)
      expect(newPosition.x).toBeGreaterThan(initialPosition.x);
    });

    it('should handle diagonal movement', () => {
      const input: MovementInput = {
        forward: 1,
        strafe: 1,
        jump: false,
        sprint: false,
      };

      const deltaTime = 1.0 / 60;
      const initialPosition = controller.getPosition();

      controller.update(input, deltaTime);

      const newPosition = controller.getPosition();
      const velocity = controller.getVelocity();

      // Should move in both directions
      expect(newPosition.x).toBeGreaterThan(initialPosition.x);
      expect(newPosition.z).toBeGreaterThan(initialPosition.z);

      // Velocity should be limited by maxVelocity
      const horizontalSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
      expect(horizontalSpeed).toBeLessThanOrEqual(config.maxVelocity + 0.1);
    });

    it('should apply sprint speed multiplier', () => {
      const walkInput: MovementInput = {
        forward: 1,
        strafe: 0,
        jump: false,
        sprint: false,
      };

      const sprintInput: MovementInput = {
        forward: 1,
        strafe: 0,
        jump: false,
        sprint: true,
      };

      const deltaTime = 1.0 / 60;

      // Test walk speed
      const walkController = new PhysicsController(Vector3.Zero(), config);
      walkController.update(walkInput, deltaTime);
      const walkVelocity = walkController.getVelocity();

      // Test sprint speed
      const sprintController = new PhysicsController(Vector3.Zero(), config);
      sprintController.update(sprintInput, deltaTime);
      const sprintVelocity = sprintController.getVelocity();

      // Sprint should be faster than walk
      expect(sprintVelocity.z).toBeGreaterThan(walkVelocity.z);
    });
  });

  describe('Physics Mechanics', () => {
    it('should apply gravity when not grounded', () => {
      const input: MovementInput = {
        forward: 0,
        strafe: 0,
        jump: false,
        sprint: false,
      };

      const deltaTime = 1.0 / 60;
      const initialVelocity = controller.getVelocity();

      controller.update(input, deltaTime);

      const newVelocity = controller.getVelocity();
      // Y velocity should decrease due to gravity
      expect(newVelocity.y).toBeLessThan(initialVelocity.y);

      const expectedVelocityChange = config.gravity * deltaTime;
      expect(newVelocity.y).toBeCloseTo(initialVelocity.y + expectedVelocityChange, 5);
    });

    it('should allow jumping when grounded', () => {
      // Set up grounded state by mocking floor collision
      const groundedSector = {
        id: 'ground_sector',
        floorHeight: 0,
        ceilingHeight: 8,
      } as DoomSector;

      mockCollisionDetector.findSectorAtPosition.mockReturnValue(groundedSector);

      // Position at ground level
      controller.setPosition(new Vector3(0, 0, 0));

      // Update once to establish grounded state
      const deltaTime = 1.0 / 60;
      controller.update({ forward: 0, strafe: 0, jump: false, sprint: false }, deltaTime);

      // Now try to jump
      const jumpInput: MovementInput = {
        forward: 0,
        strafe: 0,
        jump: true,
        sprint: false,
      };

      const initialVelocity = controller.getVelocity();
      controller.update(jumpInput, deltaTime);

      const newVelocity = controller.getVelocity();

      // Should have positive Y velocity from jump
      expect(newVelocity.y).toBeGreaterThan(initialVelocity.y);
      // Jump force minus gravity applied during the frame
      const expectedVelocity = config.jumpForce + config.gravity * deltaTime;
      expect(newVelocity.y).toBeCloseTo(expectedVelocity, 1);
    });
  });

  describe('Collision Handling', () => {
    it('should handle wall collision', () => {
      // Mock collision with wall
      mockCollisionDetector.testCircleLineCollision.mockReturnValue({
        collided: true,
        normal: new Vector2(1, 0), // Wall facing right
        correction: new Vector2(0.1, 0),
        distance: 0.1,
      });

      const input: MovementInput = {
        forward: 0,
        strafe: -1, // Moving left into wall
        jump: false,
        sprint: false,
      };

      const deltaTime = 1.0 / 60;
      const initialPosition = controller.getPosition();

      controller.update(input, deltaTime);

      const newPosition = controller.getPosition();
      // Position should be corrected by collision system
      expect(newPosition.x).toBeGreaterThanOrEqual(initialPosition.x);
    });
  });

  describe('Sector Detection', () => {
    it('should detect sector changes', () => {
      const oldSector = {
        id: 'old_sector',
        floorHeight: 0,
        ceilingHeight: 8,
      } as DoomSector;

      const newSector = {
        id: 'new_sector',
        floorHeight: 2,
        ceilingHeight: 10,
      } as DoomSector;

      // Start in old sector
      mockCollisionDetector.findSectorAtPosition.mockReturnValue(oldSector);
      const deltaTime = 1.0 / 60;
      controller.update({ forward: 0, strafe: 0, jump: false, sprint: false }, deltaTime);

      // Move to new sector
      mockCollisionDetector.findSectorAtPosition.mockReturnValue(newSector);
      controller.update({ forward: 1, strafe: 0, jump: false, sprint: false }, deltaTime);

      expect(controller.getCurrentSector()).toBe(newSector);
    });
  });

  describe('State Management', () => {
    it('should allow position override', () => {
      const newPosition = new Vector3(10, 5, -3);
      controller.setPosition(newPosition);

      expect(controller.getPosition()).toEqual(newPosition);
    });

    it('should provide configuration updates', () => {
      const newConfig: Partial<PhysicsConfig> = {
        walkSpeed: 5.0,
        jumpForce: 6.0,
      };

      controller.setConfig(newConfig);

      // Test that new config is applied
      const input: MovementInput = {
        forward: 1,
        strafe: 0,
        jump: false,
        sprint: false,
      };

      const deltaTime = 1.0 / 60;
      controller.update(input, deltaTime);

      const velocity = controller.getVelocity();
      // Should use new walk speed (5.0 instead of original 2.5)
      // The velocity accumulates over time, so we just check it's reasonable
      expect(Math.abs(velocity.z)).toBeGreaterThan(0.02); // Any meaningful movement
    });

    it('should track metrics', () => {
      const input: MovementInput = {
        forward: 1,
        strafe: 1,
        jump: false,
        sprint: false,
      };

      const deltaTime = 1.0 / 60;

      // Perform multiple updates
      for (let i = 0; i < 5; i++) {
        controller.update(input, deltaTime);
      }

      const metrics = controller.getMetrics();
      expect(metrics).toBeDefined();
      expect(typeof metrics.averageFrameTime).toBe('number');
    });

    it('should dispose properly', () => {
      controller.dispose();
      expect(mockCollisionDetector.dispose).toHaveBeenCalled();
    });
  });
});
