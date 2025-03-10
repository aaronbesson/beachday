import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Animation components
const animationMixers = new Map();
const clock = new THREE.Clock();

// Export the main function to create wolves
export function createBear(scene, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight, BEAR_COUNT) {
    const bears = new THREE.Group();
    
    // Create wolves with movement properties
    for (let i = 0; i < BEAR_COUNT; i++) {
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
        
        // Create bear group
        const bearGroup = new THREE.Group();
        bearGroup.position.copy(position);
        
        // Create temporary placeholder
        const tempGeometry = new THREE.BoxGeometry(6, 4, 8);
        const tempMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
        const tempBear = new THREE.Mesh(tempGeometry, tempMaterial);
        tempBear.castShadow = true;
        bearGroup.add(tempBear);

        
        // Add movement properties
        bearGroup.userData = { 
            id: Math.random(),
            speed: 0.5,
            radius: 50 + Math.random() * 200,
            height: position.y,
            angle: Math.random() * Math.PI * 2,
            lastTerrainY: y,
            // Add model container to apply terrain tilt separately
            modelContainer: new THREE.Group()
        };
        
        // Add the model container to the bear group
        bearGroup.add(bearGroup.userData.modelContainer);
        
        // Load 3D model into the container instead of directly to the bear group
        const loader = new GLTFLoader();
        loader.load('./assets/bear.glb', (gltf) => {
            bearGroup.remove(tempBear); // Remove placeholder
            
            const model = gltf.scene;
            model.scale.set(25, 25, 25);
            // rotate model 90 degrees on the x axis
            model.rotation.y = Math.PI * 1;
            model.position.y = 0;
            // Add model to the container, not directly to bear group
            bearGroup.userData.modelContainer.add(model);
            
            // Enable shadows
            model.traverse((node) => {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                }
            });
            
            // Set up animations
            if (gltf.animations && gltf.animations.length > 0) {
                console.log(`Bear animations found:`, 
                    gltf.animations.map(a => a.name).join(', '));
                
                // Create a mixer for this model
                const mixer = new THREE.AnimationMixer();
                animationMixers.set(bearGroup.userData.id, { 
                    mixer: mixer,
                    scene: model
                });
                
                // Play the first animation 
                const action = mixer.clipAction(gltf.animations[0], model);
                action.setLoop(THREE.LoopRepeat);
                // Start with slower speed for wandering
                action.timeScale = 0.1;
                action.play();
                
                // Store the action reference for speed adjustment during chase
                bearGroup.userData.animationAction = action;
                
                console.log("Started playing bear animation:", gltf.animations[0].name);
            } else {
                console.warn('No animations found in bear model');
            }
            
            console.log("Bear model loaded at position:", bearGroup.position);
        });
        
        bears.add(bearGroup);
    }
    
    scene.add(bears);
    return bears;
}

// Add these at the top of the file with other state variables
let playerTrail = [];
let isChasing = false;
let chaseStartTime = 0;
let chaseDelayTimer = null;
const CHASE_DURATION = 10000; // 10 seconds in milliseconds
const CHASE_TRIGGER_DISTANCE = 20;
const CHASE_DELAY = 1000; // 1 second delay before chase starts

// BEAR parameters
const BEAR_CHASE_DISTANCE = 200; // Distance at which bear notices player
const BEAR_CHASE_SPEED = 7.0; // Increased from 1.5 to 15.0 (10x faster)
const BEAR_Y_ROTATION_OFFSET = Math.PI * 1; // Adjust this value to rotate the bear (currently 90 degrees)
let bearSound = null;
let lastGrowlTime = 0;
const GROWL_COOLDOWN = 2000; // 2 seconds cooldown between growls

// Initialize bear sound
function initBearSound() {
    if (!bearSound) {
        bearSound = new Audio('./assets/soundfx/bear.mp3');
        bearSound.volume = 0.5;
    }
}

export function updateBear(bears, time, delta, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight, playerPosition) {
    if (!bears) return;
    
    // Initialize sound if not done yet
    initBearSound();
    
    // Update all animation mixers with clock delta
    const deltaTime = clock.getDelta();
    animationMixers.forEach(({ mixer }) => {
        mixer.update(deltaTime);
    });

    // PROXIMITY AND CHASE DETECTION
    if (playerPosition) {
        // Check distance to each bear
        let playerNearBear = false;
        let closestDistance = Infinity;
        let closestBear = null;
        
        bears.children.forEach(bear => {
            const distance = new THREE.Vector3(
                bear.position.x, 
                bear.position.y,
                bear.position.z
            ).distanceTo(new THREE.Vector3(
                playerPosition.x,
                playerPosition.y,
                playerPosition.z
            ));
            
            if (distance < closestDistance) {
                closestDistance = distance;
                closestBear = bear;
            }
            
            if (distance < BEAR_CHASE_DISTANCE) {
                playerNearBear = true;
            }
        });

        // Handle chase state changes
        if (playerNearBear && !isChasing && !chaseDelayTimer) {
            // Start the chase delay timer
            chaseDelayTimer = setTimeout(() => {
                isChasing = true;
                chaseStartTime = Date.now();
                console.log("BEAR CHASE STARTED!");
                chaseDelayTimer = null;
            }, CHASE_DELAY);
        } else if (!playerNearBear && chaseDelayTimer) {
            // Cancel chase if player moves away during delay
            clearTimeout(chaseDelayTimer);
            chaseDelayTimer = null;
        }

        // Check if chase should end
        if (isChasing && Date.now() - chaseStartTime > CHASE_DURATION) {
            isChasing = false;
            console.log("BEAR CHASE ENDED!");
        }

        // Visual and sound alerts
        const bearAlert = document.getElementById('wolf-alert');
        if (bearAlert && playerNearBear) {
            bearAlert.style.display = 'block';
            setTimeout(() => {
                bearAlert.style.display = 'none';
            }, 300);

            const currentTime = Date.now();
            if (currentTime - lastGrowlTime > GROWL_COOLDOWN) {
                if (bearSound) {
                    bearSound.currentTime = 0;
                    bearSound.play().catch(e => console.log("Error playing bear sound:", e));
                    lastGrowlTime = currentTime;
                }
                console.log("BEAR PROXIMITY ALERT! Distance:", closestDistance);
            }
        } else if (bearAlert) {
            bearAlert.style.display = 'none';
        }
    }

    // BEAR movement logic
    bears.children.forEach(bear => {
        const data = bear.userData;
        
        if (isChasing && playerPosition) {
            // CHASE BEHAVIOR
            const directionToPlayer = new THREE.Vector3(
                playerPosition.x - bear.position.x,
                0,
                playerPosition.z - bear.position.z
            ).normalize();

            // Move towards player at increased speed
            bear.position.x += directionToPlayer.x * BEAR_CHASE_SPEED;
            bear.position.z += directionToPlayer.z * BEAR_CHASE_SPEED;

            // Update terrain height
            const terrainY = getTerrainHeight(bear.position.x, bear.position.z);
            bear.position.y = Math.max(terrainY, WATER_LEVEL + 1) + 2;

            // Reset rotation and then make bear face player with offset
            bear.rotation.set(0, 0, 0);
            bear.lookAt(playerPosition.x, bear.position.y, playerPosition.z);
            bear.rotation.y += BEAR_Y_ROTATION_OFFSET;

            // Add aggressive bobbing during chase
            bear.position.y += Math.sin(Date.now() * 0.01) * 1.0;
            
            // Speed up animation during chase
            if (data.animationAction && data.animationAction.timeScale !== 1.5) {
                data.animationAction.timeScale = 4;
            }

        } else {
            // NORMAL WANDERING BEHAVIOR
            // Store previous position for movement vector
            const prevX = bear.position.x;
            const prevZ = bear.position.z;
            
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
            const newX = bear.position.x + Math.cos(data.angle) * data.speed;
            const newZ = bear.position.z + Math.sin(data.angle) * data.speed;
            
            // Check boundaries
            const terrainY = getTerrainHeight(newX, newZ);
            const outOfBounds = Math.abs(newX) > TERRAIN_SIZE/2 * 0.8 || Math.abs(newZ) > TERRAIN_SIZE/2 * 0.8;
            
            if (terrainY < WATER_LEVEL + 1 || outOfBounds) {
                data.angle += Math.PI + (Math.random() - 0.5) * 1.0;
                data.radius = Math.max(50, data.radius * 0.8);
                bear.position.x = prevX;
                bear.position.z = prevZ;
            } else {
                bear.position.x = newX;
                bear.position.z = newZ;
                bear.position.y = Math.max(terrainY, WATER_LEVEL + 1) + 2;
            }
            
            // Normal movement animations
            const moveX = bear.position.x - prevX;
            const moveZ = bear.position.z - prevZ;
            if (Math.abs(moveX) > 0.001 || Math.abs(moveZ) > 0.001) {
                // Reset rotation before applying new one
                bear.rotation.set(0, 0, 0);
                bear.rotation.y = Math.atan2(moveX, moveZ) + BEAR_Y_ROTATION_OFFSET;
            }
            
            // Normal bobbing animation
            bear.position.y += Math.sin(time * data.speed * 10) * 0.5;
            
            // Slow down animation during wandering
            if (data.animationAction && data.animationAction.timeScale !== 0.5) {
                data.animationAction.timeScale = 0.5;
            }
        }
    });
}