const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
// Add dotenv to load environment variables
require('dotenv').config();

const PORT = 3000;
const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY;

// Log API key presence (don't log the actual key)
console.log(`Replicate API Key ${REPLICATE_API_KEY ? 'is' : 'is NOT'} available`);

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.glb': 'model/gltf-binary',
};

// Call the real Replicate API to generate images
const generateImages = async (data) => {
  console.log('Calling Replicate API for image generation...');
  
  try {
    // Start prediction
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: data.version,
        input: {
          prompt: data.prompt,
          width: data.width || 1024,
          height: data.height || 1024,
          num_outputs: data.num_outputs || 4,
          guidance_scale: data.guidance_scale || 7.5,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Replicate API error: ${JSON.stringify(error)}`);
    }

    const prediction = await response.json();
    console.log('Prediction started:', prediction.id);

    // Poll for prediction result
    return await pollPrediction(prediction.id);
  } catch (error) {
    console.error('Error calling Replicate API:', error);
    throw error;
  }
};

// Call the real Replicate API to generate 3D model
const generate3DModel = async (data) => {
  console.log('Calling Replicate API for 3D model generation...');
  
  try {
    // Start prediction
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: data.version,
        input: {
          images: data.images,
          texture_size: data.texture_size || 2048,
          mesh_simplify: data.mesh_simplify || 0.9,
          generate_color: data.generate_color !== false,
          generate_model: data.generate_model !== false,
          randomize_seed: data.randomize_seed !== false,
          save_gaussian_ply: data.save_gaussian_ply || false,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Replicate API error: ${JSON.stringify(error)}`);
    }

    const prediction = await response.json();
    console.log('Prediction started:', prediction.id);

    // Poll for prediction result
    return await pollPrediction(prediction.id);
  } catch (error) {
    console.error('Error calling Replicate API:', error);
    throw error;
  }
};

// Poll prediction status until it's complete
const pollPrediction = async (predictionId) => {
  let completed = false;
  let prediction = null;
  
  while (!completed) {
    console.log(`Polling prediction ${predictionId}...`);
    
    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: {
        'Authorization': `Token ${REPLICATE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Replicate API error: ${JSON.stringify(error)}`);
    }

    prediction = await response.json();
    
    if (prediction.status === 'succeeded') {
      completed = true;
      console.log('Prediction completed successfully');
    } else if (prediction.status === 'failed') {
      throw new Error(`Prediction failed: ${prediction.error}`);
    } else {
      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  return prediction;
};

// Fallback to simulated responses if no API key is available
const simulateImageGenerationAPI = (data) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        status: 'succeeded',
        output: [
          "https://replicate.delivery/xezq/LB5Llg528dogN5eViGUywTGdZPnSIwHw96ChjtRYaE5C1ZLKA/out-0.png",
          "https://replicate.delivery/xezq/jflPCu2UbYWmVSEH2xDwWQLwYLDLKGc7ufCMRcnUiecKUntoA/out-1.png",
          "https://replicate.delivery/xezq/BBxe78Lg5H2dDauEf1Zp0o16BpqsILEMLNG6wRTKi4sFqzWUA/out-2.png",
          "https://replicate.delivery/xezq/ewpIO3BxCp0qOaAm80XgUyrdv7pzeJkYIzjsTeFkWVFKUntoA/out-3.png"
        ]
      });
    }, 2000);
  });
};

const simulateModelGenerationAPI = (data) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        status: 'succeeded',
        output: {
          model_file: "https://replicate.delivery/yhqm/djvAaS0o7HozMNflm94IHYb9eEpuHCmxloS0XWQd1doHuzWUA/output.glb",
          color_video: "https://replicate.delivery/yhqm/Qemv8PfaPumeiJiE39n1aEX5mCRebfdhMB78AjFeqGn4h7sFF/output_color.mp4",
          gaussian_ply: "https://replicate.delivery/yhqm/XdkBStChenTqPSDMJDCBjvbJ5C9bS2EgyEqBpkqgRadE3ZLKA/output_gaussian.ply"
        }
      });
    }, 4000);
  });
};

const server = http.createServer(async (req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS requests (CORS preflight)
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Handle favicon requests
  if (req.url === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Handle API endpoints
  const parsedUrl = url.parse(req.url, true);
  const pathName = parsedUrl.pathname;

  // API endpoint to generate images
  if (pathName === '/api/generate-images' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        console.log('Generating images with data:', data);
        
        let result;
        
        // Use real API if key is available, otherwise simulate
        if (REPLICATE_API_KEY) {
          result = await generateImages(data);
        } else {
          console.warn('No API key provided, using simulated response');
          result = await simulateImageGenerationAPI(data);
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (error) {
        console.error('Error processing image generation request:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message || 'Failed to process request' }));
      }
    });
    return;
  }

  // API endpoint to generate 3D model
  if (pathName === '/api/generate-model' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        console.log('Generating 3D model with data:', data);
        
        let result;
        
        // Use real API if key is available, otherwise simulate
        if (REPLICATE_API_KEY) {
          result = await generate3DModel(data);
        } else {
          console.warn('No API key provided, using simulated response');
          result = await simulateModelGenerationAPI(data);
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (error) {
        console.error('Error processing model generation request:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message || 'Failed to process request' }));
      }
    });
    return;
  }

  // Set the file path based on the URL for static files
  let filePath = '.' + parsedUrl.pathname;
  if (filePath === './') {
    filePath = './index.html';
  }

  // Get the file extension
  const extname = path.extname(filePath);
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  // Read the file
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // File not found
        fs.readFile('./index.html', (err, content) => {
          if (err) {
            res.writeHead(500);
            res.end('Error loading index.html');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content, 'utf-8');
          }
        });
      } else {
        // Server error
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      }
    } else {
      // Success
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
}); 