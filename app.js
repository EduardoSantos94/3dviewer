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

// Material presets with outline
const materialPresets = {
    yellow: new THREE.MeshPhysicalMaterial({
        color: 0xffd700,
        metalness: 0.8,
        roughness: 0.2,
        clearcoat: 0.5,
        clearcoatRoughness: 0.1,
        emissive: 0x111111,
        emissiveIntensity: 0.1
    }),
    rose: new THREE.MeshPhysicalMaterial({
        color: 0xe6b3b3,
        metalness: 0.8,
        roughness: 0.2,
        clearcoat: 0.5,
        clearcoatRoughness: 0.1,
        emissive: 0x111111,
        emissiveIntensity: 0.1
    }),
    white: new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0.8,
        roughness: 0.2,
        clearcoat: 0.5,
        clearcoatRoughness: 0.1,
        emissive: 0x111111,
        emissiveIntensity: 0.1
    }),
    fastYellow: new THREE.MeshPhongMaterial({
        color: 0xffd700,
        specular: 0xffffff,
        shininess: 100,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        emissive: 0x111111,
        emissiveIntensity: 0.1
    }),
    fastRose: new THREE.MeshPhongMaterial({
        color: 0xe6b8b7,
        specular: 0xffffff,
        shininess: 100,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        emissive: 0x111111,
        emissiveIntensity: 0.1
    }),
    fastWhite: new THREE.MeshPhongMaterial({
        color: 0xffffff,
        specular: 0xffffff,
        shininess: 100,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        emissive: 0x111111,
        emissiveIntensity: 0.1
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

    // Create renderer
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true,
        powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('viewer-container').appendChild(renderer.domElement);

    // Setup post-processing
    composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // Add bloom effect
    bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.5, // strength
        0.4, // radius
        0.85  // threshold
    );
    composer.addPass(bloomPass);

    // Add lights
    ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Add ground plane
    const planeGeometry = new THREE.PlaneGeometry(100, 100);
    const planeMaterial = new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        side: THREE.DoubleSide
    });
    groundPlane = new THREE.Mesh(planeGeometry, planeMaterial);
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.receiveShadow = true;
    scene.add(groundPlane);

    // Add orbit controls with improved settings
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 0.5;
    controls.maxDistance = 1000;
    controls.maxPolarAngle = Math.PI / 2;
    controls.enablePan = true;
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
}

// Setup event listeners
function setupEventListeners() {
    // Window resize
    window.addEventListener('resize', onWindowResize);

    // File input
    const fileInput = document.getElementById('file-input');
    const addModelBtn = document.getElementById('add-model');
    
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelect);
    }

    if (addModelBtn) {
        addModelBtn.addEventListener('click', () => {
            fileInput.click();
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

// Handle files
function handleFiles(files) {
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();
        
        reader.onload = function(event) {
            const loader = getLoaderForFile(file.name);
            if (loader) {
                try {
                    if (file.name.toLowerCase().endsWith('.3dm')) {
                        // Special handling for 3DM files
                        console.log('Loading 3DM file:', file.name);
                        loader.load(event.target.result, function(object) {
                            console.log('3DM file loaded:', object);
                            if (object) {
                                loadModel(object, file.name);
                            } else {
                                console.error('Failed to load 3DM file:', file.name);
                            }
                        }, 
                        // Progress callback
                        function(xhr) {
                            console.log('Loading progress:', (xhr.loaded / xhr.total * 100) + '%');
                        },
                        // Error callback
                        function(error) {
                            console.error('Error loading 3DM file:', error);
                        });
                    } else {
                        // Handle other file types
                        loader.load(event.target.result, function(object) {
                            loadModel(object, file.name);
                        }, undefined, function(error) {
                            console.error('Error loading model:', error);
                        });
                    }
                } catch (error) {
                    console.error('Error processing model:', error);
                }
            }
        };
        
        reader.onerror = function(error) {
            console.error('Error reading file:', error);
        };
        
        reader.readAsDataURL(file);
    }
}

// Handle file selection
function handleFileSelect(event) {
    const files = event.target.files;
    if (files && files.length > 0) {
        handleFiles(files);
    }
}

// Handle drop
function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files && files.length > 0) {
        handleFiles(files);
    }
}

// Get appropriate loader for file type
function getLoaderForFile(filename) {
    const extension = filename.split('.').pop().toLowerCase();
    switch (extension) {
        case 'stl':
            return new STLLoader();
        case 'obj':
            return new OBJLoader();
        case 'gltf':
        case 'glb':
            return new GLTFLoader();
        case '3dm':
            const loader = new Rhino3dmLoader();
            loader.setLibraryPath('https://cdn.jsdelivr.net/npm/rhino3dm@7.15.0/');
            return loader;
        default:
            return null;
    }
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
        outlineMesh.userData.isOutline = true; // Mark as outline mesh
        mesh.add(outlineMesh);
    } else if (object instanceof THREE.Group || object instanceof THREE.Mesh) {
        // For OBJ, GLTF, and 3DM files
        mesh = object;
        
        // Apply material to all meshes in the group
        if (mesh instanceof THREE.Group) {
            mesh.traverse(child => {
                if (child instanceof THREE.Mesh && !child.userData.isOutline) {
                    const material = materialPresets.yellow.clone();
                    child.material = material;
                    
                    // Create outline mesh
                    const outlineMesh = new THREE.Mesh(child.geometry, outlineMaterials.yellow.clone());
                    outlineMesh.scale.set(1.02, 1.02, 1.02);
                    outlineMesh.userData.isOutline = true; // Mark as outline mesh
                    child.add(outlineMesh);
                }
            });
        } else {
            const material = materialPresets.yellow.clone();
            mesh.material = material;
            
            // Create outline mesh
            const outlineMesh = new THREE.Mesh(mesh.geometry, outlineMaterials.yellow.clone());
            outlineMesh.scale.set(1.02, 1.02, 1.02);
            outlineMesh.userData.isOutline = true; // Mark as outline mesh
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
    
    // Position the model
    mesh.position.set(0, 0, 0); // Reset position first
    mesh.position.sub(center.multiplyScalar(scale)); // Center the model
    mesh.scale.set(scale, scale, scale);
    
    // Position the model slightly above the ground plane
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
    
    // Hide drop zone if we have models
    if (models.length > 0) {
        document.getElementById('drop-zone').style.display = 'none';
    }

    // If this is the first model, center the view
    if (models.length === 1) {
        zoomToFit(mesh, camera, controls);
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
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `model-${index}-visibility`;
        checkbox.checked = model.visible;
        checkbox.addEventListener('change', () => toggleModelVisibility(index));
        
        const label = document.createElement('label');
        label.htmlFor = `model-${index}-visibility`;
        label.textContent = model.name;
        label.addEventListener('click', () => selectModel(index));
        
        const visibilityIcon = document.createElement('i');
        visibilityIcon.className = `fas fa-eye${model.visible ? '' : '-slash'}`;
        visibilityIcon.addEventListener('click', () => toggleModelVisibility(index));
        
        item.appendChild(checkbox);
        item.appendChild(label);
        item.appendChild(visibilityIcon);
        modelList.appendChild(item);
    });
}

// Select a model
function selectModel(index) {
    models.forEach((model, i) => {
        model.selected = i === index;
        if (model.mesh instanceof THREE.Group) {
            model.mesh.traverse(child => {
                if (child instanceof THREE.Mesh && child.material) {
                    // Add emissive glow to selected model
                    if (model.selected) {
                        if (child.material.emissive) {
                            child.material.emissive.setHex(0x333333);
                        } else {
                            const newMaterial = child.material.clone();
                            newMaterial.emissive = new THREE.Color(0x333333);
                            child.material = newMaterial;
                        }
                        // Add bloom effect to selected model
                        child.layers.enable(1);
                    } else {
                        if (child.material.emissive) {
                            child.material.emissive.setHex(0x000000);
                        }
                        // Remove bloom effect
                        child.layers.disable(1);
                    }
                }
            });
        } else if (model.mesh.material) {
            if (model.selected) {
                if (model.mesh.material.emissive) {
                    model.mesh.material.emissive.setHex(0x333333);
                } else {
                    const newMaterial = model.mesh.material.clone();
                    newMaterial.emissive = new THREE.Color(0x333333);
                    model.mesh.material = newMaterial;
                }
                // Add bloom effect
                model.mesh.layers.enable(1);
            } else {
                if (model.mesh.material.emissive) {
                    model.mesh.material.emissive.setHex(0x000000);
                }
                // Remove bloom effect
                model.mesh.layers.disable(1);
            }
        }
    });
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

    // Create new materials instead of cloning
    const newMaterial = new THREE.MeshPhysicalMaterial({
        ...materialPresets[materialType].toJSON(),
        emissive: materialPresets[materialType].emissive,
        emissiveIntensity: materialPresets[materialType].emissiveIntensity
    });

    const newOutlineMaterial = new THREE.MeshBasicMaterial({
        ...outlineMaterials[materialType].toJSON()
    });

    if (model.mesh instanceof THREE.Group) {
        model.mesh.traverse(child => {
            if (child instanceof THREE.Mesh) {
                child.material = newMaterial;
                if (child.children.length > 0 && child.children[0] instanceof THREE.Mesh) {
                    child.children[0].material = newOutlineMaterial;
                }
            }
        });
    } else {
        model.mesh.material = newMaterial;
        if (model.mesh.children.length > 0 && model.mesh.children[0] instanceof THREE.Mesh) {
            model.mesh.children[0].material = newOutlineMaterial;
        }
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
    const newMaterial = materialPresets[materialType].clone();
    const newOutlineMaterial = outlineMaterials[materialType].clone();
    
    models.forEach(model => {
        if (model.mesh instanceof THREE.Group) {
            model.mesh.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    child.material = newMaterial;
                    if (child.children.length > 0 && child.children[0] instanceof THREE.Mesh) {
                        child.children[0].material = newOutlineMaterial;
                    }
                }
            });
        } else {
            model.mesh.material = newMaterial;
            if (model.mesh.children.length > 0 && model.mesh.children[0] instanceof THREE.Mesh) {
                model.mesh.children[0].material = newOutlineMaterial;
            }
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

// Handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Update turntable animation if active
    if (isTurntableActive && selectedObject) {
        const delta = turntableClock.getDelta();
        selectedObject.rotation.y += turntableSpeed * delta;
    }
    
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
    const toggleBackgroundBtn = document.getElementById('toggle-background');
    if (toggleBackgroundBtn) {
        toggleBackgroundBtn.classList.toggle('active');
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
    isTurntableActive = !isTurntableActive;
    if (isTurntableActive) {
        turntableClock.start();
    } else {
        turntableClock.stop();
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

// Initialize the application
init(); 