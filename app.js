import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Rhino3dmLoader } from 'three/addons/loaders/3DMLoader.js';
import * as TWEEN from './lib/tween/tween.module.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

// Initialize Three.js scene
let scene, camera, renderer, controls;
let models = []; // Array to store multiple models
let loadedMeshes = []; // Array to track all meshes for disposal
let groundPlane = null;
let selectedObject = null;
let ambientLight, directionalLight;
let isDarkBackground = false;
let isTurntableActive = false;
let turntableClock = new THREE.Clock();
let turntableSpeed = 0.5; // radians per second
let composer;
let bloomPass;
let rhino = null; // Global rhino3dm instance
let animationId = null; // For tracking animation frames
let currentMaterial = 'gold'; // Default material for new models

// Function to check if rhino3dm is loaded
function isRhino3dmLoaded() {
    // Check for the rhino3dm global variable
    return typeof rhino3dm !== 'undefined';
}

// Debug function to log available rhino3dm classes
function debugRhino3dm() {
    if (!isRhino3dmLoaded()) {
        console.error('Rhino3dm is not loaded yet');
        return;
    }
    console.log('Rhino3dm loaded:', rhino);
    
    // Check major classes
    const classesToCheck = [
        'File3dm', 'Mesh', 'Brep', 'BrepFace', 'Point3d', 'Curve', 'NurbsCurve',
        'Surface', 'ObjectType', 'MeshType'
    ];
    
    console.log('Available Rhino3dm classes:');
    classesToCheck.forEach(className => {
        console.log(`- ${className}: ${rhino[className] ? 'Available' : 'Not available'}`);
        if (rhino[className]) {
            console.log(`  typeof: ${typeof rhino[className]}`);
        }
    });
    
    if (rhino.Mesh) {
        const meshMethods = [
            'createFromBox', 'createFromSphere', 'createFromClosedPolyline', 
            'createFromBrep', 'vertices', 'faces', 'normals', 'colors'
        ];
        
        console.log('Mesh methods:');
        meshMethods.forEach(method => {
            let available = false;
            try {
                available = typeof rhino.Mesh[method] === 'function' ||
                           (rhino.Mesh.prototype && typeof rhino.Mesh.prototype[method] === 'function');
            } catch (e) {
                available = false;
            }
            console.log(`- ${method}: ${available ? 'Available' : 'Not available'}`);
        });
    }
    
    if (rhino.Brep) {
        const brepMethods = [
            'faces', 'createFromMesh', 'createFromBox', 'createFromCylinder',
            'createFromSphere', 'createFromSurface'
        ];
        
        console.log('Brep methods:');
        brepMethods.forEach(method => {
            let available = false;
            try {
                available = typeof rhino.Brep[method] === 'function' ||
                           (rhino.Brep.prototype && typeof rhino.Brep.prototype[method] === 'function');
            } catch (e) {
                available = false;
            }
            console.log(`- ${method}: ${available ? 'Available' : 'Not available'}`);
        });
    }
    
    if (rhino.ObjectType) {
        console.log('ObjectType values:');
        for (const key in rhino.ObjectType) {
            console.log(`- ${key}: ${rhino.ObjectType[key]}`);
        }
    }
}

// Function to wait for rhino3dm to load with better error handling
async function initRhino3dm() {
    if (rhino !== null) {
        console.log('rhino3dm already initialized');
        return true;
    }
    
    try {
        console.log('Initializing rhino3dm...');
        
        // Check if rhino3dm is loaded
        if (typeof rhino3dm === 'undefined') {
            console.error('rhino3dm.js is not loaded');
            // Try to load it dynamically
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/rhino3dm@7.15.0/rhino3dm.min.js';
            document.head.appendChild(script);
            
            // Wait for script to load
            await new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = () => reject(new Error('Failed to load rhino3dm.js'));
            });
        }
        
        // Wait for rhino3dm to be available
        let attempts = 0;
        while (typeof rhino3dm === 'undefined' && attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
        }
        
        if (typeof rhino3dm === 'undefined') {
            throw new Error('rhino3dm failed to load after multiple attempts');
        }
        
        // Initialize rhino3dm
        rhino = await rhino3dm();
        console.log('rhino3dm initialized successfully');
        
        return true;
    } catch (error) {
        console.error('Failed to initialize rhino3dm:', error);
        showErrorMessage('Failed to initialize 3D model loader. Please refresh the page and try again.');
        return false;
    }
}

// Show loading indicator
function showLoadingIndicator() {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'flex';  // Changed to flex for better centering
    }
}

// Hide loading indicator
function hideLoadingIndicator() {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
}

// Show frontpage
function showFrontpage() {
    const frontpage = document.getElementById('frontpage');
    const dropZone = document.getElementById('drop-zone');
    const container = document.querySelector('.container');
    
    if (frontpage) {
        frontpage.style.display = 'flex';
        console.log('Showing frontpage');
    }
    
    if (dropZone) {
        dropZone.style.display = 'none';
    }
    
    if (container) {
        container.style.display = 'none';
    }
}

// Hide frontpage with improved visibility management
function hideFrontpage() {
    const frontpage = document.getElementById('frontpage');
    const dropZone = document.getElementById('drop-zone');
    const container = document.querySelector('.container');
    const viewerContainer = document.getElementById('viewer-container');
    
    if (frontpage) {
        frontpage.style.display = 'none';
        console.log('Hiding frontpage');
    }
    
    // Show the main container first
    if (container) {
        container.style.display = 'block';
    }
    
    // Then show the drop zone for file selection
    if (dropZone) {
        dropZone.style.display = 'flex';
    }

    // Ensure viewer is visible
    if (viewerContainer) {
        viewerContainer.style.display = 'block';
    }
    
    // Force a resize event to ensure proper rendering
    window.dispatchEvent(new Event('resize'));
    
    console.log('Front page hidden, viewer ready');
}

// Initialize the application
async function initializeApp() {
    console.log('Initializing application...');
    
    try {
        // Wait to make sure rhino3dm is available FIRST
        await waitForRhino3dm();
        
        // THEN initialize Three.js scene
        await init();
        
        // Set up event listeners AFTER the scene is initialized
        setupEventListeners();
        
        // Get UI elements
        const frontpage = document.getElementById('frontpage');
        const container = document.querySelector('.container');
        const dropZone = document.getElementById('drop-zone');
        const controlsPanel = document.querySelector('.controls-panel');
        const modelList = document.querySelector('.model-list');
        
        // Log UI state
        console.log('App initialized successfully');
        console.log('UI state after initialization:');
        console.log('- Frontpage visible:', frontpage.style.display);
        console.log('- Container visible:', container.style.display);
        console.log('- Drop zone visible:', dropZone.style.display);
        console.log('- Controls panel ready:', controlsPanel.style.display);
        console.log('- Model list ready:', modelList.style.display);
        
        // Start the animation loop ONLY ONCE at the end of initialization
        animate();
    } catch (error) {
        console.error('Error initializing app:', error);
        alert('Error initializing the application: ' + error.message);
    }
}

// Wait for rhino3dm to be available
async function waitForRhino3dm(maxAttempts = 10, delay = 500) {
    console.log('Waiting for rhino3dm to be available...');
    
    // First check if it's already available
    if (isRhino3dmLoaded()) {
        console.log('rhino3dm is already available');
        return true;
    }
    
    // Wait for a set number of attempts
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, delay));
        
        if (isRhino3dmLoaded()) {
            console.log(`rhino3dm became available after ${attempt + 1} attempts`);
            return true;
        }
        
        console.log(`Waiting for rhino3dm (attempt ${attempt + 1}/${maxAttempts})...`);
    }
    
    // If we get here, rhino3dm isn't available after all attempts
    console.warn(`rhino3dm not available after ${maxAttempts} attempts`);
    
    // Try to initialize it ourselves as a last resort
    return await initRhino3dm();
}

// Gold material presets
const materialPresets = {
    'gold': new THREE.MeshPhysicalMaterial({
        color: 0xFFD700,  // Brighter yellow gold
        metalness: 0.85,  // Slightly reduced for better rendering
        roughness: 0.1,   // Less rough for more shine
        reflectivity: 1.0,
        clearcoat: 0.5,   // More clearcoat for shine
        clearcoatRoughness: 0.1,
        envMapIntensity: 1.5, // Increased for brighter reflections
        side: THREE.DoubleSide
    }),
    'rose-gold': new THREE.MeshPhysicalMaterial({
        color: 0xE0A080,
        metalness: 0.85,
        roughness: 0.1,
        reflectivity: 1.0,
        clearcoat: 0.5,
        clearcoatRoughness: 0.1,
        envMapIntensity: 1.5,
        side: THREE.DoubleSide
    }),
    'white-gold': new THREE.MeshPhysicalMaterial({
        color: 0xF0F0F0,
        metalness: 0.85,
        roughness: 0.1,
        reflectivity: 1.0,
        clearcoat: 0.5,
        clearcoatRoughness: 0.1,
        envMapIntensity: 1.5,
        side: THREE.DoubleSide
    }),
    'fast-gold': new THREE.MeshStandardMaterial({
        color: 0xFFD700,  // Brighter yellow gold
        metalness: 0.8,
        roughness: 0.2,
        side: THREE.DoubleSide
    }),
    'fast-rose-gold': new THREE.MeshStandardMaterial({
        color: 0xE0A080,
        metalness: 0.8,
        roughness: 0.2,
        side: THREE.DoubleSide
    }),
    'fast-white-gold': new THREE.MeshStandardMaterial({
        color: 0xF0F0F0,
        metalness: 0.8,
        roughness: 0.2,
        side: THREE.DoubleSide
    })
};

// Update outline materials
const outlineMaterials = {
    'gold': new THREE.MeshBasicMaterial({
        color: 0x000000,
        side: THREE.BackSide
    }),
    'rose-gold': new THREE.MeshBasicMaterial({
        color: 0x000000,
        side: THREE.BackSide
    }),
    'white-gold': new THREE.MeshBasicMaterial({
        color: 0x000000,
        side: THREE.BackSide
    }),
    'fast-gold': new THREE.MeshBasicMaterial({
        color: 0x000000,
        side: THREE.BackSide
    }),
    'fast-rose-gold': new THREE.MeshBasicMaterial({
        color: 0x000000,
        side: THREE.BackSide
    }),
    'fast-white-gold': new THREE.MeshBasicMaterial({
        color: 0x000000,
        side: THREE.BackSide
    })
};

// Function to clear the scene
function ClearScene() {
  loadedMeshes.forEach((mesh) => {
    scene.remove(mesh);
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(mat => mat.dispose());
      } else {
        mesh.material.dispose();
      }
    }
  });
  loadedMeshes = [];
  models = [];
  selectedObject = null;
  console.log("Scene cleared");
}

// Function to add a model to the scene
function AddModelToScene(mesh) {
  scene.add(mesh);
  loadedMeshes.push(mesh);
  console.log("Mesh added:", mesh.name || "Unnamed");
}

// Initialize the scene
async function init() {
    // Create scene with darker background
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe8e8e8); // Light gray for better contrast with gold
    
    // Setup camera
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);

    // Setup renderer with improved exposure
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        powerPreference: "high-performance",
        preserveDrawingBuffer: true // Needed for screenshots
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2; // Increased exposure for brighter display
    document.getElementById('viewer-container').appendChild(renderer.domElement);

    // Initialize post-processing with reduced bloom
    composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    
    // Add bloom effect with subtle settings for jewelry
    bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.2,   // Increased strength for more glow
        0.5,   // radius
        0.8    // Lower threshold to bloom more parts
    );
    composer.addPass(bloomPass);
    
    // Setup lights
    setupLights();
    
    // Setup controls
    setupControls();
    
    // Create a jewelry-specific environment map
    const envMap = createJewelryEnvironmentMap(renderer);
    scene.environment = envMap;
    
    // Update all material presets with the environment map
    Object.values(materialPresets).forEach(material => {
        if (material.envMap !== undefined) {
            material.envMap = envMap;
            material.needsUpdate = true;
        }
    });
    
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
    
    // Note: setupEventListeners() and animate() are called in initializeApp()
    // to avoid duplicate initialization
}

// Update the setupEventListeners function to properly handle file selection
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Start viewing button on frontpage
    const startViewingBtn = document.getElementById('start-viewing');
    if (startViewingBtn) {
        startViewingBtn.addEventListener('click', () => {
            console.log('Start viewing button clicked');
            
            // Hide frontpage and show other UI components
            hideFrontpage();
            
            // Force show the drop zone immediately
    const dropZone = document.getElementById('drop-zone');
    if (dropZone) {
                dropZone.style.display = 'flex';
            }
            
            // Make sure container is visible too
            const container = document.querySelector('.container');
            if (container) {
                container.style.display = 'block';
            }
        });
    } else {
        console.error('Start viewing button not found!');
    }
    
    // Drop zone select files button
    const selectFilesBtn = document.getElementById('select-files');
    if (selectFilesBtn) {
        selectFilesBtn.addEventListener('click', () => {
            console.log('Select files button clicked');
            
            // Force immediate UI changes before file dialog opens
            const frontpage = document.getElementById('frontpage');
            if (frontpage) {
                frontpage.style.display = 'none';
            }
            
            const container = document.querySelector('.container');
            if (container) {
                container.style.display = 'block';
            }
            
            document.getElementById('file-input').click();
        });
    } else {
        console.error('Select files button not found!');
    }

    // File input change handler
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.addEventListener('change', (event) => {
            const files = event.target.files;
            if (files && files.length > 0) {
                // Force hide dropzone here to ensure UI is consistent
                const dropZone = document.getElementById('drop-zone');
    if (dropZone) {
                    dropZone.style.display = 'none';
                }
                
                // Make sure container is visible
                const container = document.querySelector('.container');
                if (container) {
                    container.style.display = 'block';
                }
                
                handleFiles(files);
                // Reset the input to allow selecting the same file again
                event.target.value = '';
            }
        });
    } else {
        console.error('File input not found!');
    }

    // Drop zone handlers
    const dropZone = document.getElementById('drop-zone');
    if (dropZone) {
        dropZone.addEventListener('dragover', (event) => {
            event.preventDefault();
            event.stopPropagation();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', (event) => {
            event.preventDefault();
            event.stopPropagation();
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (event) => {
            event.preventDefault();
            event.stopPropagation();
            dropZone.classList.remove('dragover');
            const files = event.dataTransfer.files;
            if (files && files.length > 0) {
                handleFiles(files);
            }
        });
    } else {
        console.error('Drop zone not found!');
    }
    
    // Material selection (Top dropdown)
    const materialSelect = document.getElementById('material-select');
    if (materialSelect) {
        materialSelect.addEventListener('change', () => {
            const selectedMaterialType = materialSelect.value;
            if (selectedObject) {
                // Find the index of the selected model data
                const modelIndex = models.findIndex(m => m.object === selectedObject);
                if (modelIndex !== -1) {
                    console.log(`Applying material ${selectedMaterialType} from top dropdown to selected model index ${modelIndex}`);
                    applyMaterialToModel(modelIndex, selectedMaterialType);
                    // Update the UI list to reflect the change potentially
                    // updateLoadedModelsUI(); 
                } else {
                    console.warn('Top dropdown: Selected object not found in models array.');
                }
            } else {
                console.warn('Top dropdown: No model selected to apply material to.');
                // Provide feedback: e.g., show a temporary message
                // alert("Please select a model first by clicking on it in the list or viewer.");
            }
        });
        console.log('Top material select listener initialized.'); // Add log
    } else {
        console.error('Material select dropdown not found!');
    }

    // Control buttons - verify each exists before adding listener
    const centerBtn = document.getElementById('center-model');
    if (centerBtn) {
        // Ensure this button calls centerSelectedModel, not zoomToFit directly
        centerBtn.addEventListener('click', centerSelectedModel);
        console.log('Center model button initialized');
    } else {
        console.error('Center model button not found!');
    }

    const turntableBtn = document.getElementById('toggle-turntable');
    if (turntableBtn) {
        turntableBtn.addEventListener('click', toggleTurntable);
        console.log('Turntable button initialized');
    } else {
        console.error('Turntable button not found!');
    }

    const floorBtn = document.getElementById('toggle-floor');
    if (floorBtn) {
        floorBtn.addEventListener('click', toggleFloor);
        console.log('Floor button initialized');
    } else {
        console.error('Floor button not found!');
    }

    const backgroundBtn = document.getElementById('toggle-background');
    if (backgroundBtn) {
        backgroundBtn.addEventListener('click', toggleBackground);
        console.log('Background button initialized');
    } else {
        console.error('Background button not found!');
    }
    
    const resetCameraBtn = document.getElementById('reset-camera');
    if (resetCameraBtn) {
        resetCameraBtn.addEventListener('click', resetCamera);
        console.log('Reset camera button initialized');
    } else {
        console.error('Reset camera button not found!');
    }
    
    // Set up sliders for controlling lights
    const ambientLightSlider = document.getElementById('ambient-light');
    if (ambientLightSlider) {
        ambientLightSlider.addEventListener('input', handleAmbientLightChange);
        console.log('Ambient light slider initialized');
    } else {
        console.error('Ambient light slider not found!');
    }
    
    const directionalLightSlider = document.getElementById('directional-light');
    if (directionalLightSlider) {
        directionalLightSlider.addEventListener('input', handleDirectionalLightChange);
        console.log('Directional light slider initialized');
    } else {
        console.error('Directional light slider not found!');
    }

    // Click handling for object selection
    const rendererElement = renderer ? renderer.domElement : null;
    if (rendererElement) {
        rendererElement.addEventListener('click', handleClick);
        console.log('Renderer click handler initialized');
    } else {
        console.error('Renderer DOM element not found or not initialized yet!');
    }
    
    console.log('All event listeners set up successfully');
}

// Get appropriate loader for file type
function getLoaderForFile(filename) {
    const extension = filename.split('.').pop().toLowerCase();
    let loader;

    switch (extension) {
        case '3dm':
            loader = new Rhino3dmLoader();
            loader.setLibraryPath('https://cdn.jsdelivr.net/npm/rhino3dm@8.4.0/');
            loader.setWorkerLimit(1);
            break;
        case 'obj':
            loader = new OBJLoader();
            break;
        case 'stl':
            loader = new STLLoader();
            break;
        case 'gltf':
        case 'glb':
            loader = new GLTFLoader();
            break;
        default:
            return null;
    }

    // Add method to set request headers
    loader.setRequestHeader = function(headers) {
        if (!this.manager) {
            this.manager = new THREE.LoadingManager();
        }
        
        const originalLoad = this.manager.getHandler('xhr') || THREE.DefaultLoadingManager.getHandler('xhr');
        this.manager.setURLModifier((url) => {
            return url;
        });
        
        this.manager.addHandler(/.*/, {
            load: function(url, onLoad, onProgress, onError) {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                
                // Set headers
                Object.entries(headers).forEach(([key, value]) => {
                    xhr.setRequestHeader(key, value);
                });
                
                xhr.responseType = 'arraybuffer';
                
                xhr.onload = function() {
                    if (this.status === 200 || this.status === 0) {
                        onLoad(this.response);
                    } else {
                        onError(new Error(`Failed to load ${url}. Status: ${this.status}`));
                    }
                };
                
                xhr.onerror = function() {
                    onError(new Error(`Failed to load ${url}`));
                };
                
                xhr.onprogress = onProgress;
                xhr.send(null);
            }
        });
        
        return this;
    };

    return loader;
}

// Get loader for file path or object
function getLoaderForPath(path) {
    // If path is an object (typically a 3D model object), return a dummy loader
    if (typeof path === 'object') {
        // Create a simple loader that just returns the object
        return {
            load: (url, onLoad) => {
                onLoad(path);
            }
        };
    }
    
    // For string paths, use the existing getLoaderForFile function
    return getLoaderForFile(typeof path === 'string' ? path : path.name);
}

// Update the processOtherFile function to fix Content Security Policy issues when loading OBJ files
async function processOtherFile(file) {
    try {
            const loader = getLoaderForFile(file.name);
        if (!loader) {
            throw new Error(`Unsupported file format: ${file.name.split('.').pop()}`);
        }

        // Create a blob URL instead of using data URL
        const objectUrl = URL.createObjectURL(file);
        
        // Special handling for OBJ files
        const extension = file.name.split('.').pop().toLowerCase();
        if (extension === 'obj') {
            console.log(`Processing OBJ file: ${file.name}`);
            // For OBJ files we need to read the text content and pass it to the loader directly
            try {
                const fileContent = await readFileAsText(file);
                
                return new Promise((resolve, reject) => {
                    try {
                        // Parse OBJ content directly
                        const object = loader.parse(fileContent);
                        console.log(`[processOtherFile] Successfully parsed OBJ content for ${file.name}`);
                        
                        // Create model info object
                        const modelInfo = {
                            path: file.name,
                            name: file.name.split('/').pop().split('.')[0],
                            object: object,
                            originalPosition: new THREE.Vector3(),
                            originalScale: new THREE.Vector3(1, 1, 1),
                            boundingBox: new THREE.Box3().setFromObject(object),
                            selected: false,
                            visible: true,
                            material: null
                        };

                        // Add the model to the scene
                        scene.add(object);
                        
                        // Calculate bounding box
                        modelInfo.boundingBox = new THREE.Box3().setFromObject(object);
                        
                        // Add to models array
                        models.push(modelInfo);
                        
                        // Update UI
                        updateLoadedModelsUI();
                        
                        // Zoom to fit the new model
                        zoomToFit([modelInfo]);
                        
                        resolve(object);
                    } catch (error) {
                        console.error(`Error parsing OBJ content: ${error.message || 'Unknown error'}`);
                        reject(new Error(`Failed to parse ${file.name}: ${error.message || 'Unknown error'}`));
                    }
                    });
                } catch (error) {
                console.error(`Error reading OBJ file: ${error.message || 'Unknown error'}`);
                throw new Error(`Failed to read ${file.name}: ${error.message || 'Unknown error'}`);
            }
        }
        
        // For other file types, use the blob URL loading approach
        return new Promise((resolve, reject) => {
            try {
                loader.load(
                    objectUrl, 
                    (object) => {
                        console.log(`[processOtherFile] Successfully loaded ${file.name}`);
                        
                        // Create model info object
                        const modelInfo = {
                            path: file.name,
                            name: file.name.split('/').pop().split('.')[0],
                            object: object,
                            originalPosition: new THREE.Vector3(),
                            originalScale: new THREE.Vector3(1, 1, 1),
                            boundingBox: new THREE.Box3().setFromObject(object),
                            selected: false,
                            visible: true,
                            material: null
                        };

                        // Add the model to the scene
                        scene.add(object);
                        
                        // Calculate bounding box
                        modelInfo.boundingBox = new THREE.Box3().setFromObject(object);
                        
                        // Add to models array
                        models.push(modelInfo);
                        
                        // Update UI
                        updateLoadedModelsUI();
                        
                        // Zoom to fit the new model
                        zoomToFit([modelInfo]);
                        
                        // Revoke the blob URL after successful loading
                        URL.revokeObjectURL(objectUrl);
                        resolve(object);
                    },
                    (progress) => {
                        console.log(`Loading ${file.name}: ${Math.round(progress.loaded / progress.total * 100)}%`);
                    },
                    (error) => {
                        // Revoke the blob URL on error as well
                        URL.revokeObjectURL(objectUrl);
                        reject(new Error(`Failed to load ${file.name}: ${error.message || 'Unknown error'}`));
                    }
                );
            } catch (error) {
                // Make sure to revoke the URL in case of exceptions
                URL.revokeObjectURL(objectUrl);
                reject(new Error(`Failed to process ${file.name}: ${error.message || 'Unknown error'}`));
            }
        });
    } catch (error) {
        console.error(`Error processing ${file.name}: ${error.message}`);
        throw error;
    }
}

// Helper function to read a file as text
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            resolve(e.target.result);
        };
        reader.onerror = (e) => {
            reject(new Error(`Error reading file: ${e.target.error}`));
        };
        reader.readAsText(file);
    });
}

// Helper function to read a file as ArrayBuffer
function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
}

// Update meshing parameters for better quality
function getMeshingParameters(rhino) {
    const mp = new rhino.MeshingParameters();
    mp.gridMinCount = 20;      // Minimal number of grid quads in each direction (default: 16)
    mp.gridMaxCount = 100;     // Maximal number of grid quads in each direction (default: 64)
    mp.gridAngle = 0;          // Angle in degrees (default: 20)
    mp.gridAspectRatio = 1.0;  // The maximum allowed aspect ratio of grid quads (default: 6.0)
    mp.refineGrid = true;      // Whether to refine the grid to improve mesh quality
    mp.simplePlanes = false;   // Don't simplify planar areas to avoid triangulation issues
    mp.smoothNormals = true;   // Calculate smooth normals
    mp.normalAngle = 5;        // Normal angle between polygon faces to smooth (default: 20 degrees)
    mp.minimumEdgeLength = 0.0001;
    mp.maximumEdgeLength = 0.1;
    mp.texture3d = true;       // Generate 3d texture coordinates (default: false)
    mp.jaggedSeams = false;    // Optimize for smoothing across edges (default: false)
    mp.tolerance = 0.005;      // Tolerance setting to use for meshing (default: 0.01)
    return mp;
}

// Create mesh with improved material settings
function createMeshMaterial(color = 0xffd700, type = 'standard') {
    let material;
    
    if (type === 'standard') {
        material = new THREE.MeshStandardMaterial({
            color: color,
            metalness: 0.9,
            roughness: 0.1,
            envMapIntensity: 1.0,
            side: THREE.DoubleSide
        });
    } else if (type === 'physical') {
        material = new THREE.MeshPhysicalMaterial({
            color: color,
            metalness: 0.9,
            roughness: 0.1,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
            envMapIntensity: 1.0,
            side: THREE.DoubleSide
        });
    }

    return material;
}

// Update turntable animation
function updateTurntable() {
    if (isTurntableActive && selectedObject) {
        const delta = turntableClock.getDelta();
        const rotationSpeed = turntableSpeed * delta;
        
        // Apply smooth rotation to the actual object
        selectedObject.rotation.y += rotationSpeed;
        
        // Reset rotation after full circle
        if (selectedObject.rotation.y >= Math.PI * 2) {
            selectedObject.rotation.y = 0;
        }
    }
}

// Toggle turntable animation with improved handling
function toggleTurntable() {
    if (!selectedObject) {
        console.warn('No object selected for turntable animation');
        return;
    }
    
    isTurntableActive = !isTurntableActive;
    console.log("Turntable active:", isTurntableActive);
    
    const toggleTurntableBtn = document.getElementById('toggle-turntable');
    if (toggleTurntableBtn) {
        toggleTurntableBtn.classList.toggle('active', isTurntableActive);
    }
    
    if (isTurntableActive) {
        console.log('Starting turntable animation');
        controls.enableRotate = false; // Disable manual rotation during turntable
        turntableClock.start();
    } else {
        console.log('Stopping turntable animation');
        controls.enableRotate = true; // Re-enable manual rotation
        turntableClock.stop();
    }
}

// Improved handleFiles function with single path for loading 3DM files
async function handleFiles(files) {
    try {
        // Show loading indicator
        showLoadingIndicator();
        
        // Process each file
        for (const file of files) {
            if (!(file instanceof Blob)) {
                console.error('Invalid file object:', file);
                continue;
            }
            
            const extension = file.name.split('.').pop().toLowerCase();
            console.log('Processing file:', file.name, 'with extension:', extension);
            
            if (extension === '3dm') {
                await process3DMFile(file);
        } else {
                await processOtherFile(file);
            }
        }
    } catch (error) {
        console.error('Error processing files:', error);
        showErrorMessage('Error processing files: ' + error.message);
    } finally {
        hideLoadingIndicator();
    }
}

function toggleFloor() {
    if (groundPlane) {
        groundPlane.visible = !groundPlane.visible;
        const toggleFloorBtn = document.getElementById('toggle-floor');
        if (toggleFloorBtn) {
            toggleFloorBtn.classList.toggle('active', groundPlane.visible);
        }
    }
}

function toggleBackground() {
    isDarkBackground = !isDarkBackground;
    scene.background = new THREE.Color(isDarkBackground ? 0x000000 : 0xf0f0f0);
    
    // Update button state
    const toggleBackgroundBtn = document.getElementById('toggle-background');
    if (toggleBackgroundBtn) {
        toggleBackgroundBtn.classList.toggle('active', isDarkBackground);
    }
}

function toggleSidebar() {
    const controlsPanel = document.querySelector('.controls-panel');
    if (controlsPanel) {
        controlsPanel.classList.toggle('hidden');
    }
}

// Reset camera to default position
function resetCamera() {
    // If there's a selected object, center on it first
    if (selectedObject) {
        controls.target.copy(selectedObject.position);
    } else {
        controls.target.set(0, 0, 0);
    }
    
    const startPosition = camera.position.clone();
    const startTarget = controls.target.clone();
    
    // Calculate a good position based on scene content or selected object
    let targetPosition;
    if (selectedObject) {
        // Position camera at an angle to the selected object
        const box = new THREE.Box3().setFromObject(selectedObject);
        const size = box.getSize(new THREE.Vector3()).length();
        const distance = size * 2;
        targetPosition = new THREE.Vector3(
            selectedObject.position.x + distance * 0.8,
            selectedObject.position.y + distance * 0.7,
            selectedObject.position.z + distance * 0.8
        );
    } else {
        // Default position with good viewing angle
        targetPosition = new THREE.Vector3(5, 5, 5);
    }
    
    const duration = 1000;
    const startTime = Date.now();

    // Ensure rotation is enabled
    controls.enableRotate = true;

    function animateCamera() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease in-out function for smooth animation
        const easeProgress = progress < 0.5 
            ? 2 * progress * progress 
            : -1 + (4 - 2 * progress) * progress;

        camera.position.lerpVectors(startPosition, targetPosition, easeProgress);
        controls.target.lerpVectors(startTarget, selectedObject ? selectedObject.position : new THREE.Vector3(0, 0, 0), easeProgress);
        controls.update();

        if (progress < 1) {
            requestAnimationFrame(animateCamera);
        }
    }

    animateCamera();
}

// Add keyboard shortcuts handler
function setupKeyboardShortcuts() {
    window.addEventListener('keydown', function(event) {
        // Only process shortcuts if we're not in an input field
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
    }

        switch(event.key.toLowerCase()) {
            case ' ': // Space key to reset camera
                resetCamera();
                break;
            case 'f': // F key to toggle floor
                toggleFloor();
                break;
            case 'b': // B key to toggle background
                toggleBackground();
                break;
            case 't': // T key to toggle turntable
                toggleTurntable();
                break;
            case 'c': // C key to center model
                centerSelectedModel();
                break;
            case 'z': // Z key to fit selected model to view
                centerSelectedModel();
                break;
        }
    });
}

// Improved zoom to fit function
function zoomToFit(modelsToFit) { // Renamed parameter for clarity
    if (!Array.isArray(modelsToFit) || modelsToFit.length === 0) { // Check if it's a non-empty array
        console.warn('No valid models array provided to zoomToFit');
        return;
    }

    // Create a bounding box that will contain all models
    const boundingBox = new THREE.Box3();

    // Expand the bounding box to include all models in the array
    modelsToFit.forEach(modelData => { // Iterate through the array
        if (modelData && modelData.boundingBox) { // Check if model data and its boundingBox exist
            boundingBox.union(modelData.boundingBox);
        } else if (modelData && modelData.object) {
            // Fallback: calculate bounds if not pre-calculated
            const tempBox = new THREE.Box3().setFromObject(modelData.object);
            if (isValidBoundingBox(tempBox)) {
                boundingBox.union(tempBox);
                // Optionally store it back if missing
                if (!modelData.boundingBox) modelData.boundingBox = tempBox.clone(); 
            }
        }
    });

    // Check if we have a valid bounding box
    if (boundingBox.isEmpty() || !isValidBoundingBox(boundingBox)) { // Use helper
        console.warn('No valid geometry found to fit in view after checking models');
        return;
    }

    // Calculate the center and size of the bounding box
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());

    // Calculate the maximum dimension
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / Math.tan(fov / 2));

    // Add some padding
    cameraZ *= 1.5;

    // Position the camera
    // Use a consistent direction for zooming
    const direction = new THREE.Vector3(0, 0.5, 1).normalize(); // Slightly elevated view
    camera.position.copy(center).add(direction.multiplyScalar(cameraZ));
    camera.lookAt(center);

    // Update camera controls
    controls.target.copy(center);
    controls.update();

    // Update the camera's near and far planes based on the model size
    const minZ = Math.max(0.1, maxDim * 0.01);
    const maxZ = Math.max(1000, maxDim * 10);
    camera.near = minZ;
    camera.far = maxZ;
    camera.updateProjectionMatrix();
}

// Add centerSelectedModel function back
function centerSelectedModel() {
    if (selectedObject) {
        // Find the corresponding model data object in the models array
        const selectedModelData = models.find(m => m.object === selectedObject);
        if (selectedModelData) {
            zoomToFit([selectedModelData]); // Pass the model data object in an array
        } else {
             console.warn('Selected object not found in models array. Cannot center.');
        }
    } else {
        console.warn('No model selected to center');
    }
}

// Function has been moved to the exported version at line 2451
// Removed to fix duplicate declaration error
    
// Add helper function to validate a geometry's bounding box
function validateGeometry(geometry) {
    if (!geometry) return false;

    // First check if we need to compute the bounding box
    if (!geometry.boundingBox) {
        geometry.computeBoundingBox();
    }

    // Check if bounding box exists and has valid values
    if (!geometry.boundingBox) return false;

    const min = geometry.boundingBox.min;
    const max = geometry.boundingBox.max;

    // Check for NaN values
    if (isNaN(min.x) || isNaN(min.y) || isNaN(min.z) ||
        isNaN(max.x) || isNaN(max.y) || isNaN(max.z)) {
        return false;
    }

    // Check if bounding sphere needs to be computed
    if (!geometry.boundingSphere) {
        geometry.computeBoundingSphere();
    }

    // Check if bounding sphere exists and has valid values
    if (!geometry.boundingSphere) return false;
    
    // Check for NaN radius
    if (isNaN(geometry.boundingSphere.radius)) {
        return false;
    }

    return true;
}

// Add helper function to fix geometry with invalid bounding boxes
function fixGeometryBounds(geometry) {
    if (!geometry) return;

    // Get position attribute
    const positions = geometry.attributes.position;
    if (!positions) return;

    // Create a valid bounding box and sphere manually
    const validPoints = [];
    const bbox = new THREE.Box3();
    
    // Collect all valid points
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);
        
        if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
            const point = new THREE.Vector3(x, y, z);
            validPoints.push(point);
            bbox.expandByPoint(point);
        }
    }
    
    // If no valid points found, create a default tiny box at origin
    if (validPoints.length === 0) {
        bbox.min.set(-0.1, -0.1, -0.1);
        bbox.max.set(0.1, 0.1, 0.1);
    }
    
    geometry.boundingBox = bbox;
    
    // Calculate bounding sphere from bounding box
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    
    // Find the furthest point from center
    let maxRadiusSq = 0;
    for (const point of validPoints) {
        const distSq = center.distanceToSquared(point);
        maxRadiusSq = Math.max(maxRadiusSq, distSq);
    }
    
    // If no valid points were used, set a small default radius
    const radius = validPoints.length > 0 ? Math.sqrt(maxRadiusSq) : 0.1;
    geometry.boundingSphere = new THREE.Sphere(center, radius);
    
    console.log(`Fixed geometry bounds: bbox=(${bbox.min.toArray()}, ${bbox.max.toArray()}), sphere=(${center.toArray()}, ${radius})`);
}

// Update the positionAndScaleModel function to handle geometry issues
function positionAndScaleModel(object, model) {
    try {
        // Ensure the model is properly traversed to calculate accurate bounding box
        const box = new THREE.Box3();
        
        // Use recursive traversal to ensure we include all children in bounding box
        object.traverse(child => {
            if (child.isMesh) {
                // Force geometry to update bounds
                if (child.geometry) {
                    child.geometry.computeBoundingBox();
                    box.expandByObject(child);
                }
            }
        });
        
        // Check if the bounding box is valid (not infinite)
        if (!isValidBoundingBox(box)) {
            console.warn('Invalid bounding box detected, attempting to fix...');
            box.set(
                new THREE.Vector3(-1, -1, -1),
                new THREE.Vector3(1, 1, 1)
            );
        }
        
        // Additional checks and logging for debugging
        console.log('Model bounding box:', {
            min: box.min,
            max: box.max,
            size: box.getSize(new THREE.Vector3())
        });
        
        
        // Calculate center of the bounding box
        const center = new THREE.Vector3();
        box.getCenter(center);
        
        // Calculate the size of the bounding box
        const size = new THREE.Vector3();
        box.getSize(size);
        
        // Calculate the max dimension of the model
        const maxDim = Math.max(size.x, size.y, size.z);
        
        // Set a scale factor based on the size
        let scaleFactor = 1;
        
        // If the model is very small (common with CAD models), scale it up
        if (maxDim < 0.1) {
            scaleFactor = 10 / maxDim; // Scale to approximately 10 units
            console.log(`Model is very small (${maxDim}), scaling up by ${scaleFactor}`);
        }
        // If the model is very large, scale it down
        else if (maxDim > 100) {
            scaleFactor = 50 / maxDim; // Scale to approximately 50 units
            console.log(`Model is very large (${maxDim}), scaling down by ${scaleFactor}`);
        }
        
        // Apply scaling if needed
        if (scaleFactor !== 1) {
            object.scale.set(scaleFactor, scaleFactor, scaleFactor);
            
            // Update the bounding box after scaling
            box.setFromObject(object);
            box.getCenter(center);
            box.getSize(size);
        }
        
        // Center the object at the origin
        object.position.set(-center.x, -center.y, -center.z);
        
        // Store original position and scaling information in the model
        model.originalPosition = center.clone();
        model.originalScale = new THREE.Vector3(scaleFactor, scaleFactor, scaleFactor);
        model.boundingBox = box.clone();
        
        return true;
    } catch (error) {
        console.error('Error positioning and scaling model:', error);
        return false;
    }
}

// Update the original applyMaterial function
function applyMaterial(object, materialType) {
    if (!object) return;

    // If materialType is already a material instance, clone it
    const material = (materialType instanceof THREE.Material) 
        ? materialType.clone() 
        : (materialPresets[materialType] || materialPresets['gold']).clone();

    const handleMesh = (mesh) => {
        if (!mesh.isMesh) return;
        
        // Preserve any existing material properties that should persist
        if (mesh.material) {
            material.envMap = mesh.material.envMap || material.envMap;
            material.envMapIntensity = mesh.material.envMapIntensity || material.envMapIntensity;
        }

        mesh.material = material;
        mesh.material.needsUpdate = true;
    };

    if (object.isGroup) {
        object.traverse(child => handleMesh(child));
    } else {
        handleMesh(object);
    }
}

// Create outline for a mesh using the outlineMaterials
function createOutline(object) {
    if (!object) return null;
    
    try {
        // Determine material type, defaulting to 'gold'
        let materialType = 'gold';
        
        // Check if the object already has a material with a type
        if (object instanceof THREE.Mesh && object.material && object.material.userData && object.material.userData.materialType) {
            materialType = object.material.userData.materialType;
        }
        
        // Get the outline material or use default
        const outlineMaterial = outlineMaterials[materialType] || outlineMaterials['gold'];
        
        if (object instanceof THREE.Group) {
            // For groups, create a group of outlines
            const outlineGroup = new THREE.Group();
            
            object.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    const childOutline = createMeshOutline(child, outlineMaterial.clone());
                    if (childOutline) {
                        childOutline.visible = false; // Start with outline hidden
                        outlineGroup.add(childOutline);
                    }
                }
            });
            
            if (outlineGroup.children.length > 0) {
                outlineGroup.userData.isOutline = true;
                object.userData.outline = outlineGroup;
                return outlineGroup;
            }
            
            return null;
        } else if (object instanceof THREE.Mesh) {
            // For individual meshes
            const outline = createMeshOutline(object, outlineMaterial.clone());
            if (outline) {
                outline.visible = false; // Start with outline hidden
                outline.userData.isOutline = true;
                object.userData.outline = outline;
                return outline;
            }
        }
        
        return null;
    } catch (error) {
        console.error('Error creating outline:', error);
        return null;
    }
}

// Helper function to create an outline for a single mesh
function createMeshOutline(mesh, outlineMaterial) {
    if (!mesh || !mesh.geometry) return null;
    
    // Clone the geometry for the outline
    const geometry = mesh.geometry.clone();
    
    // Create the outline mesh
    const outline = new THREE.Mesh(geometry, outlineMaterial);
    
    // Copy the transform from original mesh
    outline.position.copy(mesh.position);
    outline.rotation.copy(mesh.rotation);
    outline.scale.copy(mesh.scale).multiplyScalar(1.05); // Slightly larger scale
    
    // Mark as outline for later identification
    outline.userData.isOutline = true;
    
    return outline;
}

// Add back updateModelListInSidebar function
function updateModelListInSidebar() {
    const modelListElement = document.getElementById('model-list-content');
    if (!modelListElement) {
        console.error('Model list element not found');
        return;
    }
    
    // Clear existing content
    modelListElement.innerHTML = '';
    
    if (models.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-model-list';
        emptyMessage.textContent = 'No models loaded. Click "Add Model" to get started.';
        modelListElement.appendChild(emptyMessage);
    } else {
    models.forEach((model, index) => {
        const item = document.createElement('div');
        item.className = `model-item ${model.selected ? 'selected' : ''}`;
            
            const label = document.createElement('label');
            label.className = 'model-label';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = model.visible;
        checkbox.addEventListener('change', () => toggleModelVisibility(index));
        
            const nameSpan = document.createElement('span');
            nameSpan.textContent = model.name;
            nameSpan.addEventListener('click', () => selectModel(index));
            
            const controlsDiv = document.createElement('div');
            controlsDiv.className = 'model-controls';
            
            // Visibility toggle
            const visibilityBtn = document.createElement('button');
            visibilityBtn.className = 'model-btn visibility-btn';
            visibilityBtn.innerHTML = `<i class="fas fa-eye${model.visible ? '' : '-slash'}"></i>`;
            visibilityBtn.title = model.visible ? 'Hide' : 'Show';
            visibilityBtn.addEventListener('click', () => toggleModelVisibility(index));
            
            // Material options
        const materialBtn = document.createElement('button');
            materialBtn.className = 'model-btn material-btn';
            materialBtn.innerHTML = `<i class="fas fa-palette"></i>`;
        materialBtn.title = 'Change Material';
            materialBtn.addEventListener('click', () => showMaterialDialog(index));
            
            // Delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'model-btn delete-btn';
            deleteBtn.innerHTML = `<i class="fas fa-trash"></i>`;
            deleteBtn.title = 'Remove Model';
            deleteBtn.addEventListener('click', () => {
                if (confirm(`Are you sure you want to remove "${model.name}"?`)) {
            removeModel(index);
                }
            });
            
            // Add all buttons to controls
            controlsDiv.appendChild(visibilityBtn);
            controlsDiv.appendChild(materialBtn);
            controlsDiv.appendChild(deleteBtn);
            
            // Assemble the item
            label.appendChild(checkbox);
            label.appendChild(nameSpan);
        item.appendChild(label);
            item.appendChild(controlsDiv);
            modelListElement.appendChild(item);
        });
    }
    
    // Always add "Add More Models" button
    const addMoreBtn = document.createElement('button');
    addMoreBtn.className = 'add-more-models-btn';
    addMoreBtn.innerHTML = '<i class="fas fa-plus"></i> Add More Models';
    addMoreBtn.addEventListener('click', () => {
        document.getElementById('file-input').click();
    });
    
    modelListElement.appendChild(addMoreBtn);
}

// Create a more suitable environment map for jewelry
function createJewelryEnvironmentMap(renderer) {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    
    // Create a simple environment with studio-like lighting
    const cubeRenderTarget = pmremGenerator.fromScene(createStudioScene(), 0.04);
    const envMap = cubeRenderTarget.texture;
    
    // Clean up resources
    cubeRenderTarget.dispose();
    pmremGenerator.dispose();
    
    return envMap;
}

// Create a studio-like environment for the reflections
function createStudioScene() {
    const scene = new THREE.Scene();
    
    // Top light
    const topLight = new THREE.DirectionalLight(0xffffff, 1.0);
    topLight.position.set(0, 10, 0);
    scene.add(topLight);
    
    // Front light
    const frontLight = new THREE.DirectionalLight(0xffffff, 0.8);
    frontLight.position.set(0, 0, 10);
    scene.add(frontLight);
    
    // Back light
    const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
    backLight.position.set(0, 0, -10);
    scene.add(backLight);
    
    // Side lights
    const rightLight = new THREE.DirectionalLight(0xffffff, 0.5);
    rightLight.position.set(10, 0, 0);
    scene.add(rightLight);
    
    const leftLight = new THREE.DirectionalLight(0xffffff, 0.5);
    leftLight.position.set(-10, 0, 0);
    scene.add(leftLight);
    
    // Create a large sphere to act as the environment
    const geometry = new THREE.SphereGeometry(100, 32, 32);
    const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.BackSide,
        fog: false
    });
    
    // Create a gradient material for the background
    const vertexShader = `
        varying vec3 vWorldPosition;
        void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;
    
    const fragmentShader = `
        varying vec3 vWorldPosition;
        void main() {
            vec3 topColor = vec3(0.8, 0.8, 0.9); // Light blue-gray
            vec3 bottomColor = vec3(0.3, 0.3, 0.4); // Dark blue-gray
            float h = normalize(vWorldPosition).y;
            gl_FragColor = vec4(mix(bottomColor, topColor, max(0.0, h)), 1.0);
        }
    `;
    
    const gradientMaterial = new THREE.ShaderMaterial({
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        side: THREE.BackSide
    });
    
    const sphere = new THREE.Mesh(geometry, gradientMaterial);
    scene.add(sphere);
    
    return scene;
}

// Update environment map loading
async function loadEnvironmentMap() {
    try {
        // Create default environment map
        const envMap = createDefaultEnvironment();
        scene.environment = envMap;
        scene.background = new THREE.Color(0xf0f0f0);
        
        // Update material presets with environment map
        Object.values(materialPresets).forEach(material => {
            material.envMap = envMap;
            material.needsUpdate = true;
        });
    } catch (error) {
        console.warn('Failed to create environment map:', error);
    }
}

// Add setupLights function that was referenced but not defined
function setupLights() {
    // Ambient light
    ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Directional light
    directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Add additional lights for better material rendering
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.2);
    rimLight.position.set(0, -5, 5);
    scene.add(rimLight);
}

// Add setupControls function that was referenced but not defined
function setupControls() {
    // Create camera controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.rotateSpeed = 0.5;
    controls.minDistance = 1;
    controls.maxDistance = 1000;
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0.5;
    controls.target.set(0, 0, 0);
    controls.saveState();

    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize() {
    // Update camera aspect ratio and projection matrix
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    
    // Update renderer size
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Update composer if it exists
    if (window.composer) {
        composer.setSize(window.innerWidth, window.innerHeight);
    }
}

// Show error message function
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
    
    document.body.appendChild(errorDiv);
    
    // Add event listener to close button
    const closeBtn = document.getElementById('error-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(errorDiv);
        });
    }
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (document.body.contains(errorDiv)) {
            document.body.removeChild(errorDiv);
        }
    }, 10000);
}

// Add improved wheel zoom handler to make zooming more precise
function onWheel(event) {
    // Prevent the default scroll behavior
    event.preventDefault();
    
    if (!controls) return;
    
    // Calculate zoom factor based on wheel delta
    const zoomFactor = 0.05;
    const delta = -Math.sign(event.deltaY) * zoomFactor;
    
    // Get current distance to target
    const distance = camera.position.distanceTo(controls.target);
    
    // Calculate new distance with exponential scaling for smoother zoom
    const newDistance = distance * (1 - delta);
    
    // Clamp to min/max distance
    const clampedDistance = THREE.MathUtils.clamp(
        newDistance,
        controls.minDistance,
        controls.maxDistance
    );
    
    // Only apply zoom if the distance is changing
    if (clampedDistance !== distance) {
        // Save camera up vector to prevent auto reorientation
        const upVector = camera.up.clone();
        
        // Apply the zoom by scaling the camera position
        const direction = camera.position.clone().sub(controls.target).normalize();
        camera.position.copy(controls.target).add(direction.multiplyScalar(clampedDistance));
        
        // Restore up vector to prevent camera roll
        camera.up.copy(upVector);
        
        controls.update();
    }
}

// Using existing validateGeometry and fixGeometryBounds functions defined earlier

// Helper function to check if a bounding box is valid
function isValidBoundingBox(box) {
    // Check if the bounding box has valid dimensions
    return (
        !isNaN(box.min.x) && !isNaN(box.min.y) && !isNaN(box.min.z) &&
        !isNaN(box.max.x) && !isNaN(box.max.y) && !isNaN(box.max.z) &&
        isFinite(box.min.x) && isFinite(box.min.y) && isFinite(box.min.z) &&
        isFinite(box.max.x) && isFinite(box.max.y) && isFinite(box.max.z) &&
        box.max.x >= box.min.x && box.max.y >= box.min.y && box.max.z >= box.min.z
    );
}

// Helper function to extract filename from path
function getFileNameFromPath(path) {
    if (!path) return "Unknown Model";
    
    // Handle both file objects and path strings
    if (typeof path === 'object' && path.name) {
        return path.name;
    }
    
    // Handle path strings
    if (typeof path === 'string') {
        // Remove query parameters if any
        const pathWithoutQuery = path.split('?')[0];
        
        // Split by forward slash or backslash and get the last element
        const parts = pathWithoutQuery.split(/[\/\\]/);
        return parts[parts.length - 1];
    }
    
    return "Unknown Model";
}

// Helper function to get a model's mesh regardless of structure
function getModelMesh(model) {
    if (!model) return null;
    
    // Support both legacy 'mesh' and newer 'object' references
    return model.object || model.mesh || null;
}

// Function to clear the scene (lowercase version for process3DMFile)
function clearScene() {
    // Just call the original ClearScene function
    ClearScene();
}

// Function to fit camera to a collection of objects
function fitCameraToObject(sceneToFit, objects, offset = 1.25) {
    // Create a bounding box for all objects
    const boundingBox = new THREE.Box3();
    
    // Handle both arrays and individual objects
    const objectsToFit = Array.isArray(objects) ? objects : [objects];
    
    // Add each object to the bounding box
    for (const object of objectsToFit) {
        if (object) {
            // Make sure world matrix is updated
            object.updateMatrixWorld(true);
            
            // Create a temporary box for this object
            const tempBox = new THREE.Box3().setFromObject(object);
            
            // Skip invalid boxes
            if (tempBox.isEmpty() || 
                !isFinite(tempBox.min.x) || !isFinite(tempBox.min.y) || !isFinite(tempBox.min.z) ||
                !isFinite(tempBox.max.x) || !isFinite(tempBox.max.y) || !isFinite(tempBox.max.z)) {
                continue;
            }
            
            // Expand the main box
            boundingBox.union(tempBox);
        }
    }
    
    // If the box is still empty or invalid, return
    if (boundingBox.isEmpty() || 
        !isFinite(boundingBox.min.x) || !isFinite(boundingBox.min.y) || !isFinite(boundingBox.min.z) ||
        !isFinite(boundingBox.max.x) || !isFinite(boundingBox.max.y) || !isFinite(boundingBox.max.z)) {
        console.warn('Invalid bounding box, cannot fit camera');
        return;
    }
    
    // Get the bounding sphere
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    
    // Calculate optimal camera distance
    let cameraDistance = (maxDim / 2) / Math.tan(fov / 2);
    cameraDistance *= offset; // Add some padding
    
    // Position camera
    const direction = new THREE.Vector3(1, 0.7, 1).normalize();
    camera.position.copy(center).add(direction.multiplyScalar(cameraDistance));
    camera.lookAt(center);
    
    // Update controls
    if (controls) {
        controls.target.copy(center);
        controls.update();
    }
}

// Function to validate mesh geometry
function validateMeshGeometry(geometry) {
    // Basic validation check for geometry
    if (!geometry) return false;
    
    // Check for position attribute
    if (!geometry.attributes || !geometry.attributes.position) return false;
    
    // Check that we have at least some vertices
    const positionArray = geometry.attributes.position.array;
    return positionArray && positionArray.length > 0;
}

// Converts Rhino mesh to THREE.js BufferGeometry
function rhinoMeshToThreeGeometry(rhinoMesh) {
    try {
        // Get the mesh attributes first
        const attributes = rhinoMesh.attributes();
        if (!attributes) {
            console.warn('No attributes found for Rhino mesh');
        }

        // Create geometry
        const geometry = new THREE.BufferGeometry();
        
        // Get vertices
        const vertices = rhinoMesh.vertices();
        if (!vertices) {
            throw new Error('No vertices found in Rhino mesh');
        }
        
        // Get faces
        const faces = rhinoMesh.faces();
        if (!faces) {
            throw new Error('No faces found in Rhino mesh');
        }
        
        // Create position buffer
        const positions = new Float32Array(faces.count * 3 * 3);
        const normals = new Float32Array(faces.count * 3 * 3);
        
        // Process each face
        for (let faceIndex = 0; faceIndex < faces.count; faceIndex++) {
            const face = faces.get(faceIndex);
            
            // Get vertices for this face
            for (let i = 0; i < 3; i++) {
                const vertexIndex = face[i];
                const vertex = vertices.get(vertexIndex);
                
                const posIndex = (faceIndex * 9) + (i * 3);
                positions[posIndex] = vertex[0];
                positions[posIndex + 1] = vertex[1];
                positions[posIndex + 2] = vertex[2];
            }
            
            // Calculate face normal
            const v1 = new THREE.Vector3(positions[faceIndex * 9], positions[faceIndex * 9 + 1], positions[faceIndex * 9 + 2]);
            const v2 = new THREE.Vector3(positions[faceIndex * 9 + 3], positions[faceIndex * 9 + 4], positions[faceIndex * 9 + 5]);
            const v3 = new THREE.Vector3(positions[faceIndex * 9 + 6], positions[faceIndex * 9 + 7], positions[faceIndex * 9 + 8]);
            
            const normal = new THREE.Vector3()
                .subVectors(v2, v1)
                .cross(new THREE.Vector3().subVectors(v3, v1))
                .normalize();
            
            // Set the same normal for all vertices of this face
            for (let i = 0; i < 3; i++) {
                const normalIndex = (faceIndex * 9) + (i * 3);
                normals[normalIndex] = normal.x;
                normals[normalIndex + 1] = normal.y;
                normals[normalIndex + 2] = normal.z;
            }
        }
        
        // Set attributes
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        
        // Handle texture coordinates if present
        const textureCoordinates = rhinoMesh.textureCoordinates();
        if (textureCoordinates && textureCoordinates.count > 0) {
            const uvs = new Float32Array(faces.count * 2 * 3);
            for (let faceIndex = 0; faceIndex < faces.count; faceIndex++) {
                const face = faces.get(faceIndex);
                for (let i = 0; i < 3; i++) {
                    const vertexIndex = face[i];
                    const uv = textureCoordinates.get(vertexIndex);
                    const uvIndex = (faceIndex * 6) + (i * 2);
                    uvs[uvIndex] = uv[0];
                    uvs[uvIndex + 1] = uv[1];
                }
            }
            geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        }
        
        // Handle decals if present
        if (attributes && attributes.decals) {
            geometry.userData.decals = attributes.decals;
        }
        
        // Store original Rhino attributes in userData
        if (attributes) {
            geometry.userData.rhinoAttributes = {
                name: attributes.name || '',
                layer: attributes.layer || '',
                material: attributes.material || null,
                userStrings: attributes.getUserStrings ? attributes.getUserStrings() : []
            };
        }
        
        // Compute bounds
        geometry.computeBoundingSphere();
        geometry.computeBoundingBox();
        
        return geometry;
    } catch (error) {
        console.error('Error converting Rhino mesh to Three.js geometry:', error);
        throw error;
    }
}

// Process 3DM file - using the simplified version from our last update
async function process3DMFile(file) {
    try {
        showLoadingIndicator();
        
        // Initialize rhino3dm
        if (!window.rhino3dm) {
            throw new Error('rhino3dm library not loaded');
        }
        
        const rhino = await window.rhino3dm();
        if (!rhino) {
            throw new Error('Failed to initialize rhino3dm');
        }

        console.log('Processing 3DM file:', file.name);

        // Read file as ArrayBuffer
        const buffer = await readFileAsArrayBuffer(file);
        console.log('File loaded as ArrayBuffer, size:', buffer.byteLength);

        // Create File3dm from buffer
        const doc = await rhino.File3dm.fromByteArray(buffer);
        if (!doc) {
            throw new Error('Failed to parse 3DM file');
        }

        // Create model container
        const modelInfo = {
            path: file.name,
            name: file.name.split('/').pop().split('.')[0],
            object: new THREE.Group(),
            originalPosition: new THREE.Vector3(),
            originalScale: new THREE.Vector3(1, 1, 1),
            boundingBox: null,
            selected: false,
            visible: true,
            material: currentMaterial || 'gold'
        };

        // Get all objects from the document
        const objects = doc.objects();
        const objectCount = objects.count;
        console.log(`Found ${objectCount} objects in file`);

        let processedCount = 0;
        let errorCount = 0;

        // Process each object
        for (let i = 0; i < objectCount; i++) {
            try {
                const rhinoObject = objects.get(i);
                if (!rhinoObject) continue;

                const geometry = rhinoObject.geometry();
                if (!geometry) {
                    console.log(`Object ${i}: No geometry`);
                    continue;
                }

                console.log(`Processing object ${i}, type:`, geometry.objectType);

                let mesh = null;

                // Handle different geometry types
                if (geometry.objectType === rhino.ObjectType.Mesh) {
                    // Direct mesh conversion
                    mesh = await convertRhinoMeshToThree(geometry, rhino);
                } else if (geometry.objectType === rhino.ObjectType.Brep) {
                    // Convert Brep to mesh
                    const meshes = await convertBrepToMeshes(geometry, rhino);
                    if (meshes && meshes.length > 0) {
                        const group = new THREE.Group();
                        meshes.forEach(m => {
                            if (m) group.add(m);
                        });
                        mesh = group;
                    }
                } else if (geometry.objectType === rhino.ObjectType.SubD) {
                    // Convert SubD to mesh
                    const meshGeometry = geometry.toMesh();
                    if (meshGeometry) {
                        mesh = await convertRhinoMeshToThree(meshGeometry, rhino);
                        meshGeometry.delete();
                    }
                }

                if (mesh) {
                    // Apply any attributes (layer, material, etc)
                    const attributes = rhinoObject.attributes();
                    if (attributes) {
                        // Store attributes in userData
                        mesh.userData.attributes = {
                            name: attributes.name || '',
                            layerIndex: attributes.layerIndex,
                            materialIndex: attributes.materialIndex,
                            materialSource: attributes.materialSource
                        };

                        // Handle user strings if available
                        if (typeof attributes.getUserStrings === 'function') {
                            try {
                                const userStrings = attributes.getUserStrings();
                                if (userStrings && userStrings.length > 0) {
                                    mesh.userData.userStrings = userStrings;
                                }
                            } catch (e) {
                                console.warn('Error getting user strings:', e);
                            }
                        }

                        attributes.delete();
                    }

                    modelInfo.object.add(mesh);
                    processedCount++;
                }

                // Clean up
                if (geometry) geometry.delete();
                rhinoObject.delete();

            } catch (error) {
                console.error(`Error processing object ${i}:`, error);
                errorCount++;
            }
        }

        // Clean up document
        doc.delete();

        console.log(`Processed ${processedCount} objects, ${errorCount} errors`);

        if (processedCount === 0) {
            throw new Error('No valid geometry found in file');
        }

        // Add to scene
        scene.add(modelInfo.object);

        // Apply material
        applyMaterial(modelInfo.object, modelInfo.material);

        // Calculate bounding box
        modelInfo.boundingBox = new THREE.Box3().setFromObject(modelInfo.object);

        // Add to models array
        models.push(modelInfo);

        // Update UI
        updateLoadedModelsUI();

        // Center and fit camera
        zoomToFit([modelInfo]);

        hideLoadingIndicator();
        return modelInfo;

    } catch (error) {
        console.error('Error processing 3DM file:', error);
        hideLoadingIndicator();
        showErrorMessage(`Failed to load 3DM file: ${error.message}`);
        throw error;
    }
}

// Helper function to convert Rhino mesh to Three.js mesh
async function convertRhinoMeshToThree(rhinoMesh, rhino) {
    try {
        // First check if we have a valid mesh
        if (!rhinoMesh || !rhino) {
            console.warn('Invalid rhinoMesh or rhino instance');
            return null;
        }

        // Get the mesh vertices
        const vertices = rhinoMesh.vertices();
        if (!vertices || vertices.count < 3) {
            console.warn('Mesh has insufficient vertices');
            return null;
        }

        // Get the mesh faces
        const faces = rhinoMesh.faces();
        if (!faces || faces.count < 1) {
            console.warn('Mesh has no faces');
            return null;
        }

        // Create geometry
        const geometry = new THREE.BufferGeometry();
        
        // Create arrays for vertices and faces
        const positions = new Float32Array(faces.count * 3 * 3); // 3 vertices per face, 3 components per vertex
        const indices = new Uint32Array(faces.count * 3);
        
        // Process faces and vertices
        for (let faceIndex = 0; faceIndex < faces.count; faceIndex++) {
            const face = faces.get(faceIndex);
            
            // Get vertices for this face
            for (let i = 0; i < 3; i++) {
                const vertexIndex = face[i];
                const vertex = vertices.get(vertexIndex);
                
                const posIndex = (faceIndex * 9) + (i * 3);
                positions[posIndex] = vertex[0];
                positions[posIndex + 1] = vertex[1];
                positions[posIndex + 2] = vertex[2];
                
                indices[faceIndex * 3 + i] = faceIndex * 3 + i;
            }
        }
        
        // Set geometry attributes
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        
        // Compute vertex normals
        geometry.computeVertexNormals();
        
        // Create mesh with standard material
        const material = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            metalness: 0.8,
            roughness: 0.2,
            side: THREE.DoubleSide
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        
        // Clean up rhino objects
        vertices.delete();
        faces.delete();
        
        return mesh;
    } catch (error) {
        console.error('Error converting Rhino mesh:', error);
        return null;
    }
}

// Helper function to convert Brep to meshes
async function convertBrepToMeshes(brep, rhino) {
    const meshes = [];
    try {
        // Create meshing parameters
        const mp = new rhino.MeshingParameters();
        mp.gridMinCount = 16;
        mp.gridMaxCount = 64;
        mp.simplePlanes = false;
        mp.refineGrid = true;
        
        // Get Brep faces
        const faces = brep.faces();
        for (let i = 0; i < faces.count; i++) {
            const face = faces.get(i);
            const mesh = face.getMesh(rhino.MeshType.Any);
            
            if (mesh) {
                const threeMesh = await convertRhinoMeshToThree(mesh, rhino);
                if (threeMesh) {
                    meshes.push(threeMesh);
                }
                mesh.delete();
            }
            face.delete();
        }
        faces.delete();
        
    } catch (error) {
        console.error('Error converting Brep to meshes:', error);
    }
    return meshes;
}

// Helper function to apply Rhino attributes to Three.js mesh
function applyRhinoAttributes(mesh, attributes) {
    if (!mesh || !attributes) return;

    try {
        // Apply name if available
        if (attributes.name) {
            mesh.name = attributes.name;
        }
        
        // Apply layer info if available
        if (attributes.layerIndex !== undefined) {
            mesh.userData.layerIndex = attributes.layerIndex;
        }
        
        // Safely handle user strings
        if (typeof attributes.getUserStrings === 'function') {
            try {
                const userStrings = attributes.getUserStrings();
                if (userStrings && userStrings.length > 0) {
                    mesh.userData.userStrings = userStrings;
                }
            } catch (error) {
                console.warn('Error getting user strings:', error);
            }
        }
        
        // Safely handle material attributes
        if (attributes.materialSource !== undefined) {
            mesh.userData.materialSource = attributes.materialSource;
        }
        
        if (attributes.materialIndex !== undefined) {
            mesh.userData.materialIndex = attributes.materialIndex;
        }

        // Safely handle decals
        if (attributes.decals) {
            try {
                let decalData;
                // Check if decals is a function, property, or direct data
                if (typeof attributes.decals === 'function') {
                    decalData = attributes.decals();
                } else if (attributes.decals.getData && typeof attributes.decals.getData === 'function') {
                    decalData = attributes.decals.getData();
                } else {
                    decalData = attributes.decals;
                }
                
                if (decalData) {
                    mesh.userData.decals = decalData;
                }
            } catch (decalError) {
                console.warn('Non-critical error handling decals:', decalError);
                // Continue without decals rather than failing
            }
        }

        // Safely handle user dictionary if available
        if (typeof attributes.getUserDictionary === 'function') {
            try {
                const userDict = attributes.getUserDictionary();
                if (userDict) {
                    mesh.userData.userDictionary = userDict;
                }
            } catch (error) {
                console.warn('Error getting user dictionary:', error);
            }
        }
        
    } catch (error) {
        console.error('Error applying Rhino attributes:', error);
        // Continue without failing - we don't want attribute errors to prevent model loading
    }
}

// Animation loop function
function animate() {
    requestAnimationFrame(animate);
    
    // Update controls
    if (controls) {
        controls.update();
    }
    
    // Update turntable if active
    if (isTurntableActive && selectedObject) {
        if (!turntableClock.running) {
            turntableClock.start();
        }
        const delta = turntableClock.getDelta();
        selectedObject.rotation.y += turntableSpeed * delta;
    }
    
    // Render the scene with composer for post-processing effects
    if (composer) {
        composer.render();
    } else if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

// Initialize the application when the DOM content is loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Show loading indicator
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'flex';
    }
    
    try {
        // Initialize the application
        // initializeApp is now called from index.html depending on URL params
        // await initializeApp(); 
        
        // Hide loading indicator (will be hidden in index.html after init/load)
        // if (loadingIndicator) {
        //     loadingIndicator.style.display = 'none';
        // }
    } catch (error) {
        console.error('Error during initialization:', error);
        // Hide loading indicator even if there's an error
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        // Show error message
        // Use the globally defined showErrorMessage from index.html
        if (window.showErrorMessage) {
            window.showErrorMessage('Error initializing the application: ' + error.message);
        } else {
            alert('Error initializing the application: ' + error.message);
        }
    }
});

// Expose necessary functions to global scope for UI interaction
window.toggleModelVisibility = function(modelIndex) {
    const model = models[modelIndex];
    if (!model || !model.object) return;

    model.visible = !model.visible;
    model.object.visible = model.visible;
    // Note: Outlines were removed in previous steps, keep this commented or remove
    // if (model.outline) {
    //     model.outline.visible = model.visible;
    // }

    // Update UI
    updateLoadedModelsUI(); // Use the correct UI update function

    // Force a render update
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
};

window.showMaterialDialog = function(modelIndex) {
    // Create dialog container
    const dialog = document.createElement('div');
    dialog.className = 'material-dialog';
    
    // Create dialog content
    const content = document.createElement('div');
    content.className = 'dialog-content';
    
    // Add title
    const title = document.createElement('h3');
    title.textContent = 'Select Material';
    content.appendChild(title);
    
    // Create material select
    const select = document.createElement('select');
    select.innerHTML = `
        <option value="gold">Yellow Gold (High Quality)</option>
        <option value="rose-gold">Rose Gold (High Quality)</option>
        <option value="white-gold">White Gold (High Quality)</option>
        <option value="fast-gold">Yellow Gold (Fast Render)</option>
        <option value="fast-rose-gold">Rose Gold (Fast Render)</option>
        <option value="fast-white-gold">White Gold (Fast Render)</option>
    `;
    // Pre-select the current material
    const currentModel = models[modelIndex];
    if (currentModel && currentModel.material) {
        select.value = currentModel.material;
    }
    content.appendChild(select);
    
    // Create buttons container
    const buttons = document.createElement('div');
    buttons.className = 'dialog-buttons';
    
    // Create apply button
    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Apply';
    applyBtn.onclick = () => {
        applyMaterialToModel(modelIndex, select.value);
        document.body.removeChild(dialog);
    };
    
    // Create cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => {
        document.body.removeChild(dialog);
    };
    
    buttons.appendChild(applyBtn);
    buttons.appendChild(cancelBtn);
    content.appendChild(buttons);
    
    // Add content to dialog
    dialog.appendChild(content);
    
    // Add dialog to body
    document.body.appendChild(dialog);
};

window.removeModel = function(modelIndex) {
    if (modelIndex < 0 || modelIndex >= models.length) {
        console.error('Invalid model index for removal', modelIndex);
        return;
    }
    
    const model = models[modelIndex];
    if (!model) {
        console.error('Model not found at index', modelIndex);
        return;
    }

    if (!confirm(`Are you sure you want to remove "${model.name}"?`)) {
        return;
    }

    // Remove from scene
    if (model.object) {
        scene.remove(model.object);
        // Dispose geometry and materials
        model.object.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => mat.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
    }

    // Remove from models array
    models.splice(modelIndex, 1);

    // If the removed model was selected, clear selection
    if (selectedObject === model.object) { // Compare objects
        selectedObject = null;
        // Potentially update UI to reflect no selection
    }

    // Update UI
    updateLoadedModelsUI();

    // Force a render update
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
};

// Export only the necessary functions for index.html
export { initializeApp, process3DMFile };

// --- Add back missing UI handlers --- 

function handleAmbientLightChange(event) {
    const intensity = parseFloat(event.target.value);
    if (ambientLight) {
        ambientLight.intensity = intensity;
    }
}

function handleDirectionalLightChange(event) {
    if (!directionalLight) return;
    
    const intensity = parseFloat(event.target.value);
    directionalLight.intensity = intensity;
    
    // Update the scene to reflect the changes
    if (renderer && scene && camera) { // Add check
        renderer.render(scene, camera);
    }
}

function handleClick(event) {
    if (!renderer || !camera || !scene) return;

    // Calculate mouse position in normalized device coordinates
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Create raycaster
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    // Find intersections
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        // Find the first mesh in the intersection
        let intersectedObject = intersects[0].object;
        
        // Traverse up to find the main model group if part of a complex object
        let targetModel = null;
        while (intersectedObject) {
            // Find the model object associated with this intersected part
            targetModel = models.find(m => m.object === intersectedObject);
            if (targetModel) break; 
            intersectedObject = intersectedObject.parent;
        }
        
        if (targetModel) {
            const modelIndex = models.indexOf(targetModel);
            selectModel(modelIndex); // Use selectModel to handle selection logic
        }

    } else {
        // Deselect if clicking empty space
        selectModel(-1); // Pass -1 or null to deselect
    }
}

// Update model list UI
function updateLoadedModelsUI() {
    const modelListContent = document.getElementById('model-list-content');
    if (!modelListContent) {
        console.error("Model list content element not found!");
        return;
    }

    // Clear existing content
    modelListContent.innerHTML = '';

    if (models.length === 0) {
        modelListContent.innerHTML = '<div class="empty-model-list">No models loaded</div>';
    } else {
        // Create model list items
        models.forEach((model, index) => {
            const modelItem = document.createElement('div');
            // Check if this model is the selected one by comparing object references
            const isSelected = selectedObject && selectedObject === model.object;
            modelItem.className = `model-item ${isSelected ? 'selected' : ''}`;
            
            const modelLabel = document.createElement('div');
            modelLabel.className = 'model-label';
            modelLabel.innerHTML = `
                <span>${model.name || 'Unnamed Model'}</span>
            `;
             // Add click listener to the label/name to select the model
            modelLabel.onclick = (event) => {
                event.stopPropagation(); // Prevent triggering click on the parent div if needed
                selectModel(index);
            };
            
            const modelControls = document.createElement('div');
            modelControls.className = 'model-controls';
            modelControls.innerHTML = `
                <button class="model-action-btn visibility-btn" title="Toggle Visibility" onclick="window.toggleModelVisibility(${index})">
                    <i class="fas ${model.visible ? 'fa-eye' : 'fa-eye-slash'}"></i>
                </button>
                <button class="model-action-btn material-btn" title="Change Material" onclick="window.showMaterialDialog(${index})">
                    <i class="fas fa-palette"></i>
                </button>
                <button class="model-action-btn delete-btn" title="Remove Model" onclick="window.removeModel(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            `;

            modelItem.appendChild(modelLabel);
            modelItem.appendChild(modelControls);
            modelListContent.appendChild(modelItem);
        });
    }

    // Add "Add More Files" button at the bottom
    const addMoreButton = document.createElement('button');
    addMoreButton.className = 'add-more-models-btn';
    addMoreButton.innerHTML = '<i class="fas fa-plus"></i> Add More Files';
    addMoreButton.onclick = () => {
        // Trigger the hidden file input in index.html
        const fileInput = document.getElementById('file-input');
        if (fileInput) {
            fileInput.click();
        } else {
            console.error('File input not found');
        }
    };
    modelListContent.appendChild(addMoreButton);
}

// Updated selectModel function
function selectModel(modelIndex) {
    // Deselect previous model
    if (selectedObject) {
        const prevModelData = models.find(m => m.object === selectedObject);
        if (prevModelData) {
             // Visually deselect (e.g., remove highlight or emissive)
            selectedObject.traverse((child) => {
                if (child.isMesh && child.material.emissive) {
                    child.material.emissive.setHex(0x000000);
                }
            });
        }
        selectedObject = null; // Clear the reference
    }

    // Select new model if index is valid
    if (modelIndex >= 0 && modelIndex < models.length) {
        const modelData = models[modelIndex];
        if (modelData && modelData.object) {
            selectedObject = modelData.object; // Store reference to the main THREE.Object3D
            // Visually select (e.g., add highlight or emissive)
             selectedObject.traverse((child) => {
                if (child.isMesh && child.material.emissive) {
                    child.material.emissive.setHex(0x444444); // Subtle selection glow
                }
            });
            console.log('Selected model:', modelData.name || 'Unnamed Model');
        } else {
             console.warn('Attempted to select invalid model at index:', modelIndex);
        }
    } else {
         console.log('Deselected model');
    }

    // Update UI to reflect the new selection state
    updateLoadedModelsUI();
}

// --- End of added UI handlers ---

// Add applyMaterialToModel function definition here
function applyMaterialToModel(modelIndex, materialType) {
    if (modelIndex < 0 || modelIndex >= models.length) {
        console.error('Invalid model index for applying material:', modelIndex);
        return;
    }
    
    const model = models[modelIndex];
    if (!model || !model.object) {
        console.error('Model or model object not found for material application at index:', modelIndex);
        return;
    }
    
    console.log(`Applying material '${materialType}' to model '${model.name}'`);
    
    // Apply material to the object and all its children recursively
    model.object.traverse((child) => {
        if (child.isMesh) {
            // Use the original applyMaterial function which handles cloning and env maps
            applyMaterial(child, materialType);
        }
    });
    
    // Update the model's stored material type
    model.material = materialType; // Store the selected material type key
    
    // Force a render update to show the new material
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}





