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
    return typeof rhino3dm !== 'undefined';
}

// Function to wait for rhino3dm to load with better error handling
async function initRhino3dm() {
    if (!isRhino3dmLoaded()) {
        console.log('Waiting for rhino3dm to load...');
        // Wait for a short time to allow the script to load
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (!isRhino3dmLoaded()) {
            throw new Error('rhino3dm.js is not loaded. Please check your internet connection and refresh the page.');
        }
    }

    try {
        console.log('Initializing rhino3dm...');
        rhino = await rhino3dm();
        console.log('✅ rhino3dm initialized successfully');
        return rhino;
    } catch (error) {
        console.error('❌ Failed to initialize rhino3dm:', error);
        throw error;
    }
}

// Show loading indicator
function showLoadingIndicator() {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'block';
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

// Hide frontpage
function hideFrontpage() {
    const frontpage = document.getElementById('frontpage');
    const dropZone = document.getElementById('drop-zone');
    const container = document.querySelector('.container');
    const viewerContainer = document.getElementById('viewer-container');
    
    if (frontpage) {
        frontpage.style.display = 'none';
        console.log('Hiding frontpage');
    }
    
    if (container) {
        container.style.display = 'block';
    }
    
    if (dropZone) {
        dropZone.style.display = 'flex';
    }

    if (viewerContainer) {
        viewerContainer.style.display = 'block';
    }
    
    // Show the sidebar and controls
    const controlsPanel = document.querySelector('.controls-panel');
    const modelList = document.querySelector('.model-list');
    
    if (controlsPanel) {
        controlsPanel.style.display = 'block';
    }
    
    if (modelList) {
        modelList.style.display = 'block';
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
        
        // Initially hide UI elements except frontpage
        const container = document.querySelector('.container');
        const controlsPanel = document.querySelector('.controls-panel');
        const modelList = document.querySelector('.model-list');
        const dropZone = document.getElementById('drop-zone');
        const frontpage = document.getElementById('frontpage');
        const viewerContainer = document.getElementById('viewer-container');

        // Ensure frontpage is visible
        if (frontpage) {
            frontpage.style.display = 'flex';
            console.log('Frontpage is visible');
        } else {
            console.error('Frontpage element not found');
        }

        // Hide other elements
        if (container) container.style.display = 'none';
        if (controlsPanel) controlsPanel.style.display = 'none';
        if (modelList) modelList.style.display = 'none';
        if (dropZone) dropZone.style.display = 'none';
        if (viewerContainer) viewerContainer.style.display = 'none';

        // Setup event listeners after initializing UI
        setupEventListeners();

        // Start animation loop
        animate();

        console.log('🛠️ App initialized successfully');
        hideLoadingIndicator();
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
        color: 0xffd700,
        metalness: 0.95,
        roughness: 0.05,
        reflectivity: 1.0,
        clearcoat: 0.3,
        clearcoatRoughness: 0.2,
        envMapIntensity: 1.2,
        side: THREE.DoubleSide
    }),
    'rose-gold': new THREE.MeshPhysicalMaterial({
        color: 0xe0a080,
        metalness: 0.95,
        roughness: 0.05,
        reflectivity: 1.0,
        clearcoat: 0.3,
        clearcoatRoughness: 0.2,
        envMapIntensity: 1.2,
        side: THREE.DoubleSide
    }),
    'white-gold': new THREE.MeshPhysicalMaterial({
        color: 0xf0f0f0,
        metalness: 0.95,
        roughness: 0.05,
        reflectivity: 1.0,
        clearcoat: 0.3,
        clearcoatRoughness: 0.2,
        envMapIntensity: 1.2,
        side: THREE.DoubleSide
    }),
    'fast-gold': new THREE.MeshStandardMaterial({
        color: 0xffd700,
        metalness: 0.9,
        roughness: 0.1,
        side: THREE.DoubleSide
    }),
    'fast-rose-gold': new THREE.MeshStandardMaterial({
        color: 0xe0a080,
        metalness: 0.9,
        roughness: 0.1,
        side: THREE.DoubleSide
    }),
    'fast-white-gold': new THREE.MeshStandardMaterial({
        color: 0xf0f0f0,
        metalness: 0.9,
        roughness: 0.1,
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
  console.log("🧹 Scene cleared");
}

// Function to add a model to the scene
function AddModelToScene(mesh) {
  scene.add(mesh);
  loadedMeshes.push(mesh);
  console.log("📦 Mesh added:", mesh.name || "Unnamed");
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
    
    // Setup renderer with reduced exposure
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
    renderer.toneMappingExposure = 0.9; // Slightly brighter for jewelry highlights
    document.getElementById('viewer-container').appendChild(renderer.domElement);
    
    // Initialize post-processing with reduced bloom
    composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    
    // Add bloom effect with subtle settings for jewelry
    bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.15,  // reduced strength for subtle glow
        0.5,   // radius
        0.9    // threshold - higher to only bloom the brightest parts
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
    
    // Add ground plane - hidden by default
    const planeGeometry = new THREE.PlaneGeometry(40, 40);
    const planeMaterial = new THREE.MeshStandardMaterial({
        color: 0xf0f0f0,
        roughness: 0.7,
        metalness: 0.0,
        side: THREE.DoubleSide
    });
    groundPlane = new THREE.Mesh(planeGeometry, planeMaterial);
    groundPlane.rotation.x = Math.PI / 2;
    groundPlane.position.y = -0.02;
    groundPlane.receiveShadow = true;
    groundPlane.visible = false;
    scene.add(groundPlane);
    
    // Setup event listeners after renderer is created
    setupEventListeners();
    
    // Start animation loop
    animate();
}

// Update the setupEventListeners function to properly handle file selection
function setupEventListeners() {
    // Start viewing button on frontpage
    const startViewingBtn = document.getElementById('start-viewing');
    if (startViewingBtn) {
        startViewingBtn.addEventListener('click', () => {
            console.log('Start viewing button clicked');
            hideFrontpage();
        });
    }
    
    // Drop zone select files button
    const selectFilesBtn = document.getElementById('select-files');
    if (selectFilesBtn) {
        selectFilesBtn.addEventListener('click', () => {
            console.log('Select files button clicked');
            document.getElementById('file-input').click();
        });
    }

    // File input change handler
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.addEventListener('change', (event) => {
            const files = event.target.files;
            if (files && files.length > 0) {
                handleFiles(files);
                // Reset the input to allow selecting the same file again
                event.target.value = '';
            }
        });
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
    }

    // Control buttons
    const centerBtn = document.getElementById('center-model');
    if (centerBtn) {
        centerBtn.addEventListener('click', centerSelectedModel);
    }

    const turntableBtn = document.getElementById('toggle-turntable');
    if (turntableBtn) {
        turntableBtn.addEventListener('click', toggleTurntable);
    }

    const floorBtn = document.getElementById('toggle-floor');
    if (floorBtn) {
        floorBtn.addEventListener('click', toggleFloor);
    }

    const backgroundBtn = document.getElementById('toggle-background');
    if (backgroundBtn) {
        backgroundBtn.addEventListener('click', toggleBackground);
    }
    
    // Set up sliders for controlling lights
    const ambientLightSlider = document.getElementById('ambient-light');
    if (ambientLightSlider) {
        ambientLightSlider.addEventListener('input', handleAmbientLightChange);
    }
    
    const directionalLightSlider = document.getElementById('directional-light');
    if (directionalLightSlider) {
        directionalLightSlider.addEventListener('input', handleDirectionalLightChange);
    }

    // Click handling for object selection
    renderer.domElement.addEventListener('click', handleClick);
}

// Get appropriate loader for file type
function getLoaderForFile(filename) {
    const extension = filename.split('.').pop().toLowerCase();
    console.log('Loading file with extension:', extension);
    switch (extension) {
        case 'stl':
            return new STLLoader();
        case 'obj':
            return new OBJLoader();
        case 'gltf':
        case 'glb':
            return new GLTFLoader();
        case '3dm':
            console.log('Initializing Rhino3dmLoader');
            const loader = new Rhino3dmLoader();
            loader.setLibraryPath('https://cdn.jsdelivr.net/npm/rhino3dm@7.15.0/');
            return loader;
        default:
            console.log('No loader found for extension:', extension);
            return null;
    }
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

// Simplify the handleFiles function to prevent duplicates
async function handleFiles(files) {
    if (!files || files.length === 0) return;

    try {
        showLoadingIndicator();
        hideFrontpage();
        
        // Clear scene before loading new files only if we're dropping files for the first time
        const dropZone = document.getElementById('drop-zone');
        if (dropZone && dropZone.style.display !== 'none') {
            ClearScene();
        }

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            console.log(`Processing file ${i + 1}/${files.length}: ${file.name}`);
            
            // Check if file is already loaded
            if (models.some(model => model.name === file.name)) {
                console.log(`File ${file.name} is already loaded, skipping...`);
                continue;
            }
            
            try {
                await loadFile(file);
            } catch (error) {
                console.error(`Error processing file ${file.name}:`, error);
                alert(`Failed to process ${file.name}: ${error.message}`);
            }
        }

        // Update UI after files are processed
    if (models.length > 0) {
            document.querySelector('.controls-panel').style.display = 'block';
            document.querySelector('.model-list').style.display = 'block';
            const dropZone = document.getElementById('drop-zone');
            if (dropZone) {
                dropZone.style.display = 'none';
            }
            centerModel();
        } else {
            const dropZone = document.getElementById('drop-zone');
            if (dropZone) {
                dropZone.style.display = 'flex';
            }
        }
    } catch (error) {
        console.error('Error processing files:', error);
        alert(error.message || 'Failed to process files. Please try again.');
    } finally {
        hideLoadingIndicator();
    }
}

// Ensure the loadFile function is correctly loading files
async function loadFile(file) {
    try {
        console.log(`[loadFile] Starting to load file: ${file.name}`);
        
        const extension = file.name.split('.').pop().toLowerCase();
        console.log(`[loadFile] File extension: ${extension}`);
        
        let result;
        
        if (extension === '3dm') {
            console.log(`[loadFile] Processing 3DM file`);
            result = await process3DMFile(file);
        } else if (['stl', 'obj', 'gltf', 'glb'].includes(extension)) {
            console.log(`[loadFile] Processing ${extension.toUpperCase()} file`);
            result = await processOtherFile(file);
        } else {
            throw new Error(`Unsupported file type: ${extension}`);
        }
        
        if (!result) {
            throw new Error(`Failed to process ${file.name}`);
        }
        
        // Load the model into the scene
        loadModel(result, file.name);
        
        console.log(`[loadFile] Successfully loaded: ${file.name}`);
        return result;
    } catch (error) {
        console.error(`Error loading file ${file.name}:`, error);
        // Show error message to user
        const errorMessage = `Failed to load ${file.name}: ${error.message}`;
        showErrorMessage(errorMessage);
        hideLoadingIndicator();
        return null;
    }
}

// Update the processOtherFile function to return the object rather than calling loadModel
async function processOtherFile(file) {
    const loader = getLoaderForFile(file.name);
    if (!loader) {
        throw new Error(`Unsupported file format: ${file.name.split('.').pop()}`);
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            loader.load(e.target.result, 
                (object) => {
                    console.log(`[processOtherFile] Successfully loaded ${file.name}`);
                    resolve(object);
                },
                (progress) => {
                    console.log(`Loading ${file.name}: ${Math.round(progress.loaded / progress.total * 100)}%`);
                },
                (error) => {
                    reject(new Error(`Failed to load ${file.name}: ${error.message}`));
                }
            );
        };
        reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
        reader.readAsDataURL(file);
    });
}

// Update process3DMFile to use threejs JSON conversion when possible
async function process3DMFile(file) {
    if (!rhino) {
        throw new Error('rhino3dm is not initialized. Please refresh the page and try again.');
    }

    console.log('[process3DMFile] Processing 3DM file:', file.name);
    const buffer = await file.arrayBuffer();
    
    const doc = rhino.File3dm.fromByteArray(new Uint8Array(buffer));
    if (!doc) {
        throw new Error('Failed to parse 3DM file');
    }

    const objects = doc.objects();
    const group = new THREE.Group();
    let geometryFound = false;

    const mp = getMeshingParameters(rhino);

    for (let i = 0; i < objects.count; i++) {
        const obj = objects.get(i);
        const geometry = obj.geometry();

        if (geometry) {
            try {
                if (geometry.objectType === rhino.ObjectType.Mesh) {
                    // For mesh objects, use the direct threejs JSON conversion
                    const threeJson = geometry.toThreejsJSON();
                    if (threeJson) {
                        const bufferGeometry = new THREE.BufferGeometry();
                        
                        // Set geometry attributes from the converted JSON
                        const jsonData = threeJson.data;
                        if (jsonData.attributes.position) {
                            bufferGeometry.setAttribute('position', 
                                new THREE.Float32BufferAttribute(jsonData.attributes.position.array, 3));
                        }
                        
                        if (jsonData.attributes.normal) {
                            bufferGeometry.setAttribute('normal', 
                                new THREE.Float32BufferAttribute(jsonData.attributes.normal.array, 3));
                        }
                        
                        if (jsonData.attributes.uv && jsonData.attributes.uv.array.length > 0) {
                            bufferGeometry.setAttribute('uv', 
                                new THREE.Float32BufferAttribute(jsonData.attributes.uv.array, 2));
                        }
                        
                        if (jsonData.index) {
                            bufferGeometry.setIndex(Array.from(jsonData.index.array));
                        }
                        
                        const material = materialPresets['gold'].clone();
                        const mesh = new THREE.Mesh(bufferGeometry, material);
                        group.add(mesh);
                        geometryFound = true;
                    }
                } else if (geometry.objectType === rhino.ObjectType.Brep || 
                         geometry.objectType === rhino.ObjectType.Surface ||
                         geometry.objectType === rhino.ObjectType.SubD) {
                    // For Brep, Surface and SubD objects, use the meshing process
                    // Create a mesh for the entire Brep instead of face by face
                    const rhinoMesh = new rhino.Mesh();
                    
                    // For Brep objects
                    if (geometry.objectType === rhino.ObjectType.Brep) {
                        const faces = geometry.faces();
                        for (let j = 0; j < faces.count; j++) {
                            const face = faces.get(j);
                            const mesh = face.getMesh(mp);
                            if (mesh) {
                                rhinoMesh.append(mesh);
                                mesh.delete();
                            }
                            face.delete();
                        }
                        faces.delete();
                    } 
                    // For Surface objects
                    else if (geometry.objectType === rhino.ObjectType.Surface) {
                        geometry.createMesh(mp, rhinoMesh);
                    }
                    // For SubD objects
                    else if (geometry.objectType === rhino.ObjectType.SubD) {
                        // Subdivide to get smooth surfaces
                        geometry.subdivide(2);
                        const subDMesh = rhino.Mesh.createFromSubDControlNet(geometry, true);
                        if (subDMesh) {
                            rhinoMesh.append(subDMesh);
                            subDMesh.delete();
                        }
                    }
                    
                    // Convert the Rhino mesh to Three.js format
                    if (rhinoMesh && rhinoMesh.vertices().count > 0) {
                        const threeJson = rhinoMesh.toThreejsJSON();
                        if (threeJson) {
                            const bufferGeometry = new THREE.BufferGeometry();
                            
                            // Set geometry attributes from the converted JSON
                            const jsonData = threeJson.data;
                            if (jsonData.attributes.position) {
                                bufferGeometry.setAttribute('position', 
                                    new THREE.Float32BufferAttribute(jsonData.attributes.position.array, 3));
                            }
                            
                            if (jsonData.attributes.normal) {
                                bufferGeometry.setAttribute('normal', 
                                    new THREE.Float32BufferAttribute(jsonData.attributes.normal.array, 3));
                            }
                            
                            if (jsonData.attributes.uv && jsonData.attributes.uv.array.length > 0) {
                                bufferGeometry.setAttribute('uv', 
                                    new THREE.Float32BufferAttribute(jsonData.attributes.uv.array, 2));
                            }
                            
                            if (jsonData.index) {
                                bufferGeometry.setIndex(Array.from(jsonData.index.array));
                            }
                            
                            const material = materialPresets['gold'].clone();
                            const mesh = new THREE.Mesh(bufferGeometry, material);
                            group.add(mesh);
                            geometryFound = true;
                        }
                        rhinoMesh.delete();
                    }
                }
            } catch (error) {
                console.error('Error converting geometry:', error);
            } finally {
                geometry.delete();
            }
        }
        obj.delete();
    }

    mp.delete();
    objects.delete();
    doc.delete();

    if (!geometryFound) {
        throw new Error('No valid geometry found in the 3DM file');
    }
    
    console.log(`[process3DMFile] Successfully processed 3DM file with ${group.children.length} geometries`);
    return group;
}

// Convert Rhino geometry to mesh with improved quality
async function convertRhinoGeometryToMesh(geometry, mp, rhino) {
    const meshes = [];
    
    if (geometry.objectType === rhino.ObjectType.Brep) {
        const faces = geometry.faces();
        for (let faceIndex = 0; faceIndex < faces.count; faceIndex++) {
            const face = faces.get(faceIndex);
            const mesh = face.getMesh(mp);
            if (mesh && mesh.vertices().count > 0) {
                const threeMesh = convertRhinoMeshToThree(mesh);
                if (threeMesh) meshes.push(threeMesh);
                mesh.delete();
            }
            face.delete();
        }
        faces.delete();
    } else {
        const mesh = geometry.getMesh(mp);
        if (mesh && mesh.vertices().count > 0) {
            const threeMesh = convertRhinoMeshToThree(mesh);
            if (threeMesh) meshes.push(threeMesh);
            mesh.delete();
        }
    }
    
    return meshes;
}

// Fix the computeTangents error in convertRhinoMeshToThree
function convertRhinoMeshToThree(rhinoMesh) {
    if (!rhinoMesh) return null;

    try {
        const vertices = rhinoMesh.vertices();
        const faces = rhinoMesh.faces();
        const normals = rhinoMesh.normals();
        
        if (!vertices || !faces || vertices.count === 0 || faces.count === 0) {
            console.warn('Invalid mesh data - empty vertices or faces');
            return null;
        }
        
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(vertices.count * 3);
        const normalArray = new Float32Array(vertices.count * 3);
        const indices = [];
        
        // Get vertices with higher precision
        for (let i = 0; i < vertices.count; i++) {
            const vertex = vertices.get(i);
            positions[i * 3] = vertex[0];
            positions[i * 3 + 1] = vertex[1];
            positions[i * 3 + 2] = vertex[2];
            
            // Get vertex normals if available
            if (normals) {
                const normal = normals.get(i);
                normalArray[i * 3] = normal[0];
                normalArray[i * 3 + 1] = normal[1];
                normalArray[i * 3 + 2] = normal[2];
            }
        }
        
        // Get faces with proper winding order
        for (let i = 0; i < faces.count; i++) {
            const face = faces.get(i);
            if (face[2] !== face[3]) {
                // Triangle face
                indices.push(face[0], face[1], face[2]);
            } else {
                // Quad face - split into two triangles
                indices.push(face[0], face[1], face[2]);
                indices.push(face[0], face[2], face[3]);
            }
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        if (normals) {
            geometry.setAttribute('normal', new THREE.BufferAttribute(normalArray, 3));
        } else {
            geometry.computeVertexNormals();
        }
        geometry.setIndex(indices);
        
        // Only compute tangents if we have UVs
        // Skip computeTangents to avoid errors
        
        // Create mesh with fast material for better performance
        const mesh = new THREE.Mesh(
            geometry,
            materialPresets['fast-gold'].clone()
        );
        
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        return mesh;
    } catch (error) {
        console.error('Error converting Rhino mesh to Three.js:', error);
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
                <option value="gold">Gold (High Quality)</option>
                <option value="rose-gold">Rose Gold (High Quality)</option>
                <option value="white-gold">White Gold (High Quality)</option>
                <option value="fast-gold">Gold (Fast Render)</option>
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
    ambientLight.intensity = parseFloat(event.target.value);
}

// Handle directional light change
function handleDirectionalLightChange(event) {
    directionalLight.intensity = parseFloat(event.target.value);
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
        
        // Keep rotation within 0-2π range for better performance
        if (selectedObject.rotation.y > Math.PI * 2) {
            selectedObject.rotation.y -= Math.PI * 2;
        }
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
    const startPosition = camera.position.clone();
    const startTarget = controls.target.clone();
    const targetPosition = new THREE.Vector3(0, 3, 5);
    const targetTarget = new THREE.Vector3(0, 0, 0);
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
        controls.target.lerpVectors(startTarget, targetTarget, easeProgress);
        controls.update();

        if (progress < 1) {
            requestAnimationFrame(animateCamera);
        }
    }

    animateCamera();
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

// Add the missing loadModel function
function loadModel(object, fileName) {
    let mesh;
    
    console.log(`[loadModel] Loading model: ${fileName}`);
    
    // Handle different types of loaded objects
    if (object instanceof THREE.BufferGeometry) {
        // For STL files
        const material = materialPresets['gold'].clone();
        mesh = new THREE.Mesh(object, material);
        mesh.name = fileName;
        
        // Create outline mesh
        const outlineMesh = new THREE.Mesh(object, outlineMaterials['gold'].clone());
        outlineMesh.scale.set(1.02, 1.02, 1.02);
        outlineMesh.userData.isOutline = true;
        mesh.add(outlineMesh);
    } else if (object instanceof THREE.Group || object instanceof THREE.Mesh) {
        mesh = object;
        mesh.name = fileName;
        
        if (mesh instanceof THREE.Group) {
            mesh.traverse(child => {
                if (child instanceof THREE.Mesh && !child.userData.isOutline) {
                    const material = materialPresets['gold'].clone();
                    child.material = material;
                    
                    // Create outline mesh only if not too many children (prevent performance issues)
                    if (mesh.children.length < 100) {
                        const outlineMesh = new THREE.Mesh(child.geometry, outlineMaterials['gold'].clone());
                        outlineMesh.scale.set(1.02, 1.02, 1.02);
                        outlineMesh.userData.isOutline = true;
                        child.add(outlineMesh);
                    }
                }
            });
        } else {
            const material = materialPresets['gold'].clone();
            mesh.material = material;
            
            const outlineMesh = new THREE.Mesh(mesh.geometry, outlineMaterials['gold'].clone());
            outlineMesh.scale.set(1.02, 1.02, 1.02);
            outlineMesh.userData.isOutline = true;
            mesh.add(outlineMesh);
        }
    } else {
        console.error('Unsupported object type:', object);
        return;
    }

    // Center and scale the model
    const box = new THREE.Box3().setFromObject(mesh);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 1.5 / maxDim;
    
    mesh.position.set(0, 0, 0);
    mesh.position.sub(center.multiplyScalar(scale));
    mesh.scale.set(scale, scale, scale);
    mesh.position.y = -box.min.y * scale + 0.5;

    // Add to models array
    models.push({
        mesh: mesh,
        name: fileName,
        visible: true,
        selected: false
    });

    // Use AddModelToScene instead of direct scene.add
    AddModelToScene(mesh);
    console.log(`[loadModel] Added model to scene: ${fileName}`);
    
    // Use updateModelListInSidebar instead of updateModelList
    updateModelListInSidebar();
    
    // Show UI elements only after the first model is loaded
    if (models.length === 1) {
        document.querySelector('.controls-panel').style.display = 'block';
        document.querySelector('.model-list').style.display = 'block';
        document.getElementById('drop-zone').style.display = 'none';
        document.getElementById('frontpage').style.display = 'none';
        
        zoomToFit(mesh, camera, controls);
        controls.enableRotate = true;
        controls.update();
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
    const modelListElement = document.getElementById('model-list');
    if (!modelListElement) return;
    
    // Clear existing content and add just one h3 heading
    modelListElement.innerHTML = '<h3>Models</h3>';
    
    if (models.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-model-list';
        emptyMessage.textContent = 'No models loaded. Click "Add Model" to get started.';
        modelListElement.appendChild(emptyMessage);
        return;
    }
    
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
    
    // Add "Add More Models" button at the bottom
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
    // Ambient light - subtle for good shadows
    ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);
    
    // Key light - main directional light from front-top-right
    directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.bias = -0.0001;
    scene.add(directionalLight);
    
    // Fill light - softer light from opposite side
    const fillLight = new THREE.DirectionalLight(0xfffaf0, 0.3); // Warm light
    fillLight.position.set(-5, 3, -2);
    scene.add(fillLight);
    
    // Rim light - from behind to highlight edges
    const rimLight = new THREE.DirectionalLight(0xf0f8ff, 0.2); // Cool light
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
    controls.minDistance = 1;
    controls.maxDistance = 50;
    controls.maxPolarAngle = Math.PI / 1.5;
    controls.target.set(0, 0, 0);
    
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