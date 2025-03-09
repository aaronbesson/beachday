// playerCustomizer.js
// A module for customizing the player model using Replicate APIs

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ReplicateAPI } from './replicateApi.js';
import { Lightbox } from './lightbox.js';

class PlayerCustomizer {
    constructor(scene, player, networkManager = null) {
        this.scene = scene;
        this.player = player;
        this.networkManager = networkManager;
        this.container = null;
        this.isVisible = false;
        this.generatedImages = [];
        this.selectedImages = [];
        this.glbModelUrl = null;
        
        // Create API instance
        this.api = new ReplicateAPI();
        
        // Create Lightbox for image previews
        this.lightbox = new Lightbox();
        
        this.init();
    }
    
    init() {
        this.createUI();
        this.setupEventListeners();
    }
    
    createUI() {
        // Create main container
        this.container = document.createElement('div');
        this.container.id = 'player-customizer';
        document.body.appendChild(this.container);
        
        // Create initial prompt UI
        this.createPromptUI();
    }
    
    createPromptUI() {
        this.container.innerHTML = `
            <div class="customizer-header">
                <h3>Create Custom Player</h3>
                <button id="close-customizer">×</button>
            </div>
            <div class="customizer-content">
                <p>Enter a prompt to generate images for your custom player:</p>
                <div class="input-group">
                    <input type="text" id="image-prompt" placeholder="A TOK emoji of a squirrel running...">
                    <button id="generate-images">Generate</button>
                </div>
                <div id="generation-status"></div>
            </div>
        `;
    }
    
    createImageSelectionUI(imageUrls) {
        this.container.innerHTML = `
            <div class="customizer-header">
                <h3>Select Images</h3>
                <button id="close-customizer">×</button>
            </div>
            <div class="customizer-content">
                <p>Select 1-4 images to create your 3D model:</p>
                <div class="image-grid">
                    ${imageUrls.map((url, index) => `
                        <div class="image-item" data-index="${index}">
                            <img src="${url}" alt="Generated image ${index + 1}">
                            <div class="image-overlay">
                                <span class="selection-indicator">✓</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="button-group">
                    <button id="back-to-prompt">Back</button>
                    <button id="create-model" disabled>Create 3D Model</button>
                </div>
            </div>
        `;
    }
    
    createModelPreviewUI(modelUrl) {
        this.container.innerHTML = `
            <div class="customizer-header">
                <h3>Your 3D Model</h3>
                <button id="close-customizer">×</button>
            </div>
            <div class="customizer-content">
                <div id="model-preview-container"></div>
                <div class="button-group">
                    <button id="back-to-images">Back</button>
                    <button id="use-model">Use as Player</button>
                </div>
            </div>
        `;
        
        // Setup 3D preview
        this.setupModelPreview(modelUrl);
    }
    
    setupModelPreview(modelUrl) {
        const container = document.getElementById('model-preview-container');
        
        // Create a simple Three.js scene for the preview
        const width = container.clientWidth;
        const height = 300;
        
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        container.appendChild(renderer.domElement);
        
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x444444);
        
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
        camera.position.set(0, 1, 3);
        camera.lookAt(0, 0, 0);
        
        // Add lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(1, 1, 1);
        scene.add(directionalLight);
        
        // Load the GLB model
        const loader = new GLTFLoader();
        loader.load(modelUrl, (gltf) => {
            const model = gltf.scene;
            
            // Center and scale the model
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 1.5 / maxDim;
            model.scale.set(scale, scale, scale);
            
            model.position.sub(center.multiplyScalar(scale));
            model.position.y = -0.5;
            
            scene.add(model);
            
            // Auto-rotate the model
            const animate = () => {
                requestAnimationFrame(animate);
                model.rotation.y += 0.01;
                renderer.render(scene, camera);
            };
            
            animate();
        });
    }
    
    setupEventListeners() {
        // Global event delegation
        document.body.addEventListener('click', (e) => {
            // If the click is inside the customizer, prevent it from triggering game controls
            if (e.target.closest('#player-customizer')) {
                e.stopPropagation();
            }
            
            const target = e.target;
            
            // Close button
            if (target.id === 'close-customizer') {
                this.hide();
            }
            
            // Generate images button
            if (target.id === 'generate-images') {
                const prompt = document.getElementById('image-prompt').value;
                if (prompt) {
                    this.generateImages(prompt);
                }
            }
            
            // Image selection
            if (target.closest('.image-item')) {
                const imageItem = target.closest('.image-item');
                const index = parseInt(imageItem.dataset.index);
                this.toggleImageSelection(imageItem, index);
                
                // Show image in lightbox if it's the image itself that was clicked
                if (target.tagName === 'IMG') {
                    this.lightbox.show(target.src);
                }
            }
            
            // Create 3D model button
            if (target.id === 'create-model') {
                this.createModel();
            }
            
            // Back to prompt button
            if (target.id === 'back-to-prompt') {
                this.createPromptUI();
            }
            
            // Back to images button
            if (target.id === 'back-to-images') {
                this.createImageSelectionUI(this.generatedImages);
                // Reselect previously selected images
                this.selectedImages.forEach(index => {
                    const imageItem = document.querySelector(`.image-item[data-index="${index}"]`);
                    if (imageItem) {
                        imageItem.classList.add('selected');
                    }
                });
                this.updateCreateModelButton();
            }
            
            // Use model button
            if (target.id === 'use-model') {
                this.replacePlayerModel();
                this.hide();
            }
        });

        // Prevent pointer lock when interacting with inputs
        this.container.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });

        // Prevent keyboard events from affecting game controls when typing in input
        this.container.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') {
                e.stopPropagation();
            }
        });
    }
    
    toggleImageSelection(imageItem, index) {
        imageItem.classList.toggle('selected');
        
        if (imageItem.classList.contains('selected')) {
            if (!this.selectedImages.includes(index)) {
                this.selectedImages.push(index);
            }
        } else {
            this.selectedImages = this.selectedImages.filter(i => i !== index);
        }
        
        this.updateCreateModelButton();
    }
    
    updateCreateModelButton() {
        const createModelBtn = document.getElementById('create-model');
        if (createModelBtn) {
            createModelBtn.disabled = this.selectedImages.length === 0;
        }
    }
    
    async generateImages(prompt) {
        const statusElement = document.getElementById('generation-status');
        statusElement.innerHTML = 'Generating images...';
        
        try {
            const response = await this.api.generateImages(prompt);
            
            if (response && response.output && response.output.length > 0) {
                this.generatedImages = response.output;
                this.selectedImages = [];
                this.createImageSelectionUI(this.generatedImages);
            } else {
                statusElement.innerHTML = 'Error: Failed to generate images';
            }
        } catch (error) {
            console.error('Error generating images:', error);
            statusElement.innerHTML = 'Error: ' + error.message;
        }
    }
    
    async createModel() {
        const selectedUrls = this.selectedImages.map(index => this.generatedImages[index]);
        
        // Update UI to show processing state
        this.container.innerHTML = `
            <div class="customizer-header">
                <h3>Creating 3D Model</h3>
                <button id="close-customizer">×</button>
            </div>
            <div class="customizer-content">
                <div class="processing-message">
                    <p>Creating your 3D model...</p>
                    <div class="loader"></div>
                </div>
            </div>
        `;
        
        try {
            const response = await this.api.generateModel(selectedUrls);
            
            if (response && response.output && response.output.model_file) {
                this.glbModelUrl = response.output.model_file;
                this.createModelPreviewUI(this.glbModelUrl);
                if (this.networkManager) {
                    // Send the model update to other players
                    this.networkManager.sendModelUpdate({
                        modelUrl: this.glbModelUrl,
                        customizations: this.customizationSettings // If you have any customization settings
                    });
                }
            } else {
                throw new Error('Failed to generate 3D model');
            }
        } catch (error) {
            console.error('Error creating model:', error);
            this.container.innerHTML = `
                <div class="customizer-header">
                    <h3>Error</h3>
                    <button id="close-customizer">×</button>
                </div>
                <div class="customizer-content">
                    <p>Failed to create 3D model: ${error.message}</p>
                    <button id="back-to-images">Try Again</button>
                </div>
            `;
        }
    }
    
    replacePlayerModel() {
        if (!this.glbModelUrl) return;
        
        // Load the new model
        const loader = new GLTFLoader();
        loader.load(this.glbModelUrl, (gltf) => {
            // Remove old model from scene
            if (this.player.model) {
                this.scene.remove(this.player.model);
            }
            
            // Add new model
            this.player.model = gltf.scene;
            this.scene.add(this.player.model);
            
            // Copy position, rotation, scale from original model
            // Note: You may need to adjust these values based on the new model
            this.player.model.scale.set(3, 3, 3);
            this.player.model.position.set(0, 50, -10);
            
            console.log('Player model replaced successfully');
        });
    }
    
    show() {
        this.container.style.display = 'block';
        this.isVisible = true;
    }
    
    hide() {
        this.container.style.display = 'none';
        this.isVisible = false;
    }
    
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
}

export { PlayerCustomizer }; 