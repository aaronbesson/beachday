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
let chaseDelayTimer = null;
const CHASE_DURATION = 10000; // 10 seconds in milliseconds
const CHASE_TRIGGER_DISTANCE = 20;
const CHASE_DELAY = 1000; // 1 second delay before chase starts

// Wolf parameters
const WOLF_CHASE_DISTANCE = 200; // Distance at which wolf notices player
const WOLF_CHASE_SPEED = 7.0; // Increased from 1.5 to 15.0 (10x faster)
const WOLF_Y_ROTATION_OFFSET = -Math.PI * -0.5; // Adjust this value to rotate the wolf (currently 90 degrees)
let wolfSound = null;
let lastGrowlTime = 0;
const GROWL_COOLDOWN = 2000; // 2 seconds cooldown between growls

// Initialize wolf sound
function initWolfSound() {
    if (!wolfSound) {
        wolfSound = new Audio('/assets/soundfx/wolf.mp3');
        wolfSound.volume = 0.5;
    }
}

export function updateWolf(wolves, time, delta, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight, playerPosition) {
    if (!wolves) return;
    
    // Initialize sound if not done yet
    initWolfSound();

    // PROXIMITY AND CHASE DETECTION
    if (playerPosition) {
        // Check distance to each wolf
        let playerNearWolf = false;
        let closestDistance = Infinity;
        let closestWolf = null;
        
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
                closestWolf = wolf;
            }
            
            if (distance < WOLF_CHASE_DISTANCE) {
                playerNearWolf = true;
            }
        });

        // Handle chase state changes
        if (playerNearWolf && !isChasing && !chaseDelayTimer) {
            // Start the chase delay timer
            chaseDelayTimer = setTimeout(() => {
                isChasing = true;
                chaseStartTime = Date.now();
                console.log("WOLF CHASE STARTED!");
                chaseDelayTimer = null;
            }, CHASE_DELAY);
        } else if (!playerNearWolf && chaseDelayTimer) {
            // Cancel chase if player moves away during delay
            clearTimeout(chaseDelayTimer);
            chaseDelayTimer = null;
        }

        // Check if chase should end
        if (isChasing && Date.now() - chaseStartTime > CHASE_DURATION) {
            isChasing = false;
            console.log("WOLF CHASE ENDED!");
        }

        // Visual and sound alerts
        const wolfAlert = document.getElementById('wolf-alert');
        if (wolfAlert && playerNearWolf) {
            wolfAlert.style.display = 'block';
            setTimeout(() => {
                wolfAlert.style.display = 'none';
            }, 300);

            const currentTime = Date.now();
            if (currentTime - lastGrowlTime > GROWL_COOLDOWN) {
                if (wolfSound) {
                    wolfSound.currentTime = 0;
                    wolfSound.play().catch(e => console.log("Error playing wolf sound:", e));
                    lastGrowlTime = currentTime;
                }
                console.log("WOLF PROXIMITY ALERT! Distance:", closestDistance);
            }
        } else if (wolfAlert) {
            wolfAlert.style.display = 'none';
        }
    }

    // Wolf movement logic
    wolves.children.forEach(wolf => {
        const data = wolf.userData;
        
        if (isChasing && playerPosition) {
            // CHASE BEHAVIOR
            const directionToPlayer = new THREE.Vector3(
                playerPosition.x - wolf.position.x,
                0,
                playerPosition.z - wolf.position.z
            ).normalize();

            // Move towards player at increased speed
            wolf.position.x += directionToPlayer.x * WOLF_CHASE_SPEED;
            wolf.position.z += directionToPlayer.z * WOLF_CHASE_SPEED;

            // Update terrain height
            const terrainY = getTerrainHeight(wolf.position.x, wolf.position.z);
            wolf.position.y = Math.max(terrainY, WATER_LEVEL + 1) + 2;

            // Reset rotation and then make wolf face player with offset
            wolf.rotation.set(0, 0, 0);
            wolf.lookAt(playerPosition.x, wolf.position.y, playerPosition.z);
            wolf.rotation.y += WOLF_Y_ROTATION_OFFSET;

            // Add aggressive bobbing during chase
            wolf.position.y += Math.sin(Date.now() * 0.01) * 1.0;

        } else {
            // NORMAL WANDERING BEHAVIOR
            // Store previous position for movement vector
            const prevX = wolf.position.x;
            const prevZ = wolf.position.z;
            
            // Occasionally change movement parameters for natural roaming
            if (Math.random() < 0.005) {
                data.speed = 0.3 + Math.random() * 2;
                data.angleChange = (Math.random() - 0.5) * 0.05;
            }
            
            // Add wandering behavior
            if (!data.angleChange) data.angleChange = (Math.random() - 0.5) * 0.02;
            data.angle += data.angleChange;
            data.angle += data.speed * 0.01;
            
            // Update radius occasionally
            if (Math.random() < 0.01) {
                data.radius = 50 + Math.random() * 200;
            }
            
            // Calculate new position
            const radius = data.radius + Math.sin(time * 0.5) * 30;
            const newX = wolf.position.x + Math.cos(data.angle) * data.speed;
            const newZ = wolf.position.z + Math.sin(data.angle) * data.speed;
            
            // Check boundaries
            const terrainY = getTerrainHeight(newX, newZ);
            const outOfBounds = Math.abs(newX) > TERRAIN_SIZE/2 * 0.8 || Math.abs(newZ) > TERRAIN_SIZE/2 * 0.8;
            
            if (terrainY < WATER_LEVEL + 1 || outOfBounds) {
                data.angle += Math.PI + (Math.random() - 0.5) * 1.0;
                data.radius = Math.max(50, data.radius * 0.8);
                wolf.position.x = prevX;
                wolf.position.z = prevZ;
            } else {
                wolf.position.x = newX;
                wolf.position.z = newZ;
                wolf.position.y = Math.max(terrainY, WATER_LEVEL + 1) + 2;
            }
            
            // Normal movement animations
            const moveX = wolf.position.x - prevX;
            const moveZ = wolf.position.z - prevZ;
            if (Math.abs(moveX) > 0.001 || Math.abs(moveZ) > 0.001) {
                // Reset rotation before applying new one
                wolf.rotation.set(0, 0, 0);
                wolf.rotation.y = Math.atan2(moveX, moveZ) + WOLF_Y_ROTATION_OFFSET;
            }
            
            // Normal bobbing animation
            wolf.position.y += Math.sin(time * data.speed * 10) * 0.5;
        }
    });
}