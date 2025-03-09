import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Water } from 'three/addons/objects/Water.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';

// Import our custom modules
import { PlayerCustomizer } from './playerCustomizer.js';
import { ReplicateAPI } from './replicateApi.js';

// Main scene variables
let scene, camera, renderer, controls, fpControls;
let terrain, water, sky, sun, directionalLight, clouds, birds;
let clock = new THREE.Clock();

// Player settings
let player = {
    speed: 0.5,
    height: 1.0, // Height offset above terrain
    lastGroundY: 0, // Last detected ground height
    model: null, // Will store the squirrel model
    modelOffset: {x: 0, y: -3.0, z: 0} // Offset for the model relative to camera
};

// Movement control state
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let isLocked = false;
let isJumping = false;
let jumpTime = 0;

// Store terrain for height detection
let terrainGeometry;

// Parameters
const TERRAIN_SIZE = 3000;
const TERRAIN_SEGMENTS = 124;
const TERRAIN_HEIGHT = 57;
const WATER_LEVEL = 10;
const SUN_HEIGHT = 400;
const TREE_COUNT = 500;
const CLOUD_COUNT = 12;
const BIRD_COUNT = 2;

// Global variables for our application
let playerCustomizer;

// Initialize the scene
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    
    // Add fog for atmosphere
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.0008);
    
    // Initialize underwater overlay
    const underwaterOverlay = document.getElementById('underwater-overlay');
    if (underwaterOverlay) {
        underwaterOverlay.style.opacity = '0';
    }
    
    // Debug marker removed - squirrel model is visible now
    
    // Create camera
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10000);
    camera.position.set(24, 24, 150);
    camera.lookAt(0, 0, 0);
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('scene'),
        antialias: true,
        precision: 'highp'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.8;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Add orbit controls (for regular view)
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
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);
    
    // Setup first-person controls and player
    setupPlayer();
    
    // Setup event listeners for UI
    setupEventListeners();

    // Print instructions to console
    console.log("WASD or Arrow Keys to move, Space to jump");
    console.log("Click anywhere to enter first-person mode, ESC to exit");
    
    // Start animation loop
    animate();
}

// Set up player and controls
function setupPlayer() {
    // Load the squirrel model
    const loader = new GLTFLoader();
    console.log("Attempting to load squirrel model from ./assets/squirrel.glb");
    
    loader.load('./assets/squirrel.glb', (gltf) => {
        console.log("Squirrel model loaded successfully", gltf);
        player.model = gltf.scene;
        
        // Add the model to the scene
        scene.add(player.model);
        
        // Scale model appropriately - adjust this value if needed
        player.model.scale.set(3, 3, 3);
        
        // Set initial position - raised higher
        player.model.position.set(0, 50, -10); // Start in front of camera
        
        console.log("Squirrel model added to scene at:", player.model.position);
        
        // Initialize player customizer after model is loaded
        playerCustomizer = new PlayerCustomizer(scene, player);
    }, 
    // Progress callback
    (xhr) => {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded');
    }, 
    // Error callback
    (error) => {
        console.error("Error loading squirrel model:", error);
    });

    // Create pointer lock controls (now for third-person)
    fpControls = new PointerLockControls(camera, document.body);
    scene.add(fpControls.getObject());
    
    // Position the camera higher and behind for third-person view
    camera.position.set(0, 60, 30); // Higher and further behind
    fpControls.getObject().position.set(0, 60, 30); // Match camera position
    console.log("Camera initialized at position:", fpControls.getObject().position);
    
    // Add click event to enable pointer lock
    document.addEventListener('click', function(event) {
        // Check if the click is on the customizer UI or any UI element
        if (event.target.closest('#player-customizer') || 
            event.target.closest('.action-button') ||
            event.target.closest('.lightbox')) {
            // Don't activate pointer lock for UI interactions
            return;
        }
        
        console.log("Click detected, locking pointer");
        fpControls.lock();
    });
    
    // Lock/unlock events
    fpControls.addEventListener('lock', function() {
        isLocked = true;
        console.log("Pointer lock enabled - third person active");
        
        // Set initial height above terrain
        const camera = fpControls.getObject();
        const terrainY = getTerrainHeight(camera.position.x, camera.position.z);
        player.lastGroundY = terrainY;
        camera.position.y = terrainY + player.height + 5; // Higher for third-person
        console.log("Initial terrain height:", terrainY, "Player Y:", camera.position.y);
        
        // Hide regular controls
        if (controls) controls.enabled = false;
    });
    
    fpControls.addEventListener('unlock', function() {
        isLocked = false;
        console.log("Pointer lock disabled - returning to orbit mode");
        // Re-enable orbit controls
        if (controls) controls.enabled = true;
    });
}

// Very simple key controls
function setupEventListeners() {
    document.addEventListener('keydown', function(event) {
        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
                moveForward = true;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                moveLeft = true;
                break;
            case 'KeyS':
            case 'ArrowDown':
                moveBackward = true;
                break;
            case 'KeyD':
            case 'ArrowRight':
                moveRight = true;
                break;
            case 'Space':
                // Start jumping if not already jumping
                if (isLocked && !isJumping) {
                    isJumping = true;
                    jumpTime = 0;
                }
                break;
        }
    });
    
    document.addEventListener('keyup', function(event) {
        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
                moveForward = false;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                moveLeft = false;
                break;
            case 'KeyS':
            case 'ArrowDown':
                moveBackward = false;
                break;
            case 'KeyD':
            case 'ArrowRight':
                moveRight = false;
                break;
        }
    });
    
    // Add event listener for the customizer button
    document.getElementById('open-customizer').addEventListener('click', () => {
        if (playerCustomizer) {
            playerCustomizer.toggle();
        }
    });
}

// Create lighting
function createLighting() {
    // Add directional light (sun)
    directionalLight = new THREE.DirectionalLight(0xfffafa, 1.2);
    directionalLight.position.set(100, 100, 100);
    directionalLight.castShadow = true;
    
    // Configure shadow properties
    directionalLight.shadow.mapSize.width = 4096;
    directionalLight.shadow.mapSize.height = 4096;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 800;
    
    // Increase shadow camera size to cover the terrain
    const shadowSize = TERRAIN_SIZE / 1.8;
    directionalLight.shadow.camera.left = -shadowSize;
    directionalLight.shadow.camera.right = shadowSize;
    directionalLight.shadow.camera.top = shadowSize;
    directionalLight.shadow.camera.bottom = -shadowSize;
    
    directionalLight.shadow.bias = -0.0005;
    directionalLight.shadow.normalBias = 0.02;
    
    scene.add(directionalLight);
    
    // Add hemisphere light for better ambient lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    hemiLight.position.set(0, 300, 0);
    scene.add(hemiLight);
    
    // Add subtle point lights for more depth
    const pointLight1 = new THREE.PointLight(0xff7e47, 0.5, 250);
    pointLight1.position.set(100, 50, 100);
    scene.add(pointLight1);
    
    const pointLight2 = new THREE.PointLight(0x4ca7ff, 0.3, 250);
    pointLight2.position.set(-100, 50, -100);
    scene.add(pointLight2);
}

// Create sky with sun
function createSky() {
    sky = new Sky();
    sky.scale.setScalar(10000);
    scene.add(sky);
    
    sun = new THREE.Vector3();
    
    const skyParams = {
        turbidity: 8, // Reduced for clearer sky
        rayleigh: 1.5, // Adjusted for better sky color
        mieCoefficient: 0.005,
        mieDirectionalG: 0.9, // Increased for more pronounced sun glow
        elevation: 30,
        azimuth: 180,
        exposure: renderer.toneMappingExposure
    };
    
    // Instead of creating a visible sun, we'll just track the position
    // for lighting and environment purposes
    
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    
    function updateSun() {
        const phi = THREE.MathUtils.degToRad(90 - skyParams.elevation);
        const theta = THREE.MathUtils.degToRad(skyParams.azimuth);
        
        sun.setFromSphericalCoords(1, phi, theta);
        
        // Update sky with sun position (no visible sun)
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
    
    // Apply simplex noise to create heights with more detail layers
    const simplex = new SimplexNoise();
    const vertices = geometry.attributes.position.array;
    
    // Store height data for physics
    const heightData = [];
    
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const z = vertices[i + 2];
        
        // Multiple noise layers for more interesting detailed terrain
        const noise1 = simplex.noise(x * 0.001, z * 0.001);
        // const noise2 = simplex.noise(x * 0.01, z * 0.01) * 0.3;
        // const noise3 = simplex.noise(x * 0.05, z * 0.05) * 0.1;
        // const noise4 = simplex.noise(x * 0.2, z * 0.2) * 0.05;
        // const noise5 = simplex.noise(x * 0.4, z * 0.4) * 0.025;
        
        let height = (noise1) * 200;
        
        // Smoother transition for underwater areas
        if (height < WATER_LEVEL + 2) {
            height = WATER_LEVEL - 2 + Math.random() * 1;
        }
        
        vertices[i + 1] = height;
        
        // Store height data for reference
        const xIndex = Math.floor((x + TERRAIN_SIZE/2) / (TERRAIN_SIZE/TERRAIN_SEGMENTS));
        const zIndex = Math.floor((z + TERRAIN_SIZE/2) / (TERRAIN_SIZE/TERRAIN_SEGMENTS));
        if (!heightData[zIndex]) heightData[zIndex] = [];
        heightData[zIndex][xIndex] = height;
    }
    
    // Compute normals for proper lighting
    geometry.computeVertexNormals();
    
    // Create terrain material
    const material = new THREE.MeshStandardMaterial({
        color: 0x3d9e56,
        roughness: 2,
        metalness: 0.1,
        flatShading: false,
        vertexColors: false
    });
    
    // Add more detailed color variations
    const colors = [];
    for (let i = 0; i < vertices.length; i += 3) {
        const y = vertices[i + 1];
        
        if (y < WATER_LEVEL + 5) {
            material.vertexColors = true;
            // Sandy beach color with slight variations
            const sandVariation = Math.random() * 0.05;
            colors.push(0.76 + sandVariation, 0.7 + sandVariation, 0.5 + sandVariation);
        } else if (y < WATER_LEVEL + 15) {
            material.vertexColors = true;
            // Blend between sand and grass with more natural transition
            const blend = (y - (WATER_LEVEL + 5)) / 10;
            const greenVariation = Math.random() * 0.05;
            colors.push(
                0.76 * (1 - blend) + (0.2 + greenVariation) * blend,
                0.7 * (1 - blend) + (0.6 + greenVariation) * blend,
                0.5 * (1 - blend) + (0.3 - greenVariation) * blend
            );
        } else if (y < WATER_LEVEL + 40) {
            // Regular grass/vegetation colors with variations
            const greenVariation = Math.random() * 0.1;
            colors.push(0.2 + greenVariation, 0.6 - greenVariation * 0.5, 0.3 - greenVariation);
        } else {
            // Higher elevation - slightly different color for mountain tops
            const stoneVariation = Math.random() * 0.05;
            colors.push(0.6 + stoneVariation, 0.6 + stoneVariation, 0.6 + stoneVariation);
        }
    }
    
    if (material.vertexColors) {
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    }
    
    // Create a bump map for added detail
    const displacementTexture = new THREE.DataTexture(
        new Uint8Array(TERRAIN_SEGMENTS * TERRAIN_SEGMENTS).map(() => Math.random() * 255),
        TERRAIN_SEGMENTS,
        TERRAIN_SEGMENTS,
        THREE.RedFormat
    );
    displacementTexture.needsUpdate = true;
    material.displacementMap = displacementTexture;
    material.displacementScale = 2;
    
    terrain = new THREE.Mesh(geometry, material);
    terrain.receiveShadow = true;
    terrain.castShadow = true;
    scene.add(terrain);
    
    terrainGeometry = geometry;
    
    return terrain;
}

// Create reflective water
function createWater() {
    const waterGeometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, 128, 128);
    
    water = new Water(
        waterGeometry,
        {
            textureWidth: 1024,
            textureHeight: 1024,
            waterNormals: new THREE.TextureLoader().load('https://threejs.org/examples/textures/waternormals.jpg', function(texture) {
                texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(8, 8);
            }),
            sunDirection: new THREE.Vector3(),
            sunColor: 0xffffff,
            waterColor: 0x001e0f,
            distortionScale: 3.7,
            fog: scene.fog !== undefined,
            reflectivity: 0.9
        }
    );
    
    water.rotation.x = -Math.PI / 2;
    water.position.y = WATER_LEVEL + 6;
    
    scene.add(water);
}

// Create trees
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
    
    // Function to create a high-poly tree
    function createTree(position, size) {
        const treeGroup = new THREE.Group();
        
        // Create detailed trunk with texture
        const trunkGeometry = new THREE.CylinderGeometry(size * 0.5, size * 0.7, size * 4, 12, 5);
        const trunkMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x8B4513,
            roughness: 0.9,
            metalness: 0.1,
            onBeforeCompile: shader => {
                shader.vertexShader = shader.vertexShader.replace(
                    '#include <begin_vertex>',
                    `
                    #include <begin_vertex>
                    float noise = sin(position.y * 10.0) * 0.05 + sin(position.y * 20.0 + position.x * 5.0) * 0.02;
                    transformed.x += noise * normal.x;
                    transformed.z += noise * normal.z;
                    `
                );
            }
        });
        
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = size * 2;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        treeGroup.add(trunk);
        
        // Create detailed foliage with multiple layers
        const foliageLayers = 3 + Math.floor(Math.random() * 2);
        const foliageMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x2d4c1e,
            roughness: 0.8,
            metalness: 0.1,
            flatShading: false
        });
        
        for (let i = 0; i < foliageLayers; i++) {
            // Use more detailed geometry
            const foliageGeometry = new THREE.IcosahedronGeometry(
                size * (3 - i * 0.5),
                2
            );
            
            // Add variation to vertices
            const positions = foliageGeometry.attributes.position.array;
            for (let j = 0; j < positions.length; j += 3) {
                positions[j] += (Math.random() - 0.5) * size * 0.1;
                positions[j + 1] += (Math.random() - 0.5) * size * 0.1;
                positions[j + 2] += (Math.random() - 0.5) * size * 0.1;
            }
            foliageGeometry.computeVertexNormals();
            
            const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial.clone());
            
            // Vary colors slightly for each layer
            foliage.material.color.setHSL(
                0.3 + Math.random() * 0.05,
                0.6 + Math.random() * 0.1,
                0.4 + Math.random() * 0.1
            );
            
            foliage.position.y = size * (6 + i * 1.5);
            foliage.castShadow = true;
            foliage.receiveShadow = true;
            treeGroup.add(foliage);
        }
        
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

// Create high-poly clouds
function createClouds() {
    clouds = new THREE.Group();
    
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
        const y = 100 + Math.random() * 100;
        const z = (Math.random() - 0.5) * TERRAIN_SIZE;
        
        // Random cloud size
        const scale = 10 + Math.random() * 20;
        
        const cloud = createCloud(x, y, z, scale);
        clouds.add(cloud);
    }
    
    scene.add(clouds);
}

// Create high-poly birds
function createBirds() {
    birds = new THREE.Group();
    
    // Function to create a single detailed bird
    function createBird(position, size) {
        const birdGroup = new THREE.Group();
        
        // Create bird body with more detail
        const bodyGeometry = new THREE.ConeGeometry(size, size * 3, 8, 3);
        const bodyMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x222222,
            roughness: 0.8,
            metalness: 0.1,
            flatShading: false
        });
        
        // Add noise to body
        const bodyPositions = bodyGeometry.attributes.position.array;
        for (let i = 0; i < bodyPositions.length; i += 3) {
            bodyPositions[i] += (Math.random() - 0.5) * size * 0.1;
            bodyPositions[i + 1] += (Math.random() - 0.5) * size * 0.1;
            bodyPositions[i + 2] += (Math.random() - 0.5) * size * 0.1;
        }
        bodyGeometry.computeVertexNormals();
        
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.rotation.x = Math.PI / 2;
        birdGroup.add(body);
        
        // Create more detailed wings
        const wingShape = new THREE.Shape();
        wingShape.moveTo(0, 0);
        wingShape.quadraticCurveTo(size * 2, size * 0.5, size * 4, 0);
        wingShape.quadraticCurveTo(size * 2, -size * 0.5, 0, 0);
        
        const wingGeometry = new THREE.ShapeGeometry(wingShape, 16);
        const wingMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x222222,
            side: THREE.DoubleSide,
            flatShading: false,
            transparent: true,
            opacity: 0.9
        });
        
        const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
        leftWing.position.set(-size * 0, 0, 0);
        leftWing.rotation.y = Math.PI / 4;
        birdGroup.add(leftWing);
        
        const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
        rightWing.position.set(size * 0, 0, 0);
        rightWing.rotation.y = -Math.PI / 4;
        birdGroup.add(rightWing);
        
        // Add tail feathers
        const tailGeometry = new THREE.ConeGeometry(size * 0.5, size * 2, 4, 1);
        const tail = new THREE.Mesh(tailGeometry, bodyMaterial.clone());
        tail.position.set(0, 0, -size * 2);
        tail.rotation.x = -Math.PI / 6;
        birdGroup.add(tail);
        
        // Add head
        const headGeometry = new THREE.SphereGeometry(size * 0.6, 8, 8);
        const head = new THREE.Mesh(headGeometry, bodyMaterial.clone());
        head.position.set(0, 0, size * 1.8);
        birdGroup.add(head);
        
        // Add beak
        const beakGeometry = new THREE.ConeGeometry(size * 0.2, size * 0.8, 4, 1);
        const beakMaterial = new THREE.MeshStandardMaterial({ color: 0xffcc00 });
        const beak = new THREE.Mesh(beakGeometry, beakMaterial);
        beak.position.set(0, 0, size * 2.5);
        beak.rotation.x = -Math.PI / 2;
        birdGroup.add(beak);
        
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

// Get height at specific x,z position on terrain
function getTerrainHeight(x, z) {
    if (!terrainGeometry) return 0;
    
    try {
        // First attempt: Use raycasting for precise detection
        const raycaster = new THREE.Raycaster();
        raycaster.set(
            new THREE.Vector3(x, 1000, z), // Start high above terrain
            new THREE.Vector3(0, -1, 0)    // Cast downward
        );
        
        // Intersect with terrain mesh
        const intersects = raycaster.intersectObject(terrain);
        
        if (intersects.length > 0) {
            console.log("Found terrain height via raycast:", intersects[0].point.y);
            return intersects[0].point.y;
        }
        
        // Second attempt: Try to calculate from terrain geometry
        const terrainSize = TERRAIN_SIZE;
        const segments = TERRAIN_SEGMENTS;
        
        // Convert world position to geometry indices
        const halfSize = terrainSize / 2;
        const xIndex = Math.floor(((x + halfSize) / terrainSize) * segments);
        const zIndex = Math.floor(((z + halfSize) / terrainSize) * segments);
        
        // Validate indices
        if (xIndex >= 0 && xIndex <= segments && zIndex >= 0 && zIndex <= segments) {
            // Get vertex index
            const vertexIndex = (zIndex * (segments + 1) + xIndex) * 3 + 1; // +1 for y component
            
            // Get height from geometry
            if (terrainGeometry.attributes && terrainGeometry.attributes.position) {
                const y = terrainGeometry.attributes.position.array[vertexIndex];
                console.log("Found terrain height via geometry:", y);
                return y;
            }
        }
    } catch (error) {
        console.warn("Error getting terrain height:", error);
    }
    
    // Return last known ground height or default value
    console.warn("Using fallback terrain height");
    return player.lastGroundY > 0 ? player.lastGroundY : 0;
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    const time = clock.getElapsedTime();
    const delta = clock.getDelta();
    
    // SIMPLE MOVEMENT - directional keys
    if (isLocked) {
        // Movement speed
        const speed = player.speed;
        
        // Store previous position
        const camera = fpControls.getObject();
        const prevX = camera.position.x;
        const prevZ = camera.position.z;
        
        // Calculate movement direction
        if (moveForward) {
            fpControls.moveForward(speed);
        }
        if (moveBackward) {
            fpControls.moveForward(-speed);
        }
        if (moveLeft) {
            fpControls.moveRight(-speed);
        }
        if (moveRight) {
            fpControls.moveRight(speed);
        }
        
        // Handle jumping
        if (isJumping) {
            jumpTime += delta;
            
            // Simple jump arc over 0.6 seconds
            if (jumpTime < 0.6) {
                // Parabolic jump curve
                const jumpHeight = 15 * Math.sin(Math.PI * jumpTime / 0.6);
                camera.position.y = player.lastGroundY + player.height + 5 + jumpHeight; // Added +5 for third-person
            } else {
                isJumping = false;
            }
        }
        
        // Get terrain height at current position if not jumping
        if (!isJumping) {
            const terrainY = getTerrainHeight(camera.position.x, camera.position.z);
            player.lastGroundY = terrainY;
            
            // Make sure the player is at least at water level
            const minHeight = Math.max(terrainY, WATER_LEVEL + 0.5);
            
            // Set player height above terrain
            camera.position.y = minHeight + player.height + 5; // Added +5 for third-person
            
            // Check if player is underwater and update overlay
            const underwaterOverlay = document.getElementById('underwater-overlay');
            // Check if player's feet are in the water (standing on terrain below water level)
            if (terrainY < WATER_LEVEL) {
                // Player is underwater - show overlay with transition
                if (underwaterOverlay) underwaterOverlay.style.opacity = '0.5';
            } else {
                // Player is above water - hide overlay with transition
                if (underwaterOverlay) underwaterOverlay.style.opacity = '0';
            }
        }
        
        // Update squirrel model position - place it in front of the camera
        if (player.model) {
            // Calculate direction vector
            const direction = new THREE.Vector3();
            camera.getWorldDirection(direction);
            
            // Position the model ahead of the camera
            const modelDistance = 10; // Increased distance in front of camera
            const modelX = camera.position.x + direction.x * modelDistance;
            const modelZ = camera.position.z + direction.z * modelDistance;
            
            // Get the terrain height for the model
            const modelTerrainY = getTerrainHeight(modelX, modelZ);
            const modelMinHeight = Math.max(modelTerrainY, WATER_LEVEL + 0.5);
            
            // Set model position with added height offset
            const modelHeightOffset = 2.5; // Use player height setting
            player.model.position.x = modelX;
            player.model.position.z = modelZ;
            player.model.position.y = modelMinHeight + modelHeightOffset; // Added height offset
            
            // Make model face the direction of movement
            if (prevX !== camera.position.x || prevZ !== camera.position.z) {
                // Calculate angle based on camera movement direction
                const angle = Math.atan2(
                    camera.position.x - prevX,
                    camera.position.z - prevZ
                );
                // Apply rotation - add Math.PI to face forward direction
                const targetRotation = angle; // Removed Math.PI to rotate 180 degrees
                player.model.rotation.y = targetRotation;
            }
            
            // Debug output every few seconds
            if (Math.floor(time) % 5 === 0 && Math.floor(time * 10) % 10 === 0) {
                console.log("Camera position:", camera.position);
                console.log("Squirrel position:", player.model.position);
                console.log("Model visible:", player.model.visible);
            }
        }
    } else {
        // Update orbit controls
        if (controls) controls.update();
    }
    
    // Update water animation
    if (water) {
        water.material.uniforms['time'].value = time;
    }
    
    // Update sun effects
    scene.traverse(function(object) {
        if (object.isMesh && object.material.type === 'ShaderMaterial' && object.material.uniforms && object.material.uniforms.time) {
            object.material.uniforms.time.value = time;
        }
    });
    
    // Update cloud positions
    if (clouds) {
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
    
    // Update bird animation
    if (birds) {
        birds.children.forEach(bird => {
            const data = bird.userData;
            
            // Update bird position in circular flight
            data.angle += data.speed * 0.01;
            
            // More natural flight path
            const radius = data.radius + Math.sin(data.angle * 2) * 20;
            bird.position.x = Math.cos(data.angle) * radius;
            bird.position.z = Math.sin(data.angle) * radius;
            
            // Vertical movement with smoother curves
            const verticalOffset = Math.sin(data.angle * 3) * 10 + Math.sin(data.angle * 7) * 5;
            bird.position.y = data.height + verticalOffset;
            
            // More natural banking in turns
            const bankAngle = Math.cos(data.angle) * 0.2;
            bird.rotation.z = bankAngle;
            
            // Make bird face the direction it's flying with natural head movement
            bird.rotation.y = -data.angle + Math.PI / 2 + Math.sin(time * 0.5) * 0.1;
            
            // More natural wing flapping with asymmetry
            data.wingAngle = Math.sin(time * data.wingSpeed * 10) * 0.4;
            const leftWingAngle = Math.PI / 4 + data.wingAngle;
            const rightWingAngle = -Math.PI / 4 - data.wingAngle;
            
            if (bird.children[1]) bird.children[1].rotation.y = leftWingAngle;
            if (bird.children[2]) bird.children[2].rotation.y = rightWingAngle;
            
            // Subtle tail movement
            if (bird.children[3]) {
                bird.children[3].rotation.x = -Math.PI / 6 + Math.sin(time * data.wingSpeed * 5) * 0.1;
            }
        });
    }
    
    // Render scene
    renderer.render(scene, camera);
}

// Start the application
init(); 