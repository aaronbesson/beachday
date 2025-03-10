import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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
const BOSS_CHASE_SPEED = 7.0;
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
export async function createLevelBoss(scene, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight, bossName = 'Wolf', count = 1) {
    const bossData = await getBossByName(bossName);
    if (!bossData) {
        console.error(`Boss "${bossName}" not found in boss data`);
        return null;
    }
    
    // Create a group for all boss instances
    const bossGroup = new THREE.Group();
    bossGroup.userData = {
        bossType: bossName,
        bossData: bossData
    };
    
    // Create specified number of boss instances
    for (let i = 0; i < count; i++) {
        await createBossInstance(bossGroup, bossData, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight);
    }
    
    scene.add(bossGroup);
    
    // Initialize sound
    initBossSound(bossData);
    
    return bossGroup;
}

// Helper function to get boss data by name
async function getBossByName(name) {
    const bossData = await loadBossData();
    return bossData.find(boss => boss.name === name);
}

// Create an individual boss instance
async function createBossInstance(bossGroup, bossData, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight) {
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
    
    // Create boss instance group
    const bossInstance = new THREE.Group();
    bossInstance.position.copy(position);
    
    // Create temporary placeholder
    const tempGeometry = new THREE.BoxGeometry(6, 4, 8);
    const tempMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
    const tempBoss = new THREE.Mesh(tempGeometry, tempMaterial);
    tempBoss.castShadow = true;
    bossInstance.add(tempBoss);
    
    // Add movement properties
    bossInstance.userData = { 
        id: Math.random(),
        speed: bossData.speed || 5,
        radius: 50 + Math.random() * 200,
        height: position.y,
        angle: Math.random() * Math.PI * 2,
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
            model.rotation.y = -Math.PI / 2;
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
    // For now, just using wolf.mp3, but we could make this configurable per boss type
    if (!bossSound) {
        bossSound = new Audio('/assets/soundfx/wolf.mp3');
        bossSound.volume = 0.5;
    }
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
        const bossSpeed = data.bossData?.speed || 5;
        const Y_ROTATION_OFFSET = -Math.PI * -0.5; // Default rotation offset (could be made configurable per boss)
        
        if (isChasing && playerPosition) {
            // CHASE BEHAVIOR
            const directionToPlayer = new THREE.Vector3(
                playerPosition.x - boss.position.x,
                0,
                playerPosition.z - boss.position.z
            ).normalize();

            // Move towards player at increased speed
            boss.position.x += directionToPlayer.x * BOSS_CHASE_SPEED;
            boss.position.z += directionToPlayer.z * BOSS_CHASE_SPEED;

            // Update terrain height
            const terrainY = getTerrainHeight(boss.position.x, boss.position.z);
            boss.position.y = Math.max(terrainY, WATER_LEVEL + 1) + 2;

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
            
            if (terrainY < WATER_LEVEL + 1 || outOfBounds) {
                data.angle += Math.PI + (Math.random() - 0.5) * 1.0;
                data.radius = Math.max(50, data.radius * 0.8);
                boss.position.x = prevX;
                boss.position.z = prevZ;
            } else {
                boss.position.x = newX;
                boss.position.z = newZ;
                boss.position.y = Math.max(terrainY, WATER_LEVEL + 1) + 2;
            }
            
            // Normal movement animations
            const moveX = boss.position.x - prevX;
            const moveZ = boss.position.z - prevZ;
            if (Math.abs(moveX) > 0.001 || Math.abs(moveZ) > 0.001) {
                // Reset rotation before applying new one
                boss.rotation.set(0, 0, 0);
                boss.rotation.y = Math.atan2(moveX, moveZ) + Y_ROTATION_OFFSET;
            }
            
            // Normal bobbing animation
            boss.position.y += Math.sin(time * data.speed * 10) * 0.5;
        }
    });
}