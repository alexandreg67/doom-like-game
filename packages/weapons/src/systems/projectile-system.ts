/**
 * Projectile system for non-hitscan weapons
 * Handles physics-based projectiles with Babylon.js
 */

import { Color3, MeshBuilder, PhysicsImpostor, StandardMaterial, Vector3 } from '@babylonjs/core';
import type { AbstractMesh, Mesh, Scene } from '@babylonjs/core';
import type { Entity } from '@doom-like/game-logic';
import {
  ExplosionComponent,
  type ProjectileComponent,
  createExplosionComponent,
  createProjectileComponent,
} from '../components/projectile-component';
import type { FiringContext, ProjectileConfig } from '../types';

export class ProjectileSystem {
  private scene: Scene;
  private activeProjectiles: Map<Entity, Mesh> = new Map();
  private projectilePool: Mesh[] = [];
  private readonly POOL_SIZE = 50;

  constructor(scene: Scene) {
    this.scene = scene;
    this.initializeProjectilePool();
  }

  /**
   * Fire a projectile weapon
   */
  public fire(context: FiringContext, config: ProjectileConfig): Entity {
    const { entity, origin, direction } = context;

    // Create projectile entity (this would integrate with your ECS system)
    const projectileEntity = this.createProjectileEntity(config, origin, direction, entity);

    // Create visual mesh
    const projectileMesh = this.createProjectileMesh(config);
    projectileMesh.position = origin.clone();

    // Setup physics
    this.setupProjectilePhysics(projectileMesh, direction, config);

    // Track projectile
    this.activeProjectiles.set(projectileEntity, projectileMesh);

    return projectileEntity;
  }

  /**
   * Update all active projectiles
   */
  public update(deltaTime: number): void {
    const now = performance.now();
    const projectilesToRemove: Entity[] = [];

    for (const [entity, mesh] of this.activeProjectiles) {
      const projectile = entity.components.get('projectile') as ProjectileComponent;

      if (!projectile) {
        projectilesToRemove.push(entity);
        continue;
      }

      // Update projectile physics
      this.updateProjectilePhysics(projectile, mesh, deltaTime);

      // Check lifetime
      if (now - projectile.spawnTime > projectile.maxLifetime) {
        if (projectile.explodeOnTimeout) {
          this.createExplosion(mesh.position, projectile);
        }
        projectilesToRemove.push(entity);
        continue;
      }

      // Check collision
      if (this.checkProjectileCollision(projectile, mesh)) {
        this.handleProjectileCollision(projectile, mesh, entity);

        if (!projectile.isSticky) {
          projectilesToRemove.push(entity);
        }
      }

      // Update visual effects
      this.updateProjectileVisuals(projectile, mesh, deltaTime);
    }

    // Remove expired projectiles
    for (const entity of projectilesToRemove) {
      this.removeProjectile(entity);
    }
  }

  /**
   * Create explosion at position
   */
  public createExplosion(position: Vector3, projectile: ProjectileComponent): Entity {
    const explosionEntity = this.createExplosionEntity(position, projectile);

    // Create visual effect
    this.createExplosionEffect(position, projectile.config.explosionRadius || 32);

    // Apply damage to nearby entities
    this.applyExplosionDamage(position, projectile);

    return explosionEntity;
  }

  /**
   * Get all projectiles in radius
   */
  public getProjectilesInRadius(center: Vector3, radius: number): Entity[] {
    const result: Entity[] = [];

    for (const [entity, mesh] of this.activeProjectiles) {
      const distance = Vector3.Distance(center, mesh.position);
      if (distance <= radius) {
        result.push(entity);
      }
    }

    return result;
  }

  /**
   * Cleanup system
   */
  public dispose(): void {
    for (const [entity] of this.activeProjectiles) {
      this.removeProjectile(entity);
    }

    for (const mesh of this.projectilePool) {
      mesh.dispose();
    }

    this.activeProjectiles.clear();
    this.projectilePool.length = 0;
  }

  private initializeProjectilePool(): void {
    for (let i = 0; i < this.POOL_SIZE; i++) {
      const mesh = MeshBuilder.CreateSphere(`projectile_pool_${i}`, { diameter: 0.1 }, this.scene);
      mesh.setEnabled(false);
      this.projectilePool.push(mesh);
    }
  }

  private createProjectileEntity(
    config: ProjectileConfig,
    _origin: Vector3,
    direction: Vector3,
    owner?: Entity
  ): Entity {
    // This would integrate with your ECS system
    // For now, create a mock entity
    const entity: Entity = {
      id: `projectile_${Date.now()}_${Math.random()}`,
      components: new Map(),
    };

    const velocity = direction.scale(config.speed);
    const projectileComponent = createProjectileComponent(config, velocity, 50, owner);

    entity.components.set('projectile', projectileComponent);

    return entity;
  }

  private createProjectileMesh(_config: ProjectileConfig): Mesh {
    let mesh: Mesh;

    const pooledMesh = this.projectilePool.pop();
    if (pooledMesh) {
      mesh = pooledMesh;
      mesh.setEnabled(true);
    } else {
      mesh = MeshBuilder.CreateSphere('projectile', { diameter: 0.2 }, this.scene);
    }

    // Setup visual appearance based on config
    const material = new StandardMaterial('projectileMat', this.scene);
    material.emissiveColor = new Color3(1, 0.5, 0); // Orange glow
    mesh.material = material;

    return mesh;
  }

  private setupProjectilePhysics(mesh: Mesh, direction: Vector3, config: ProjectileConfig): void {
    // Setup physics impostor
    mesh.physicsImpostor = new PhysicsImpostor(
      mesh,
      PhysicsImpostor.SphereImpostor,
      { mass: config.mass, restitution: 0.3 },
      this.scene
    );

    // Set initial velocity
    const velocity = direction.scale(config.speed);
    mesh.physicsImpostor.setLinearVelocity(velocity);
  }

  private updateProjectilePhysics(
    projectile: ProjectileComponent,
    mesh: Mesh,
    deltaTime: number
  ): void {
    if (!mesh.physicsImpostor) return;

    // Update velocity with acceleration
    const currentVelocity = mesh.physicsImpostor.getLinearVelocity() || Vector3.Zero();
    const newVelocity = currentVelocity.add(projectile.acceleration.scale(deltaTime));

    // Apply gravity
    newVelocity.y -= projectile.config.gravity * deltaTime;

    mesh.physicsImpostor.setLinearVelocity(newVelocity);

    // Update distance traveled
    const frameDistance = newVelocity.length() * deltaTime;
    projectile.distanceTraveled += frameDistance;

    // Handle homing behavior
    if (projectile.isHoming && projectile.homingTarget) {
      this.updateHomingBehavior(projectile, mesh);
    }
  }

  private checkProjectileCollision(_projectile: ProjectileComponent, mesh: Mesh): boolean {
    if (!mesh.physicsImpostor) return false;

    // Use physics collision detection
    return mesh.physicsImpostor.getLinearVelocity()?.length() === 0;
  }

  private handleProjectileCollision(
    projectile: ProjectileComponent,
    mesh: Mesh,
    _entity: Entity
  ): void {
    projectile.hasCollided = true;
    projectile.collisionPoint = mesh.position.clone();

    // Handle bouncing
    if (projectile.bounceCount < projectile.maxBounces) {
      this.handleProjectileBounce(projectile, mesh);
      return;
    }

    // Handle explosion
    if (projectile.explodeOnImpact) {
      this.createExplosion(mesh.position, projectile);
    }

    // Handle sticky projectiles
    if (projectile.isSticky) {
      this.makeProjectileSticky(projectile, mesh);
    }
  }

  private handleProjectileBounce(projectile: ProjectileComponent, mesh: Mesh): void {
    if (!mesh.physicsImpostor) return;

    const velocity = mesh.physicsImpostor.getLinearVelocity();
    if (!velocity) return;

    // Apply bounce damping
    const dampedVelocity = velocity.scale(projectile.bounceDamping);
    mesh.physicsImpostor.setLinearVelocity(dampedVelocity);

    projectile.bounceCount++;
  }

  private makeProjectileSticky(projectile: ProjectileComponent, mesh: Mesh): void {
    if (mesh.physicsImpostor) {
      mesh.physicsImpostor.setLinearVelocity(Vector3.Zero());
      mesh.physicsImpostor.setAngularVelocity(Vector3.Zero());
    }

    // Set stick timer
    if (projectile.stickTime) {
      setTimeout(() => {
        if (projectile.explodeOnTimeout) {
          this.createExplosion(mesh.position, projectile);
        }
      }, projectile.stickTime);
    }
  }

  private updateProjectileVisuals(
    projectile: ProjectileComponent,
    mesh: Mesh,
    deltaTime: number
  ): void {
    // Update rotation
    if (projectile.rotationSpeed > 0) {
      mesh.rotation.y += projectile.rotationSpeed * deltaTime;
    }

    // Update trail effect
    if (projectile.trailEffect) {
      // Trail effect implementation would go here
    }

    // Update glow effect
    if (projectile.glowEffect && mesh.material instanceof StandardMaterial) {
      const time = (performance.now() - projectile.spawnTime) / 1000;
      const glowIntensity = 0.5 + 0.5 * Math.sin(time * 10);
      mesh.material.emissiveColor = mesh.material.emissiveColor.scale(glowIntensity);
    }
  }

  private updateHomingBehavior(projectile: ProjectileComponent, mesh: Mesh): void {
    if (!projectile.homingTarget || !mesh.physicsImpostor) return;

    // Get target position (would need to integrate with ECS for real target position)
    const targetPosition = Vector3.Zero(); // Placeholder

    const currentVelocity = mesh.physicsImpostor.getLinearVelocity() || Vector3.Zero();
    const toTarget = targetPosition.subtract(mesh.position).normalize();

    const homingForce = toTarget.scale(projectile.homingStrength || 5.0);
    const newVelocity = currentVelocity.add(homingForce);

    // Maintain original speed
    const originalSpeed = projectile.config.speed;
    newVelocity.normalize().scaleInPlace(originalSpeed);

    mesh.physicsImpostor.setLinearVelocity(newVelocity);
  }

  private createExplosionEntity(position: Vector3, projectile: ProjectileComponent): Entity {
    const entity: Entity = {
      id: `explosion_${Date.now()}_${Math.random()}`,
      components: new Map(),
    };

    const explosionComponent = createExplosionComponent(
      position,
      projectile.explosionDamage,
      projectile.explosionRadius,
      projectile.damageOwner
    );

    entity.components.set('explosion', explosionComponent);

    return entity;
  }

  private createExplosionEffect(position: Vector3, radius: number): void {
    // Create visual explosion effect
    const explosionSphere = MeshBuilder.CreateSphere(
      'explosion',
      { diameter: radius * 2 },
      this.scene
    );
    explosionSphere.position = position;

    const material = new StandardMaterial('explosionMat', this.scene);
    material.emissiveColor = new Color3(1, 0.5, 0);
    material.alpha = 0.8;
    explosionSphere.material = material;

    // Animate explosion
    const startTime = performance.now();
    const duration = 500; // 0.5 seconds

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = elapsed / duration;

      if (progress >= 1) {
        explosionSphere.dispose();
        return;
      }

      // Scale and fade
      const scale = 1 + progress * 2;
      const alpha = 1 - progress;

      explosionSphere.scaling.setAll(scale);
      material.alpha = alpha * 0.8;

      requestAnimationFrame(animate);
    };

    animate();
  }

  private applyExplosionDamage(_position: Vector3, _projectile: ProjectileComponent): void {
    // This would need integration with the ECS system to find and damage entities
    // Implementation depends on your entity management system
  }

  private removeProjectile(entity: Entity): void {
    const mesh = this.activeProjectiles.get(entity);

    if (mesh) {
      // Return mesh to pool
      mesh.setEnabled(false);
      mesh.position.setAll(0);

      if (mesh.physicsImpostor) {
        mesh.physicsImpostor.dispose();
        mesh.physicsImpostor = null;
      }

      this.projectilePool.push(mesh);
      this.activeProjectiles.delete(entity);
    }
  }
}
