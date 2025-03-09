# Low Poly Beach Day Scene

A 3D recreation of a low-poly landscape using Three.js, featuring:

- Procedurally generated terrain with simplex noise
- Realistic water with reflections and animations
- Dynamic sky with sun
- Low-poly trees placed on terrain
- First-person camera controls
- **NEW**: Custom player object creation using AI

## Features

- **Terrain Generation**: Created using multi-layered simplex noise for natural-looking hills
- **Water Reflections**: Realistic water surface with dynamic reflections and distortions
- **Dynamic Lighting**: Sun position affects lighting and reflections
- **Low-Poly Aesthetics**: Maintains a stylized, low-poly look
- **Responsive Design**: Adapts to different screen sizes
- **Custom Player Creation**: Generate your own 3D player model from text prompts using AI

## How to Run

### Method 1: Open Directly (Basic Features Only)
1. Clone the repository
2. Open `index.html` in a web browser that supports WebGL

### Method 2: Using Node.js Server (Full Features)
1. Clone the repository
2. Make sure you have Node.js installed
3. Run `npm install` to install dependencies
4. Copy `.env.example` to `.env` and add your Replicate API key
5. Run `npm start` or `node server.js` in the terminal
6. Open `http://localhost:3000` in your browser

## API Integration

The custom player feature uses Replicate AI APIs:
1. Text-to-image generation for creating character concepts
2. Image-to-3D model conversion for creating playable 3D models

To use these features:
1. Create an account at [Replicate](https://replicate.com)
2. Get your API token from https://replicate.com/account/api-tokens
3. Add your API token to the `.env` file

## Controls

- **Orbit**: Click and drag
- **Zoom**: Scroll wheel
- **Pan**: Right-click and drag
- **Customize Player**: Click the "Customize Player" button in the top-left corner

## Creating Custom Players

1. Click the "Customize Player" button
2. Enter a text prompt describing your character (e.g., "A TOK emoji of a squirrel running holding a Bazooka")
3. Select from the generated images
4. Click "Create 3D Model"
5. Preview the model and click "Use as Player" to replace the default squirrel

## Technologies Used

- Three.js for 3D rendering
- Simplex noise for procedural terrain generation
- WebGL for hardware-accelerated graphics
- Replicate API for AI-generated content
- Node.js for server-side API integration

## Browser Compatibility

This project requires a browser with WebGL support. 