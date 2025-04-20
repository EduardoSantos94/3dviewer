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

// Add this after the supabase initialization
const FILE_TABLE = 'file_mappings';

// Add this near the top of the file after the Supabase initialization
const STORAGE_CONFIG = {
    bucketName: 'client-files',
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedTypes: ['.3dm', '.obj', '.stl', '.glb', '.gltf', '.fbx']
};

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
    const originalName = file.original_name || file.name.split('-').slice(2).join('-');
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
                <button class="model-btn view-btn" onclick="viewModel('${file.stored_name || file.name}', '${originalName}')">
                    <i class="fas fa-eye"></i>
                    View
                </button>
                <button class="model-btn delete-btn" onclick="deleteModel('${file.stored_name || file.name}')">
                    <i class="fas fa-trash"></i>
                    Delete
                </button>
            </div>
        </div>
    `;
    return card;
}

// Function to show error messages
function showError(title, message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
        <div class="error-content">
            <i class="fas fa-exclamation-circle"></i>
            <h3>${title}</h3>
            <p>${message}</p>
            <button onclick="this.closest('.error-message').remove()">Close</button>
        </div>
    `;
    document.body.appendChild(errorDiv);
    setTimeout(() => {
        if (document.body.contains(errorDiv)) {
            errorDiv.remove();
        }
    }, 5000);
}

// Function to show success messages
function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.innerHTML = `
        <div class="success-content">
            <i class="fas fa-check-circle"></i>
            <p>${message}</p>
        </div>
    `;
    document.body.appendChild(successDiv);
    setTimeout(() => successDiv.remove(), 3000);
}

// Function to update the models grid
async function updateModelsGrid() {
    const modelsGrid = document.getElementById('models-grid');
    const emptyState = document.getElementById('empty-state');
    
    try {
        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        
        if (!session?.user?.id) {
            console.log('No active session, redirecting to login');
            window.location.href = 'login.html';
            return;
        }

        currentSession = session;
        
        // Get file mappings
        const { data: mappings, error: mappingError } = await supabase
            .from(FILE_TABLE)
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false });

        if (mappingError) throw mappingError;

        // List files from storage
        const { data: files, error: storageError } = await supabase.storage
            .from(STORAGE_CONFIG.bucketName)
            .list(session.user.id);

        if (storageError) throw storageError;

        console.log('Files retrieved:', files);
        console.log('Mappings retrieved:', mappings);

        if (!files || files.length === 0) {
            modelsGrid.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        // Create a map of stored names to file mappings
        const mappingsMap = new Map(mappings.map(m => [m.stored_name, m]));

        modelsGrid.innerHTML = '';
        files.forEach(file => {
            const mapping = mappingsMap.get(file.name);
            const originalName = mapping?.original_name || getOriginalFilename(file.name);
            const card = createModelCard({
                ...file,
                original_name: originalName,
                stored_name: file.name
            });
            modelsGrid.appendChild(card);
        });

        modelsGrid.style.display = 'grid';
        emptyState.style.display = 'none';
    } catch (error) {
        console.error('Error updating models grid:', error);
        showError('Error Loading Models', error.message);
    }
}

// Function to show/hide upload modal
function toggleUploadModal(show) {
    const modal = document.getElementById('upload-modal');
    if (modal) {
        modal.style.display = show ? 'flex' : 'none';
    }
}

// Function to view a model
async function viewModel(storedName, originalName) {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) {
            throw new Error('No active session');
        }

        const filePath = `${session.user.id}/${storedName}`;
        console.log('Creating signed URL for:', filePath);

        const { data, error } = await supabase.storage
            .from(STORAGE_CONFIG.bucketName)
            .createSignedUrl(filePath, 3600);

        if (error) throw error;
        if (!data?.signedUrl) throw new Error('Failed to get signed URL');

        // Get file extension from original name
        const fileExtension = originalName.split('.').pop()?.toLowerCase();
        if (!fileExtension) throw new Error('Could not determine file type');

        // Construct viewer URL
        const viewerUrl = new URL('index.html', window.location.origin);
        viewerUrl.searchParams.set('model', encodeURIComponent(data.signedUrl));
        viewerUrl.searchParams.set('type', fileExtension);

        console.log('Redirecting to viewer:', viewerUrl.toString());
        window.location.href = viewerUrl.toString();
    } catch (error) {
        console.error('Error viewing model:', error);
        showError('View Error', error.message);
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

        loadingOverlay.style.display = 'flex';
        const userId = currentSession.user.id;

        console.log('Fetching files for user:', userId);

        // List files from the bucket
        const { data: files, error } = await supabase.storage
            .from('client-files')
            .list(userId);

        if (error) {
            console.error('Storage list error:', error);
            throw error;
        }

        console.log('Files retrieved:', files);

        if (!files || files.length === 0) {
            console.log('No files found for user');
            fileListContent.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        // Get file mappings from the database
        const { data: mappings, error: mappingError } = await supabase
            .from(FILE_TABLE)
            .select('*')
            .eq('user_id', userId);

        if (mappingError) {
            console.error('File mapping error:', mappingError);
            throw mappingError;
        }

        console.log('File mappings:', mappings);

        // Create a map of stored names to original names
        const nameMap = new Map(mappings.map(m => [m.stored_name, m.original_name]));

        const fileItems = files.map(file => {
            const originalName = nameMap.get(file.name) || getOriginalFilename(file.name);
            const size = (file.metadata?.size || 0) / (1024 * 1024);
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
                        <button onclick="deleteFile('${file.name}')" class="file-action-btn delete-btn">
                            <i class="fas fa-trash"></i>
                            Delete
                        </button>
                    </div>
                </div>
            `;
        });

        fileListContent.innerHTML = fileItems.join('');
        emptyState.style.display = 'none';
        
        // Update the models grid as well
        await updateModelsGrid();
    } catch (error) {
        console.error('Error updating file list:', error);
        showErrorMessage('Failed to update file list: ' + error.message);
        fileListContent.innerHTML = '';
        emptyState.style.display = 'block';
    } finally {
        loadingOverlay.style.display = 'none';
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
        const maxSize = STORAGE_CONFIG.maxFileSize;
        if (file.size > maxSize) {
            throw new Error(`File size exceeds ${maxSize / (1024 * 1024)}MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB)`);
        }

        if (!STORAGE_CONFIG.allowedTypes.includes('.' + file.name.split('.').pop().toLowerCase())) {
            throw new Error(`Unsupported file type: ${file.name.split('.').pop()}`);
        }

        // Create unique filename while preserving original name
        const timestamp = Date.now();
        const uniqueId = Math.random().toString(36).substring(7);
        const storedName = `${timestamp}-${uniqueId}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const filePath = `${currentSession.user.id}/${storedName}`;

        // Upload file
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from(STORAGE_CONFIG.uploadPath)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false,
                contentType: file.type,
                duplex: 'half',
                headers: {
                    'x-upsert': 'true',
                    'Cache-Control': 'max-age=3600'
                },
                onUploadProgress: (progress) => {
                    const percentage = Math.round((progress.loaded / progress.total) * 100);
                    progressFill.style.width = `${percentage}%`;
                    progressPercentage.textContent = `${percentage}%`;
                }
            });

        if (uploadError) throw uploadError;

        // Store filename mapping
        const { error: mappingError } = await supabase
            .from(FILE_TABLE)
            .insert([{
                user_id: currentSession.user.id,
                stored_name: storedName,
                original_name: file.name,
                file_path: filePath,
                created_at: new Date().toISOString()
            }]);

        if (mappingError) throw mappingError;

        // Update grid and show success
        await updateModelsGrid();
        showSuccess(`${file.name} uploaded successfully`);

        // Hide progress after a delay
        setTimeout(() => {
            progressBar.style.display = 'none';
        }, 2000);

        return uploadData;
    } catch (error) {
        console.error('Upload error:', error);
        showErrorMessage(error.message || 'Failed to upload file');
        progressBar.style.display = 'none';
        throw error;
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

        // Get a signed URL with the correct port configuration
        const { data, error } = await supabase.storage
            .from('client-files')
            .createSignedUrl(`${currentSession.user.id}/${fileName}`, 3600, {
                transform: {
                    width: 800,
                    height: 600,
                    quality: 80
                }
            });

        if (error) throw error;
        if (!data?.signedUrl) throw new Error('Failed to get file URL');

        // Construct absolute viewer URL without port number
        const baseUrl = window.location.origin;
        const viewerUrl = new URL(`${baseUrl}/index.html`);
        viewerUrl.searchParams.set('model', encodeURIComponent(data.signedUrl));
        viewerUrl.searchParams.set('filename', encodeURIComponent(originalFilename));
        viewerUrl.searchParams.set('type', encodeURIComponent(fileType));

        // Open in new tab
        window.open(viewerUrl.toString(), '_blank');
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
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Check auth state first
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!session) {
            window.location.href = 'login.html';
            return;
        }

        currentSession = session;
        
        // Update UI with user info
        const userEmail = document.getElementById('user-email');
        if (userEmail) {
            userEmail.textContent = session.user.email;
        }

        // Initialize the models grid
        await updateModelsGrid();

        // Set up other event listeners
        // ... (keep existing event listeners)
    } catch (error) {
        console.error('Initialization error:', error);
        showError('Initialization Error', error.message);
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