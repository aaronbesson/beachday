// Projectile system module - Simplified version

import * as THREE from 'three';

// Store all active projectiles
const projectiles = [];

/**
 * Initialize the projectile system
 * @param {THREE.Scene} scene - The scene to add projectiles to
 */
export function initProjectileSystem(scene) {
    initProjectileSystem.scene = scene;
    return projectiles;
}

/**
 * Create and shoot a projectile
 * @param {THREE.Vector3} startPosition - Starting position
 * @param {THREE.Vector3} direction - Direction to shoot
 */
export function shootProjectile(startPosition, direction) {
    // Make sure we have a scene
    if (!initProjectileSystem.scene) {
        console.error('Projectile system not initialized!');
        return null;
    }
    
    // Create a small sphere for the projectile
    const geometry = new THREE.SphereGeometry(0.3, 8, 8);
    const material = new THREE.MeshBasicMaterial({ color: 0xFF8C00 });
    const projectile = new THREE.Mesh(geometry, material);
    
    // Position the projectile 3 units in front of the camera
    const normalizedDirection = direction.clone().normalize();
    const offset = normalizedDirection.clone().multiplyScalar(3);
    projectile.position.copy(startPosition.clone().add(offset));
    
    // Store velocity with the projectile (fixed value in the direction)
    projectile.userData = {
        velocity: normalizedDirection.clone().multiplyScalar(30),
        creationTime: Date.now()
    };
    
    // Add to scene and projectiles array
    initProjectileSystem.scene.add(projectile);
    projectiles.push(projectile);
    
    return projectile;
}

/**
 * Update all projectiles
 * @param {number} delta - Time delta
 */
export function updateProjectiles(delta) {
    // Move all projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        
        // Skip if invalid
        if (!projectile || !projectile.userData) {
            projectiles.splice(i, 1);
            continue;
        }
        
        // Move projectile by velocity * delta
        projectile.position.x += projectile.userData.velocity.x * delta;
        projectile.position.y += projectile.userData.velocity.y * delta;
        projectile.position.z += projectile.userData.velocity.z * delta;
        
        // Remove projectiles after 3 seconds
        const age = (Date.now() - projectile.userData.creationTime) / 1000;
        if (age > 3) {
            initProjectileSystem.scene.remove(projectile);
            projectiles.splice(i, 1);
        }
    }
} 