import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Water } from 'three/addons/objects/Water.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';

// Main scene variables
let scene, camera, renderer, controls;
let terrain, water, sky, sun, directionalLight, clouds, birds;
let clock = new THREE.Clock();

// Parameters
const TERRAIN_SIZE = 1000;
const TERRAIN_SEGMENTS = 33;
const TERRAIN_HEIGHT = 60;
const WATER_LEVEL = 0;
const SUN_HEIGHT = 400;
const TREE_COUNT = 100;
const CLOUD_COUNT = 20;
const BIRD_COUNT = 2;

// Initialize the scene
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    
    // Add fog for atmosphere
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.0015);
    
    // Create camera
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10000);
    camera.position.set(12, 70, 150);
    camera.lookAt(0, 0, 0);
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('scene'),
        antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.5;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Add controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 50;
    controls.maxDistance = 500;
    controls.maxPolarAngle = Math.PI / 2 - 0.1;
    
    // Create scene elements
    createSky();
    createLighting();
    createTerrain();
    createWater();
    createTrees();
    createClouds();
    createBirds();
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);
    
    // Add event listeners
    window.addEventListener('resize', onWindowResize);
    
    // Start animation loop
    animate();
}

// Create lighting
function createLighting() {
    // Add directional light (sun)
    directionalLight = new THREE.DirectionalLight(0xfffafa, 1);
    directionalLight.position.set(100, 100, 100);
    directionalLight.castShadow = true;
    
    // Configure shadow properties
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    
    // Increase shadow camera size to cover the terrain
    const shadowSize = TERRAIN_SIZE / 2;
    directionalLight.shadow.camera.left = -shadowSize;
    directionalLight.shadow.camera.right = shadowSize;
    directionalLight.shadow.camera.top = shadowSize;
    directionalLight.shadow.camera.bottom = -shadowSize;
    
    directionalLight.shadow.bias = -0.001;
    
    scene.add(directionalLight);
    
    // Add hemisphere light for better ambient lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    hemiLight.position.set(0, 300, 0);
    scene.add(hemiLight);
}

// Create sky with sun
function createSky() {
    sky = new Sky();
    sky.scale.setScalar(10000);
    scene.add(sky);
    
    sun = new THREE.Vector3();
    
    const skyParams = {
        turbidity: 10,
        rayleigh: 2,
        mieCoefficient: 0.005,
        mieDirectionalG: 0.8,
        elevation: 30,
        azimuth: 180,
        exposure: renderer.toneMappingExposure
    };
    
    const sunSphere = new THREE.Mesh(
        new THREE.SphereGeometry(20, 16, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    sunSphere.position.y = SUN_HEIGHT;
    scene.add(sunSphere);
    
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    
    function updateSun() {
        const phi = THREE.MathUtils.degToRad(90 - skyParams.elevation);
        const theta = THREE.MathUtils.degToRad(skyParams.azimuth);
        
        sun.setFromSphericalCoords(1, phi, theta);
        
        sunSphere.position.x = sun.x * SUN_HEIGHT;
        sunSphere.position.y = sun.y * SUN_HEIGHT;
        sunSphere.position.z = sun.z * SUN_HEIGHT;
        
        sky.material.uniforms['sunPosition'].value.copy(sun);
        
        if (water) {
            water.material.uniforms['sunDirection'].value.copy(sun).normalize();
        }
        
        // Update directional light position to match sun position
        if (directionalLight) {
            directionalLight.position.set(
                sun.x * 100,
                sun.y * 100,
                sun.z * 100
            );
        }
        
        scene.environment = pmremGenerator.fromScene(sky).texture;
    }
    
    const skyUniforms = sky.material.uniforms;
    skyUniforms['turbidity'].value = skyParams.turbidity;
    skyUniforms['rayleigh'].value = skyParams.rayleigh;
    skyUniforms['mieCoefficient'].value = skyParams.mieCoefficient;
    skyUniforms['mieDirectionalG'].value = skyParams.mieDirectionalG;
    
    updateSun();
}

// Create terrain using simplex noise
function createTerrain() {
    const geometry = new THREE.PlaneGeometry(
        TERRAIN_SIZE, 
        TERRAIN_SIZE, 
        TERRAIN_SEGMENTS, 
        TERRAIN_SEGMENTS
    );
    geometry.rotateX(-Math.PI / 2);
    
    // Apply simplex noise to create heights
    const simplex = new SimplexNoise();
    const vertices = geometry.attributes.position.array;
    
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const z = vertices[i + 2];
        
        // Multiple noise layers for more interesting terrain
        const noise1 = simplex.noise(x * 0.001, z * 0.001);
        const noise2 = simplex.noise(x * 0.01, z * 0.01) * 0.3;
        const noise3 = simplex.noise(x * 0.05, z * 0.05) * 0.1;
        
        let height = (noise1 + noise2 + noise3) * TERRAIN_HEIGHT;
        
        // Flatten areas below water level
        if (height < WATER_LEVEL + 2) {
            height = WATER_LEVEL - 2 + Math.random() * 1;
        }
        
        vertices[i + 1] = height;
    }
    
    // Compute normals for proper lighting
    geometry.computeVertexNormals();
    
    // Create terrain material
    const material = new THREE.MeshPhongMaterial({
        color: 0x3d9e56,
        flatShading: true,
        shininess: 0,
        vertexColors: false
    });
    
    // Add some sandy beach color near water
    const colors = [];
    for (let i = 0; i < vertices.length; i += 3) {
        const y = vertices[i + 1];
        if (y < WATER_LEVEL + 5) {
            material.vertexColors = true;
            colors.push(0.76, 0.7, 0.5); // Sandy color
        } else if (y < WATER_LEVEL + 15) {
            material.vertexColors = true;
            // Blend between sand and grass
            const blend = (y - (WATER_LEVEL + 5)) / 10;
            colors.push(
                0.76 * (1 - blend) + 0.2 * blend,
                0.7 * (1 - blend) + 0.6 * blend,
                0.5 * (1 - blend) + 0.3 * blend
            );
        } else {
            colors.push(0.2, 0.6, 0.3); // Grass color
        }
    }
    
    if (material.vertexColors) {
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    }
    
    terrain = new THREE.Mesh(geometry, material);
    terrain.receiveShadow = true;
    scene.add(terrain);
}

// Create reflective water
function createWater() {
    const waterGeometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE);
    
    water = new Water(
        waterGeometry,
        {
            textureWidth: 512,
            textureHeight: 512,
            waterNormals: new THREE.TextureLoader().load('https://threejs.org/examples/textures/waternormals.jpg', function(texture) {
                texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            }),
            sunDirection: new THREE.Vector3(),
            sunColor: 0xffffff,
            waterColor: 0x001e0f,
            distortionScale: 3.7,
            fog: scene.fog !== undefined
        }
    );
    
    water.rotation.x = -Math.PI / 2;
    water.position.y = WATER_LEVEL;
    
    scene.add(water);
}

// Create low-poly trees
function createTrees() {
    // Find positions on terrain that are above water level
    const potentialPositions = [];
    const terrainVertices = terrain.geometry.attributes.position.array;
    
    for (let i = 0; i < terrainVertices.length; i += 3) {
        const x = terrainVertices[i];
        const y = terrainVertices[i + 1];
        const z = terrainVertices[i + 2];
        
        // Only place trees on terrain above water + 5 units
        if (y > WATER_LEVEL + 5) {
            potentialPositions.push(new THREE.Vector3(x, y, z));
        }
    }
    
    // Function to create a single tree
    function createTree(position, size) {
        const treeGroup = new THREE.Group();
        
        // Create trunk
        const trunkGeometry = new THREE.CylinderGeometry(size * 0.5, size * 0.7, size * 4, 5);
        const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = size * 2;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        treeGroup.add(trunk);
        
        // Create foliage (low-poly style)
        const foliageGeometry = new THREE.IcosahedronGeometry(size * 3, 0);
        const foliageMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x2d4c1e,
            flatShading: true
        });
        const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
        foliage.position.y = size * 6;
        foliage.castShadow = true;
        foliage.receiveShadow = true;
        treeGroup.add(foliage);
        
        // Position the tree
        treeGroup.position.set(position.x, position.y, position.z);
        
        // Random rotation for variety
        treeGroup.rotation.y = Math.random() * Math.PI * 2;
        
        return treeGroup;
    }
    
    // Create trees at random positions
    for (let i = 0; i < Math.min(TREE_COUNT, potentialPositions.length); i++) {
        // Pick a random position from potential positions
        const randomIndex = Math.floor(Math.random() * potentialPositions.length);
        const position = potentialPositions[randomIndex];
        
        // Remove the selected position to avoid placing multiple trees at the same spot
        potentialPositions.splice(randomIndex, 1);
        
        // Random tree size
        const size = 1 + Math.random() * 2;
        
        const tree = createTree(position, size);
        scene.add(tree);
    }
}

// Create low-poly clouds
function createClouds() {
    clouds = new THREE.Group();
    
    // Function to create a single cloud
    function createCloud(x, y, z, scale) {
        const cloudGroup = new THREE.Group();
        
        // Create multiple cloud puffs
        const puffCount = 3 + Math.floor(Math.random() * 3);
        const cloudMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xffffff,
            flatShading: false,
            transparent: true,
            opacity: 0.9
        });
        
        for (let i = 0; i < puffCount; i++) {
            const puffSize = (0.5 + Math.random() * 0.5) * scale;
            const puffGeometry = new THREE.IcosahedronGeometry(puffSize, 1);
            
            const puff = new THREE.Mesh(puffGeometry, cloudMaterial);
            
            // Position puffs to form a cloud shape
            const angle = (i / puffCount) * Math.PI * 2;
            const offsetX = Math.cos(angle) * scale * 0.5;
            const offsetZ = Math.sin(angle) * scale * 0.5;
            const offsetY = Math.random() * scale * 0.2;
            
            puff.position.set(offsetX, offsetY, offsetZ);
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
        const y = 100 + Math.random() * 100;
        const z = (Math.random() - 0.5) * TERRAIN_SIZE;
        
        // Random cloud size
        const scale = 10 + Math.random() * 15;
        
        const cloud = createCloud(x, y, z, scale);
        clouds.add(cloud);
    }
    
    scene.add(clouds);
}

// Create low-poly birds
function createBirds() {
    birds = new THREE.Group();
    
    // Function to create a single bird
    function createBird(position, size) {
        const birdGroup = new THREE.Group();
        
        // Create bird body
        const bodyGeometry = new THREE.ConeGeometry(size, size * 3, 4);
        const bodyMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x222222,
            flatShading: true
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.rotation.x = Math.PI / 2;
        birdGroup.add(body);
        
        // Create wings
        const wingGeometry = new THREE.PlaneGeometry(size * 4, size * 1.5);
        const wingMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x222222,
            side: THREE.DoubleSide,
            flatShading: true
        });
        
        const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
        leftWing.position.set(-size * 1.5, 0, 0);
        leftWing.rotation.y = Math.PI / 4;
        birdGroup.add(leftWing);
        
        const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
        rightWing.position.set(size * 1.5, 0, 0);
        rightWing.rotation.y = -Math.PI / 4;
        birdGroup.add(rightWing);
        
        // Position the bird
        birdGroup.position.copy(position);
        
        // Add unique ID and flight data for animation
        birdGroup.userData = { 
            id: Math.random(),
            speed: 0.3 + Math.random() * 0.3,
            wingSpeed: 0.1 + Math.random() * 0.2,
            radius: 50 + Math.random() * 200,
            height: position.y,
            angle: Math.random() * Math.PI * 2,
            wingAngle: 0
        };
        
        return birdGroup;
    }
    
    // Create birds at random positions
    for (let i = 0; i < BIRD_COUNT; i++) {
        // Random position
        const x = (Math.random() - 0.5) * TERRAIN_SIZE * 0.7;
        const y = 50 + Math.random() * 100;
        const z = (Math.random() - 0.5) * TERRAIN_SIZE * 0.7;
        const position = new THREE.Vector3(x, y, z);
        
        // Random bird size
        const size = 1 + Math.random() * 1.5;
        
        const bird = createBird(position, size);
        birds.add(bird);
    }
    
    scene.add(birds);
}

// Handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    const time = clock.getElapsedTime();
    
    // Update water animation
    if (water) {
        water.material.uniforms['time'].value = time;
    }
    
    // Update cloud positions
    if (clouds) {
        clouds.children.forEach(cloud => {
            cloud.position.x += cloud.userData.speed;
            
            // If cloud moves off the terrain, reset it to the other side
            if (cloud.position.x > TERRAIN_SIZE / 2) {
                cloud.position.x = -TERRAIN_SIZE / 2;
                cloud.position.z = (Math.random() - 0.5) * TERRAIN_SIZE;
            }
        });
    }
    
    // Update bird animation
    if (birds) {
        birds.children.forEach(bird => {
            const data = bird.userData;
            
            // Update bird position in circular flight
            data.angle += data.speed * 0.01;
            bird.position.x = Math.cos(data.angle) * data.radius;
            bird.position.z = Math.sin(data.angle) * data.radius;
            bird.position.y = data.height + Math.sin(data.angle * 2) * 10;
            
            // Make bird face the direction it's flying
            bird.rotation.y = -data.angle + Math.PI / 2;
            
            // Animate wings
            data.wingAngle = Math.sin(time * data.wingSpeed * 10) * 0.3;
            if (bird.children[1]) bird.children[1].rotation.y = Math.PI / 4 + data.wingAngle;
            if (bird.children[2]) bird.children[2].rotation.y = -Math.PI / 4 - data.wingAngle;
        });
    }
    
    // Update controls
    controls.update();
    
    // Render scene
    renderer.render(scene, camera);
}

// Start the application
init(); 