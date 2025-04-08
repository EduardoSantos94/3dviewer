import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Rhino3dmLoader } from 'three/addons/loaders/3DMLoader.js';

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

// Function to check if rhino3dm is loaded
function isRhino3dmLoaded() {
    const loaded = typeof rhino3dm !== 'undefined';
    console.log('Checking if rhino3dm is loaded:', loaded, typeof rhino3dm);
    return loaded;
}

// Function to wait for rhino3dm to load with better error handling
async function initRhino3dm() {
    console.log('Starting rhino3dm initialization...');
    
    if (!isRhino3dmLoaded()) {
        console.log('Waiting for rhino3dm to load...');
        // Wait for a short time to allow the script to load
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (!isRhino3dmLoaded()) {
            console.error('rhino3dm.js is not loaded after waiting. Library details:', { 
                rhino3dm: typeof rhino3dm, 
                window_rhino3dm: typeof window.rhino3dm
            });
            throw new Error('rhino3dm.js is not loaded. Please check your internet connection and refresh the page.');
        }
    }

    try {
        console.log('Initializing rhino3dm...', typeof rhino3dm);
        
        // First check if we already have a global instance
        if (rhino && typeof rhino.File3dm === 'function') {
            console.log('Using existing rhino instance');
            return rhino;
        }
        
        // Initialize new instance
        rhino = await rhino3dm();
        console.log('rhino3dm initialized successfully', rhino, 'File3dm constructor:', typeof rhino.File3dm);
        
        if (!rhino || typeof rhino.File3dm !== 'function') {
            console.error('Initialized rhino object is invalid:', rhino);
            throw new Error('Failed to properly initialize rhino3dm. File3dm constructor not available.');
        }
        
        return rhino;
    } catch (error) {
        console.error('Failed to initialize rhino3dm:', error);
        throw error;
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
    try {
        showLoadingIndicator();
        console.log('Starting application initialization...');

        // First, ensure rhino3dm is loaded
        await initRhino3dm();

        // Then initialize Three.js scene and components
        await init();
        
        // Set up the initial UI state
        const container = document.querySelector('.container');
        const controlsPanel = document.querySelector('.controls-panel');
        const modelList = document.querySelector('.model-list');
        const dropZone = document.getElementById('drop-zone');
        const frontpage = document.getElementById('frontpage');
        const viewerContainer = document.getElementById('viewer-container');

        // Ensure all elements exist before trying to manipulate them
        if (!frontpage) console.error('Frontpage element not found');
        if (!container) console.error('Container element not found');
        if (!controlsPanel) console.error('Controls panel element not found');
        if (!modelList) console.error('Model list element not found');
        if (!dropZone) console.error('Drop zone element not found');
        if (!viewerContainer) console.error('Viewer container element not found');

        // Initial state: only show frontpage
        if (frontpage) frontpage.style.display = 'flex';
        if (container) container.style.display = 'none';
        if (dropZone) dropZone.style.display = 'none';
        
        // Make sure the sidebar is ready but hidden until needed
        if (controlsPanel) controlsPanel.style.display = 'block';
        if (modelList) modelList.style.display = 'block';
        
        // Make sure viewer container is ready
        if (viewerContainer) viewerContainer.style.display = 'block';

        // Setup event listeners after initializing UI
        setupEventListeners();
        setupKeyboardShortcuts();

        // Start animation loop
        animate();

        console.log('App initialized successfully');
        hideLoadingIndicator();
        
        // Force a resize event to ensure proper rendering
        window.dispatchEvent(new Event('resize'));
        
        // Update the model list sidebar
        updateModelListInSidebar();
        
        console.log('UI state after initialization:');
        console.log('- Frontpage visible:', frontpage ? frontpage.style.display : 'element not found');
        console.log('- Container visible:', container ? container.style.display : 'element not found');
        console.log('- Drop zone visible:', dropZone ? dropZone.style.display : 'element not found');
        console.log('- Controls panel ready:', controlsPanel ? controlsPanel.style.display : 'element not found');
        console.log('- Model list ready:', modelList ? modelList.style.display : 'element not found');
        
    } catch (error) {
        console.error('Failed to initialize:', error);
        hideLoadingIndicator();
        alert('Failed to initialize 3D viewer. Please refresh the page and ensure you have a stable internet connection.');
        throw error;
    }
}

// Start initialization when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM content loaded, starting initialization...');
    initializeApp().catch(error => {
        console.error('Initialization error:', error);
        hideLoadingIndicator();
        alert('Failed to initialize 3D viewer. Please refresh the page and ensure you have a stable internet connection.');
    });
});

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
    
    // Create a ground plane
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.8,
        metalness: 0.2,
        side: THREE.DoubleSide
    });
    groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
    groundPlane.rotation.x = Math.PI / 2; // Rotate to be horizontal
    groundPlane.position.y = 0; // Position at y=0
    groundPlane.receiveShadow = true;
    scene.add(groundPlane);

    // Setup event listeners after renderer is created
    setupEventListeners();

    // Start animation loop
    animate();
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
    
    // Material selection
    const materialSelect = document.getElementById('material-select');
    if (materialSelect) {
        materialSelect.addEventListener('change', () => {
            for (const model of models) {
                if (model.selected) {
                    applyMaterialToModel(models.indexOf(model), materialSelect.value);
                }
            }
        });
    } else {
        console.error('Material select not found!');
    }

    // Control buttons - verify each exists before adding listener
    const centerBtn = document.getElementById('center-model');
    if (centerBtn) {
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
    console.log('Loading file with extension:', extension);
    switch (extension) {
        case 'stl':
            return new STLLoader();
        case 'obj':
            console.log('Creating OBJLoader for OBJ file');
            const objLoader = new OBJLoader();
            // Configure the loader to use the local material search path
            objLoader.setPath('./');
            // Important: disable resource verification to avoid CSP issues
            objLoader.setResourcePath('./');
            objLoader.setCrossOrigin('anonymous');
            return objLoader;
        case 'gltf':
        case 'glb':
            return new GLTFLoader();
        case '3dm':
            console.log('Initializing Rhino3dmLoader');
            const loader = new Rhino3dmLoader();
            // Use the local library path
            loader.setLibraryPath('lib/rhino3dm/');
            return loader;
        default:
            console.log('No loader found for extension:', extension);
            return null;
    }
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
function createMeshMaterial(color = 0xffd700) {
    return new THREE.MeshPhysicalMaterial({
        color: color,
        metalness: 0.8,
        roughness: 0.15,
        clearcoat: 0.5,
        clearcoatRoughness: 0.1,
        reflectivity: 0.9,
        envMapIntensity: 1.0,
        side: THREE.DoubleSide,
        flatShading: false,
        vertexColors: false,
        wireframe: false,
        precision: 'highp'
    });
}

// Update turntable animation
function updateTurntable() {
    if (isTurntableActive && selectedObject) {
        const delta = turntableClock.getDelta();
        const rotationSpeed = turntableSpeed * delta;
        
        // Apply smooth rotation
        selectedObject.rotation.y += rotationSpeed;
        
        // Reset rotation after full circle
        if (selectedObject.rotation.y >= Math.PI * 2) {
            selectedObject.rotation.y = 0;
        }
        
        // Request next frame
        requestAnimationFrame(updateTurntable);
    }
}

// Toggle turntable animation with improved handling
function toggleTurntable() {
    console.log("Toggle turntable called, selectedObject:", selectedObject);
    
    if (!selectedObject) {
        console.warn('No object selected for turntable animation');
        alert('Please select an object first by clicking on it');
        return;
    }

    isTurntableActive = !isTurntableActive;
    console.log("Turntable active:", isTurntableActive);
    
    // Update button state
    const toggleTurntableBtn = document.getElementById('toggle-turntable');
    if (toggleTurntableBtn) {
        toggleTurntableBtn.classList.toggle('active', isTurntableActive);
    }
    
    if (isTurntableActive) {
        console.log('Starting turntable animation');
        controls.enableRotate = false; // Disable manual rotation during turntable
        selectedObject.userData.initialRotation = selectedObject.rotation.y;
        
        // Reset and start the clock
        turntableClock.stop();
        turntableClock.start();
    } else {
        console.log('Stopping turntable animation');
        turntableClock.stop();
        controls.enableRotate = true; // Re-enable manual rotation
    }
}

// Improved handleFiles function with single path for loading 3DM files
async function handleFiles(files) {
    if (!files || files.length === 0) return;

    try {
        showLoadingIndicator();
        console.log(`Processing ${files.length} file(s)`);
        
        // Force UI state before any processing
        const frontpage = document.getElementById('frontpage');
        if (frontpage) {
            frontpage.style.display = 'none';
        }
        
        const dropZone = document.getElementById('drop-zone');
        if (dropZone) {
            dropZone.style.display = 'none';
        }
        
        const container = document.querySelector('.container');
        if (container) {
            container.style.display = 'block';
        }
        
        // Ensure controls are visible
        const controlsPanel = document.querySelector('.controls-panel');
        if (controlsPanel) {
            controlsPanel.style.display = 'block';
        }
        
        const modelList = document.querySelector('.model-list');
        if (modelList) {
            modelList.style.display = 'block';
        }
        
        const viewerContainer = document.getElementById('viewer-container');
        if (viewerContainer) {
            viewerContainer.style.display = 'block';
        }

        // Track newly added models for selection
        const addedModelIndices = [];

        // Process each file
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const extension = file.name.split('.').pop().toLowerCase();
            
            console.log(`Processing file: ${file.name} (${extension})`);
            
            try {
                // Check if we already have this file loaded
                const alreadyLoaded = models.some(model => model.name === file.name);
                if (alreadyLoaded) {
                    console.log(`File ${file.name} is already loaded, skipping`);
                    continue;
                }
                
                let object;
                
                // Read the file as ArrayBuffer first
                const fileBuffer = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = e => resolve(e.target.result);
                    reader.onerror = e => reject(new Error("Error reading file"));
                    reader.readAsArrayBuffer(file);
                });
                
                // Process the file based on its extension
                if (extension === '3dm') {
                    try {
                        // Make sure rhino is initialized before processing
                        if (!rhino) {
                            await initRhino3dm();
                        }
                        
                        // Use the rhino3dm library directly
                        const meshes = await process3DMFile(fileBuffer, file.name);
                        console.log('3DM processing result:', meshes);
                        
                        if (Array.isArray(meshes) && meshes.length > 0) {
                            // Create a group for all meshes
                            object = new THREE.Group();
                            object.name = file.name;
                            
                            // Add all meshes to the group
                            meshes.forEach(mesh => {
                                if (mesh) {
                                    object.add(mesh);
                                }
                            });
                            
                            console.log(`Created group for ${file.name} with ${meshes.length} meshes`);
                        } else {
                            throw new Error('No valid meshes were generated from the 3DM file');
                        }
                    } catch (error) {
                        console.error(`Error processing 3DM file: ${error.message}`);
                        alert(`Failed to process ${file.name}: ${error.message}`);
                        continue;  // Skip to the next file
                    }
                } else {
                    try {
                        // For other file types
                        object = await processOtherFile(file);
                    } catch (error) {
                        console.error(`Error processing file: ${error.message}`);
                        alert(`Failed to process ${file.name}: ${error.message}`);
                        continue;  // Skip to the next file
                    }
                }
                
                if (object) {
                    // Add the object to the scene
                    console.log(`Adding ${file.name} to model list and scene`);
                    const modelIndex = loadModel(object, file.name);
                    
                    if (modelIndex >= 0) {
                        addedModelIndices.push(modelIndex);
                        console.log(`Successfully added ${file.name} to scene with index ${modelIndex}`);
                    }
                }
            } catch (error) {
                console.error(`Failed to process ${file.name}:`, error);
                alert(`Failed to process ${file.name}: ${error.message || 'Unknown error'}`);
            }
        }
        
        // Update the model list in the sidebar
        updateModelListInSidebar();
        
        // Auto-select the first model that was added (if any)
        if (addedModelIndices.length > 0) {
            selectModel(addedModelIndices[0]);
        }
        
        // After all models are loaded, center them in the scene
        if (models.length > 0) {
            centerModel();
            console.log('Centered all models in scene');
        }
        
        // Force a resize event to ensure proper rendering
        window.dispatchEvent(new Event('resize'));
        
    } catch (error) {
        console.error('Error handling files:', error);
        alert(`Failed to process files: ${error.message || 'Unknown error'}`);
    } finally {
        hideLoadingIndicator();
    }
}

// Process a 3DM file and extract geometry
async function process3DMFile(buffer) {
    try {
        // Ensure rhino3dm is loaded and initialized
        if (!rhino) {
            rhino = await initRhino3dm();
        }
        
        if (!rhino) {
            throw new Error('Failed to initialize rhino3dm');
        }
        
        // Decode the 3DM file using fromByteArray instead of readBuffer
        console.log('Decoding 3DM file with rhino instance:', rhino);
        let doc = null;
        
        try {
            doc = rhino.File3dm.fromByteArray(buffer);
        } catch (e) {
            console.error('Error parsing 3DM file:', e);
            throw new Error('Failed to parse 3DM file: ' + e.message);
        }
        
        // Validate the doc
        if (!doc) {
            throw new Error('Failed to parse 3DM file - doc is null');
        }
        
        console.log('3DM file loaded successfully');
        const meshes = [];
        const materials = new Map();
        const processedIds = new Set(); // Keep track of processed objects to avoid duplication
        
        // Process objects from the file - using count as a property, not a function
        const objects = doc.objects();
        const objCount = objects.count;
        console.log(`Processing ${objCount} objects in the 3DM file`);
        
        // Set up progress tracking
        let processedCount = 0;
        updateProgressBar(0);
        
        // Process each object in the file
        for (let i = 0; i < objCount; i++) {
            const rhinoObject = objects.get(i);
            
            if (!rhinoObject) {
                console.warn(`Object at index ${i} is null or undefined`);
                continue;
            }
            
            try {
                // Check for duplicate object IDs
                const objectId = rhinoObject.id ? rhinoObject.id : i;
                if (processedIds.has(objectId)) {
                    console.warn(`Skipping duplicate object with ID ${objectId}`);
                    continue;
                }
                processedIds.add(objectId);
                
                const geometry = rhinoObject.geometry();
                
                if (!geometry) {
                    console.warn(`Geometry at index ${i} is null or undefined`);
                    continue;
                }
                
                const attributes = rhinoObject.attributes();
                const layerIndex = attributes.layerIndex();
                
                // Get the layer by index properly
                const layers = doc.layers();
                const layer = layerIndex >= 0 && layerIndex < layers.count ? layers.get(layerIndex) : null;
                
                // Get material information
                let material;
                let materialHash = null;
                let layerName = "";
                let isLayerVisible = false;
                
                // Get layer properties safely
                if (layer) {
                    try {
                        isLayerVisible = typeof layer.visible === 'function' ? layer.visible() : layer.visible;
                        layerName = typeof layer.name === 'function' ? layer.name() : layer.name;
                    } catch (e) {
                        console.warn('Error accessing layer properties:', e);
                    }
                }
                
                if (attributes.materialSource() === rhino.ObjectMaterialSource.MaterialFromObject) {
                    const rhinoMaterial = attributes.material();
                    if (rhinoMaterial) {
                        const materialColor = convertRhinoColorToTHREE(rhinoMaterial.diffuseColor());
                        materialHash = materialColor.getHexString();
                        
                        if (!materials.has(materialHash)) {
                            material = new THREE.MeshStandardMaterial({
                                color: materialColor,
                                metalness: 0.2,
                                roughness: 0.8,
                                side: THREE.DoubleSide
                            });
                            materials.set(materialHash, material);
                        } else {
                            material = materials.get(materialHash);
                        }
                    }
                } else if (layer && isLayerVisible) {
                    // Safely get the layer color
                    let layerColor;
                    try {
                        layerColor = convertRhinoColorToTHREE(layer.color());
                    } catch (e) {
                        console.warn('Error getting layer color:', e);
                        layerColor = new THREE.Color(0x808080); // Default gray fallback
                    }
                    
                    materialHash = layerColor.getHexString();
                    
                    if (!materials.has(materialHash)) {
                        material = new THREE.MeshStandardMaterial({
                            color: layerColor,
                            metalness: 0.2,
                            roughness: 0.8,
                            side: THREE.DoubleSide
                        });
                        materials.set(materialHash, material);
                    } else {
                        material = materials.get(materialHash);
                    }
                }
                
                // If we didn't get a material from object or layer, use default
                if (!material) {
                    const defaultColor = new THREE.Color(0x808080); // Gray
                    materialHash = defaultColor.getHexString();
                    
                    if (!materials.has(materialHash)) {
                        material = new THREE.MeshStandardMaterial({
                            color: defaultColor,
                            metalness: 0.2,
                            roughness: 0.8,
                            side: THREE.DoubleSide
                        });
                        materials.set(materialHash, material);
                    } else {
                        material = materials.get(materialHash);
                    }
                }
                
                // Convert the Rhino geometry to a THREE.js mesh
                const mesh = convertRhinoGeometryToMesh(geometry, material);
                
                // Add the mesh to our array if valid
                if (mesh) {
                    // Set a unique ID on the mesh to avoid duplication
                    mesh.userData.rhinoId = objectId;
                    
                    // Add name from attributes if available
                    const attributeName = typeof attributes.name === 'function' ? attributes.name() : attributes.name;
                    if (attributeName) {
                        mesh.name = attributeName;
                    } else if (layerName) {
                        mesh.name = `${layerName}_${i}`;
                    } else {
                        mesh.name = `Object_${i}`;
                    }
                    
                    meshes.push(mesh);
                }
            } catch (e) {
                console.error(`Error processing object at index ${i}:`, e);
            }
            
            // Update progress
            processedCount++;
            const progress = processedCount / objCount;
            updateProgressBar(progress);
        }
        
        console.log(`Successfully created ${meshes.length} THREE.js meshes from the 3DM file`);
        
        // Clean up rhino objects
        doc.delete();
        
        return meshes;
    } catch (error) {
        console.error('Error processing 3DM file:', error);
        throw error;
    }
}

// Update the progress bar with a value between 0 and 1
function updateProgressBar(progress) {
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
        progress = Math.min(Math.max(progress, 0), 1);
        progressBar.style.width = `${progress * 100}%`;
    }
}

// Convert Rhino color to THREE.js color
function convertRhinoColorToTHREE(rhinoColor) {
    if (!rhinoColor) return new THREE.Color(0x808080); // Default gray
    return new THREE.Color(rhinoColor.r / 255, rhinoColor.g / 255, rhinoColor.b / 255);
}

// Convert a Rhino geometry object to a THREE.js mesh
function convertRhinoGeometryToMesh(geometry, material) {
    // Use the global rhino instance instead of window.rhino3dm
    const objectType = geometry.objectType;
    
    try {
        // For Brep objects, we need to mesh it first
        if (objectType === rhino.ObjectType.Brep) {
            const meshes = [];
            const brep = geometry;
            
            // Create meshing parameters for quality output
            const mp = new rhino.MeshingParameters();
            mp.gridMinCount = 8;
            mp.gridMaxCount = 32;
            mp.gridAmplification = 1.5;
            mp.refineGrid = true;
            mp.simplePlanes = false;
            mp.comfortMargin = 0.1;
            mp.angularTolerance = 0.1;
            
            const meshes3d = brep.meshes(mp);
            for (let i = 0; i < meshes3d.count; i++) {
                const mesh3d = meshes3d.get(i);
                const threeMesh = rhinoMeshToThreeMesh(mesh3d, material);
                
                if (threeMesh) {
                    meshes.push(threeMesh);
                }
                mesh3d.delete();
            }
            meshes3d.delete();
            
            if (meshes.length === 1) {
                return meshes[0];
            } else if (meshes.length > 1) {
                // Create a group to contain multiple meshes
                const group = new THREE.Group();
                meshes.forEach(mesh => group.add(mesh));
                return group;
            }
            return null;
        }
        
        // For mesh objects, convert directly
        else if (objectType === rhino.ObjectType.Mesh) {
            return rhinoMeshToThreeMesh(geometry, material);
        }
        
        // For extrusion objects, mesh them first
        else if (objectType === rhino.ObjectType.Extrusion) {
            const brep = geometry.toBRep();
            const meshes = [];
            
            // Create meshing parameters
            const mp = new rhino.MeshingParameters();
            mp.gridMinCount = 8;
            mp.gridMaxCount = 32;
            mp.refineGrid = true;
            
            const meshes3d = brep.meshes(mp);
            for (let i = 0; i < meshes3d.count; i++) {
                const mesh3d = meshes3d.get(i);
                const threeMesh = rhinoMeshToThreeMesh(mesh3d, material);
                
                if (threeMesh) {
                    meshes.push(threeMesh);
                }
                mesh3d.delete();
            }
            meshes3d.delete();
            brep.delete();
            
            if (meshes.length === 1) {
                return meshes[0];
            } else if (meshes.length > 1) {
                const group = new THREE.Group();
                meshes.forEach(mesh => group.add(mesh));
                return group;
            }
            return null;
        }
        
        // For other geometry types, we don't handle them yet
        else {
            console.warn(`Geometry type not supported for conversion: ${objectType}`);
            return null;
        }
    } catch (error) {
        console.error('Error converting Rhino geometry to THREE.js mesh:', error);
        return null;
    }
}

// Convert a Rhino mesh to a THREE.js mesh with proper validation
function rhinoMeshToThreeMesh(rhinoMesh, material) {
    try {
        // Create BufferGeometry to hold the mesh data
        const geometry = new THREE.BufferGeometry();
        
        // Get vertices
        const vertices = rhinoMesh.vertices();
        const vertexCount = vertices.count;
        const positions = new Float32Array(vertexCount * 3);
        
        for (let i = 0; i < vertexCount; i++) {
            const vertex = vertices.get(i);
            const idx = i * 3;
            positions[idx] = vertex.x;
            positions[idx + 1] = vertex.y;
            positions[idx + 2] = vertex.z;
        }
        
        // Set the vertex positions
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        // Get faces
        const faces = rhinoMesh.faces();
        const faceCount = faces.count;
        const indices = [];
        
        for (let i = 0; i < faceCount; i++) {
            const face = faces.get(i);
            indices.push(face.a, face.b, face.c);
            // If it's a quad, add another triangle
            if (face.d !== face.c) {
                indices.push(face.a, face.c, face.d);
            }
        }
        
        // Set the face indices
        geometry.setIndex(indices);
        
        // Get normals if they exist
        const normals = rhinoMesh.normals();
        if (normals && normals.count === vertexCount) {
            const normalsArray = new Float32Array(vertexCount * 3);
            
            for (let i = 0; i < vertexCount; i++) {
                const normal = normals.get(i);
                const idx = i * 3;
                normalsArray[idx] = normal.x;
                normalsArray[idx + 1] = normal.y;
                normalsArray[idx + 2] = normal.z;
            }
            
            geometry.setAttribute('normal', new THREE.BufferAttribute(normalsArray, 3));
        } else {
            // Compute normals if they don't exist
            geometry.computeVertexNormals();
        }
        
        // Validate and fix the geometry if needed
        if (!validateGeometry(geometry)) {
            fixGeometryBounds(geometry);
            if (!validateGeometry(geometry)) {
                console.warn('Failed to fix geometry after validation');
                return null;
            }
        }
        
        // Create the mesh with the validated geometry
        const mesh = new THREE.Mesh(geometry, material);
        
        return mesh;
    } catch (error) {
        console.error('Error converting Rhino mesh to THREE.js mesh:', error);
        return null;
    }
}

// Update model list in UI with improved multiple model handling
function updateModelList() {
    updateModelListInSidebar();
}

// Select a model
function selectModel(index) {
    // Deselect all models first
    models.forEach(model => {
        model.selected = false;
        
        const handleMesh = (mesh) => {
            if (mesh instanceof THREE.Mesh && !mesh.userData.isOutline) {
                if (mesh.material) {
                    mesh.material.emissive = new THREE.Color(0x000000);
                    mesh.material.emissiveIntensity = 0;
                    mesh.material.needsUpdate = true;
                }
            }
        };
        
        if (model.mesh instanceof THREE.Group) {
            model.mesh.traverse(handleMesh);
        } else if (model.mesh instanceof THREE.Mesh) {
            handleMesh(model.mesh);
        }
    });
    
    // Then select the clicked model
    if (index >= 0 && index < models.length) {
        models[index].selected = true;
        selectedObject = models[index].mesh;
        
        // Highlight the selected model with a slight emissive glow
        const handleMesh = (mesh) => {
            if (mesh instanceof THREE.Mesh && !mesh.userData.isOutline) {
                if (mesh.material) {
                    mesh.material.emissive = new THREE.Color(0x222222);
                    mesh.material.emissiveIntensity = 0.2;
                    mesh.material.needsUpdate = true;
                }
            }
        };
        
        if (selectedObject instanceof THREE.Group) {
            selectedObject.traverse(handleMesh);
        } else if (selectedObject instanceof THREE.Mesh) {
            handleMesh(selectedObject);
        }
        
        // Center camera on selected model
        zoomToFit(selectedObject, camera, controls);
        
        // Update material selector to show the current material
        const materialSelect = document.getElementById('material-select');
        if (materialSelect && models[index].materialType) {
            materialSelect.value = models[index].materialType;
        }
        } else {
        selectedObject = null;
        }
    
    // Update model list to reflect selection changes
    updateModelList();
}

// Show material dialog for a specific model
function showMaterialDialog(index) {
    const model = models[index];
    if (!model) return;

    const dialog = document.createElement('div');
    dialog.className = 'material-dialog';
    dialog.innerHTML = `
        <div class="dialog-content">
            <h3>Change Material for ${model.name}</h3>
            <select id="model-material-select">
                <option value="gold">Yellow Gold (High Quality)</option>
                <option value="rose-gold">Rose Gold (High Quality)</option>
                <option value="white-gold">White Gold (High Quality)</option>
                <option value="fast-gold">Yellow Gold (Fast Render)</option>
                <option value="fast-rose-gold">Rose Gold (Fast Render)</option>
                <option value="fast-white-gold">White Gold (Fast Render)</option>
            </select>
            <div class="dialog-buttons">
                <button id="apply-material">Apply</button>
                <button id="cancel-material">Cancel</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    const applyBtn = dialog.querySelector('#apply-material');
    const cancelBtn = dialog.querySelector('#cancel-material');
    const materialSelect = dialog.querySelector('#model-material-select');

    // Set the current material value if available
    if (model.materialType) {
        materialSelect.value = model.materialType;
    }

    applyBtn.addEventListener('click', () => {
        const materialType = materialSelect.value;
        applyMaterialToModel(index, materialType);
        document.body.removeChild(dialog);
    });

    cancelBtn.addEventListener('click', () => {
        document.body.removeChild(dialog);
    });
}

// Apply material to a specific model
function applyMaterialToModel(index, materialType) {
    if (index < 0 || index >= models.length) return;
    
    const model = models[index];
    applyMaterial(model.mesh, materialType);
    
    // Update the model's material type for future reference
    model.materialType = materialType;
}

// Toggle model visibility
function toggleModelVisibility(index) {
    if (index >= 0 && index < models.length) {
        const model = models[index];
        model.visible = !model.visible;
        model.mesh.visible = model.visible;
        
        // Update model list to reflect visibility changes
        updateModelList();
    }
}

// Remove model
function removeModel(index) {
    if (models[index]) {
        const mesh = models[index].mesh;
        
        // Remove from scene
        scene.remove(mesh);
        
        // Remove from loadedMeshes array
        const meshIndex = loadedMeshes.indexOf(mesh);
        if (meshIndex !== -1) {
            loadedMeshes.splice(meshIndex, 1);
        }
        
        // Properly dispose resources
        if (mesh instanceof THREE.Mesh) {
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach(mat => mat.dispose());
    } else {
                    mesh.material.dispose();
                }
            }
        } else if (mesh instanceof THREE.Group) {
            mesh.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(mat => mat.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }
            });
        }
        
        // Remove from models array
        models.splice(index, 1);
        
        // Reset selected object if it was selected
        if (selectedObject === mesh) {
            selectedObject = null;
        }
        
        // Update UI using updateModelListInSidebar
        updateModelListInSidebar();
        
        // Show drop zone if no models left
        if (models.length === 0) {
            document.getElementById('drop-zone').style.display = 'flex';
        }
        
        console.log(`Removed model: ${mesh.name || "Unnamed"}`);
    }
}

// Handle material change
function handleMaterialChange(event) {
    const materialType = event.target.value;
    const baseMaterial = materialPresets[materialType];
    
    models.forEach(model => {
        const handleMesh = (mesh) => {
            if (mesh instanceof THREE.Mesh && !mesh.userData.isOutline) {
                const newMaterial = new THREE.MeshStandardMaterial({
                    color: baseMaterial.color,
                    metalness: baseMaterial.metalness,
                    roughness: baseMaterial.roughness,
                    emissive: model.selected ? new THREE.Color(0x333333) : new THREE.Color(0x000000),
                    emissiveIntensity: 0.1
                });
                
                // Store the material type
                newMaterial.userData.materialType = materialType;
                mesh.material = newMaterial;
            }
        };

        if (model.mesh instanceof THREE.Group) {
            model.mesh.traverse(handleMesh);
        } else if (model.mesh instanceof THREE.Mesh) {
            handleMesh(model.mesh);
        }
    });
}

// Handle ambient light change
function handleAmbientLightChange(event) {
    const value = parseFloat(event.target.value);
    if (ambientLight) {
        ambientLight.intensity = value;
        console.log('Ambient light intensity:', value);
    }
}

// Handle directional light change
function handleDirectionalLightChange(event) {
    const value = parseFloat(event.target.value);
    if (directionalLight) {
        directionalLight.intensity = value;
        console.log('Directional light intensity:', value);
    }
}

// Handle background color change
function handleBackgroundColorChange(event) {
    scene.background = new THREE.Color(event.target.value);
}

// Handle click for object selection
function handleClick(event) {
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    // Collect all selectable objects
    const selectableObjects = [];
    models.forEach(model => {
        if (model.mesh) {
            selectableObjects.push(model.mesh);
        }
    });

    const intersects = raycaster.intersectObjects(selectableObjects, true);

    if (intersects.length > 0) {
        const selected = intersects[0].object;
        
        // Find the parent model in our models array
        let parentModel = null;
        let modelIndex = -1;
        
        for (let i = 0; i < models.length; i++) {
            const model = models[i];
            if (model.mesh === selected || 
                (model.mesh.isGroup && model.mesh.children.includes(selected)) ||
                findInChildren(model.mesh, selected)) {
                parentModel = model.mesh;
                modelIndex = i;
                break;
            }
        }
        
        if (parentModel) {
            // Stop turntable if it was active
            if (isTurntableActive) {
                isTurntableActive = false;
                turntableClock.stop();
                const toggleTurntableBtn = document.getElementById('toggle-turntable');
                if (toggleTurntableBtn) {
                    toggleTurntableBtn.classList.remove('active');
                }
            }
            
            // Set the new selected object
            selectedObject = parentModel;
            
            // Update model list UI to show selection
            selectModel(modelIndex);
            
            // Zoom to fit the selected object
            zoomToFit(selectedObject, camera, controls);
            
            console.log('Selected model:', models[modelIndex].name);
        }
    }
}

// Helper function to find an object in children recursively
function findInChildren(parent, target) {
    if (!parent.children || parent.children.length === 0) {
        return false;
    }
    
    for (const child of parent.children) {
        if (child === target) {
            return true;
        }
        if (findInChildren(child, target)) {
            return true;
        }
    }
    
    return false;
}

// Handle window resize with improved handling
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    
    // Update pixel ratio on resize
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(pixelRatio);
    composer.setPixelRatio(pixelRatio);
}

// Animation loop with fixed turntable functionality
function animate() {
    // Store the animation ID so we can cancel it if needed
    animationId = requestAnimationFrame(animate);
    
    // Update controls for responsive camera movement
    controls.update();
    
    // Handle turntable animation with improved handling
    if (isTurntableActive && selectedObject) {
        if (!turntableClock.running) {
            turntableClock.start();
        }
        
        const delta = turntableClock.getDelta();
        selectedObject.rotation.y += turntableSpeed * delta;
        
        // Removed rotation clamping to allow continuous rotation
    }
    
    // Render the scene with post-processing for better quality
    composer.render();
}

// Center all models
function centerModel() {
    if (models.length === 0) return;

    let targetObject;
    if (selectedObject) {
        // If an object is selected, center on that object
        targetObject = selectedObject;
    } else {
        // Otherwise center on all models
    const combinedBox = new THREE.Box3();
    models.forEach(model => {
        const box = new THREE.Box3().setFromObject(model.mesh);
        combinedBox.union(box);
    });

    const center = combinedBox.getCenter(new THREE.Vector3());
    const size = combinedBox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 1.5 / maxDim;

    // Center and scale all models
    models.forEach(model => {
        model.mesh.position.sub(center);
        model.mesh.scale.set(scale, scale, scale);
        model.mesh.position.y = -combinedBox.min.y * scale + 0.5;
    });

        targetObject = models[0].mesh;
    }

    // Use zoomToFit for smooth camera transition
    zoomToFit(targetObject, camera, controls);
}

function toggleFloor() {
    if (groundPlane) {
        groundPlane.visible = !groundPlane.visible;
        const toggleFloorBtn = document.getElementById('toggle-floor');
        if (toggleFloorBtn) {
            toggleFloorBtn.classList.toggle('active');
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
                if (selectedObject) {
                    zoomToFit(selectedObject, camera, controls);
                }
                break;
        }
    });
}

// Improved zoom to fit function
function zoomToFit(object, camera, controls) {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());

    // Calculate the distance needed to fit the object
    const distance = size / (2 * Math.tan((Math.PI * camera.fov) / 360));
    const direction = controls.target.clone()
        .sub(camera.position)
        .normalize()
        .multiplyScalar(distance);

    // Smoothly animate to the new position
    const startPosition = camera.position.clone();
    const startTarget = controls.target.clone();
    const duration = 1000; // Animation duration in ms
    const startTime = Date.now();

    function animateCamera() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease in-out function for smooth animation
        const easeProgress = progress < 0.5 
            ? 2 * progress * progress 
            : -1 + (4 - 2 * progress) * progress;

        // Interpolate position and target
        camera.position.lerpVectors(
            startPosition,
            center.clone().sub(direction),
            easeProgress
        );
        controls.target.lerpVectors(
            startTarget,
            center,
            easeProgress
        );
        controls.update();

        if (progress < 1) {
            requestAnimationFrame(animateCamera);
        }
    }

    animateCamera();
}

// Load model function that adds a model to the scene without duplicating geometry
function loadModel(object, fileName) {
    // Check if we have a valid object
    if (!object) {
        console.error('Invalid object provided to loadModel');
        return null;
    }

    console.log(`[loadModel] Loading model: ${fileName}`);

    try {
        // Create a model object to store information
        const modelInfo = {
            name: fileName || 'Unknown Model',
            mesh: object,
            visible: true,
            selected: false,
            material: currentMaterial || 'gold',
            originalPosition: object.position.clone(),
            geometry: null
        };

        // Check if the object has a valid bounding box
        if (object instanceof THREE.Mesh) {
            if (!validateGeometry(object.geometry)) {
                console.warn(`Model ${fileName} has invalid geometry, fixing...`);
                fixGeometryBounds(object.geometry);
            }
        } else if (object instanceof THREE.Group) {
            // For groups, check and fix each child mesh
            object.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    if (!validateGeometry(child.geometry)) {
                        console.warn(`Child in model ${fileName} has invalid geometry, fixing...`);
                        fixGeometryBounds(child.geometry);
                    }
                }
            });
        }

        // Apply the current material
        applyMaterial(object, currentMaterial || 'gold');

        // Add to the scene
        scene.add(object);

        // Position and scale the model
        positionAndScaleModel(object);

        // Add an outline to the model
        const outline = createOutline(object);
        if (outline) {
            scene.add(outline);
            modelInfo.outline = outline;
        }

        // Add to models array
        models.push(modelInfo);

        // Update the model list in the UI
        updateModelListInSidebar();

        // Return the new model info
        return modelInfo;
    } catch (error) {
        console.error(`Error loading model ${fileName}:`, error);
        return null;
    }
}

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
function positionAndScaleModel(object) {
    // Calculate the bounding box for the model
    let box = new THREE.Box3().setFromObject(object);
    
    // Check for invalid bounding box
    if (isNaN(box.min.x) || isNaN(box.min.y) || isNaN(box.min.z) ||
        isNaN(box.max.x) || isNaN(box.max.y) || isNaN(box.max.z)) {
        console.warn('Invalid bounding box detected, attempting to fix...');
        
        // Fix each mesh in the model
        object.traverse(child => {
            if (child instanceof THREE.Mesh) {
                if (!validateGeometry(child.geometry)) {
                    fixGeometryBounds(child.geometry);
                }
            }
        });
        
        // Recalculate the bounding box
        box = new THREE.Box3().setFromObject(object);
        
        // If still invalid, create a default box
        if (isNaN(box.min.x) || isNaN(box.min.y) || isNaN(box.min.z) ||
            isNaN(box.max.x) || isNaN(box.max.y) || isNaN(box.max.z)) {
            console.warn('Could not fix bounding box, using default');
            box.min.set(-1, -1, -1);
            box.max.set(1, 1, 1);
        }
    }
    
    // Calculate model center
    const center = new THREE.Vector3();
    box.getCenter(center);
    
    // Move the model so its center is at the origin
    object.position.sub(center);
    
    // Calculate the size
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    // Scale the model if it's too large or too small
    if (maxDim > 10 || maxDim < 0.1) {
        const scale = maxDim > 10 ? 5 / maxDim : 1 / maxDim;
        object.scale.multiplyScalar(scale);
    }
}

// Add centerSelectedModel function back
function centerSelectedModel() {
    if (models.length === 0) {
        console.warn('No models available to center');
        return;
    }

    if (selectedObject) {
        // If an object is selected, center on that object
        zoomToFit(selectedObject, camera, controls);
        console.log('Centering selected model');
    } else {
        // Otherwise center on all models
        centerModel();
    }
}

// Add applyMaterial function back
function applyMaterial(mesh, materialType) {
    if (!mesh || !materialPresets[materialType]) return;
    
    const material = materialPresets[materialType].clone();
    
    if (mesh instanceof THREE.Group) {
        mesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.material = material;
            }
        });
    } else if (mesh instanceof THREE.Mesh) {
        mesh.material = material;
    }
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
    // Ambient light - increased for better overall illumination
    ambientLight = new THREE.AmbientLight(0xffffff, 0.4); // Increased from 0.2
    scene.add(ambientLight);
    
    // Key light - main directional light from front-top-right
    directionalLight = new THREE.DirectionalLight(0xffffff, 0.7); // Increased from 0.5
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.bias = -0.0001;
    scene.add(directionalLight);
    
    // Fill light - softer light from opposite side
    const fillLight = new THREE.DirectionalLight(0xfffaf0, 0.5); // Increased from 0.3
    fillLight.position.set(-5, 3, -2);
    scene.add(fillLight);
    
    // Rim light - from behind to highlight edges
    const rimLight = new THREE.DirectionalLight(0xf0f8ff, 0.3); // Increased from 0.2
    rimLight.position.set(0, -5, -5);
    scene.add(rimLight);
    
    // Update sliders to match light intensities
    const ambientSlider = document.getElementById('ambient-light');
    if (ambientSlider) ambientSlider.value = ambientLight.intensity;
    
    const directionalSlider = document.getElementById('directional-light');
    if (directionalSlider) directionalSlider.value = directionalLight.intensity;
}

// Add setupControls function that was referenced but not defined
function setupControls() {
    // Orbit controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true;
    controls.minDistance = 0.5;  // Reduced to allow closer zoom
    controls.maxDistance = 100;  // Increased to allow further zoom out
    controls.maxPolarAngle = Math.PI; // Allow full rotation
    controls.target.set(0, 0, 0);
    controls.zoomSpeed = 0.5;    // Slower zoom for more precision
    controls.autoRotate = false; // Ensure auto-rotation is off
    controls.enableKeys = false; // Disable keyboard navigation to prevent accidental zooming
    
    // Prevent automatic camera changes unless explicitly requested
    controls.enableRotate = true;
    controls.rotateSpeed = 0.8;  // Slightly slower rotation for better control
    
    // Disable the built-in mouse wheel zoom to use our custom implementation
    controls.enableZoom = false;
    
    // Prevent auto-zooming by setting a fixed up vector
    controls.addEventListener('change', function() {
        camera.up.set(0, 1, 0); // Always keep Y as up
    });
    
    // Register custom wheel event for improved zoom control
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    
    // Add double-click to fit model
    renderer.domElement.addEventListener('dblclick', function(event) {
        if (selectedObject) {
            zoomToFit(selectedObject, camera, controls);
        } else if (models.length > 0) {
            centerModel();
        }
    });
    
    // Setup window resize handler
    window.addEventListener('resize', onWindowResize);
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
