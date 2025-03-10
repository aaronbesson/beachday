import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Export the main function to create hippos
export function createHippos(scene, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight, HIPPO_COUNT) {
    const hippos = new THREE.Group();
    
    // Create hippos with movement properties
    for (let i = 0; i < HIPPO_COUNT; i++) {
        // Random position on terrain
        const x = (Math.random() - 0.5) * TERRAIN_SIZE * 0.7;
        const z = (Math.random() - 0.5) * TERRAIN_SIZE * 0.7;
        const y = Math.max(getTerrainHeight(x, z), WATER_LEVEL) + 5;
        
        const position = new THREE.Vector3(x, y, z);
        
        // Create hippo group
        const hippoGroup = new THREE.Group();
        hippoGroup.position.copy(position);
        
        // Create temporary placeholder
        const tempGeometry = new THREE.BoxGeometry(6, 4, 8);
        const tempMaterial = new THREE.MeshStandardMaterial({ color: 0xff69b4 });
        const tempHippo = new THREE.Mesh(tempGeometry, tempMaterial);
        tempHippo.castShadow = true;
        hippoGroup.add(tempHippo);
        
        // Add movement properties
        hippoGroup.userData = { 
            id: Math.random(),
            speed: 0.3 + Math.random() * 0.1,
            radius: 50 + Math.random() * 200,
            height: position.y,
            angle: Math.random() * Math.PI * 2,
            lastTerrainY: y,
            // Add model container to apply terrain tilt separately
            modelContainer: new THREE.Group()
        };

        // Add the model container to the hippo group
        hippoGroup.add(hippoGroup.userData.modelContainer);
        
        // Load 3D model into the container instead of directly to the hippo group
        const loader = new GLTFLoader();
        loader.load('./assets/hippo.glb', (gltf) => {
            hippoGroup.remove(tempHippo); // Remove placeholder
            
            const model = gltf.scene;
            model.scale.set(40, 40, 40);
            // rotate model 90 degrees on the x axis
            model.rotation.y = -Math.PI / 2;
            model.position.y = 5.5
            
            // Add model to the container, not directly to hippo group
            hippoGroup.userData.modelContainer.add(model);
            
            // Enable shadows
            model.traverse((node) => {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                }
            });
            
            console.log("Hippo model loaded at position:", hippoGroup.position);
        });
        
        hippos.add(hippoGroup);
    }
    
    scene.add(hippos);
    return hippos;
}

export function updateHippos(hippos, time, delta, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight) {
    if (!hippos) return;
    
    hippos.children.forEach(hippo => {
        const data = hippo.userData;
        
        // Store previous position for movement vector
        const prevX = hippo.position.x;
        const prevZ = hippo.position.z;
        
        // Update hippo position in circular path
        data.angle += data.speed * 0.01;
        
        // Calculate new position using circular motion
        const radius = data.radius + Math.sin(data.angle * 2) * 20;
        hippo.position.y = Math.cos(data.angle) * radius;
        hippo.position.z = Math.sin(data.angle) * radius;
        
        // Calculate movement direction vector
        const moveX = hippo.position.x - prevX;
        const moveZ = hippo.position.z - prevZ;
        const moveMagnitude = Math.sqrt(moveX * moveX + moveZ * moveZ);
        
        if (moveMagnitude > 0.001) {
            const dirX = moveX / moveMagnitude;
            const dirZ = moveZ / moveMagnitude;
            
            // Sample terrain height at current position
            const currentY = getTerrainHeight(hippo.position.x, hippo.position.z);
            
            // Sample terrain height at a point slightly ahead in movement direction
            const aheadDist = 10;  // Sample 10 units ahead for slope calculation
            const aheadX = hippo.position.x + dirX * aheadDist;
            const aheadZ = hippo.position.z + dirZ * aheadDist;
            const aheadY = getTerrainHeight(aheadX, aheadZ);
            
            // Calculate slope angle
            const terrainAngle = Math.atan2(aheadY - currentY, aheadDist);
            
            // Make hippo follow terrain height with a slight offset
            const terrainY = currentY;
            data.lastTerrainY = terrainY;
            hippo.position.y = Math.max(terrainY, WATER_LEVEL) + 2;
            
            // Make hippo face movement direction (yaw/horizontal rotation)
                hippo.rotation.y = -data.angle + Math.PI / 2;
            
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
        hippo.position.y += Math.sin(time * data.speed * 10) * 0.5;
    });
}