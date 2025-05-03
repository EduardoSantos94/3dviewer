async function loadModelFromSharedLink(linkId, password = null) {
    console.log(`Attempting to load model from shared link ID: ${linkId}`);
    const loadingIndicator = document.getElementById('loading-indicator');
    const modelTitleElement = document.getElementById('model-title'); // Get title element
    const modelDescriptionElement = document.getElementById('model-description'); // Get description element

    if (!loadingIndicator || !modelTitleElement || !modelDescriptionElement) {
        console.error('Required elements (loading indicator, title, description) not found in the DOM.');
        return;
    }

    // Clear previous title/description
    modelTitleElement.textContent = '';
    modelDescriptionElement.textContent = '';
    
    loadingIndicator.style.display = 'flex';
    hidePasswordPrompt(); // Ensure password prompt is hidden initially

    try {
        // Call the Edge Function to get the signed URL, title, and description
        const response = await fetch('/.netlify/functions/generate-signed-url', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ link_id: linkId, password: password }),
        });

        loadingIndicator.style.display = 'none'; // Hide loading indicator after fetch

        if (response.status === 401) {
            const errorData = await response.json();
            if (errorData.error === 'Password required') {
                console.log('Password required for this link.');
                showPasswordPrompt(linkId);
            } else {
                console.error('Authentication error:', errorData.error);
                alert('Authentication failed: ' + errorData.error);
            }
            return; // Stop execution if password is required or auth failed
        }

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Error fetching signed URL:', response.status, errorData);
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const signedUrl = data.signedUrl;
        const modelTitle = data.title; // Get title from response
        const modelDescription = data.description; // Get description from response

        if (!signedUrl) {
            throw new Error('Signed URL not found in response');
        }

        // Update the title and description elements
        if (modelTitle) {
            modelTitleElement.textContent = modelTitle;
        } else {
             modelTitleElement.textContent = 'Jewelry Model'; // Default title
        }
        if (modelDescription) {
            modelDescriptionElement.textContent = modelDescription;
        }

        console.log('Received Signed URL:', signedUrl);
        console.log('Model Title:', modelTitle);
        console.log('Model Description:', modelDescription);
        
        // Load the model using the signed URL
        await loadModel(signedUrl); // Assuming loadModel handles the actual loading

    } catch (error) {
        loadingIndicator.style.display = 'none';
        console.error('Failed to load model from shared link:', error);
        // Display error to user appropriately
        alert('Failed to load model: ' + error.message);
        // Potentially clear title/description on error too
        modelTitleElement.textContent = 'Error Loading Model';
        modelDescriptionElement.textContent = error.message;
    }
}

function zoomToFit(model) {
    // ... (calculate center, size, maxDim, fov, cameraZ) ...

    // Position the camera
    const direction = new THREE.Vector3(0, 0.5, 1).normalize(); // Slightly elevated view
    camera.position.copy(center).add(direction.multiplyScalar(cameraZ));
    camera.lookAt(center);

    // Update camera controls ONLY IF they exist
    if (controls) {
        controls.target.copy(center);
        controls.update();
    } else {
        console.warn('OrbitControls not initialized when zoomToFit was called.');
        // Manually update projection matrix if controls are missing
        camera.updateProjectionMatrix(); 
    }

    // Update the camera's near and far planes based on the model size
    const minZ = Math.max(0.1, maxDim * 0.01);
    const maxZ = Math.max(1000, maxDim * 10);
    // ... (rest of near/far plane update)
}

async function init() {
    // Create scene
    scene = new THREE.Scene();
    // ... (scene background setup) ...
    
    // Setup camera
    // ... (camera setup) ...

    // Find the existing canvas element
    const canvas = document.getElementById('viewer-canvas');
    if (!canvas) {
        console.error("Canvas element with id 'viewer-canvas' not found in the DOM!");
        showErrorMessage("Viewer canvas element is missing. Cannot initialize 3D view.");
        throw new Error("Required canvas element #viewer-canvas not found."); // Stop initialization
    }

    // Setup renderer using the existing canvas
    renderer = new THREE.WebGLRenderer({ 
        canvas: canvas, // Use the existing canvas
        antialias: true,
        powerPreference: "high-performance",
        preserveDrawingBuffer: true // Needed for screenshots
    });
    // Set size and pixel ratio based on the PARENT container, not necessarily window
    // We'll adjust this in onWindowResize later
    const container = canvas.parentElement || document.getElementById('main-content'); // Get container size
    if (container) {
         renderer.setSize(container.clientWidth, container.clientHeight);
    } else {
         renderer.setSize(window.innerWidth, window.innerHeight); // Fallback
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2; 
    
    // NO LONGER NEEDED: document.getElementById('main-content').appendChild(renderer.domElement);

    // Initialize post-processing
    composer = new EffectComposer(renderer);
    // ... (rest of init, composer setup, lights, controls, etc.) ...
}

function onWindowResize() {
    // Update camera aspect ratio
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    
    // Update renderer size based on its container
    const canvas = renderer.domElement;
    const container = canvas.parentElement || document.getElementById('main-content');
    if (container) {
        renderer.setSize(container.clientWidth, container.clientHeight);
    } else {
        renderer.setSize(window.innerWidth, window.innerHeight); // Fallback
    }
    
    // Update composer size
    if (composer) { // Check if composer exists
        composer.setSize(container ? container.clientWidth : window.innerWidth, 
                         container ? container.clientHeight : window.innerHeight);
    }
} 