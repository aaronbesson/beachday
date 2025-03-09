# Custom Player Customization Feature Implementation

This document outlines the implementation of the custom player object generation feature using Replicate APIs.

## Overview

The feature allows users to:
1. Enter a text prompt to generate 4 image options (150x150 thumbnails)
2. View images in a lightbox by clicking on them
3. Select 1-4 images to create a 3D model
4. Preview the 3D model before accepting it
5. Replace the default squirrel player with the custom 3D model

## Files Created

1. **playerCustomizer.js** - Main module for the player customization UI and functionality
2. **customizer.css** - Styling for the player customizer UI
3. **lightbox.js** - Simple lightbox implementation for viewing larger image previews
4. **replicateApi.js** - Module for handling API communication with Replicate
5. **IMPLEMENTATION.md** - This documentation file

## Server Integration

The server.js file was modified to add two new API endpoints:
- `/api/generate-images` - Handles text-to-image generation (first Replicate API)
- `/api/generate-model` - Handles image-to-3D model generation (second Replicate API)

## Implementation Details

### UI Flow

1. **Initial State**:
   - A "Customize Player" button appears in the top left corner
   - Clicking this button opens the customizer panel

2. **Image Generation**:
   - User enters a text prompt
   - Clicking "Generate" sends request to Replicate API
   - 4 image thumbnails are displayed

3. **Image Selection**:
   - User can click on thumbnails to toggle selection
   - Clicking the image shows a larger preview in lightbox
   - At least one image must be selected

4. **3D Model Generation**:
   - User clicks "Create 3D Model" button
   - Selected images are sent to Replicate API
   - Loading indicator shows during processing

5. **Model Preview**:
   - 3D model is displayed in a preview window
   - User can see the model rotating to examine it
   - User can accept or go back

6. **Player Replacement**:
   - If accepted, the model replaces the default squirrel
   - Player customizer panel is closed

### API Integration

The feature uses two Replicate APIs:

1. **Image Generation API**
   - Version: `dee76b5afde21b0f01ed7925f0665b7e879c50ee718c5f78a9d38e04d523cc5e`
   - Input: Text prompt
   - Output: 4 images

2. **3D Model Generation API**
   - Version: `4876f2a8da1c544772dffa32e8889da4a1bab3a1f5c1937bfcfccb99ae347251`
   - Input: 1-4 selected images
   - Output: GLB model file

## Technical Implementation

### PlayerCustomizer Class

The main class managing the UI and model replacement logic.

Key methods:
- `createPromptUI()` - Creates the initial prompt input UI
- `createImageSelectionUI()` - Creates the image selection grid
- `createModelPreviewUI()` - Creates the 3D model preview
- `generateImages()` - Calls the image generation API
- `createModel()` - Calls the 3D model generation API
- `replacePlayerModel()` - Swaps the player model in the scene

### ReplicateAPI Class

Handles communication with the Replicate API endpoints.

Key methods:
- `generateImages()` - Calls the text-to-image API
- `generateModel()` - Calls the image-to-3D model API

### Lightbox Class

Simple lightbox implementation for viewing larger image previews.

Key methods:
- `show()` - Displays an image in the lightbox
- `hide()` - Hides the lightbox

## Running the Application

1. Start the server with `node server.js`
2. Open a browser to `http://localhost:3000`
3. Click the "Customize Player" button in the top left
4. Follow the UI flow to create and use a custom player

## Notes

- The current implementation uses simulated API responses for demo purposes
- In a production environment, you would need to replace these with actual API calls using a Replicate API key 