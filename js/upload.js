import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.3/+esm';

// Initialize Supabase client
const supabaseUrl = 'https://lwmcnwwkgdauqgxukwhn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3bWNud3drZ2RhdXFneHVrd2huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ5NzcwNzcsImV4cCI6MjA2MDU1MzA3N30._NfRA6_3PL9JLEG9-X9P3Tzg5E59NuXtcmQzOdkraNE';

let currentSession = null;
let refreshTimer = null;

// Initialize Supabase with error handling
try {
    window.supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Supabase client initialized');
} catch (error) {
    console.error('Failed to initialize Supabase:', error);
    showErrorMessage('Failed to initialize Supabase: ' + error.message);
}

// Function to extract original filename from stored name
function getOriginalFilename(storedName) {
    // If the name contains a timestamp prefix (e.g., "1234567890-filename.ext")
    if (storedName.match(/^\d+-/)) {
        return storedName.replace(/^\d+-/, '');
    }
    return storedName;
}

// Function to create a model card
function createModelCard(file) {
    // Extract original filename from the stored name
    const originalName = file.name.split('-').slice(2).join('-');
    const size = (file.metadata?.size || file.size || 0) / (1024 * 1024);
    const formattedSize = size.toFixed(2);
    const timestamp = new Date(file.created_at || Date.now()).toLocaleDateString();

    const card = document.createElement('div');
    card.className = 'model-card';
    card.innerHTML = `
        <div class="model-preview">
            <i class="fas fa-cube"></i>
        </div>
        <div class="model-info">
            <div class="model-name">${originalName}</div>
            <div class="model-meta">${formattedSize} MB • ${timestamp}</div>
            <div class="model-actions">
                <button class="model-btn view-btn" onclick="viewModel('${file.name}', '${originalName}')">
                    <i class="fas fa-eye"></i>
                    View
                </button>
                <button class="model-btn delete-btn" onclick="deleteModel('${file.name}')">
                    <i class="fas fa-trash"></i>
                    Delete
                </button>
            </div>
        </div>
    `;
    return card;
}

// Function to update the models grid
async function updateModelsGrid() {
    const modelsGrid = document.getElementById('models-grid');
    const emptyState = document.getElementById('empty-state');
    
    try {
        if (!currentSession?.user?.id) throw new Error('No active session');
        
        const { data: files, error } = await supabase.storage
            .from('client-files')
            .list(currentSession.user.id + '/');

        if (error) throw error;

        if (!files || files.length === 0) {
            modelsGrid.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        modelsGrid.innerHTML = '';
        files.forEach(file => {
            const card = createModelCard(file);
            modelsGrid.appendChild(card);
        });

        modelsGrid.style.display = 'grid';
        emptyState.style.display = 'none';
    } catch (error) {
        console.error('Error updating models grid:', error);
        showErrorMessage('Failed to load models: ' + error.message);
    }
}

// Function to show/hide upload modal
function toggleUploadModal(show) {
    const modal = document.getElementById('upload-modal');
    modal.style.display = show ? 'flex' : 'none';
}

// Function to view a model
async function viewModel(fileName, originalName) {
    try {
        if (!currentSession?.user?.id) throw new Error('No active session');

        const { data, error } = await supabase.storage
            .from('client-files')
            .createSignedUrl(`${currentSession.user.id}/${fileName}`, 3600);

        if (error) throw error;
        if (!data?.signedUrl) throw new Error('Failed to get file URL');

        // Open viewer in new tab with original filename
        const viewerUrl = new URL(window.location.origin + '/index.html');
        viewerUrl.searchParams.set('model', data.signedUrl);
        viewerUrl.searchParams.set('filename', originalName);
        window.open(viewerUrl.toString(), '_blank');
    } catch (error) {
        console.error('Error viewing model:', error);
        showErrorMessage('Failed to view model: ' + error.message);
    }
}

// Function to delete a model
async function deleteModel(fileName) {
    try {
        if (!confirm('Are you sure you want to delete this model?')) return;
        if (!currentSession?.user?.id) throw new Error('No active session');

        const { error } = await supabase.storage
            .from('client-files')
            .remove([`${currentSession.user.id}/${fileName}`]);

        if (error) throw error;

        await updateModelsGrid();
        showSuccess('Model deleted successfully');
    } catch (error) {
        console.error('Error deleting model:', error);
        showErrorMessage('Failed to delete model: ' + error.message);
    }
}

// Function to update the file list
async function updateFileList() {
    const fileListContent = document.getElementById('file-list-content');
    const emptyState = document.getElementById('empty-state');
    const loadingOverlay = document.getElementById('loading-overlay');

    if (!fileListContent || !emptyState || !loadingOverlay) {
        console.error('Required DOM elements not found');
        return;
    }

    try {
        if (!currentSession?.user?.id) {
            throw new Error('No active session');
        }

        loadingOverlay.classList.add('active');
        const userPath = currentSession.user.id + '/';

        console.log('Fetching files from:', userPath);

        const { data: files, error } = await supabase.storage
            .from('client-files')
            .list(userPath);

        if (error) throw error;

        if (!files || files.length === 0) {
            fileListContent.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        const fileItems = files.map(file => {
            const originalName = getOriginalFilename(file.name);
            const size = (file.metadata?.size || file.size || 0) / (1024 * 1024);
            const formattedSize = size.toFixed(2);

            return `
                <div class="file-item">
                    <div class="file-info">
                        <i class="fas fa-cube file-icon"></i>
                        <div class="file-details">
                            <span class="file-name">${originalName}</span>
                            <span class="file-size">${formattedSize} MB</span>
                        </div>
                    </div>
                    <div class="file-actions">
                        <button onclick="viewFile('${file.name}', '${originalName}')" class="file-action-btn view-btn">
                            <i class="fas fa-eye"></i>
                            View
                        </button>
                        <button onclick="deleteFile('${file.name}')" class="file-action-btn delete">
                            <i class="fas fa-trash"></i>
                            Delete
                        </button>
                    </div>
                </div>
            `;
        });

        fileListContent.innerHTML = fileItems.join('');
        emptyState.style.display = 'none';
    } catch (error) {
        console.error('Error updating file list:', error);
        showErrorMessage('Failed to update file list: ' + error.message);
        fileListContent.innerHTML = '';
        emptyState.style.display = 'block';
    } finally {
        loadingOverlay.classList.remove('active');
    }
}

// Function to handle file uploads
async function uploadFile(file) {
    const progressBar = document.getElementById('upload-progress');
    const progressFill = document.getElementById('progress-fill');
    const progressFilename = document.getElementById('progress-filename');
    const progressPercentage = document.getElementById('progress-percentage');

    try {
        if (!currentSession?.user?.id) throw new Error('No active session');

        // Show progress
        progressBar.style.display = 'block';
        progressFilename.textContent = file.name;
        progressFill.style.width = '0%';
        progressPercentage.textContent = '0%';

        // Validate file
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (file.size > maxSize) {
            throw new Error(`File size exceeds 50MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB)`);
        }

        const allowedTypes = ['.3dm', '.obj', '.stl', '.glb', '.gltf', '.fbx'];
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        if (!allowedTypes.includes(ext)) {
            throw new Error(`Unsupported file type: ${ext}`);
        }

        // Create safe filename with timestamp
        const timestamp = Date.now();
        const safeFileName = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const filePath = `${currentSession.user.id}/${safeFileName}`;

        // Upload with progress
        const { error: uploadError } = await supabase.storage
            .from('client-files')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false,
                metadata: {
                    originalName: file.name,
                    uploadedAt: new Date().toISOString()
                },
                onUploadProgress: (progress) => {
                    const percentage = Math.round((progress.loaded / progress.total) * 100);
                    progressFill.style.width = `${percentage}%`;
                    progressPercentage.textContent = `${percentage}%`;
                }
            });

        if (uploadError) throw uploadError;

        // Update grid and show success
        await updateModelsGrid();
        showSuccess(`${file.name} uploaded successfully`);

        // Hide progress after a delay
        setTimeout(() => {
            progressBar.style.display = 'none';
        }, 2000);

        // Close modal
        toggleUploadModal(false);
    } catch (error) {
        console.error('Upload error:', error);
        showErrorMessage(error.message || 'Failed to upload file');
        progressBar.style.display = 'none';
    }
}

// Function to view a file
async function viewFile(fileName, originalFilename) {
    const loadingOverlay = document.getElementById('loading-overlay');
    try {
        if (!currentSession?.user?.id) throw new Error('No active session');
        loadingOverlay.classList.add('active');

        const fileType = originalFilename.split('.').pop().toLowerCase();
        if (!['3dm', 'obj', 'stl', 'glb', 'gltf'].includes(fileType)) {
            throw new Error(`Unsupported file type: ${fileType}`);
        }

        // Get a signed URL
        const { data, error } = await supabase.storage
            .from('client-files')
            .createSignedUrl(`${currentSession.user.id}/${fileName}`, 3600);

        if (error) throw error;
        if (!data?.signedUrl) throw new Error('Failed to get file URL');

        // Log URL for debugging
        console.log('Generated URL:', {
            fileName,
            originalFilename,
            signedUrl: data.signedUrl
        });

        // Construct absolute viewer URL
        const baseUrl = window.location.href.split('/').slice(0, -1).join('/');
        const viewerUrl = `${baseUrl}/index.html?model=${encodeURIComponent(data.signedUrl)}&filename=${encodeURIComponent(originalFilename)}&type=${encodeURIComponent(fileType)}`;

        console.log('Redirecting to:', viewerUrl);

        // Open in new tab
        window.open(viewerUrl, '_blank');
    } catch (error) {
        console.error('Error viewing file:', error);
        showErrorMessage('Failed to view file: ' + error.message);
    } finally {
        loadingOverlay.classList.remove('active');
    }
}

// Function to delete a file
async function deleteFile(fileName) {
    try {
        if (!currentSession?.user?.id) throw new Error('No active session');

        const { error } = await supabase.storage
            .from('client-files')
            .remove([`${currentSession.user.id}/${fileName}`]);

        if (error) throw error;

        await updateFileList();
        showSuccess('File deleted successfully');
    } catch (error) {
        console.error('Delete error:', error);
        showErrorMessage('Failed to delete file: ' + error.message);
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Initialize auth state
    checkAuth();

    // Upload button handlers
    const uploadBtn = document.getElementById('upload-btn');
    const uploadFirstBtn = document.getElementById('upload-first-btn');
    const closeModalBtn = document.getElementById('close-modal');
    const selectFileBtn = document.getElementById('select-file-btn');
    const fileInput = document.getElementById('file-input');
    const dropZone = document.getElementById('drop-zone');

    [uploadBtn, uploadFirstBtn].forEach(btn => {
        if (btn) {
            btn.addEventListener('click', () => toggleUploadModal(true));
        }
    });

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => toggleUploadModal(false));
    }

    if (selectFileBtn) {
        selectFileBtn.addEventListener('click', () => fileInput.click());
    }

    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                await uploadFile(files[0]); // Upload first file only
            }
            e.target.value = ''; // Reset input
        });
    }

    // Drop zone handlers
    if (dropZone) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('dragover');
            });
        });

        dropZone.addEventListener('drop', async (e) => {
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) {
                await uploadFile(files[0]); // Upload first file only
            }
        });
    }

    // Logout handler
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                const { error } = await supabase.auth.signOut();
                if (error) throw error;
                window.location.href = 'login.html';
            } catch (error) {
                console.error('Logout error:', error);
                showErrorMessage('Failed to logout: ' + error.message);
            }
        });
    }
});

// Make functions globally available
window.viewFile = viewFile;
window.deleteFile = deleteFile;
window.uploadFile = uploadFile;
window.showSuccess = showSuccess;
window.showErrorMessage = showErrorMessage;
window.viewModel = viewModel;
window.deleteModel = deleteModel;
window.toggleUploadModal = toggleUploadModal;

// Helper functions
function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    document.body.appendChild(successDiv);
    setTimeout(() => successDiv.remove(), 3000);
}

function showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 3000);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Auth functions
async function checkAuth() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (!session) {
            window.location.replace('login.html');
            return;
        }

        currentSession = session;
        updateAuthUI(session);
        await updateModelsGrid();
    } catch (error) {
        console.error('Auth check failed:', error);
        showErrorMessage('Authentication failed: ' + error.message);
    }
}

function updateAuthUI(session) {
    const userInfo = document.getElementById('user-info');
    const loginInfo = document.getElementById('login-info');
    const userEmail = document.getElementById('user-email');

    if (session?.user) {
        if (userEmail) userEmail.textContent = session.user.email;
        if (userInfo) userInfo.style.display = 'flex';
        if (loginInfo) loginInfo.style.display = 'none';
    } else {
        if (userInfo) userInfo.style.display = 'none';
        if (loginInfo) loginInfo.style.display = 'flex';
    }
} 