import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getHousePosition, getHouseFootprint } from './createHouse.js';

// State variables for boss behavior
let playerTrail = [];
let isChasing = false;
let chaseStartTime = 0;
let chaseDelayTimer = null;
let bossSound = null;
let lastSoundTime = 0;
let bosses = null;

// Boss constants
const CHASE_DURATION = 10000; // 10 seconds in milliseconds
const CHASE_TRIGGER_DISTANCE = 20;
const CHASE_DELAY = 1000; // 1 second delay before chase starts
const BOSS_CHASE_DISTANCE = 200; // Distance at which boss notices player
const SOUND_COOLDOWN = 2000; // 2 seconds cooldown between sounds

// Load boss data from JSON
async function loadBossData() {
    if (bosses !== null) return bosses;
    
    try {
        const response = await fetch('./bosses.json');
        const data = await response.json();
        bosses = data.levelBosses;
        return bosses;
    } catch (error) {
        console.error('Error loading boss data:', error);
        return [];
    }
}

// Main function to create a level boss
export async function createLevelBoss(scene, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight, bossName = null, count = 1) {
    // Load all boss data
    const allBosses = await loadBossData();
    if (allBosses.length === 0) {
        console.error('No boss data available');
        return null;
    }
    
    // If no specific boss is requested, use the first one from the JSON
    const bossData = bossName ? 
        allBosses.find(boss => boss.name === bossName) : 
        allBosses[0];
    
    if (!bossData) {
        console.error(`Boss "${bossName}" not found in boss data`);
        return null;
    }
    
    // Create a group for all boss instances
    const bossGroup = new THREE.Group();
    bossGroup.userData = {
        bossType: bossData.name,
        bossData: bossData
    };
    
    // Create specified number of boss instances
    for (let i = 0; i < count; i++) {
        await createBossInstance(bossGroup, bossData, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight);
    }
    
    scene.add(bossGroup);
    
    // Initialize sound
    initBossSound(bossData);
    
    console.log(`Created boss: ${bossData.name}`);
    return bossGroup;
}

// Helper function to get boss data by name
async function getBossByName(name) {
    const bossData = await loadBossData();
    return bossData.find(boss => boss.name === name);
}

// Create an individual boss instance
async function createBossInstance(bossGroup, bossData, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight) {
    // Find a position on land by ensuring terrain height is appropriate based on boss water capability
    let x, z, terrainHeight;
    let attempts = 0;
    const canGoInWater = bossData.water === true;
    
    // Try to find appropriate position
    do {
        x = (Math.random() - 0.5) * TERRAIN_SIZE * 0.7;
        z = (Math.random() - 0.5) * TERRAIN_SIZE * 0.7;
        terrainHeight = getTerrainHeight(x, z);
        attempts++;
        
        // For water bosses, we could choose to spawn them in water or on land
        // For non-water bosses, we need to ensure they spawn on land
        if (canGoInWater) {
            // Water-capable bosses can spawn anywhere, so we're good with any location
            break;
        }
    } while (terrainHeight < WATER_LEVEL + 3 && attempts < 50);
    
    // If we couldn't find a good spot for a land boss, force one
    if (terrainHeight < WATER_LEVEL + 3 && !canGoInWater) {
        // Find a spot near the edge of the terrain which is likely to be above water
        x = (Math.random() - 0.5) * TERRAIN_SIZE * 0.6 + (Math.random() > 0.5 ? 1 : -1) * TERRAIN_SIZE * 0.3;
        z = (Math.random() - 0.5) * TERRAIN_SIZE * 0.6 + (Math.random() > 0.5 ? 1 : -1) * TERRAIN_SIZE * 0.3;
        terrainHeight = getTerrainHeight(x, z);
    }
    
    const y = Math.max(terrainHeight, WATER_LEVEL + 3) + 5;
    const position = new THREE.Vector3(x, y, z);
    
    // Create boss instance group
    const bossInstance = new THREE.Group();
    bossInstance.position.copy(position);
    
    // Create temporary placeholder
    const tempGeometry = new THREE.BoxGeometry(6, 4, 8);
    const tempMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
    const tempBoss = new THREE.Mesh(tempGeometry, tempMaterial);
    tempBoss.castShadow = true;
    bossInstance.add(tempBoss);
    
    // Get speed from boss data (with fallback to default value)
    const bossSpeed = bossData.speed !== undefined ? bossData.speed / 5 : 1; // Normalize speed where 5 = 1.0 (normal speed)
    
    // Add movement properties
    bossInstance.userData = { 
        id: Math.random(),
        speed: bossSpeed * 8, // Scale the base speed based on boss speed
        radius: 50 + Math.random() * 200,
        height: position.y,
        angle: -Math.random() * Math.PI * 2,
        lastTerrainY: y,
        bossData: bossData,
        // Add model container to apply terrain tilt separately
        modelContainer: new THREE.Group()
    };
    
    // Add the model container to the boss group
    bossInstance.add(bossInstance.userData.modelContainer);
    
    // Load 3D model
    const modelPath = `./assets/${bossData.model}`;
    await loadBossModel(bossInstance, modelPath, tempBoss);
    
    bossGroup.add(bossInstance);
    return bossInstance;
}

// Load boss 3D model
function loadBossModel(bossInstance, modelPath, tempBoss) {
    return new Promise((resolve) => {
        const loader = new GLTFLoader();
        loader.load(modelPath, (gltf) => {
            bossInstance.remove(tempBoss); // Remove placeholder
            
            const model = gltf.scene;
            
            // Apply default scaling and rotation for wolf model
            // These could be made configurable per boss type in the future
            model.scale.set(47, 47, 47);
            model.rotation.y = -Math.PI * 0.5;
            model.position.y = 2;
            
            // Add model to the container, not directly to boss group
            bossInstance.userData.modelContainer.add(model);
            
            // Enable shadows
            model.traverse((node) => {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                }
            });
            
            console.log(`Boss model loaded at position:`, bossInstance.position);
            resolve();
        });
    });
}

// Initialize boss sound
function initBossSound(bossData) {
    // Use the sound property from the boss data if available
    if (!bossSound && bossData && bossData.sound) {
        const soundPath = `/assets/soundfx/${bossData.sound}`;
        console.log(`Loading boss sound: ${soundPath}`);
        bossSound = new Audio(soundPath);
        bossSound.volume = 0.5;
    } else if (!bossSound) {
        // Fallback to wolf sound if no specific sound is defined
        console.log('Using default wolf sound');
        bossSound = new Audio('/assets/soundfx/wolf.mp3');
        bossSound.volume = 0.5;
    }
}

// Add a function to check if the boss would collide with the house
function wouldCollideWithHouse(newX, newZ) {
    const housePos = getHousePosition();
    const house = getHouseFootprint();
    
    if (!housePos || !house) {
        return false;
    }
    
    // Calculate distance from boss to house center
    const dx = newX - housePos.x;
    const dz = newZ - housePos.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    
    // Check if boss would be inside house footprint (plus a small margin)
    const collisionDistance = house.size / 2 + 10; // Add a margin of 10 units
    
    const collision = distance < collisionDistance;
    if (collision) {
        // Log collision but not too frequently
        if (Math.random() < 0.05) {
            console.log(`Boss collision with house detected! Distance: ${distance.toFixed(2)}, Threshold: ${collisionDistance.toFixed(2)}`);
        }
    }
    
    return collision;
}

// Update boss positions and behaviors
export function updateLevelBoss(bossGroup, time, delta, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight, playerPosition) {
    if (!bossGroup) return;
    
    const bossType = bossGroup.userData.bossType;
    const bossData = bossGroup.userData.bossData;
    
    // PROXIMITY AND CHASE DETECTION
    if (playerPosition) {
        // Check distance to each boss instance
        let playerNearBoss = false;
        let closestDistance = Infinity;
        let closestBoss = null;
        
        bossGroup.children.forEach(boss => {
            const distance = new THREE.Vector3(
                boss.position.x, 
                boss.position.y,
                boss.position.z
            ).distanceTo(new THREE.Vector3(
                playerPosition.x,
                playerPosition.y,
                playerPosition.z
            ));
            
            if (distance < closestDistance) {
                closestDistance = distance;
                closestBoss = boss;
            }
            
            if (distance < BOSS_CHASE_DISTANCE) {
                playerNearBoss = true;
            }
        });

        // Handle chase state changes
        if (playerNearBoss && !isChasing && !chaseDelayTimer) {
            // Start the chase delay timer
            chaseDelayTimer = setTimeout(() => {
                isChasing = true;
                chaseStartTime = Date.now();
                console.log(`${bossType} CHASE STARTED!`);
                chaseDelayTimer = null;
            }, CHASE_DELAY);
        } else if (!playerNearBoss && chaseDelayTimer) {
            // Cancel chase if player moves away during delay
            clearTimeout(chaseDelayTimer);
            chaseDelayTimer = null;
        }

        // Check if chase should end
        if (isChasing && Date.now() - chaseStartTime > CHASE_DURATION) {
            isChasing = false;
            console.log(`${bossType} CHASE ENDED!`);
        }

        // Visual and sound alerts
        const bossAlert = document.getElementById('boss-alert');
        if (bossAlert && playerNearBoss) {
            bossAlert.style.display = 'block';
            setTimeout(() => {
                bossAlert.style.display = 'none';
            }, 300);

            const currentTime = Date.now();
            if (currentTime - lastSoundTime > SOUND_COOLDOWN) {
                if (bossSound) {
                    bossSound.currentTime = 0;
                    bossSound.play().catch(e => console.log(`Error playing ${bossType} sound:`, e));
                    lastSoundTime = currentTime;
                }
                console.log(`${bossType} PROXIMITY ALERT! Distance:`, closestDistance);
            }
        } else if (bossAlert) {
            bossAlert.style.display = 'none';
        }
    }

    // Boss movement logic
    bossGroup.children.forEach(boss => {
        const data = boss.userData;
        // Get the boss speed directly from the boss data
        const bossSpeed = data.bossData?.speed || 5;
        const Y_ROTATION_OFFSET = -Math.PI * -0.5; // Default rotation offset (could be made configurable per boss)
        
        if (isChasing && playerPosition) {
            // CHASE BEHAVIOR
            const directionToPlayer = new THREE.Vector3(
                playerPosition.x - boss.position.x,
                0,
                playerPosition.z - boss.position.z
            ).normalize();

            // Calculate potential new position
            const newX = boss.position.x + directionToPlayer.x * bossSpeed;
            const newZ = boss.position.z + directionToPlayer.z * bossSpeed;
            
            // Check if new position is in water
            const terrainY = getTerrainHeight(newX, newZ);
            const waterDetected = terrainY < WATER_LEVEL + 1;
            const canGoInWater = data.bossData?.water === true;
            const outOfBounds = Math.abs(newX) > TERRAIN_SIZE/2 * 0.8 || Math.abs(newZ) > TERRAIN_SIZE/2 * 0.8;

            // Check if new position would collide with house
            const wouldCollideHouse = wouldCollideWithHouse(newX, newZ);
            
            // Only move if the boss can go to the new position and won't collide with house
            if (!outOfBounds && (canGoInWater || !waterDetected) && !wouldCollideHouse) {
                // Move towards player at increased speed
                boss.position.x = newX;
                boss.position.z = newZ;
                
                // Update height based on terrain and water capability
                if (waterDetected && canGoInWater) {
                    // Special case for goose - floats higher in water
                    if (data.bossData?.name === 'Goose') {
                        boss.position.y = WATER_LEVEL + 4; // Goose floats higher
                    } else {
                        boss.position.y = WATER_LEVEL + 1; // Just above water for swimming
                    }
                } else {
                    boss.position.y = Math.max(terrainY, WATER_LEVEL + 1) + 2;
                }
            } else {
                // If can't move directly toward player, try to circle around obstacle
                // Add a slight adjustment to the angle to try to find a path around obstacles
                if (!data.angle) data.angle = Math.atan2(directionToPlayer.z, directionToPlayer.x);
                data.angle += Math.PI/8; // Small rotation to try finding a path
                
                const circleX = boss.position.x + Math.cos(data.angle) * bossSpeed * 0.5;
                const circleZ = boss.position.z + Math.sin(data.angle) * bossSpeed * 0.5;
                
                // Check if this new position avoids house and water constraints
                const circleTerrainY = getTerrainHeight(circleX, circleZ);
                const circleWaterDetected = circleTerrainY < WATER_LEVEL + 1;
                const circleOutOfBounds = Math.abs(circleX) > TERRAIN_SIZE/2 * 0.8 || Math.abs(circleZ) > TERRAIN_SIZE/2 * 0.8;
                const circleCollideHouse = wouldCollideWithHouse(circleX, circleZ);
                
                // Move if the circling position is valid
                if (!circleOutOfBounds && (canGoInWater || !circleWaterDetected) && !circleCollideHouse) {
                    boss.position.x = circleX;
                    boss.position.z = circleZ;
                    
                    // Update height based on terrain and water capability
                    if (circleWaterDetected && canGoInWater) {
                        // Special case for goose - floats higher in water
                        if (data.bossData?.name === 'Goose') {
                            boss.position.y = WATER_LEVEL + 4; // Goose floats higher
                        } else {
                            boss.position.y = WATER_LEVEL + 1; // Just above water for swimming
                        }
                    } else {
                        boss.position.y = Math.max(circleTerrainY, WATER_LEVEL + 1) + 2;
                    }
                }
            }

            // Reset rotation and then make boss face player with offset
            boss.rotation.set(0, 0, 0);
            boss.lookAt(playerPosition.x, boss.position.y, playerPosition.z);
            boss.rotation.y += Y_ROTATION_OFFSET;

            // Add aggressive bobbing during chase
            boss.position.y += Math.sin(Date.now() * 0.01) * 1.0;

        } else {
            // NORMAL WANDERING BEHAVIOR
            // Store previous position for movement vector
            const prevX = boss.position.x;
            const prevZ = boss.position.z;
            
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
            const newX = boss.position.x + Math.cos(data.angle) * data.speed;
            const newZ = boss.position.z + Math.sin(data.angle) * data.speed;
            
            // Check boundaries
            const terrainY = getTerrainHeight(newX, newZ);
            const outOfBounds = Math.abs(newX) > TERRAIN_SIZE/2 * 0.8 || Math.abs(newZ) > TERRAIN_SIZE/2 * 0.8;
            
            // Check if this boss can go in water (from boss data)
            const canGoInWater = data.bossData?.water === true;
            
            // If boss can't go in water AND water is detected, or if out of bounds
            const waterDetected = terrainY < WATER_LEVEL + 1;
            
            // Check if new position would collide with house
            const wouldCollideHouse = wouldCollideWithHouse(newX, newZ);
            
            if ((waterDetected && !canGoInWater) || outOfBounds || wouldCollideHouse) {
                data.angle += Math.PI + (Math.random() - 0.5) * 1.0;
                data.radius = Math.max(50, data.radius * 0.8);
                boss.position.x = prevX;
                boss.position.z = prevZ;
            } else {
                boss.position.x = newX;
                boss.position.z = newZ;
                
                // Adjust height - if in water and can swim, stay slightly above water level
                if (waterDetected && canGoInWater) {
                    // Special case for goose - floats higher in water
                    if (data.bossData?.name === 'Goose') {
                        boss.position.y = WATER_LEVEL + 12; // Goose floats higher
                    } else {
                        boss.position.y = WATER_LEVEL + 1; // Other water creatures just above water
                    }
                } else {
                    boss.position.y = Math.max(terrainY, WATER_LEVEL + 1) + 2;
                }
            }
            
            // Normal movement animations
            const moveX = boss.position.x - prevX;
            const moveZ = boss.position.z - prevZ;
            if (Math.abs(moveX) > 0.001 || Math.abs(moveZ) > 0.001) {
                // Get the movement direction vector
                const movementVector = new THREE.Vector3(moveX, 0, moveZ);
                
                // Calculate a target point in the opposite direction of movement
                // We need to look in the opposite direction since THREE.js models typically face -Z
                const targetPoint = new THREE.Vector3(
                    boss.position.x - movementVector.x,
                    boss.position.y,
                    boss.position.z - movementVector.z
                );
                
                // Reset rotation and use lookAt - same as chase mode
                boss.rotation.set(0, 0, 0);
                boss.lookAt(targetPoint);
                boss.rotation.y += Y_ROTATION_OFFSET;
            }
            
            // Normal bobbing animation
            boss.position.y += Math.sin(time * data.speed * 10) * 0.5;
        }
    });
}