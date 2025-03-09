// replicateApi.js
// Module for handling Replicate API calls

class ReplicateAPI {
    constructor() {
        // API endpoint URLs
        this.baseUrl = '/api';
        
        // API versions
        this.imageGenVersion = 'dee76b5afde21b0f01ed7925f0665b7e879c50ee718c5f78a9d38e04d523cc5e';
        this.modelGenVersion = '4876f2a8da1c544772dffa32e8889da4a1bab3a1f5c1937bfcfccb99ae347251';
    }
    
    // Method to generate images from text prompt
    async generateImages(prompt) {
        console.log('Generating images with prompt:', prompt);
        
        try {
            const response = await fetch(`${this.baseUrl}/generate-images`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: "A TOK emoji of" + prompt + "full body, 3d, cartoon style, low poly, 8k, photorealistic",
                    version: this.imageGenVersion,
                    width: 512,
                    height: 512,
                    num_outputs: 4,
                    guidance_scale: 7.5,
                }),
            });
            
            if (!response.ok) {
                throw new Error('Failed to generate images');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error generating images:', error);
            throw error;
        }
    }
    
    // Method to generate 3D model from selected images
    async generateModel(imageUrls) {
        console.log('Generating 3D model from images:', imageUrls);
        
        try {
            const response = await fetch(`${this.baseUrl}/generate-model`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    images: imageUrls,
                    version: this.modelGenVersion,
                    texture_size: 512,
                    mesh_simplify: 0.98,
                    save_gaussian_ply: false,
                    generate_normal: false,
                    generate_color: false,
                    generate_model: true,
                    randomize_seed: true,
                }),
            });
            
            if (!response.ok) {
                throw new Error('Failed to generate 3D model');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error generating 3D model:', error);
            throw error;
        }
    }
    
    // Helper method to poll Replicate API for prediction status
    async getPredictionStatus(predictionId) {
        try {
            const response = await fetch(`${this.baseUrl}/${predictionId}`, {
                headers: {
                    'Authorization': `Token ${this.apiToken}`,
                    'Content-Type': 'application/json',
                },
            });
            
            if (!response.ok) {
                throw new Error('Failed to get prediction status');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error checking prediction status:', error);
            throw error;
        }
    }
}

export { ReplicateAPI }; 