import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Export the main function to create sharks
export function createSharks(scene, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight, SHARK_COUNT) {
    const sharks = new THREE.Group();
    
    // Create sharks with water-only movement properties
    for (let i = 0; i < SHARK_COUNT; i++) {
        // Find a position in water by ensuring terrain height is below water level
        let x, z, terrainHeight;
        let attempts = 0;
        
        // Try to find underwater position
        do {
            // Expanded area for initial shark placement (from 0.7 to 0.9)
            x = (Math.random() - 0.5) * TERRAIN_SIZE * 0.9;
            z = (Math.random() - 0.5) * TERRAIN_SIZE * 0.9;
            terrainHeight = getTerrainHeight(x, z);
            attempts++;
        } while (terrainHeight > WATER_LEVEL - 3 && attempts < 50);
        
        // If we couldn't find a good spot, force one
        if (terrainHeight > WATER_LEVEL - 3) {
            // Find a spot in the middle of the terrain which is likely to be underwater
            x = (Math.random() - 0.5) * TERRAIN_SIZE * 0.3;
            z = (Math.random() - 0.5) * TERRAIN_SIZE * 0.3;
        }
        
        // Set position below water surface
        const position = new THREE.Vector3(x, WATER_LEVEL, z);
        
        // Create shark group
        const sharkGroup = new THREE.Group();
        sharkGroup.position.copy(position);
        
        // Create temporary placeholder
        const tempGeometry = new THREE.BoxGeometry(6, 4, 8);
        const tempMaterial = new THREE.MeshStandardMaterial({ color: 0x0077be });
        const tempShark = new THREE.Mesh(tempGeometry, tempMaterial);
        tempShark.castShadow = true;
        sharkGroup.add(tempShark);
        
        // Add movement properties
        sharkGroup.userData = { 
            id: Math.random(),
            speed: 0.3 + Math.random() * 0.3,
            radius: 50 + Math.random() * 200,
            waterDepth: 3 + Math.random() * 3, // Random depth below water
            angle: Math.random() * Math.PI * 2,
            // Add new movement properties for more freedom
            wanderStrength: 0.05 + Math.random() * 0.1,     // Random wandering intensity
            directionChangeTimer: Math.random() * 200,       // Countdown to direction change
            directionChangeInterval: 100 + Math.random() * 300, // Random interval between direction changes
            // Add model container to apply water movement
            modelContainer: new THREE.Group()
        };
        
        // Add the model container to the shark group
        sharkGroup.add(sharkGroup.userData.modelContainer);
        
        // Load 3D model
        const loader = new GLTFLoader();
        loader.load('./assets/shark.glb', (gltf) => {
            sharkGroup.remove(tempShark); // Remove placeholder
            
            const model = gltf.scene;
            model.scale.set(33, 33, 33);
            model.rotation.y = -Math.PI / 2;
            model.position.y = 6
            
            // Add model to the container
            sharkGroup.userData.modelContainer.add(model);
            
            // Enable shadows
            model.traverse((node) => {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                }
            });
            
            console.log("Shark model loaded underwater at position:", sharkGroup.position);
        });
        
        sharks.add(sharkGroup);
    }
    
    scene.add(sharks);
    return sharks;
}

// Modified to accept player data
export function updateSharks(sharks, time, delta, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight, player) {
    if (!sharks) return;
    
    // Check if player is in water - we'll detect if player's y position is close to water level
    const playerInWater = player && Math.abs(player.position.y - WATER_LEVEL) < 2;
    
    sharks.children.forEach(shark => {
        const data = shark.userData;
        
        // Store previous position for movement vector
        const prevX = shark.position.x;
        const prevZ = shark.position.z;
        
        // Player attraction logic
        let attractionX = 0;
        let attractionZ = 0;
        let attractionStrength = 0;
        
        if (playerInWater) {
            // Calculate distance to player
            const distToPlayer = Math.sqrt(
                Math.pow(player.position.x - shark.position.x, 2) + 
                Math.pow(player.position.z - shark.position.z, 2)
            );
            
            // Only attract sharks within certain range (scent range)
            const scentRange = 300;
            if (distToPlayer < scentRange) {
                // Attraction strength increases as shark gets closer, then decreases when very close
                // This creates a schooling behavior rather than collision
                attractionStrength = Math.min(0.8, (1 - Math.pow(distToPlayer / scentRange, 2)) * 2);
                
                // If very close, create some distance (personal space for shark)
                if (distToPlayer < 30) {
                    attractionStrength = -0.5;
                }
                
                // Direction from shark to player
                attractionX = (player.position.x - shark.position.x) / distToPlayer;
                attractionZ = (player.position.z - shark.position.z) / distToPlayer;
            }
        }
        
        // Decrease direction change timer and change direction if needed
        // Only change direction randomly if not strongly attracted to player
        if (attractionStrength < 0.4) {
            data.directionChangeTimer -= delta;
            if (data.directionChangeTimer <= 0) {
                data.angle += (Math.random() - 0.5) * Math.PI;
                data.directionChangeTimer = data.directionChangeInterval * (0.8 + Math.random() * 0.4);
                if (Math.random() < 0.3) {
                    data.radius = 50 + Math.random() * 200;
                }
            }
        }
        
        // Update shark position with circular base + wandering + player attraction
        data.angle += data.speed * 0.01 * (1 - attractionStrength); // Reduce circling when following player
        
        // Calculate base movement from circular motion (reduced when following player)
        const radius = data.radius + Math.sin(data.angle * 2) * 20;
        const baseX = Math.cos(data.angle) * radius * (1 - attractionStrength);
        const baseZ = Math.sin(data.angle) * radius * (1 - attractionStrength);
        
        // Add wandering effect (reduced when following player)
        const wanderFactor = 1 - attractionStrength * 0.8;
        const wanderX = Math.sin(time * 0.7 + data.id * 10) * data.wanderStrength * radius * wanderFactor;
        const wanderZ = Math.cos(time * 0.5 + data.id * 10) * data.wanderStrength * radius * wanderFactor;
        
        // Add player attraction component
        const playerAttractionX = attractionX * attractionStrength * data.speed * 15;
        const playerAttractionZ = attractionZ * attractionStrength * data.speed * 15;
        
        // Combine all movement components
        const newX = baseX + wanderX + playerAttractionX;
        const newZ = baseZ + wanderZ + playerAttractionZ;
        
        // Check if new position is in water and within bounds
        const terrainY = getTerrainHeight(newX, newZ);
        const outOfBounds = Math.abs(newX) > TERRAIN_SIZE/2 * 0.9 || Math.abs(newZ) > TERRAIN_SIZE/2 * 0.9;
        
        if (terrainY > WATER_LEVEL - 1 || outOfBounds) {
            // If we'd go on land or out of bounds, change direction
            data.angle += Math.PI; // Flip direction 180 degrees
            data.radius = Math.max(50, data.radius * 0.8); // Reduce radius to move inward
            
            // Keep existing position this frame
            shark.position.x = prevX;
            shark.position.z = prevZ;
        } else {
            // Safe to move
            shark.position.x = newX;
            shark.position.z = newZ;
        }
        
        // Always keep sharks at water level
        shark.position.y = WATER_LEVEL;
        
        // Calculate movement direction vector
        const moveX = shark.position.x - prevX;
        const moveZ = shark.position.z - prevZ;
        const moveMagnitude = Math.sqrt(moveX * moveX + moveZ * moveZ);
        
        if (moveMagnitude > 0.001) {
            // Make shark face movement direction
            const angle = Math.atan2(moveX, moveZ);
            shark.rotation.y = angle + Math.PI / 2;
            
            // Add subtle up/down swimming motion
            if (data.modelContainer) {
                data.modelContainer.rotation.x = Math.sin(time * 1.5) * 0.1;
                data.modelContainer.rotation.z = Math.cos(time * 0.7) * 0.05;
            }
        }
        
        // Add slight bobbing for swimming animation
        shark.position.y += Math.sin(time * data.speed * 2) * 0.3;
    });
}