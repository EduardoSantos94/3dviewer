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

export async function init() {
    console.log('Initializing application...');
    try {
        await setupRhino();
        console.log('Rhino3dm setup complete.');

        const readyStateCheckInterval = setInterval(async function() {
            if (document.readyState === 'complete' || document.readyState === 'interactive') {
                clearInterval(readyStateCheckInterval);
                console.log('DOM is ready, proceeding with init.');

                try {
                    // Ensure the target container exists
                    const container = document.getElementById('main-content'); // Changed ID here
                    if (!container) {
                        console.error('Initialization Error: Target container #main-content not found in the DOM.');
                        showErrorMessage('Initialization failed: Viewer container missing.');
                        return; // Stop initialization
                    }
                    console.log('Target container #main-content found.');

                    scene = new THREE.Scene();
                    camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
                    camera.position.set(0, 0, 10); // Adjust initial camera position

                    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
                    renderer.setSize(container.clientWidth, container.clientHeight);
                    renderer.setPixelRatio(window.devicePixelRatio);
                    renderer.toneMapping = THREE.ACESFilmicToneMapping;
                    renderer.toneMappingExposure = 1.0;
                    renderer.outputColorSpace = THREE.SRGBColorSpace; // Correct color space

                    console.log('Renderer initialized:', renderer);
                    console.log('Renderer DOM element:', renderer.domElement);

                    // Append renderer
                    container.appendChild(renderer.domElement); // Appending to #main-content
                    console.log('Renderer appended to #main-content.');

                    controls = new OrbitControls(camera, renderer.domElement);
                    controls.enableDamping = true;
                    controls.dampingFactor = 0.05;
                    controls.screenSpacePanning = false;
                    controls.minDistance = 1;
                    controls.maxDistance = 500;
                    controls.maxPolarAngle = Math.PI / 2;
                    controls.target.set(0, 0, 0);
                    controls.update();
                    console.log('OrbitControls initialized.');

                    setupLighting();
                    await setupEnvironment();
                    setupEventListeners(); // Ensure listeners are set up after elements exist

                    // Start animation loop only after initialization
                    animate();
                    console.log('Animation loop started.');
                    
                    // Handle shared links or show frontpage
                    await handleInitialLoad(); 

                } catch (initError) {
                    console.error('Error during renderer/controls setup:', initError);
                    showErrorMessage(`Initialization Error: ${initError.message}`);
                }

            } else {
                console.log('DOM not ready yet, waiting... State:', document.readyState);
            }
        }, 100); // Check every 100ms

    } catch (error) {
        console.error('Error initializing the application:', error);
        // Show user-friendly error message
        showErrorMessage(`Error initializing the application: ${error.message}`);
        // Hide loading indicator if it's still visible
        hideLoadingIndicator();
    }
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