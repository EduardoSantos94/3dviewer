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
        throw new Error('rhino3dm.js is not loaded. Please check your script tag in index.html');
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
    if (frontpage) {
        frontpage.style.display = 'flex';
    }
}

// Hide frontpage
function hideFrontpage() {
    const frontpage = document.getElementById('frontpage');
    const dropZone = document.getElementById('drop-zone');
    
    if (frontpage) {
        frontpage.style.display = 'none';
    }
    
    if (dropZone) {
        dropZone.style.display = 'none';
    }
    
    // Show the sidebar and controls since they're now part of the main layout
    const controlsPanel = document.querySelector('.controls-panel');
    const modelList = document.querySelector('.model-list');
    
    if (controlsPanel) {
        controlsPanel.style.display = 'block';
    }
    
    if (modelList) {
        modelList.style.display = 'block';
    }
}

// Initialize the application
async function initializeApp() {
    try {
        showLoadingIndicator();
        console.log('Starting application initialization...');

        // First, ensure rhino3dm is loaded
        await initRhino3dm();

        // Then initialize Three.js scene and components
        init();
        setupEventListeners();
        animate();

        // Initially hide UI elements
        const controlsPanel = document.querySelector('.controls-panel');
        const modelList = document.querySelector('.model-list');
        const dropZone = document.getElementById('drop-zone');
        const frontpage = document.getElementById('frontpage');

        if (controlsPanel) controlsPanel.style.display = 'none';
        if (modelList) modelList.style.display = 'none';
        if (dropZone) dropZone.style.display = 'none';
        if (frontpage) frontpage.style.display = 'flex';

        console.log('🛠️ App initialized successfully');
        hideLoadingIndicator();
    } catch (error) {
        console.error('Failed to initialize:', error);
        hideLoadingIndicator();
        alert('Failed to initialize 3D viewer. Please refresh the page and ensure you have a stable internet connection.');
        throw error; // Re-throw to help with debugging
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

// Improved material settings for better rendering quality
const materialPresets = {
    yellow: new THREE.MeshPhysicalMaterial({
        color: 0xffd700,
        metalness: 0.85,
        roughness: 0.12,
        clearcoat: 0.6,
        clearcoatRoughness: 0.1,
        reflectivity: 0.9,
        envMapIntensity: 1.2,
        side: THREE.DoubleSide
    }),
    rose: new THREE.MeshPhysicalMaterial({
        color: 0xe6b3b3,
        metalness: 0.85,
        roughness: 0.12,
        clearcoat: 0.6,
        clearcoatRoughness: 0.1,
        reflectivity: 0.9,
        envMapIntensity: 1.2,
        side: THREE.DoubleSide
    }),
    white: new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0.85,
        roughness: 0.12,
        clearcoat: 0.6,
        clearcoatRoughness: 0.1,
        reflectivity: 0.9,
        envMapIntensity: 1.2,
        side: THREE.DoubleSide
    }),
    fastYellow: new THREE.MeshStandardMaterial({
        color: 0xffd700,
        metalness: 0.95,
        roughness: 0.05,
        envMapIntensity: 1.5,
        side: THREE.DoubleSide
    }),
    fastRose: new THREE.MeshStandardMaterial({
        color: 0xe6b8b7,
        metalness: 0.95,
        roughness: 0.05,
        envMapIntensity: 1.5,
        side: THREE.DoubleSide
    }),
    fastWhite: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.95,
        roughness: 0.05,
        envMapIntensity: 1.5,
        side: THREE.DoubleSide
    })
};

// Create outline materials
const outlineMaterials = {
    yellow: new THREE.MeshBasicMaterial({
        color: 0x000000,
        side: THREE.BackSide
    }),
    rose: new THREE.MeshBasicMaterial({
        color: 0x000000,
        side: THREE.BackSide
    }),
    white: new THREE.MeshBasicMaterial({
        color: 0x000000,
        side: THREE.BackSide
    }),
    fastYellow: new THREE.MeshBasicMaterial({
        color: 0x000000,
        side: THREE.BackSide
    }),
    fastRose: new THREE.MeshBasicMaterial({
        color: 0x000000,
        side: THREE.BackSide
    }),
    fastWhite: new THREE.MeshBasicMaterial({
        color: 0x000000,
        side: THREE.BackSide
    })
};

// Initialize the scene
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);

    // Create camera with better initial position
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 3, 5);
    camera.lookAt(0, 0, 0);

    // Create renderer with improved settings
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
        logarithmicDepthBuffer: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.75; // Slightly reduced for better dynamic range
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.getElementById('viewer-container').appendChild(renderer.domElement);

    // Setup post-processing with improved settings
    composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // Add subtle bloom for metallic highlights
    bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.3,  // strength - slightly increased
        0.4,  // radius - slightly decreased
        0.7   // threshold
    );
    composer.addPass(bloomPass);

    // Studio lighting setup - improved for jewelry
    ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    // Key light - brighter and slightly repositioned
    directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight.position.set(5, 8, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.bias = -0.0001;
    scene.add(directionalLight);

    // Fill light - adjusted for better modeling
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
    fillLight.position.set(-5, 3, 2);
    scene.add(fillLight);

    // Rim light for edge definition - increased intensity
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
    rimLight.position.set(0, -3, -5);
    scene.add(rimLight);

    // Create studio environment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    // Create a higher quality gradient environment
    const canvas = document.createElement('canvas');
    canvas.width = 2048; // Increased for better quality
    canvas.height = 1024;
    const context = canvas.getContext('2d');
    
    // Create a more sophisticated gradient for better reflections
    const gradient = context.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width / 2
    );
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.5, '#f5f5f5');
    gradient.addColorStop(1, '#e0e0e0');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    
    const envMap = pmremGenerator.fromEquirectangular(texture).texture;
    scene.environment = envMap;
    scene.background = new THREE.Color(0xf5f5f5); // Keep neutral background

    texture.dispose();
    pmremGenerator.dispose();

    // Add ground plane with shadow and reflection
    const planeGeometry = new THREE.PlaneGeometry(100, 100);
    const planeMaterial = new THREE.MeshStandardMaterial({
        color: 0xf0f0f0,
        metalness: 0.1, // Slight metalness for subtle reflections
        roughness: 0.8,
        side: THREE.DoubleSide
    });
    groundPlane = new THREE.Mesh(planeGeometry, planeMaterial);
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.position.y = -0.001;
    groundPlane.receiveShadow = true;
    scene.add(groundPlane);

    // Add orbit controls with improved settings
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 0.5;
    controls.maxDistance = 1000;
    controls.maxPolarAngle = Math.PI; // Allow full 360-degree rotation
    controls.minPolarAngle = 0; // Allow viewing from below
    controls.enablePan = true;
    controls.enableRotate = true;
    controls.panSpeed = 0.5;
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 0.5;
    controls.screenSpacePanning = true;
    controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
    };

    // Add smooth zooming with inertia
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.zoomDampingFactor = 0.1;

    // Add touch support
    controls.touchDampingFactor = 0.1;
    controls.touchZoomSpeed = 0.5;
    controls.touchRotateSpeed = 0.5;
    controls.touchPanSpeed = 0.5;

    // Add double-click handler for camera reset
    renderer.domElement.addEventListener('dblclick', (event) => {
        if (event.target === renderer.domElement) {
            resetCamera();
        }
    });

    // Add touch events for mobile
    renderer.domElement.addEventListener('touchstart', (event) => {
        if (event.touches.length === 2) {
            controls.enableDamping = false;
        }
    });

    renderer.domElement.addEventListener('touchend', () => {
        controls.enableDamping = true;
    });

    // Setup event listeners
    setupEventListeners();

    // Start animation loop
    animate();

    // Add event listener for the start viewing button
    const startViewingBtn = document.getElementById('start-viewing');
    if (startViewingBtn) {
        startViewingBtn.addEventListener('click', () => {
            document.getElementById('frontpage').style.display = 'none';
            document.getElementById('drop-zone').style.display = 'flex';
        });
    }

    // Add event listener for the add model button
    const addModelBtn = document.getElementById('add-model');
    if (addModelBtn) {
        addModelBtn.addEventListener('click', () => {
            document.getElementById('file-input').click();
        });
    }
}

// Setup event listeners with improved turntable support
function setupEventListeners() {
    // Add model button in sidebar
    const addModelBtn = document.getElementById('add-model');
    if (addModelBtn) {
        addModelBtn.addEventListener('click', () => {
            const fileInput = document.getElementById('file-input');
            fileInput.click();
        });
    }
    
    // Start viewing button on frontpage
    const startViewingBtn = document.getElementById('start-viewing');
    if (startViewingBtn) {
        startViewingBtn.addEventListener('click', () => {
            hideFrontpage();
            document.getElementById('drop-zone').style.display = 'flex';
        });
    }
    
    // Drop zone select files button
    const dropZoneBtn = document.querySelector('.drop-zone .add-model-btn');
    if (dropZoneBtn) {
        dropZoneBtn.addEventListener('click', () => {
            const fileInput = document.getElementById('file-input');
            fileInput.click();
        });
    }
    
    // File input change event
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        let isProcessing = false;
        fileInput.addEventListener('change', async (e) => {
            if (isProcessing) return;
            if (e.target.files.length > 0) {
                isProcessing = true;
                console.log('Files selected:', e.target.files);
                await handleFiles(e.target.files);
                hideFrontpage();
                document.getElementById('drop-zone').style.display = 'none';
                isProcessing = false;
                // Clear the input to allow selecting the same file again
                fileInput.value = '';
            }
        });
    }
    
    // Click handling for object selection
    renderer.domElement.addEventListener('click', handleClick);

    // Setup drop zone events
    const dropZone = document.getElementById('drop-zone');
    if (dropZone) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
        });
        
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, highlight, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, unhighlight, false);
        });
        
        dropZone.addEventListener('drop', handleDrop, false);
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
        centerBtn.addEventListener('click', centerModel);
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
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlight(e) {
    document.getElementById('drop-zone').classList.add('dragover');
}

function unhighlight(e) {
    document.getElementById('drop-zone').classList.remove('dragover');
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
    mp.gridMinCount = 100;      // Increase for better detail
    mp.gridMaxCount = 1000;     // Increase for better detail
    mp.gridAngle = 10;         // Decrease for smoother curves
    mp.gridAspectRatio = 1.0;  // Keep aspect ratio uniform
    mp.simplePlanes = false;   // Don't simplify planar surfaces
    mp.refineGrid = true;      // Enable grid refinement
    mp.simplifyMesh = false;   // Don't simplify the resulting mesh
    mp.packNormals = true;     // Pack normals for better quality
    mp.tolerance = 0.001;      // Increase accuracy
    mp.minimumEdgeLength = 0.0001; // Better edge detail
    mp.maximumEdgeLength = 0.1;   // Limit long edges
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

// Update file handling to support multiple files
async function handleFiles(files) {
    if (!files || files.length === 0) return;

    try {
        showLoadingIndicator();
        hideFrontpage();
        
        let successCount = 0;
        
        // Process each file sequentially to avoid memory issues
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const extension = file.name.split('.').pop().toLowerCase();
            console.log(`Processing file ${i + 1}/${files.length}: ${file.name}`);
            
            try {
                if (extension === '3dm') {
                    // Important: Wait for each 3DM file to complete before moving to the next
                    await process3DMFile(file);
                    successCount++;
                } else if (['stl', 'obj', 'gltf', 'glb'].includes(extension)) {
                    await processOtherFile(file);
                    successCount++;
                } else {
                    console.warn(`Unsupported file type: ${extension}`);
                    alert(`File type not supported: ${extension}`);
                }
            } catch (error) {
                console.error(`Error processing file ${file.name}:`, error);
                alert(`Failed to process ${file.name}: ${error.message}`);
            }
        }
        
        // Update UI after all files are processed
        if (successCount > 0) {
            document.querySelector('.controls-panel').style.display = 'block';
            document.querySelector('.model-list').style.display = 'block';
            document.getElementById('drop-zone').style.display = 'none';
            
            // Center and fit all models
            centerModel();
            
            console.log(`Successfully loaded ${successCount} out of ${files.length} files`);
        } else {
            console.error('No files were successfully loaded');
            alert('No files were successfully loaded. Please try different files.');
            
            // Show drop zone if no files were loaded
            document.getElementById('drop-zone').style.display = 'flex';
        }
    } catch (error) {
        console.error('Error processing files:', error);
        alert(error.message || 'Failed to process files. Please try again.');
    } finally {
        hideLoadingIndicator();
    }
}

// Process 3DM file with improved quality
async function process3DMFile(file) {
    if (!rhino) {
        throw new Error('rhino3dm is not initialized. Please refresh the page and try again.');
    }

    console.log('Processing 3DM file:', file.name);
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
                    const mesh = convertRhinoMeshToThree(geometry);
                    if (mesh) {
                        group.add(mesh);
                        geometryFound = true;
                    }
                } else if (geometry.objectType === rhino.ObjectType.Brep || 
                         geometry.objectType === rhino.ObjectType.Surface ||
                         geometry.objectType === rhino.ObjectType.SubD) {
                    const meshes = await convertRhinoGeometryToMesh(geometry, mp, rhino);
                    if (meshes && meshes.length > 0) {
                        meshes.forEach(mesh => group.add(mesh));
                        geometryFound = true;
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

    if (geometryFound) {
        loadModel(group, file.name);
    } else {
        throw new Error('No valid geometry found in the 3DM file');
    }
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

// Process other file formats
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
                    loadModel(object, file.name);
                    resolve();
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

// Improved mesh conversion for better quality
function convertRhinoMeshToThree(rhinoMesh) {
    const vertices = rhinoMesh.vertices();
    const faces = rhinoMesh.faces();
    
    if (!vertices || !faces || vertices.count === 0 || faces.count === 0) {
        console.warn('Invalid mesh data:', { vertexCount: vertices?.count, faceCount: faces?.count });
        return null;
    }
    
    // Create geometry with proper attributes
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(vertices.count * 3);
    
    // Get vertices
    for (let i = 0; i < vertices.count; i++) {
        const vertex = vertices.get(i);
        if (!vertex || vertex.length !== 3) {
            console.warn('Invalid vertex data at index', i);
            continue;
        }
        positions[i * 3] = vertex[0];
        positions[i * 3 + 1] = vertex[1];
        positions[i * 3 + 2] = vertex[2];
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    // Get faces and create index array for triangles
    const indices = [];
    for (let i = 0; i < faces.count; i++) {
        const face = faces.get(i);
        if (!face || face.length < 3) {
            console.warn('Invalid face data at index', i);
            continue;
        }
        indices.push(face[0], face[1], face[2]);
    }
    
    if (indices.length === 0) {
        console.warn('No valid faces found in mesh');
        return null;
    }
    
    // Set indices and compute normals for smooth shading
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    // Only compute tangents if we have UV coordinates
    try {
        if (geometry.attributes.uv) {
            geometry.computeTangents();
        }
    } catch (e) {
        console.warn('Could not compute tangents:', e.message);
    }
    
    // Create mesh with high quality material
    const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshPhysicalMaterial({
            color: 0xffd700,
            metalness: 0.85,
            roughness: 0.12,
            clearcoat: 0.6,
            clearcoatRoughness: 0.1,
            reflectivity: 0.9,
            envMapIntensity: 1.2,
            side: THREE.DoubleSide
        })
    );
    
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    return mesh;
}

// Load model into scene
function loadModel(object, fileName) {
    let mesh;
    
    // Handle different types of loaded objects
    if (object instanceof THREE.BufferGeometry) {
        // For STL files
        const material = materialPresets.yellow.clone();
        mesh = new THREE.Mesh(object, material);
        
        // Create outline mesh
        const outlineMesh = new THREE.Mesh(object, outlineMaterials.yellow.clone());
        outlineMesh.scale.set(1.02, 1.02, 1.02);
        outlineMesh.userData.isOutline = true;
        mesh.add(outlineMesh);
    } else if (object instanceof THREE.Group || object instanceof THREE.Mesh) {
        mesh = object;
        
        if (mesh instanceof THREE.Group) {
            mesh.traverse(child => {
                if (child instanceof THREE.Mesh && !child.userData.isOutline) {
                    const material = materialPresets.yellow.clone();
                    child.material = material;
                    
                    const outlineMesh = new THREE.Mesh(child.geometry, outlineMaterials.yellow.clone());
                    outlineMesh.scale.set(1.02, 1.02, 1.02);
                    outlineMesh.userData.isOutline = true;
                    child.add(outlineMesh);
                }
            });
        } else {
            const material = materialPresets.yellow.clone();
            mesh.material = material;
            
            const outlineMesh = new THREE.Mesh(mesh.geometry, outlineMaterials.yellow.clone());
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

    scene.add(mesh);
    
    // Update model list in UI
    updateModelList();
    
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

// Update model list in UI with improved multiple model handling
function updateModelList() {
    const modelList = document.getElementById('model-list');
    if (!modelList) return;

    modelList.innerHTML = '<h3>Models</h3>';
    
    if (models.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-model-list';
        emptyMessage.textContent = 'No models loaded. Click "Add Model" to get started.';
        modelList.appendChild(emptyMessage);
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
        modelList.appendChild(item);
    });
    
    // Add "Add More Models" button at the bottom
    const addMoreBtn = document.createElement('button');
    addMoreBtn.className = 'add-more-models-btn';
    addMoreBtn.innerHTML = '<i class="fas fa-plus"></i> Add More Models';
    addMoreBtn.addEventListener('click', () => {
        document.getElementById('file-input').click();
    });
    
    modelList.appendChild(addMoreBtn);
}

// Select a model
function selectModel(index) {
    models.forEach((model, i) => {
        model.selected = i === index;
        
        const handleMesh = (mesh) => {
            if (mesh instanceof THREE.Mesh && !mesh.userData.isOutline) {
                // Create a new material instance to avoid sharing uniforms
                const baseMaterial = materialPresets[mesh.material.userData.materialType || 'yellow'];
                const newMaterial = new THREE.MeshStandardMaterial({
                    color: baseMaterial.color,
                    metalness: baseMaterial.metalness,
                    roughness: baseMaterial.roughness,
                    emissive: model.selected ? new THREE.Color(0x333333) : new THREE.Color(0x000000),
                    emissiveIntensity: 0.1
                });
                
                // Store the material type for future reference
                newMaterial.userData.materialType = mesh.material.userData.materialType || 'yellow';
                
                // Apply the new material
                mesh.material = newMaterial;
                
                // Handle bloom effect
                if (model.selected) {
                    mesh.layers.enable(1);
                } else {
                    mesh.layers.disable(1);
                }
            }
        };

        // Apply to all meshes in the model
        if (model.mesh instanceof THREE.Group) {
            model.mesh.traverse(handleMesh);
        } else if (model.mesh instanceof THREE.Mesh) {
            handleMesh(model.mesh);
        }
    });

    // Update the model list in UI
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
                <option value="yellow">Yellow Gold (High Quality)</option>
                <option value="rose">Rose Gold (High Quality)</option>
                <option value="white">White Gold (High Quality)</option>
                <option value="fastYellow">Yellow Gold (Fast Render)</option>
                <option value="fastRose">Rose Gold (Fast Render)</option>
                <option value="fastWhite">White Gold (Fast Render)</option>
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
    const model = models[index];
    if (!model) return;

    const baseMaterial = materialPresets[materialType];
    
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
}

// Toggle model visibility
function toggleModelVisibility(index) {
    if (index >= 0 && index < models.length) {
        models[index].visible = !models[index].visible;
        models[index].mesh.visible = models[index].visible;
        
        updateModelList(); // Update the model list UI
    }
}

// Remove model
function removeModel(index) {
    if (models[index]) {
        scene.remove(models[index].mesh);
        models.splice(index, 1);
        updateModelList();
        
        // Show drop zone if no models left
        if (models.length === 0) {
            document.getElementById('drop-zone').style.display = 'flex';
        }
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
    scene.background = new THREE.Color(isDarkBackground ? 0x000000 : 0xf5f5f5);
    
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

// Handle drop events
function handleDrop(event) {
    preventDefaults(event);
    unhighlight();
    
    const dt = event.dataTransfer;
    const files = dt.files;
    
    // Prevent processing if already handling files
    if (files.length > 0) {
        // Use setTimeout to avoid event propagation issues
        setTimeout(() => {
            handleFiles(files);
        }, 100);
    }
}

// Add function to update model list with consistent sidebar appearance
function updateModelListInSidebar() {
    const modelListElement = document.getElementById('model-list');
    if (!modelListElement) return;
    
    modelListElement.innerHTML = '';
    
    if (models.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-model-list';
        emptyMessage.textContent = 'No models loaded';
        modelListElement.appendChild(emptyMessage);
        return;
    }
    
    models.forEach((model, index) => {
        const item = document.createElement('div');
        item.className = `model-item ${model.selected ? 'selected' : ''}`;
        
        const label = document.createElement('div');
        label.className = 'model-label';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = model.visible;
        checkbox.addEventListener('change', () => toggleModelVisibility(index));
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = model.name;
        nameSpan.addEventListener('click', () => selectModel(index));
        
        const actions = document.createElement('div');
        actions.className = 'model-actions';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'model-action-btn delete-btn';
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.title = 'Remove model';
        deleteBtn.addEventListener('click', () => removeModel(index));
        
        label.appendChild(checkbox);
        label.appendChild(nameSpan);
        
        actions.appendChild(deleteBtn);
        
        item.appendChild(label);
        item.appendChild(actions);
        
        modelListElement.appendChild(item);
    });
}

// Fix the missing centerSelectedModel function
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

// Add this function if it doesn't exist
function applyMaterial(mesh, materialType) {
    if (!mesh || !materialPresets[materialType]) {
        console.warn('Invalid mesh or material type:', { mesh, materialType });
        return;
    }
    
    const baseMaterial = materialPresets[materialType];
    
    const handleMesh = (meshObject) => {
        if (meshObject instanceof THREE.Mesh && !meshObject.userData.isOutline) {
            const newMaterial = baseMaterial.clone();
            
            // Store the material type for future reference
            newMaterial.userData.materialType = materialType;
            
            // Apply the new material
            meshObject.material = newMaterial;
        }
    };
    
    // Apply to all meshes in the model
    if (mesh instanceof THREE.Group) {
        mesh.traverse(handleMesh);
    } else if (mesh instanceof THREE.Mesh) {
        handleMesh(mesh);
    }
    
    console.log(`Applied ${materialType} material to mesh`);
}