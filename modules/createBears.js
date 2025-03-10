import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Export the main function to create hippos
export function createBears(scene, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight, BEAR_COUNT) {
    const bears = new THREE.Group();
    
    // Create hippos with movement properties
            for (let i = 0; i < BEAR_COUNT; i++) {
        // Random position on terrain
        const x = (Math.random() - 0.5) * TERRAIN_SIZE * 0.7;
        const z = (Math.random() - 0.5) * TERRAIN_SIZE * 0.7;
        const y = Math.max(getTerrainHeight(x, z), WATER_LEVEL) + 5;
        
        const position = new THREE.Vector3(x, y, z);
        
        // Create hippo group
        const bearGroup = new THREE.Group();
        bearGroup.position.copy(position);
        
        // Create temporary placeholder
        const tempGeometry = new THREE.BoxGeometry(6, 4, 8);
        const tempMaterial = new THREE.MeshStandardMaterial({ color: 0xff69b4 });
        const tempBear = new THREE.Mesh(tempGeometry, tempMaterial);
        tempBear.castShadow = true;
        bearGroup.add(tempBear);
        
        // Add movement properties
        bearGroup.userData = { 
            id: Math.random(),
            speed: 0.2,
            radius: 50 + Math.random() * 200,
            height: position.y,
            angle: Math.random() * Math.PI * 2,
            lastTerrainY: y,
            // Add model container to apply terrain tilt separately
            modelContainer: new THREE.Group()
        };

        // Add the model container to the hippo group
        bearGroup.add(bearGroup.userData.modelContainer);
        
        // Load 3D model into the container instead of directly to the hippo group
        const loader = new GLTFLoader();
        loader.load('./assets/bear.glb', (gltf) => {
            bearGroup.remove(tempBear); // Remove placeholder
            
            const model = gltf.scene;
            model.scale.set(66, 66, 66);
            // rotate model 90 degrees on the x axis
            model.rotation.y = -Math.PI / 2;
            model.position.y = 5.5
            
            // Add model to the container, not directly to hippo group
            bearGroup.userData.modelContainer.add(model);
            
            // Enable shadows
            model.traverse((node) => {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                }
            });
            
            console.log("Bear model loaded at position:", bearGroup.position);
        });
        
        bears.add(bearGroup);
    }
    
    scene.add(bears);
    return bears;
}

export function updateBears(bears, time, delta, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight) {
    if (!bears) return;
    
    bears.children.forEach(bear => {
        const data = bear.userData;
        
        // Store previous position for movement vector
        const prevX = bear.position.x;
        const prevZ = bear.position.z;
        
        // Update bear position in circular path
        data.angle += data.speed * 0.01;
        
        // Calculate new position using circular motion
        const radius = data.radius + Math.sin(data.angle * 2) * 20;
        bear.position.y = Math.cos(data.angle) * radius;
        bear.position.z = Math.sin(data.angle) * radius;
        
        // Calculate movement direction vector
        const moveX = bear.position.x - prevX;
            const moveZ = bear.position.z - prevZ;
        const moveMagnitude = Math.sqrt(moveX * moveX + moveZ * moveZ);
        
        if (moveMagnitude > 0.001) {
            const dirX = moveX / moveMagnitude;
            const dirZ = moveZ / moveMagnitude;
            
            // Sample terrain height at current position
            const currentY = getTerrainHeight(bear.position.x, bear.position.z);
            
            // Sample terrain height at a point slightly ahead in movement direction
            const aheadDist = 10;  // Sample 10 units ahead for slope calculation
            const aheadX = bear.position.x + dirX * aheadDist;
            const aheadZ = bear.position.z + dirZ * aheadDist;
            const aheadY = getTerrainHeight(aheadX, aheadZ);
            
            // Calculate slope angle
            const terrainAngle = Math.atan2(aheadY - currentY, aheadDist);
            
            // Make hippo follow terrain height with a slight offset
            const terrainY = currentY;
            data.lastTerrainY = terrainY;
            bear.position.y = Math.max(terrainY, WATER_LEVEL) + 2;
            
            // Make hippo face movement direction (yaw/horizontal rotation)
                bear.rotation.y = -data.angle + Math.PI / 2;
            
            // Apply pitch/vertical rotation to the model container for terrain slope
            if (data.modelContainer) {
                // Apply terrain-following tilt with smoothing
                data.modelContainer.rotation.y = terrainAngle + 1;

                data.modelContainer.position.y = 3
                
                // Optional: add a roll component for more natural movement on slopes
                const lateralSlope = Math.sin(data.angle * 3) * 0.3;
                data.modelContainer.rotation.z = lateralSlope;
            }
        }
        
        // Add slight bobbing for running animation
        bear.position.y += Math.sin(time * data.speed * 10) * 0.5;
    });
}