import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Export the main function to create sharks
export function createSharks(scene, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight, SHARK_COUNT) {
    console.log(`Creating ${SHARK_COUNT} sharks with terrain size ${TERRAIN_SIZE}`);
    
    const sharks = new THREE.Group();
    
    // Force sharks to spawn at extreme edges of the map
    // No random positions - explicitly place in distant corners
    for (let i = 0; i < SHARK_COUNT; i++) {
        // Calculate placement position at far edges based on shark index
        const corner = i % 4; // 0, 1, 2, 3 for four corners
        
        // Use 75% of terrain size as distance from center for extreme separation
        const edgeDistance = TERRAIN_SIZE * 0.38; // Very far out
        
        // Assign positions by corner - ensure maximum separation
        let x, z;
        switch(corner) {
            case 0: // Far northeast
                x = edgeDistance;
                z = edgeDistance;
                break;
            case 1: // Far northwest
                x = -edgeDistance;
                z = edgeDistance;
                break;
            case 2: // Far southwest
                x = -edgeDistance;
                z = -edgeDistance;
                break;
            case 3: // Far southeast
                x = edgeDistance;
                z = -edgeDistance;
                break;
        }
        
        // Add some randomness to each corner (but not too much)
        x += (Math.random() - 0.5) * TERRAIN_SIZE * 0.1;
        z += (Math.random() - 0.5) * TERRAIN_SIZE * 0.1;
        
        // Make sure we're in water - check terrain height
        let terrainHeight = getTerrainHeight(x, z);
        
        // If not in water, move toward center until we find water
        let attempts = 0;
        const stepSize = TERRAIN_SIZE * 0.05;
        
        while (terrainHeight > WATER_LEVEL - 3 && attempts < 20) {
            // Move slightly toward center
            x = x * 0.9;
            z = z * 0.9;
            terrainHeight = getTerrainHeight(x, z);
            attempts++;
        }
        
        // If still no water, place in a known deep water location
        if (terrainHeight > WATER_LEVEL - 4) {
            console.log("Could not find water at edge, placing shark in deep water area");
            // Try a position closer to center but still in that quadrant
            x = (corner === 0 || corner === 3) ? TERRAIN_SIZE * 0.25 : -TERRAIN_SIZE * 0.25;
            z = (corner === 0 || corner === 1) ? TERRAIN_SIZE * 0.25 : -TERRAIN_SIZE * 0.25;
        }
        
        // Now create the shark at this position
        console.log(`Shark ${i} placed at position: ${x}, ${z}`);
        
        // Set position below water surface
        const position = new THREE.Vector3(x, WATER_LEVEL - 3 - Math.random() * 6, z);
        
        // Create shark group
        const sharkGroup = new THREE.Group();
        sharkGroup.position.copy(position);
        
        // Create temporary placeholder
        const tempGeometry = new THREE.BoxGeometry(6, 4, 8);
        const tempMaterial = new THREE.MeshStandardMaterial({ color: 0x0077be });
        const tempShark = new THREE.Mesh(tempGeometry, tempMaterial);
        tempShark.castShadow = true;
        sharkGroup.add(tempShark);
        
        // Add movement properties with extreme territory settings
        sharkGroup.userData = { 
            id: Math.random(),
            speed: 0.001,  // Faster movement
            radius: 300 + Math.random() * 800, // Extremely large radius
            waterDepth: 3 + Math.random() * 8,
            angle: Math.random() * Math.PI * 2,
            // Maximum wandering strength
            wanderStrength: 0.3 + Math.random() * 0.4,
            // Very frequent direction changes
            directionChangeTimer: Math.random() * 30,
            directionChangeInterval: 20 + Math.random() * 100,
            // Strict territory centered at spawn position
            territoryX: x,
            territoryZ: z,
            territoryRadius: 500 + Math.random() * 600, // Huge territory
            stuckTime: 0,
            // Flag to indicate if initial teleport has happened
            initialTeleportDone: false,
            modelContainer: new THREE.Group(),
            // Track if this shark ever got close to spawn
            visitedSpawn: false
        };
        
        // Add the model container to the shark group
        sharkGroup.add(sharkGroup.userData.modelContainer);
        
        // Load 3D model
        const loader = new GLTFLoader();
        loader.load('./assets/salmon.glb', (gltf) => {
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
        });
        
        sharks.add(sharkGroup);
    }
    
    scene.add(sharks);
    return sharks;
}

// Modified to ensure sharks stay extremely far apart
export function updateSharks(sharks, time, delta, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight, player) {
    if (!sharks) return;
    
    // Force initial teleportation on first few frames
    // This helps ensure sharks are immediately spread out
    sharks.children.forEach(shark => {
        if (!shark.userData.initialTeleportDone && time > 2) {
            // Force teleport to territory center with slight offset
            const offset = TERRAIN_SIZE * 0.1 * (Math.random() - 0.5);
            shark.position.x = shark.userData.territoryX + offset;
            shark.position.z = shark.userData.territoryZ + offset;
            shark.userData.initialTeleportDone = true;
        }
    });
    
    // Check if player is in water
    const playerInWater = player && Math.abs(player.position.y - WATER_LEVEL) < 2;
    
    // Calculate spawn point position (assumed to be origin)
    const spawnPointX = 0;
    const spawnPointZ = 0;
    
    // Calculate extreme repulsion forces between sharks
    const repulsionForces = [];
    for (let i = 0; i < sharks.children.length; i++) {
        repulsionForces[i] = { x: 0, z: 0 };
        
        // Add anti-spawn-point force
        const shark = sharks.children[i];
        const dxFromSpawn = shark.position.x - spawnPointX;
        const dzFromSpawn = shark.position.z - spawnPointZ;
        const distFromSpawnSquared = dxFromSpawn*dxFromSpawn + dzFromSpawn*dzFromSpawn;
        const distFromSpawn = Math.sqrt(distFromSpawnSquared);
        
        // Extreme repulsion from spawn point (500 unit range)
        if (distFromSpawn < 500) {
            shark.userData.visitedSpawn = true;
            const repulsionStrength = 5.0 * (1 - distFromSpawn / 500);
            
            // Normalized direction away from spawn
            if (distFromSpawn > 0.001) {
                const nx = dxFromSpawn / distFromSpawn;
                const nz = dzFromSpawn / distFromSpawn;
                
                repulsionForces[i].x += nx * repulsionStrength;
                repulsionForces[i].z += nz * repulsionStrength;
            } else {
                // Random direction if exactly at spawn
                const angle = Math.random() * Math.PI * 2;
                repulsionForces[i].x += Math.cos(angle) * 5.0; 
                repulsionForces[i].z += Math.sin(angle) * 5.0;
            }
        }
        
        // Immediate teleport if shark is at spawn and has been there before
        if (distFromSpawn < 100 && shark.userData.visitedSpawn) {
            console.log("Emergency teleport from spawn area!");
            // Force teleport to a distant location
            const angle = Math.random() * Math.PI * 2;
            const distance = TERRAIN_SIZE * 0.4;
            shark.position.x = Math.cos(angle) * distance;
            shark.position.z = Math.sin(angle) * distance;
            
            // Update territory
            shark.userData.territoryX = shark.position.x;
            shark.userData.territoryZ = shark.position.z;
            continue; // Skip rest of processing for this shark
        }
        
        // Calculate repulsion from other sharks with much greater range
        for (let j = 0; j < sharks.children.length; j++) {
            if (i === j) continue; // Skip self
            
            const shark1 = sharks.children[i];
            const shark2 = sharks.children[j];
            
            // Calculate distance between sharks
            const dx = shark2.position.x - shark1.position.x;
            const dz = shark2.position.z - shark1.position.z;
            const distSquared = dx * dx + dz * dz;
            const dist = Math.sqrt(distSquared);
            
            // Extremely long range and strong repulsion (500 units)
            if (dist < 500) {
                // Exponential repulsion strength
                const repulsionStrength = 4.0 * Math.pow(1 - dist / 500, 2);
                
                // Direction away from other shark (normalized)
                const nx = -dx / dist;
                const nz = -dz / dist;
                
                // Add to repulsion forces
                repulsionForces[i].x += nx * repulsionStrength;
                repulsionForces[i].z += nz * repulsionStrength;
            }
        }
    }
    
    // Check for clustering of sharks - teleport more aggressively
    sharks.children.forEach(shark => {
        let neighborCount = 0;
        
        // Count sharks that are very close (within 200 units)
        for (const otherShark of sharks.children) {
            if (shark === otherShark) continue;
            
            const dx = shark.position.x - otherShark.position.x;
            const dz = shark.position.z - otherShark.position.z;
            const distSquared = dx*dx + dz*dz;
            
            if (distSquared < 40000) { // 200^2
                neighborCount++;
            }
        }
        
        // If ANY neighbors are too close, increment stuck time rapidly
        if (neighborCount > 0) {
            shark.userData.stuckTime += delta * 2; // Accelerate stuck counter
        } else {
            shark.userData.stuckTime = 0;
        }
        
        // Faster teleportation trigger (5 seconds)
        if (shark.userData.stuckTime > 5) {
            // Teleport to extreme edges
            const angle = Math.random() * Math.PI * 2;
            const distance = TERRAIN_SIZE * (0.4 + Math.random() * 0.1); // Far from center
            
            const newX = Math.cos(angle) * distance;
            const newZ = Math.sin(angle) * distance;
            
            // Check terrain height at new position
            const newTerrainHeight = getTerrainHeight(newX, newZ);
            if (newTerrainHeight <= WATER_LEVEL - 2) {
                // Position is valid water, teleport there
                shark.position.x = newX;
                shark.position.z = newZ;
                
                // Update territory to new location
                shark.userData.territoryX = newX;
                shark.userData.territoryZ = newZ;
                
                // Reset stuck counter
                shark.userData.stuckTime = 0;
                console.log("Teleported shark to extreme location", newX, newZ);
            }
        }
    });
    
    // Process individual shark movement
    sharks.children.forEach((shark, index) => {
        const data = shark.userData;
        
        // Store previous position
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
            const scentRange = 200; // Reduced range
            if (distToPlayer < scentRange) {
                // Reduced attraction strength
                attractionStrength = Math.min(0.3, (1 - Math.pow(distToPlayer / scentRange, 2)));
                
                // Larger personal space
                if (distToPlayer < 80) {
                    attractionStrength = -1.0;
                }
                
                // Direction from shark to player
                attractionX = (player.position.x - shark.position.x) / distToPlayer;
                attractionZ = (player.position.z - shark.position.z) / distToPlayer;
            }
        }
        
        // Stronger territory attraction
        let territoryX = 0;
        let territoryZ = 0;
        let territoryStrength = 0;
        
        // Calculate distance to territory center
        const distToTerritory = Math.sqrt(
            Math.pow(data.territoryX - shark.position.x, 2) + 
            Math.pow(data.territoryZ - shark.position.z, 2)
        );
        
        // Stronger territory pull
        if (distToTerritory > data.territoryRadius * 0.4) {
            territoryStrength = Math.min(0.5, (distToTerritory - data.territoryRadius * 0.4) / data.territoryRadius);
            territoryX = (data.territoryX - shark.position.x) / distToTerritory;
            territoryZ = (data.territoryZ - shark.position.z) / distToTerritory;
        }
        
        // Direction changes (less frequent)
        if (attractionStrength < 0.3) {
            data.directionChangeTimer -= delta;
            if (data.directionChangeTimer <= 0) {
                // More dramatic direction changes
                data.angle += (Math.random() - 0.5) * Math.PI * 1.5;
                data.directionChangeTimer = data.directionChangeInterval * (0.7 + Math.random() * 0.6);
                // Larger radius changes
                if (Math.random() < 0.5) {
                    data.radius = 100 + Math.random() * 400;
                }
            }
        }
        
        // Update shark position (less dependent on circular motion)
        data.angle += data.speed * 0.005 * (1 - attractionStrength);
        
        // Calculate base movement (reduced circular component)
        const radius = data.radius + Math.sin(data.angle * 2) * 30;
        const baseX = Math.cos(data.angle) * radius * (0.4 - attractionStrength * 0.4);
        const baseZ = Math.sin(data.angle) * radius * (0.4 - attractionStrength * 0.4);
        
        // Enhanced wandering (much stronger)
        const wanderFactor = 1 - attractionStrength * 0.6;
        const wanderX = Math.sin(time * 0.3 + data.id * 10) * data.wanderStrength * radius * wanderFactor * 2.5;
        const wanderZ = Math.cos(time * 0.2 + data.id * 10) * data.wanderStrength * radius * wanderFactor * 2.5;
        
        // Add all components including repulsion and territory
        const playerAttractionX = attractionX * attractionStrength * data.speed * 15;
        const playerAttractionZ = attractionZ * attractionStrength * data.speed * 15;
        
        const territoryAttractionX = territoryX * territoryStrength * data.speed * 10;
        const territoryAttractionZ = territoryZ * territoryStrength * data.speed * 10;
        
        // Apply shark repulsion forces (massively strengthen effect)
        const repulsionX = repulsionForces[index].x * data.speed * 60;
        const repulsionZ = repulsionForces[index].z * data.speed * 60;
        
        // Combine all movement components
        const newX = baseX + wanderX + playerAttractionX + territoryAttractionX + repulsionX;
        const newZ = baseZ + wanderZ + playerAttractionZ + territoryAttractionZ + repulsionZ;
        
        // Check if new position is in water and within bounds
        const terrainY = getTerrainHeight(newX, newZ);
        const outOfBounds = Math.abs(newX) > TERRAIN_SIZE/2 * 0.9 || Math.abs(newZ) > TERRAIN_SIZE/2 * 0.9;
        
        if (terrainY > WATER_LEVEL - 1 || outOfBounds) {
            // If we'd go on land or out of bounds, change direction
            data.angle += Math.PI; // Flip direction 180 degrees
            data.radius = Math.max(100, data.radius * 0.8); // Reduce radius to move inward
            
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