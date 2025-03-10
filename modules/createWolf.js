import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Export the main function to create wolves
export function createWolf(scene, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight, WOLF_COUNT) {
    const wolves = new THREE.Group();
    
    // Create wolves with movement properties
    for (let i = 0; i < WOLF_COUNT; i++) {
        // Find a position on land by ensuring terrain height is above water level
        let x, z, terrainHeight;
        let attempts = 0;
        
        // Try to find dry land position
        do {
            x = (Math.random() - 0.5) * TERRAIN_SIZE * 0.7;
            z = (Math.random() - 0.5) * TERRAIN_SIZE * 0.7;
            terrainHeight = getTerrainHeight(x, z);
            attempts++;
        } while (terrainHeight < WATER_LEVEL + 3 && attempts < 50);
        
        // If we couldn't find a good spot, force one
        if (terrainHeight < WATER_LEVEL + 3) {
            // Find a spot near the edge of the terrain which is likely to be above water
            x = (Math.random() - 0.5) * TERRAIN_SIZE * 0.6 + (Math.random() > 0.5 ? 1 : -1) * TERRAIN_SIZE * 0.3;
            z = (Math.random() - 0.5) * TERRAIN_SIZE * 0.6 + (Math.random() > 0.5 ? 1 : -1) * TERRAIN_SIZE * 0.3;
            terrainHeight = getTerrainHeight(x, z);
        }
        
        const y = Math.max(terrainHeight, WATER_LEVEL + 3) + 5;
        const position = new THREE.Vector3(x, y, z);
        
        // Create wolf group
        const wolfGroup = new THREE.Group();
        wolfGroup.position.copy(position);
        
        // Create temporary placeholder
        const tempGeometry = new THREE.BoxGeometry(6, 4, 8);
        const tempMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
        const tempWolf = new THREE.Mesh(tempGeometry, tempMaterial);
        tempWolf.castShadow = true;
        wolfGroup.add(tempWolf);

        
        // Add movement properties
        wolfGroup.userData = { 
            id: Math.random(),
            speed: 8,
            radius: 50 + Math.random() * 200,
            height: position.y,
            angle: Math.random() * Math.PI * 2,
            lastTerrainY: y,
            // Add model container to apply terrain tilt separately
            modelContainer: new THREE.Group()
        };
        
        // Add the model container to the wolf group
        wolfGroup.add(wolfGroup.userData.modelContainer);
        
        // Load 3D model into the container instead of directly to the wolf group
        const loader = new GLTFLoader();
        loader.load('./assets/wolf.glb', (gltf) => {
            wolfGroup.remove(tempWolf); // Remove placeholder
            
            const model = gltf.scene;
            model.scale.set(47, 47, 47);
            // rotate model 90 degrees on the x axis
            model.rotation.y = -Math.PI / 2;
            model.position.y = 2
            // Add model to the container, not directly to wolf group
            wolfGroup.userData.modelContainer.add(model);
            
            // Enable shadows
            model.traverse((node) => {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                }
            });
            
            console.log("Wolf model loaded at position:", wolfGroup.position);
        });
        
        wolves.add(wolfGroup);
    }
    
    scene.add(wolves);
    return wolves;
}

// Add these at the top of the file with other state variables
let playerTrail = [];
let isChasing = false;
let chaseStartTime = 0;
const CHASE_DURATION = 10000; // 10 seconds in milliseconds
const CHASE_TRIGGER_DISTANCE = 20;

// Wolf parameters
const WOLF_CHASE_DISTANCE = 200; // Changed back to 20 to match the visual indicator
let wolfSound = null;
let lastGrowlTime = 0;
const GROWL_COOLDOWN = 2000; // 2 seconds cooldown between growls

// Initialize wolf sound
function initWolfSound() {
    if (!wolfSound) {
        wolfSound = new Audio('/assets/soundfx/wolf.mp3');
        wolfSound.volume = 0.5; // Set volume to 50%
    }
}

export function updateWolf(wolves, time, delta, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight, playerPosition) {
    if (!wolves) return;
    
    // Initialize sound if not done yet
    initWolfSound();

    // Original wolf movement logic
    wolves.children.forEach(wolf => {
        const data = wolf.userData;
        
        // Store previous position for movement vector
        const prevX = wolf.position.x;
        const prevZ = wolf.position.z;
        
        // Occasionally change movement parameters for more natural roaming
        if (Math.random() < 0.005) {
            data.speed = 0.3 + Math.random() * 2;
            data.angleChange = (Math.random() - 0.5) * 0.05;
        }
        
        // Add some wandering behavior by changing angle gradually
        if (!data.angleChange) data.angleChange = (Math.random() - 0.5) * 0.02;
        data.angle += data.angleChange;
        
        // Update wolf position with more freedom
        data.angle += data.speed * 0.01;
        
        // Occasionally change radius to expand exploration area
        if (Math.random() < 0.01) {
            data.radius = 50 + Math.random() * 200;
        }
        
        // Calculate new position using circular motion with more variation
        const radius = data.radius + Math.sin(time * 0.5) * 30;
        const newX = wolf.position.x + Math.cos(data.angle) * data.speed;
        const newZ = wolf.position.z + Math.sin(data.angle) * data.speed;
        
        // Check if new position is in water or out of bounds
        const terrainY = getTerrainHeight(newX, newZ);
        const outOfBounds = Math.abs(newX) > TERRAIN_SIZE/2 * 0.8 || Math.abs(newZ) > TERRAIN_SIZE/2 * 0.8;
        
        if (terrainY < WATER_LEVEL + 1 || outOfBounds) {
            // If we'd go in water or out of bounds, change direction
            data.angle += Math.PI + (Math.random() - 0.5) * 1.0; // Flip with some randomness
            data.radius = Math.max(50, data.radius * 0.8); // Reduce radius to move inward
            
            // Keep existing position this frame
            wolf.position.x = prevX;
            wolf.position.z = prevZ;
        } else {
            // Safe to move
            wolf.position.x = newX;
            wolf.position.z = newZ;
        }
        
        // Calculate movement direction vector
        const moveX = wolf.position.x - prevX;
        const moveZ = wolf.position.z - prevZ;
        const moveMagnitude = Math.sqrt(moveX * moveX + moveZ * moveZ);
        
        if (moveMagnitude > 0.001) {
            const dirX = moveX / moveMagnitude;
            const dirZ = moveZ / moveMagnitude;
            
            // Sample terrain height at current position
            const currentY = getTerrainHeight(wolf.position.x, wolf.position.z);
            
            // Sample terrain height at a point slightly ahead in movement direction
            const aheadDist = 10;  // Sample 10 units ahead for slope calculation
            const aheadX = wolf.position.x + dirX * aheadDist;
            const aheadZ = wolf.position.z + dirZ * aheadDist;
            const aheadY = getTerrainHeight(aheadX, aheadZ);
            
            // Calculate slope angle
            const terrainAngle = Math.atan2(aheadY - currentY, aheadDist);
            
            // Make wolf follow terrain height with a slight offset
            const terrainY = currentY;
            data.lastTerrainY = terrainY;
            wolf.position.y = Math.max(terrainY, WATER_LEVEL + 1) + 2;
            
            // Make wolf face movement direction (yaw/horizontal rotation)
            const angle = Math.atan2(moveX, moveZ);
            wolf.rotation.y = angle;
            
            // Apply pitch/vertical rotation to the model container for terrain slope
            if (data.modelContainer) {
                // Apply terrain-following tilt with smoothing
                data.modelContainer.rotation.y = terrainAngle + 1;
                
                // Optional: add a roll component for more natural movement on slopes
                const lateralSlope = Math.sin(data.angle * 5) * 0.4;
                data.modelContainer.rotation.z = lateralSlope;
            }
        }
        
        // Add slight bobbing for running animation
        wolf.position.y += Math.sin(time * data.speed * 10) * 0.5;
    });

    // SIMPLE PROXIMITY DETECTION
    if (playerPosition) {
        // Check distance to each wolf
        let playerNearWolf = false;
        let closestDistance = Infinity;
        
        wolves.children.forEach(wolf => {
            const distance = new THREE.Vector3(
                wolf.position.x, 
                wolf.position.y,
                wolf.position.z
            ).distanceTo(new THREE.Vector3(
                playerPosition.x,
                playerPosition.y,
                playerPosition.z
            ));
            
            if (distance < closestDistance) {
                closestDistance = distance;
            }
            
            if (distance < WOLF_CHASE_DISTANCE) {
                playerNearWolf = true;
            }
        });
        
        // Debug logging
        if (Math.random() < 0.01) {
            console.log("Closest wolf distance:", closestDistance, "Player near wolf:", playerNearWolf);
        }
        
        // Show alert and play sound if player is near wolf
        const wolfAlert = document.getElementById('wolf-alert');
        if (wolfAlert && playerNearWolf) {
            // Visual alert
            wolfAlert.style.display = 'block';
            setTimeout(() => {
                wolfAlert.style.display = 'none';
            }, 300);

            // Sound alert (with cooldown)
            const currentTime = Date.now();
            if (currentTime - lastGrowlTime > GROWL_COOLDOWN) {
                if (wolfSound) {
                    wolfSound.currentTime = 0; // Reset sound to start
                    wolfSound.play().catch(e => console.log("Error playing wolf sound:", e));
                    lastGrowlTime = currentTime;
                }
                console.log("WOLF PROXIMITY ALERT! Distance:", closestDistance);
            }
        } else if (wolfAlert) {
            wolfAlert.style.display = 'none';
        }
    }
}