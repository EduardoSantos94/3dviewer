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
    if (frontpage) {
        frontpage.style.display = 'none';
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

// Material presets with improved quality
const materialPresets = {
    yellow: new THREE.MeshPhysicalMaterial({
        color: 0xffd700,
        metalness: 0.7,
        roughness: 0.3,
        clearcoat: 0.4,
        clearcoatRoughness: 0.2,
        reflectivity: 0.8,
        envMapIntensity: 0.7,
        side: THREE.DoubleSide
    }),
    rose: new THREE.MeshPhysicalMaterial({
        color: 0xe6b3b3,
        metalness: 0.7,
        roughness: 0.3,
        clearcoat: 0.4,
        clearcoatRoughness: 0.2,
        reflectivity: 0.8,
        envMapIntensity: 0.7,
        side: THREE.DoubleSide
    }),
    white: new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0.7,
        roughness: 0.3,
        clearcoat: 0.4,
        clearcoatRoughness: 0.2,
        reflectivity: 0.8,
        envMapIntensity: 0.7,
        side: THREE.DoubleSide
    }),
    fastYellow: new THREE.MeshStandardMaterial({
        color: 0xffd700,
        metalness: 0.9,
        roughness: 0.1,
        envMapIntensity: 2.0,
        side: THREE.DoubleSide
    }),
    fastRose: new THREE.MeshStandardMaterial({
        color: 0xe6b8b7,
        metalness: 0.9,
        roughness: 0.1,
        envMapIntensity: 2.0,
        side: THREE.DoubleSide
    }),
    fastWhite: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.9,
        roughness: 0.1,
        envMapIntensity: 2.0,
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
    renderer.toneMappingExposure = 0.8;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.getElementById('viewer-container').appendChild(renderer.domElement);

    // Setup post-processing with improved settings
    composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // Add subtle bloom for metallic highlights
    bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.2,  // strength
        0.5,  // radius
        0.8   // threshold
    );
    composer.addPass(bloomPass);

    // Studio lighting setup
    ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    // Key light
    directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.bias = -0.0001;
    scene.add(directionalLight);

    // Fill light
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-5, 2, 2);
    scene.add(fillLight);

    // Rim light for edge definition
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.2);
    rimLight.position.set(0, -5, -5);
    scene.add(rimLight);

    // Create studio environment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    // Create a simple gradient environment
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#ffffff');
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
        metalness: 0.0,
        roughness: 0.7,
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

// Setup event listeners
function setupEventListeners() {
    // Window resize
    window.addEventListener('resize', onWindowResize);

    // File input handling
    const fileInput = document.getElementById('file-input');
    const addModelBtn = document.getElementById('add-model');
    
    if (fileInput) {
        // Remove any existing listeners
        const newFileInput = fileInput.cloneNode(true);
        fileInput.parentNode.replaceChild(newFileInput, fileInput);
        
        newFileInput.addEventListener('change', (event) => {
            console.log('File input change event triggered');
            const files = event.target.files;
            if (files && files.length > 0) {
                handleFiles(files);
            }
        });
    }

    if (addModelBtn) {
        // Remove any existing listeners
        const newAddModelBtn = addModelBtn.cloneNode(true);
        addModelBtn.parentNode.replaceChild(newAddModelBtn, addModelBtn);
        
        newAddModelBtn.addEventListener('click', () => {
            console.log('Add model button clicked');
            const fileInput = document.getElementById('file-input');
            if (fileInput) {
                fileInput.click();
            }
        });
    }

    // Drop zone
    const dropZone = document.getElementById('drop-zone');
    
    if (dropZone) {
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
            document.body.addEventListener(eventName, preventDefaults, false);
        });

        // Highlight drop zone when dragging over it
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, unhighlight, false);
        });

        // Handle dropped files
        dropZone.addEventListener('drop', handleDrop, false);
    }

    // Controls
    const materialSelect = document.getElementById('material-select');
    const ambientLightControl = document.getElementById('ambient-light');
    const directionalLightControl = document.getElementById('directional-light');
    const backgroundColorControl = document.getElementById('background-color');
    const centerModelBtn = document.getElementById('center-model');
    const toggleFloorBtn = document.getElementById('toggle-floor');
    const toggleBackgroundBtn = document.getElementById('toggle-background');
    const toggleSidebarBtn = document.getElementById('toggle-sidebar');

    if (materialSelect) materialSelect.addEventListener('change', handleMaterialChange);
    if (ambientLightControl) ambientLightControl.addEventListener('input', handleAmbientLightChange);
    if (directionalLightControl) directionalLightControl.addEventListener('input', handleDirectionalLightChange);
    if (backgroundColorControl) backgroundColorControl.addEventListener('input', handleBackgroundColorChange);
    if (centerModelBtn) centerModelBtn.addEventListener('click', centerModel);
    if (toggleFloorBtn) toggleFloorBtn.addEventListener('click', toggleFloor);
    if (toggleBackgroundBtn) toggleBackgroundBtn.addEventListener('click', toggleBackground);
    if (toggleSidebarBtn) toggleSidebarBtn.addEventListener('click', toggleSidebar);

    // Add turntable button event listener
    const toggleTurntableBtn = document.getElementById('toggle-turntable');
    if (toggleTurntableBtn) {
        toggleTurntableBtn.addEventListener('click', () => {
            if (selectedObject) {
                toggleTurntable();
                toggleTurntableBtn.classList.toggle('active', isTurntableActive);
            }
        });
    }

    // Click handling for object selection
    renderer.domElement.addEventListener('click', handleClick);
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
    mp.gridMinCount = 50;      // Increase from 16 for better detail
    mp.gridMaxCount = 512;     // Increase from 256 for better detail
    mp.gridAngle = 15;         // Decrease for smoother curves
    mp.gridAspectRatio = 1.5;  // Adjust for better mesh quality
    mp.simplePlanes = false;   // Don't simplify planar surfaces
    mp.refineGrid = true;      // Enable grid refinement
    mp.simplifyMesh = false;   // Don't simplify the resulting mesh
    mp.packNormals = true;     // Pack normals for better quality
    mp.tolerance = 0.01;       // Set tolerance for better accuracy
    return mp;
}

// Update file handling to ensure single-click works
async function handleFiles(files) {
    if (!files || files.length === 0) return;

    const file = files[0];
    const extension = file.name.split('.').pop().toLowerCase();

    try {
        showLoadingIndicator();
        hideFrontpage();

        if (extension === '3dm') {
            if (!rhino) {
                throw new Error('rhino3dm is not initialized. Please refresh the page and try again.');
            }

            console.log('Processing 3DM file...');
            const buffer = await file.arrayBuffer();
            
            try {
                const doc = rhino.File3dm.fromByteArray(new Uint8Array(buffer));
                if (!doc) {
                    throw new Error('Failed to parse 3DM file');
                }

                console.log('Successfully parsed 3DM file');
                const objects = doc.objects();
                const group = new THREE.Group();
                let geometryFound = false;

                // Get improved meshing parameters
                const mp = getMeshingParameters(rhino);

                for (let i = 0; i < objects.count; i++) {
                    const obj = objects.get(i);
                    const geometry = obj.geometry();

                    if (geometry) {
                        try {
                            if (geometry.objectType === rhino.ObjectType.Mesh) {
                                console.log('Processing Mesh geometry');
                                const mesh = convertRhinoMeshToThree(geometry);
                                if (mesh) {
                                    group.add(mesh);
                                    geometryFound = true;
                                }
                            } else if (geometry.objectType === rhino.ObjectType.Brep || 
                                     geometry.objectType === rhino.ObjectType.Surface ||
                                     geometry.objectType === rhino.ObjectType.SubD) {
                                console.log(`Processing ${geometry.objectType} geometry`);
                                
                                let meshes = null;

                                if (geometry.objectType === rhino.ObjectType.Brep) {
                                    console.log('Converting Brep to mesh');
                                    const faces = geometry.faces();
                                    meshes = [];
                                    
                                    for (let faceIndex = 0; faceIndex < faces.count; faceIndex++) {
                                        const face = faces.get(faceIndex);
                                        const mesh = face.getMesh(mp);
                                        if (mesh) {
                                            meshes.push(mesh);
                                        }
                                        face.delete();
                                    }
                                    
                                    faces.delete();
                                } else {
                                    console.log('Converting Surface/SubD to mesh');
                                    const mesh = geometry.getMesh(mp);
                                    if (mesh) {
                                        meshes = [mesh];
                                    }
                                }

                                if (meshes && meshes.length > 0) {
                                    meshes.forEach(mesh => {
                                        if (mesh && mesh.vertices().count > 0) {
                                            const threeMesh = convertRhinoMeshToThree(mesh);
                                            if (threeMesh) {
                                                group.add(threeMesh);
                                                geometryFound = true;
                                            }
                                            mesh.delete();
                                        }
                                    });
                                }
                            }
                            geometry.delete();
                        } catch (error) {
                            console.error('Error converting geometry:', error);
                        }
                    }
                    obj.delete();
                }

                mp.delete();
                objects.delete();
                doc.delete();

                if (geometryFound) {
                    loadModel(group, file.name);
                    
                    // Ensure controls panel and center button are visible
                    const controlsPanel = document.querySelector('.controls-panel');
                    if (controlsPanel) {
                        controlsPanel.style.display = 'block';
                        
                        // Make sure center button exists and is visible
                        const centerBtn = document.getElementById('center-model');
                        if (!centerBtn) {
                            const centerBtn = document.createElement('button');
                            centerBtn.id = 'center-model';
                            centerBtn.innerHTML = '<i class="fas fa-compress-arrows-alt"></i>';
                            centerBtn.title = 'Center Model';
                            centerBtn.addEventListener('click', centerModel);
                            controlsPanel.appendChild(centerBtn);
                        }
                    }
                } else {
                    throw new Error('No valid geometry found in the 3DM file');
                }
            } catch (error) {
                console.error('Error parsing 3DM file:', error);
                throw new Error(`Failed to parse 3DM file: ${error.message}`);
            }
        } else {
            // Handle other file formats (OBJ, STL, GLTF)
            const loader = getLoaderForFile(file.name);
            if (!loader) {
                throw new Error(`Unsupported file format: ${extension}`);
            }

            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    loader.load(e.target.result, function(object) {
                        loadModel(object, file.name);
                        hideLoadingIndicator();
                    }, undefined, function(error) {
                        console.error('Error loading file:', error);
                        hideLoadingIndicator();
                        alert('Failed to load file: ' + error.message);
                    });
                } catch (error) {
                    console.error('Error loading file:', error);
                    hideLoadingIndicator();
                    alert('Failed to load file: ' + error.message);
                }
            };
            reader.readAsDataURL(file);
        }

        hideLoadingIndicator();
    } catch (error) {
        console.error('Error processing file:', error);
        hideLoadingIndicator();
        alert(error.message || 'Failed to process file. Please try again.');
    }
}

// Update convertRhinoMeshToThree function for better material handling
function convertRhinoMeshToThree(rhinoMesh) {
    const vertices = rhinoMesh.vertices();
    const faces = rhinoMesh.faces();
    
    if (!vertices || !faces || vertices.count === 0 || faces.count === 0) {
        console.warn('Invalid mesh data:', { vertexCount: vertices?.count, faceCount: faces?.count });
        return null;
    }
    
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
    
    // Get faces
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
    
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    // Create mesh with improved material settings
    const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshPhysicalMaterial({
            color: 0xffd700,
            metalness: 0.7,
            roughness: 0.3,
            clearcoat: 0.4,
            clearcoatRoughness: 0.2,
            reflectivity: 0.8,
            envMapIntensity: 0.7,
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

// Update model list in UI
function updateModelList() {
    const modelList = document.getElementById('model-list');
    if (!modelList) return;

    modelList.innerHTML = '';
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
        
        const visibilityIcon = document.createElement('i');
        visibilityIcon.className = `fas fa-eye${model.visible ? '' : '-slash'}`;
        visibilityIcon.addEventListener('click', () => toggleModelVisibility(index));
        
        label.appendChild(checkbox);
        label.appendChild(nameSpan);
        item.appendChild(label);
        item.appendChild(visibilityIcon);
        modelList.appendChild(item);
    });
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
    if (models[index]) {
        models[index].visible = !models[index].visible;
        models[index].mesh.visible = models[index].visible;
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

    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        const selected = intersects[0].object;
        
        // Find the parent model in our models array
        let parentModel = null;
        for (const model of models) {
            if (model.mesh === selected || model.mesh.children.includes(selected)) {
                parentModel = model.mesh;
                break;
            }
        }
        
        if (parentModel) {
            selectedObject = parentModel;
            // Stop turntable if it was active
            isTurntableActive = false;
            turntableClock.stop();
            
            // Zoom to fit the selected object
            zoomToFit(selectedObject, camera, controls);
        }
    } else {
        selectedObject = null;
    }
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

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Update turntable animation if active
    if (isTurntableActive && selectedObject) {
        const delta = turntableClock.getDelta();
        const rotationSpeed = turntableSpeed * delta;
        
        // Apply rotation to the selected object
        selectedObject.rotation.y += rotationSpeed;
        
        // Ensure smooth continuous rotation
        if (selectedObject.rotation.y > Math.PI * 2) {
            selectedObject.rotation.y -= Math.PI * 2;
        }
    }
    
    // Always update controls
    controls.update();
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

// Toggle turntable animation
function toggleTurntable() {
    if (!selectedObject) return;
    
    isTurntableActive = !isTurntableActive;
    
    // Update button state
    const toggleTurntableBtn = document.getElementById('toggle-turntable');
    if (toggleTurntableBtn) {
        toggleTurntableBtn.classList.toggle('active', isTurntableActive);
    }
    
    if (isTurntableActive) {
        turntableClock.start();
        controls.enableRotate = false; // Disable manual rotation during turntable
        selectedObject.userData.initialRotation = selectedObject.rotation.y;
    } else {
        turntableClock.stop();
        controls.enableRotate = true; // Re-enable manual rotation
        
        // Reset to initial rotation smoothly
        if (selectedObject.userData.initialRotation !== undefined) {
            const targetRotation = selectedObject.userData.initialRotation;
            const currentRotation = selectedObject.rotation.y;
            const duration = 500; // milliseconds
            const startTime = Date.now();
            
            function animateRotation() {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Ease out function
                const easeProgress = 1 - Math.pow(1 - progress, 3);
                
                selectedObject.rotation.y = currentRotation + (targetRotation - currentRotation) * easeProgress;
                
                if (progress < 1) {
                    requestAnimationFrame(animateRotation);
                }
            }
            
            animateRotation();
        }
    }
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
function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const dt = e.dataTransfer;
    const files = dt.files;

    if (files && files.length > 0) {
        handleFiles(files);
    }
}