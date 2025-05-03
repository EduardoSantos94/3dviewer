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
    // Wait for DOM content to be fully loaded before proceeding
    if (document.readyState === 'loading') {
        console.log("DOM not ready yet, waiting...");
        await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
        console.log("DOM ready, proceeding with init.");
    } else {
        console.log("DOM already ready, proceeding with init.");
    }

    // Create scene
    scene = new THREE.Scene();
    // Initial background setting (will be replaced by gradient/HDR)
    scene.background = new THREE.Color(0xf0f0f0); // Default light gray
    
    // Setup camera
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);

    // Find the existing canvas element (should exist now)
    const canvas = document.getElementById('viewer-canvas');
    if (!canvas) {
        // This should theoretically not happen now, but keep the check
        console.error("Canvas element #viewer-canvas still not found!");
        showErrorMessage("Critical error: Viewer canvas element missing.");
        throw new Error("Required canvas element #viewer-canvas not found.");
    }

     // Setup renderer using the existing canvas
    renderer = new THREE.WebGLRenderer({
        canvas: canvas, // Use the existing canvas
        antialias: true,
        powerPreference: "high-performance",
        preserveDrawingBuffer: true // Needed for screenshots
    });
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

    // Initialize post-processing
    composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    
    bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.2,   
        0.5,   
        0.8    
    );
    composer.addPass(bloomPass);
    
    // Setup lights (including Hemisphere)
    setupLights();
    
    // Setup controls
    setupControls();
    
    // Load HDR Environment Map
    await loadEnvironment(renderer); // Load the default HDR

    // Create gradient background texture (but don't apply yet)
    createGradientBackground(); 

    // Apply initial background based on default mode
    applyBackground(); 
    
    // Update all material presets with the default environment map (if loaded)
    if (defaultEnvMap) {
        Object.values(materialPresets).forEach(material => {
            if (material.envMap !== undefined) {
                material.envMap = defaultEnvMap;
                material.needsUpdate = true;
            }
        });
    }
    
    // Add floor grid - hidden by default
    const gridHelper = new THREE.GridHelper(20, 20);
    gridHelper.visible = false;
    scene.add(gridHelper);
    
    // Create a ground plane - hidden by default
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.8,
        metalness: 0.2,
        side: THREE.DoubleSide
    });
    groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
    groundPlane.rotation.x = Math.PI / 2;
    groundPlane.position.y = 0;
    groundPlane.receiveShadow = true;
    groundPlane.visible = false; // Set to hidden by default
    scene.add(groundPlane);

    // Update floor toggle button state
    const toggleFloorBtn = document.getElementById('toggle-floor');
    if (toggleFloorBtn) {
        toggleFloorBtn.classList.remove('active');
    }
    
    console.log("Scene init complete.");
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

function showErrorMessage(message) {
    // Create error message element
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
        <div class="error-content">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Error</h3>
            <p>${message}</p>
            <button id="error-close">OK</button>
        </div>
    `;
    
    // Check if document.body exists before appending
    if (document.body) {
        document.body.appendChild(errorDiv);
    } else {
        console.error("Cannot show error message: document.body is not available yet.");
        // As a last resort, use alert, though it's less user-friendly
        alert("Error: " + message);
        return; // Stop further execution for this message
    }
    
    // Add event listener to close button
    const closeBtn = document.getElementById('error-close');
    // ... rest of showErrorMessage ...
} 