document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const addFilesBtn = document.getElementById('add-files');
    const selectFilesBtn = document.getElementById('select-files');
    const addFilesEmptyBtn = document.getElementById('add-files-empty');
    const fileList = document.getElementById('file-list');
    const emptyState = document.getElementById('empty-state');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');

    let fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.accept = '.glb,.gltf,.obj,.fbx';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    // Drag and drop handlers
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const files = Array.from(e.dataTransfer.files);
        handleFiles(files);
    });

    // Button click handlers
    [addFilesBtn, selectFilesBtn, addFilesEmptyBtn].forEach(btn => {
        btn.addEventListener('click', () => {
            fileInput.click();
        });
    });

    fileInput.addEventListener('change', () => {
        const files = Array.from(fileInput.files);
        handleFiles(files);
    });

    // File handling
    function handleFiles(files) {
        if (files.length === 0) return;

        showLoadingOverlay();
        
        // Filter for supported file types
        const supportedFiles = files.filter(file => {
            const ext = file.name.toLowerCase().split('.').pop();
            return ['glb', 'gltf', 'obj', 'fbx'].includes(ext);
        });

        if (supportedFiles.length === 0) {
            hideLoadingOverlay();
            alert('Please upload supported 3D model files (.glb, .gltf, .obj, .fbx)');
            return;
        }

        // Upload files
        uploadFiles(supportedFiles);
    }

    async function uploadFiles(files) {
        try {
            for (const file of files) {
                await uploadFile(file);
            }
            
            updateFileList();
            hideLoadingOverlay();
        } catch (error) {
            console.error('Error uploading files:', error);
            hideLoadingOverlay();
            alert('Error uploading files. Please try again.');
        }
    }

    async function uploadFile(file) {
        // TODO: Implement actual file upload logic here
        // This is a placeholder that simulates upload
        return new Promise(resolve => {
            setTimeout(() => {
                console.log(`Uploaded file: ${file.name}`);
                resolve();
            }, 1000);
        });
    }

    function updateFileList() {
        // TODO: Implement actual file list update logic
        // This is a placeholder that shows a sample file list
        emptyState.style.display = 'none';
        fileList.style.display = 'block';
        
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <div class="file-info">
                <i class="fas fa-cube"></i>
                <span>Sample Model.glb</span>
            </div>
            <div class="file-actions">
                <button class="delete-btn">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        fileList.appendChild(fileItem);
    }

    function showLoadingOverlay() {
        loadingOverlay.style.display = 'flex';
    }

    function hideLoadingOverlay() {
        loadingOverlay.style.display = 'none';
    }

    // Auth handlers
    loginBtn.addEventListener('click', () => {
        // TODO: Implement actual login logic
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'block';
    });

    logoutBtn.addEventListener('click', () => {
        // TODO: Implement actual logout logic
        logoutBtn.style.display = 'none';
        loginBtn.style.display = 'block';
    });
}); 