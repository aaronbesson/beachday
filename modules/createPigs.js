import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getHousePosition, getHouseFootprint } from './createHouse.js';

// Function to check if the pig would collide with the house
function wouldCollideWithHouse(newX, newZ) {
    const housePos = getHousePosition();
    const house = getHouseFootprint();
    
    if (!housePos || !house) {
        return false;
    }
    
    // Calculate distance from pig to house center
    const dx = newX - housePos.x;
    const dz = newZ - housePos.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    
    // Check if pig would be inside house footprint (plus a small margin)
    const collisionDistance = house.size / 2 + 5; // Add a margin of 5 units
    
    return distance < collisionDistance;
}

// Export the main function to create pigs
export function createPigs(scene, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight, PIG_COUNT) {
    const pigs = new THREE.Group();
    
    // Create pigs with movement properties
    for (let i = 0; i < PIG_COUNT; i++) {
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
        
        // Create pig group
        const pigGroup = new THREE.Group();
        pigGroup.position.copy(position);
        
        // Create temporary placeholder
        const tempGeometry = new THREE.BoxGeometry(6, 4, 8);
        const tempMaterial = new THREE.MeshStandardMaterial({ color: 0xff69b4 });
        const tempPig = new THREE.Mesh(tempGeometry, tempMaterial);
        tempPig.castShadow = true;
        pigGroup.add(tempPig);

        
        // Add movement properties
        pigGroup.userData = { 
            id: Math.random(),
            speed: 8,
            radius: 50 + Math.random() * 200,
            height: position.y,
            angle: Math.random() * Math.PI * 2,
            lastTerrainY: y,
            // Add model container to apply terrain tilt separately
            modelContainer: new THREE.Group()
        };
        
        // Add the model container to the pig group
        pigGroup.add(pigGroup.userData.modelContainer);
        
        // Load 3D model into the container instead of directly to the pig group
        const loader = new GLTFLoader();
        loader.load('./assets/deer.glb', (gltf) => {
            pigGroup.remove(tempPig); // Remove placeholder
            
            const model = gltf.scene;
            model.scale.set(7, 7, 7);
            // rotate model 90 degrees on the x axis
            model.rotation.y = -Math.PI / 2;
            model.position.y = 2
            // Add model to the container, not directly to pig group
            pigGroup.userData.modelContainer.add(model);
            
            // Enable shadows
            model.traverse((node) => {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                }
            });
            
            console.log("Pig model loaded at position:", pigGroup.position);
        });
        
        pigs.add(pigGroup);
    }
    
    scene.add(pigs);
    return pigs;
}

export function updatePigs(pigs, time, delta, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight) {
    if (!pigs) return;
    
    pigs.children.forEach(pig => {
        const data = pig.userData;
        
        // Store previous position for movement vector
        const prevX = pig.position.x;
        const prevZ = pig.position.z;
        
        // Occasionally change movement parameters for more natural roaming
        if (Math.random() < 0.005) {
            data.speed = 0.3 + Math.random() * 2;
            data.angleChange = (Math.random() - 0.5) * 0.05;
        }
        
        // Add some wandering behavior by changing angle gradually
        if (!data.angleChange) data.angleChange = (Math.random() - 0.5) * 0.02;
        data.angle += data.angleChange;
        
        // Update pig position with more freedom
        data.angle += data.speed * 0.01;
        
        // Occasionally change radius to expand exploration area
        if (Math.random() < 0.01) {
            data.radius = 50 + Math.random() * 200;
        }
        
        // Calculate new position using circular motion with more variation
        const radius = data.radius + Math.sin(time * 0.5) * 30;
        const newX = pig.position.x + Math.cos(data.angle) * data.speed;
        const newZ = pig.position.z + Math.sin(data.angle) * data.speed;
        
        // Check if new position is in water, out of bounds, or colliding with house
        const terrainY = getTerrainHeight(newX, newZ);
        const outOfBounds = Math.abs(newX) > TERRAIN_SIZE/2 * 0.8 || Math.abs(newZ) > TERRAIN_SIZE/2 * 0.8;
        const wouldCollideHouse = wouldCollideWithHouse(newX, newZ);
        
        if (terrainY < WATER_LEVEL + 1 || outOfBounds || wouldCollideHouse) {
            // If we'd go in water, out of bounds, or collide with house, change direction
            data.angle += Math.PI + (Math.random() - 0.5) * 1.0; // Flip with some randomness
            data.radius = Math.max(50, data.radius * 0.8); // Reduce radius to move inward
            
            // Keep existing position this frame
            pig.position.x = prevX;
            pig.position.z = prevZ;
            
            // Debug house collision occasionally
            if (wouldCollideHouse && Math.random() < 0.01) {
                console.log("Pig avoided house collision");
            }
        } else {
            // Safe to move
            pig.position.x = newX;
            pig.position.z = newZ;
        }
        
        // Calculate movement direction vector
        const moveX = pig.position.x - prevX;
        const moveZ = pig.position.z - prevZ;
        const moveMagnitude = Math.sqrt(moveX * moveX + moveZ * moveZ);
        
        if (moveMagnitude > 0.001) {
            const dirX = moveX / moveMagnitude;
            const dirZ = moveZ / moveMagnitude;
            
            // Sample terrain height at current position
            const currentY = getTerrainHeight(pig.position.x, pig.position.z);
            
            // Sample terrain height at a point slightly ahead in movement direction
            const aheadDist = 10;  // Sample 10 units ahead for slope calculation
            const aheadX = pig.position.x + dirX * aheadDist;
            const aheadZ = pig.position.z + dirZ * aheadDist;
            const aheadY = getTerrainHeight(aheadX, aheadZ);
            
            // Calculate slope angle
            const terrainAngle = Math.atan2(aheadY - currentY, aheadDist);
            
            // Make pig follow terrain height with a slight offset
            const terrainY = currentY;
            data.lastTerrainY = terrainY;
            pig.position.y = Math.max(terrainY, WATER_LEVEL + 1) + 2;
            
            // Make pig face movement direction (yaw/horizontal rotation)
            const angle = Math.atan2(moveX, moveZ);
            pig.rotation.y = angle;
            
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
        pig.position.y += Math.sin(time * data.speed * 10) * 0.5;
    });
}