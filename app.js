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
    try {
        console.log(`Processing ${files.length} file(s)`);

        for (const file of files) {
            try {
                console.log(`Processing file: ${file.name} (${file.name.split('.').pop()})`);
                const buffer = await readFileAsArrayBuffer(file);
                const meshes = await process3DMFile(buffer);

                if (meshes && meshes.length > 0) {
                    const group = new THREE.Group();
                    group.name = file.name;
                    meshes.forEach(mesh => group.add(mesh));
                    scene.add(group);

                    // Update UI with loaded model
                    const event = createCustomEvent('modelLoaded', {
                        name: file.name,
                        meshes: meshes
                    });
                    document.dispatchEvent(event);
                }
            } catch (error) {
                console.error(`Failed to process ${file.name}:`, error);
                showErrorMessage(`Failed to process ${file.name}: ${error.message}`);
            }
        }
    } catch (error) {
        console.error('Error handling files:', error);
        showErrorMessage('Error handling files: ' + error.message);
    }
}

// Helper function to create a custom event
function createCustomEvent(name, detail) {
    return new CustomEvent(name, {
        detail: detail,
        bubbles: true,
        cancelable: true
    });
}

// Process a 3DM file and extract geometry
async function process3DMFile(buffer) {
    try {
        // Ensure rhino3dm is loaded and initialized
        if (!isRhino3dmLoaded()) {
            await initRhino3dm();
        }

        // Clear existing scene
        clearScene();

        // Decode the 3DM file
        const doc = rhino.File3dm.fromByteArray(buffer);
        if (!doc) {
            throw new Error('Failed to decode 3DM file');
        }

        const meshes = [];
        const objectCount = doc.objects().count;
        console.log(`Processing ${objectCount} objects in the 3DM file`);

        // Process each object in the file
        for (let i = 0; i < objectCount; i++) {
            try {
                const obj = doc.objects().get(i);
                if (!obj) continue;

                const geometry = obj.geometry();
                if (!geometry) continue;

                let threeGeometry;
                let material = createMeshMaterial();

                // Handle different types of geometry
                if (geometry instanceof rhino.Mesh) {
                    // For meshes, convert to THREE.js geometry
                    threeGeometry = new THREE.BufferGeometry();
                    const vertices = geometry.vertices();
                    const faces = geometry.faces();
                    
                    // Create position attribute
                    const positions = new Float32Array(vertices.length * 3);
                    for (let j = 0; j < vertices.length; j++) {
                        positions[j * 3] = vertices[j].x;
                        positions[j * 3 + 1] = vertices[j].y;
                        positions[j * 3 + 2] = vertices[j].z;
                    }
                    threeGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

                    // Create index attribute
                    const indices = new Uint32Array(faces.length * 3);
                    for (let j = 0; j < faces.length; j++) {
                        indices[j * 3] = faces[j].a;
                        indices[j * 3 + 1] = faces[j].b;
                        indices[j * 3 + 2] = faces[j].c;
                    }
                    threeGeometry.setIndex(new THREE.BufferAttribute(indices, 1));

                    // Compute normals
                    threeGeometry.computeVertexNormals();

                } else if (geometry instanceof rhino.Brep) {
                    // For Breps, create a mesh with high quality settings
                    const meshingParams = getMeshingParameters(rhino);
                    const mesh = geometry.toMesh(meshingParams);
                    if (mesh && mesh.vertices().length > 0) {
                        // Convert Rhino mesh to THREE.js geometry
                        threeGeometry = new THREE.BufferGeometry();
                        const vertices = mesh.vertices();
                        const faces = mesh.faces();
                        
                        // Create position attribute
                        const positions = new Float32Array(vertices.length * 3);
                        for (let j = 0; j < vertices.length; j++) {
                            positions[j * 3] = vertices[j].x;
                            positions[j * 3 + 1] = vertices[j].y;
                            positions[j * 3 + 2] = vertices[j].z;
                        }
                        threeGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

                        // Create index attribute
                        const indices = new Uint32Array(faces.length * 3);
                        for (let j = 0; j < faces.length; j++) {
                            indices[j * 3] = faces[j].a;
                            indices[j * 3 + 1] = faces[j].b;
                            indices[j * 3 + 2] = faces[j].c;
                        }
                        threeGeometry.setIndex(new THREE.BufferAttribute(indices, 1));

                        // Compute normals
                        threeGeometry.computeVertexNormals();

                        mesh.delete(); // Clean up Rhino mesh
                    }
                } else if (geometry instanceof rhino.Surface) {
                    // For surfaces, create a mesh with high quality settings
                    const meshingParams = getMeshingParameters(rhino);
                    const mesh = geometry.toMesh(meshingParams);
                    if (mesh && mesh.vertices().length > 0) {
                        // Convert Rhino mesh to THREE.js geometry
                        threeGeometry = new THREE.BufferGeometry();
                        const vertices = mesh.vertices();
                        const faces = mesh.faces();
                        
                        // Create position attribute
                        const positions = new Float32Array(vertices.length * 3);
                        for (let j = 0; j < vertices.length; j++) {
                            positions[j * 3] = vertices[j].x;
                            positions[j * 3 + 1] = vertices[j].y;
                            positions[j * 3 + 2] = vertices[j].z;
                        }
                        threeGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

                        // Create index attribute
                        const indices = new Uint32Array(faces.length * 3);
                        for (let j = 0; j < faces.length; j++) {
                            indices[j * 3] = faces[j].a;
                            indices[j * 3 + 1] = faces[j].b;
                            indices[j * 3 + 2] = faces[j].c;
                        }
                        threeGeometry.setIndex(new THREE.BufferAttribute(indices, 1));

                        // Compute normals
                        threeGeometry.computeVertexNormals();

                        mesh.delete(); // Clean up Rhino mesh
                    }
                } else if (geometry instanceof rhino.Curve) {
                    // For curves, create a line geometry
                    const points = geometry.getPoints();
                    if (points && points.length > 0) {
                        threeGeometry = new THREE.BufferGeometry();
                        const positions = new Float32Array(points.length * 3);
                        for (let j = 0; j < points.length; j++) {
                            positions[j * 3] = points[j].x;
                            positions[j * 3 + 1] = points[j].y;
                            positions[j * 3 + 2] = points[j].z;
                        }
                        threeGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                        material = new THREE.LineBasicMaterial({ color: 0x000000 });
                    }
                }

                // Only add valid geometries to the scene
                if (threeGeometry && threeGeometry.attributes.position && threeGeometry.attributes.position.count > 0) {
                    const mesh = new THREE.Mesh(threeGeometry, material);
                    mesh.name = `Object_${i}`;
                    meshes.push(mesh);
                }

                // Update progress
                updateProgressBar((i + 1) / objectCount);
            } catch (error) {
                console.error(`Error processing object at index ${i}:`, error);
            }
        }

        // Add all meshes to the scene
        for (const mesh of meshes) {
            scene.add(mesh);
        }

        // Center the camera on the loaded objects
        if (meshes.length > 0) {
            fitCameraToObject(scene, meshes);
        }

        // Clean up
        doc.delete();

        return meshes;
    } catch (error) {
        console.error('Error processing 3DM file:', error);
        throw error;
    }
}

// Update the loaded models UI
function updateLoadedModelsUI() {
    const modelListContent = document.getElementById('model-list-content');
    if (!modelListContent) return;
    
    modelListContent.innerHTML = '';
    
    loadedMeshes.forEach((mesh, index) => {
        const modelItem = document.createElement('div');
        modelItem.className = 'model-item';
        modelItem.innerHTML = `
            <div class="model-label">
                <span>${mesh.name || `Model ${index + 1}`}</span>
            </div>
            <div class="model-controls">
                <button class="model-btn visibility-btn" title="Toggle Visibility">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="model-btn material-btn" title="Change Material">
                    <i class="fas fa-paint-brush"></i>
                </button>
                <button class="model-btn delete-btn" title="Remove Model">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        // Add event listeners
        const visibilityBtn = modelItem.querySelector('.visibility-btn');
        const materialBtn = modelItem.querySelector('.material-btn');
        const deleteBtn = modelItem.querySelector('.delete-btn');
        
        visibilityBtn.addEventListener('click', () => toggleModelVisibility(index));
        materialBtn.addEventListener('click', () => showMaterialDialog(index));
        deleteBtn.addEventListener('click', () => removeModel(index));
        
        modelListContent.appendChild(modelItem);
    });
    
    if (loadedMeshes.length === 0) {
        modelListContent.innerHTML = '<div class="empty-model-list">No models loaded</div>';
    }
}

// Helper function to clear the scene
function clearScene() {
    loadedMeshes.forEach(mesh => {
        scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
    });
    loadedMeshes = [];
}

// Helper function to fit camera to object
function fitCameraToObject(scene, meshes) {
    const box = new THREE.Box3();
    meshes.forEach(mesh => box.expandByObject(mesh));
    
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / Math.tan(fov / 2));
    
    // Add some padding
    cameraZ *= 1.5;
    
    camera.position.set(center.x, center.y, center.z + cameraZ);
    camera.lookAt(center);
    camera.updateProjectionMatrix();
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
    if (!rhinoColor) return new THREE.Color(0xFFD700); // Default gold color instead of gray
    return new THREE.Color(rhinoColor.r / 255, rhinoColor.g / 255, rhinoColor.b / 255);
}

// Convert a Rhino geometry object to a THREE.js mesh
function convertRhinoGeometryToMesh(geometry, material) {
    // Use the global rhino instance instead of window.rhino3dm
    const objectType = geometry.objectType;
    
    try {
        // Debug the material to ensure it's being applied correctly
        console.log('Material for new geometry:', material);
        
        // Make a clone of the material for this specific geometry
        const clonedMaterial = material.clone();
        
        // Enhance material properties to improve visibility
        if (clonedMaterial instanceof THREE.MeshStandardMaterial || 
            clonedMaterial instanceof THREE.MeshPhysicalMaterial) {
            clonedMaterial.side = THREE.DoubleSide; // Render both sides
            clonedMaterial.needsUpdate = true;      // Force material update
            
            // Ensure emissive is set for better visibility
            if (!clonedMaterial.emissive) {
                clonedMaterial.emissive = new THREE.Color(0x222222);
                clonedMaterial.emissiveIntensity = 0.1;
            }
        }
        
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
            
            // Handle meshes as property or method
            const meshes3d = typeof brep.meshes === 'function' ? 
                brep.meshes(mp) : (mp ? null : brep.meshes);
                
            if (!meshes3d) {
                console.warn('Failed to generate meshes from Brep');
                return null;
            }
            
            for (let i = 0; i < meshes3d.count; i++) {
                const mesh3d = meshes3d.get(i);
                const threeMesh = rhinoMeshToThreeMesh(mesh3d, clonedMaterial);
                
                if (threeMesh) {
                    // Set castShadow and receiveShadow for better visualization
                    threeMesh.castShadow = true;
                    threeMesh.receiveShadow = true;
                    
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
            const threeMesh = rhinoMeshToThreeMesh(geometry, clonedMaterial);
            if (threeMesh) {
                threeMesh.castShadow = true;
                threeMesh.receiveShadow = true;
            }
            return threeMesh;
        }
        
        // For extrusion objects, mesh them first
        else if (objectType === rhino.ObjectType.Extrusion) {
            // Handle toBRep as property or method
            const brep = typeof geometry.toBRep === 'function' ? 
                geometry.toBRep() : geometry.toBRep;
                
            if (!brep) {
                console.warn('Failed to convert Extrusion to BRep');
                return null;
            }
            
            const meshes = [];
            
            // Create meshing parameters
            const mp = new rhino.MeshingParameters();
            mp.gridMinCount = 8;
            mp.gridMaxCount = 32;
            mp.refineGrid = true;
            
            // Handle meshes as property or method
            const meshes3d = typeof brep.meshes === 'function' ? 
                brep.meshes(mp) : (mp ? null : brep.meshes);
                
            if (!meshes3d) {
                console.warn('Failed to generate meshes from Extrusion BRep');
                brep.delete();
                return null;
            }
            
            for (let i = 0; i < meshes3d.count; i++) {
                const mesh3d = meshes3d.get(i);
                const threeMesh = rhinoMeshToThreeMesh(mesh3d, clonedMaterial);
                
                if (threeMesh) {
                    threeMesh.castShadow = true;
                    threeMesh.receiveShadow = true;
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
        
        // Get vertices - handle as property or method
        const vertices = typeof rhinoMesh.vertices === 'function' ? 
            rhinoMesh.vertices() : rhinoMesh.vertices;
            
        if (!vertices) {
            console.warn('No vertices found in Rhino mesh');
            return null;
        }
        
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
        
        // Get faces - handle as property or method
        const faces = typeof rhinoMesh.faces === 'function' ? 
            rhinoMesh.faces() : rhinoMesh.faces;
            
        if (!faces) {
            console.warn('No faces found in Rhino mesh');
            return null;
        }
        
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
        
        // Get normals if they exist - handle as property or method
        const normals = typeof rhinoMesh.normals === 'function' ? 
            rhinoMesh.normals() : rhinoMesh.normals;
            
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
        
        const modelMesh = getModelMesh(model);
        if (!modelMesh) return;
        
        const handleMesh = (mesh) => {
            if (mesh instanceof THREE.Mesh && !mesh.userData.isOutline) {
                if (mesh.material) {
                    mesh.material.emissive = new THREE.Color(0x000000);
                    mesh.material.emissiveIntensity = 0;
                    mesh.material.needsUpdate = true;
                }
            }
        };
        
        if (modelMesh instanceof THREE.Group) {
            modelMesh.traverse(handleMesh);
        } else if (modelMesh instanceof THREE.Mesh) {
            handleMesh(modelMesh);
        }
    });
    
    // Then select the clicked model
    if (index >= 0 && index < models.length) {
        models[index].selected = true;
        const modelMesh = getModelMesh(models[index]);
        selectedObject = modelMesh;
        
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
        zoomToFit([models[index]], true);
        
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
    const modelMesh = getModelMesh(model);
    
    if (modelMesh) {
        applyMaterial(modelMesh, materialType);
        
        // Update the model's material type for future reference
        model.materialType = materialType;
    }
}

// Toggle model visibility
function toggleModelVisibility(index) {
    if (index >= 0 && index < models.length) {
        const model = models[index];
        model.visible = !model.visible;
        
        const modelMesh = getModelMesh(model);
        if (modelMesh) {
            modelMesh.visible = model.visible;
        }
        
        // Update model list to reflect visibility changes
        updateModelList();
    }
}

// Remove model
function removeModel(index) {
    if (models[index]) {
        const modelMesh = getModelMesh(models[index]);
        
        if (modelMesh) {
            // Remove from scene
            scene.remove(modelMesh);
            
            // Remove from loadedMeshes array if it exists
            if (typeof loadedMeshes !== 'undefined') {
                const meshIndex = loadedMeshes.indexOf(modelMesh);
                if (meshIndex !== -1) {
                    loadedMeshes.splice(meshIndex, 1);
                }
            }
            
            // Properly dispose resources
            if (modelMesh instanceof THREE.Mesh) {
                if (modelMesh.geometry) modelMesh.geometry.dispose();
                if (modelMesh.material) {
                    if (Array.isArray(modelMesh.material)) {
                        modelMesh.material.forEach(mat => mat.dispose());
                    } else {
                        modelMesh.material.dispose();
                    }
                }
            } else if (modelMesh instanceof THREE.Group) {
                modelMesh.traverse(child => {
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
            
            // Reset selected object if it was selected
            if (selectedObject === modelMesh) {
                selectedObject = null;
            }
        }
        
        // Remove from models array
        models.splice(index, 1);
        
        // Update UI using updateModelListInSidebar
        updateModelListInSidebar();
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
    
    // Update TWEEN animations
    TWEEN.update();
    
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
    if (models.length === 0) {
        console.log('No models to center');
        return;
    }

    try {
        console.log(`Centering ${models.length} models`);
        
        // If there's a selected object, just fit that one
        if (selectedObject) {
            console.log('Centering selected object');
            // Use the zoomToFit function for the selected object
            zoomToFit([selectedObject], true);
            return;
        }
        
        // Create a combined bounding box for all valid models
    const combinedBox = new THREE.Box3();
        let validModelCount = 0;
        
        // Safely expand the bounding box with each model
        models.forEach((model, index) => {
            try {
                if (model && model.object && model.visible !== false) {
                    // Make sure the world matrix is updated
                    model.object.updateMatrixWorld(true);
                    
                    // Get or compute the bounding box
                    const modelBox = model.boundingBox || new THREE.Box3().setFromObject(model.object);
                    
                    // Only use the box if it's valid
                    if (isValidBoundingBox(modelBox)) {
                        combinedBox.union(modelBox);
                        validModelCount++;
                        console.log(`Added model ${index} to combined bounding box`);
                    } else {
                        console.warn(`Model ${index} has invalid bounding box, skipping`);
                    }
                }
            } catch (err) {
                console.error(`Error processing model ${index} for centering:`, err);
            }
        });
        
        // If no valid models found, use a default box
        if (validModelCount === 0) {
            console.warn('No valid models found for centering, using default positioning');
            combinedBox.set(
                new THREE.Vector3(-1, -1, -1),
                new THREE.Vector3(1, 1, 1)
            );
        }
        
        // Now use zoomToFit to handle the camera positioning
        zoomToFit(models, true);
        
    } catch (error) {
        console.error('Error in centerModel:', error);
    }
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
function zoomToFit(selectedModels = null, animate = true) {
    const modelsToFit = selectedModels || models;
    
    if (!modelsToFit || modelsToFit.length === 0) {
        console.warn('No models to fit in view');
        return;
    }
    
    // Create a new bounding box encompassing all models to fit
    const box = new THREE.Box3();
    
    // Track whether we've found any valid geometry
    let foundValidGeometry = false;
    
    modelsToFit.forEach(model => {
        if (model.object) {
            // Ensure we have a valid bounding box for the model
            if (!model.boundingBox) {
                // If no bounding box stored, calculate it
                model.boundingBox = new THREE.Box3().setFromObject(model.object);
            }
            
            // Only expand the overall box if the model's box is valid
            if (isValidBoundingBox(model.boundingBox)) {
                box.union(model.boundingBox);
                foundValidGeometry = true;
            }
        }
    });
    
    // If we didn't find any valid geometry, return
    if (!foundValidGeometry) {
        console.warn('No valid geometry found to fit in view');
        return;
    }
    
    // Calculate the center of the box
    const center = new THREE.Vector3();
    box.getCenter(center);
    
    // Calculate the size of the box
    const size = new THREE.Vector3();
    box.getSize(size);
    
    // Log for debugging
    console.log('Zooming to fit box:', {
        center: center,
        size: size
    });
    
    // Get the max dimension of the bounding box
    const maxDim = Math.max(size.x, size.y, size.z);
    
    // Calculate the distance based on the field of view and size
    const fov = camera.fov * (Math.PI / 180);
    
    // Add padding factor to ensure models fit comfortably in view
    const padding = 1.5;
    
    // Calculate the camera distance, ensuring we're not too close
    let distance = Math.max(
        (maxDim * padding) / (2 * Math.tan(fov / 2)),
        5 // Minimum distance to avoid clipping
    );
    
    // Calculate the target position (center of models)
    const targetPosition = center.clone();
    
    // Calculate the new camera position
    // Position the camera to look at the models from a front-top-right perspective
    const offset = new THREE.Vector3(1, 0.7, 1).normalize().multiplyScalar(distance);
    const newPosition = targetPosition.clone().add(offset);
    
    // Set the camera target (controls target)
    if (animate) {
        // Animate the movement
        new TWEEN.Tween(controls.target)
            .to(targetPosition, 1000)
            .easing(TWEEN.Easing.Cubic.Out)
            .start();
            
        // Animate the camera position
        new TWEEN.Tween(camera.position)
            .to(newPosition, 1000)
            .easing(TWEEN.Easing.Cubic.Out)
            .start();
    } else {
        // Set immediately
        controls.target.copy(targetPosition);
        camera.position.copy(newPosition);
        controls.update();
    }
    
    // Reset camera up vector to ensure consistent orientation
    camera.up.set(0, 1, 0);
}

// Load model function that adds a model to the scene without duplicating geometry
function loadModel(modelPath, materialType = null) {
    // Create a progress indicator
    const progressContainer = document.getElementById('progress-container');
    const progressElement = document.getElementById('progress');
    progressContainer.style.display = 'block';
    progressElement.style.width = '0%';
    
    // Check if we already have this model loaded
    const existingModelIndex = models.findIndex(model => model.path === modelPath);
    if (existingModelIndex >= 0) {
        console.log(`Model ${modelPath} already loaded`);
        progressContainer.style.display = 'none';
        return existingModelIndex;
    }
    
    // Determine which material to use, with better fallback handling
    let materialToUse = currentMaterial || 'gold';
    if (materialType && materialPresets[materialType]) {
        materialToUse = materialType;
    } else if (!materialPresets[materialToUse]) {
        materialToUse = 'gold'; // Default fallback
    }
    
    // Create a placeholder for this model
    const modelInfo = {
        path: modelPath,
        name: getFileNameFromPath(modelPath),
        object: null,
        originalPosition: new THREE.Vector3(),
        originalScale: new THREE.Vector3(1, 1, 1),
        boundingBox: null,
        selected: false,
        visible: true,
        material: materialToUse
    };
    
    // Add the model to our models array
    const modelIndex = models.push(modelInfo) - 1;
    
    console.log(`Loading model: ${modelPath} with material: ${materialToUse}`);
    
    // Load the model
    const loader = getLoaderForPath(modelPath);
    loader.load(
        modelPath,
        (object) => {
            // Apply the material to the model
            applyMaterial(object, materialPresets[materialToUse]);
            
            // Add the loaded object to the model info
            modelInfo.object = object;
            
            // Position and scale the model
            if (positionAndScaleModel(object, modelInfo)) {
                // Add the object to the scene
                scene.add(object);
                
                // Create an outline for the object
                modelInfo.outline = createOutline(object, materialToUse);
                if (modelInfo.outline) {
                    scene.add(modelInfo.outline);
                }
                
                // Hide the progress indicator
                progressContainer.style.display = 'none';
                progressElement.style.width = '0%';
                
                // Update UI to reflect the new model
                updateLoadedModelsUI();
                
                // Log and zoom to fit the newly loaded model
                console.log(`Model loaded successfully: ${modelPath}`);
                
                // Force a render to ensure the model is visible
                renderer.render(scene, camera);
                
                // Zoom to fit with animation only if this is our first model
                zoomToFit([modelInfo], models.length === 1);
                
                // Dispatch a model loaded event
                dispatchEvent('modelLoaded', { 
                    modelIndex: modelIndex,
                    model: modelInfo 
                });
            }
        },
        (xhr) => {
            // Update the progress indicator
            if (xhr.lengthComputable) {
                const percentComplete = xhr.loaded / xhr.total * 100;
                progressElement.style.width = percentComplete + '%';
            }
        },
        (error) => {
            console.error(`Error loading model: ${modelPath}`, error);
            progressContainer.style.display = 'none';
            progressElement.style.width = '0%';
            
            // Remove the model from our models array
            models.splice(modelIndex, 1);
            
            // Show an error message
            alert(`Failed to load model: ${modelPath}`);
        }
    );
    
    return modelIndex;
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


