import * as THREE from 'three';

export function createClouds(
    scene,
    TERRAIN_SIZE,
    CLOUD_COUNT
) {
    const clouds = new THREE.Group();
    
    // Function to create a single cloud with higher detail
    function createCloud(x, y, z, scale) {
        const cloudGroup = new THREE.Group();
        
        // Create multiple cloud puffs with higher poly count
        const puffCount = 5 + Math.floor(Math.random() * 5);
        const cloudMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffffff,
            roughness: 0.3,
            metalness: 0.1,
            transparent: true,
            opacity: 0.9,
            emissive: 0xffffff,
            emissiveIntensity: 0.1
        });
        
        for (let i = 0; i < puffCount; i++) {
            const puffSize = (0.5 + Math.random() * 0.5) * scale;
            // Higher detail sphere with displacement for fluffy effect
            const puffGeometry = new THREE.IcosahedronGeometry(puffSize, 3);
            
            // Add noise to puff vertices
            const positions = puffGeometry.attributes.position.array;
            for (let j = 0; j < positions.length; j += 3) {
                const vertex = new THREE.Vector3(positions[j], positions[j+1], positions[j+2]);
                const distance = vertex.length();
                vertex.normalize();
                
                // Add noise based on position
                const noise = Math.sin(vertex.x * 10 + vertex.y * 10) * 0.1 + 
                              Math.sin(vertex.y * 8 + vertex.z * 8) * 0.1;
                
                // Apply noise
                vertex.multiplyScalar(distance * (1 + noise * 0.2));
                positions[j] = vertex.x;
                positions[j+1] = vertex.y;
                positions[j+2] = vertex.z;
            }
            
            puffGeometry.computeVertexNormals();
            
            const puff = new THREE.Mesh(puffGeometry, cloudMaterial.clone());
            
            // Position puffs to form a more natural cloud shape
            const u = i / puffCount;
            const angle = u * Math.PI * 2;
            const radius = scale * 0.5 * (0.8 + Math.random() * 0.4);
            const offsetX = Math.cos(angle) * radius;
            const offsetZ = Math.sin(angle) * radius;
            const offsetY = (Math.random() - 0.5) * scale * 0.3;
            
            puff.position.set(offsetX, offsetY, offsetZ);
            
            // Random rotation for each puff
            puff.rotation.set(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            );
            
            // Vary the brightness slightly
            puff.material.emissiveIntensity = 0.05 + Math.random() * 0.08;
            
            cloudGroup.add(puff);
        }
        
        // Position the cloud
        cloudGroup.position.set(x, y, z);
        
        // Add unique ID for animation
        cloudGroup.userData = { 
            id: Math.random(),
            speed: 0.05 + Math.random() * 0.1
        };
        
        return cloudGroup;
    }
    
    // Create clouds at random positions
    for (let i = 0; i < CLOUD_COUNT; i++) {
        const x = (Math.random() - 0.5) * TERRAIN_SIZE;
        const y = 100 + Math.random() * 300;
        const z = (Math.random() - 0.5) * TERRAIN_SIZE;
        
        // Random cloud size
        const scale = 10 + Math.random() * 20;
        
        const cloud = createCloud(x, y, z, scale);
        clouds.add(cloud);
    }
    
    scene.add(clouds);
    return clouds;
}

// Function to update cloud positions and animations
export function updateClouds(clouds, time, delta, TERRAIN_SIZE) {
    if (!clouds) return;
    
    clouds.children.forEach(cloud => {
        cloud.position.x += cloud.userData.speed * delta;
        
        // If cloud moves off the terrain, reset it to the other side
        if (cloud.position.x > TERRAIN_SIZE / 2) {
            cloud.position.x = -TERRAIN_SIZE / 2;
            cloud.position.z = (Math.random() - 0.5) * TERRAIN_SIZE;
        }
        
        // Subtle cloud pulsing
        cloud.children.forEach((puff, idx) => {
            const pulseSpeed = 0.2 + idx * 0.05;
            const pulseMagnitude = 0.02;
            const pulse = Math.sin(time * pulseSpeed + cloud.userData.id * 10) * pulseMagnitude + 1;
            puff.scale.set(pulse, pulse, pulse);
        });
    });
}