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
    const originalName = file.original_name || getOriginalFilename(file.name);
    const size = (file.metadata?.size || 0) / (1024 * 1024);
    const formattedSize = size.toFixed(2);
    const timestamp = new Date(file.created_at || Date.now()).toLocaleDateString();
    const isShared = file.is_shared; // Get the share status

    const card = document.createElement('div');
    card.className = 'model-card';
    card.innerHTML = `
        <div class="model-preview">
            <i class="fas fa-cube"></i>
        </div>
        <div class="model-info">
            <div class="model-name">
                <span class="filename">${file.original_name}</span>
                <span class="share-status-icon" style="display: ${isShared ? 'inline-block' : 'none'}; margin-left: 8px;" title="Shared"><i class="fas fa-share-alt"></i></span>
            </div>
            <div class="model-meta">${formattedSize} MB • ${timestamp}</div>
        </div>
        <div class="model-actions">
            <button class="model-btn view-btn" title="View Model" onclick="viewModel('${file.name}', '${originalName}')">
                <i class="fas fa-eye"></i>
            </button>
            <button class="model-btn share-btn" title="${isShared ? 'Manage Share' : 'Share Model'}">
                <i class="fas fa-share-alt"></i>
            </button>
            <button class="model-btn delete-btn" title="Delete Model" onclick="deleteModel('${file.name}')">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;

    // Add event listeners
    card.querySelector('.view-btn').addEventListener('click', () => viewModel(file.name, originalName));
    card.querySelector('.delete-btn').addEventListener('click', () => deleteModel(file.name));
    card.querySelector('.share-btn').addEventListener('click', () => showShareModal(file.name, originalName));

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

// Alias for backward compatibility
const showErrorMessage = (message) => showError('Error', message);

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

        // Fetch existing share links for the user
        const { data: shares, error: shareError } = await supabase
            .from('shared_links')
            .select('file_path, id') // Select file_path and id to identify shares
            .eq('user_id', session.user.id);

        if (shareError) {
            console.error('Error fetching share links:', shareError);
            // Don't throw, just proceed without share status if fetching fails
        }

        console.log('Files retrieved:', files);
        console.log('Mappings retrieved:', mappings);
        console.log('Shares retrieved:', shares);

        if (!files || files.length === 0) {
            modelsGrid.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        // Create a map of stored names to file mappings
        const mappingsMap = new Map(mappings.map(m => [m.stored_name, m]));

        // Create a Set of file paths that have shares for quick lookup
        const sharedFilePaths = new Set(shares ? shares.map(s => s.file_path) : []);

        modelsGrid.innerHTML = '';
        files.forEach(file => {
            const mapping = mappingsMap.get(file.name);
            const originalName = mapping?.original_name || getOriginalFilename(file.name);
            const filePath = `${session.user.id}/${file.name}`;
            const isShared = sharedFilePaths.has(filePath);

            const card = createModelCard({
                ...file,
                original_name: originalName,
                stored_name: file.name,
                is_shared: isShared // Pass share status to card creation
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
    console.log(`[viewModel] Called with storedName: ${storedName}, originalName: ${originalName}`);
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) {
            throw new Error('No active session');
        }

        const filePath = `${session.user.id}/${storedName}`;
        console.log('[viewModel] Creating signed URL for:', filePath);

        const { data, error } = await supabase.storage
            .from(STORAGE_CONFIG.bucketName)
            .createSignedUrl(filePath, 3600);

        if (error) throw error;
        if (!data?.signedUrl) throw new Error('Failed to get signed URL');

        console.log('[viewModel] Signed URL obtained:', data.signedUrl);

        // Get file extension from original name
        const fileExtension = originalName ? originalName.split('.').pop()?.toLowerCase() : null; 
        if (!fileExtension) {
             console.error(`[viewModel] Could not determine file extension from originalName: ${originalName}`);
             throw new Error('Could not determine file type');
        }
        console.log(`[viewModel] Determined file extension: ${fileExtension}`); 

        // Construct viewer URL
        const viewerUrl = new URL('viewer.html', window.location.origin);
        viewerUrl.searchParams.set('model', encodeURIComponent(data.signedUrl));
        viewerUrl.searchParams.set('type', fileExtension);
        
        // Ensure originalName is valid before setting
        if (originalName) {
            viewerUrl.searchParams.set('filename', encodeURIComponent(originalName));
            console.log(`[viewModel] Added filename param: ${encodeURIComponent(originalName)}`); 
        } else {
             console.warn('[viewModel] originalName is invalid, filename param not set.'); 
        }


        console.log('[viewModel] Final viewer URL:', viewerUrl.toString()); 
        window.location.href = viewerUrl.toString();
    } catch (error) {
        console.error('[viewModel] Error:', error);
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
            .from(STORAGE_CONFIG.bucketName)
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
        const uploadBtn = document.getElementById('upload-btn');
        const uploadFirstBtn = document.getElementById('upload-first-btn');
        const selectFileBtn = document.getElementById('select-file-btn');
        const closeModalBtn = document.getElementById('close-modal');
        const uploadModal = document.getElementById('upload-modal');
        const fileInput = document.getElementById('file-input'); // Assuming this ID exists in upload.html modal
        const modalDropZone = uploadModal ? uploadModal.querySelector('.upload-drop-zone') : null;

        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => toggleUploadModal(true));
        }
        if (uploadFirstBtn) {
            uploadFirstBtn.addEventListener('click', () => toggleUploadModal(true));
        }
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => toggleUploadModal(false));
        }
        // Close modal if clicking outside the content
        if (uploadModal) {
            uploadModal.addEventListener('click', (event) => {
                if (event.target === uploadModal) { // Check if click is on the backdrop
                    toggleUploadModal(false);
                }
            });
        }
        if (selectFileBtn && fileInput) {
            selectFileBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (event) => {
                if (event.target.files.length > 0) {
                    uploadFile(event.target.files[0]); // Assuming single file upload for now
                    toggleUploadModal(false);
                    event.target.value = null; // Reset file input
                }
            });
        }

        // Add Drag & Drop to modal drop zone
        if (modalDropZone && fileInput) {
            modalDropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                modalDropZone.classList.add('dragover');
            });
            modalDropZone.addEventListener('dragleave', () => {
                modalDropZone.classList.remove('dragover');
            });
            modalDropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                modalDropZone.classList.remove('dragover');
                if (e.dataTransfer.files.length > 0) {
                    uploadFile(e.dataTransfer.files[0]); // Assuming single file upload
                    toggleUploadModal(false);
                }
            });
        }

        // Also add logout listener for upload page
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
             logoutBtn.addEventListener('click', async () => {
                 try {
                     const { error } = await supabase.auth.signOut();
                     if (error) throw error;
                     window.location.href = 'login.html';
                 } catch (error) {
                     console.error('Error signing out:', error);
                     showError('Sign Out Error', error.message);
                 }
             });
        }
        
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

// --- Share Link Functionality ---

let currentShareStoredName = null;
let currentShareOriginalName = null;
let currentShareId = null; // Add variable to store existing share ID

// Function to show the share modal
window.showShareModal = async function(storedName, originalName) { // Make async
    currentShareStoredName = storedName;
    currentShareOriginalName = originalName;
    currentShareId = null; // Reset current share ID

    // Get DOM elements
    const modal = document.getElementById('share-modal');
    const modalTitle = modal.querySelector('.modal-header h2');
    const modelNameSpan = document.getElementById('share-model-name');
    const titleInput = document.getElementById('share-title');
    const descriptionInput = document.getElementById('share-description');
    const generatedLinkContainer = document.getElementById('generated-link-container');
    const generatedLinkInput = document.getElementById('generated-link');
    const errorMessage = document.getElementById('share-error-message');
    const passwordInput = document.getElementById('share-password');
    const radioPublic = document.querySelector('input[name="share-option"][value="public"]');
    const radioPassword = document.querySelector('input[name="share-option"][value="password"]');
    const mainButton = document.getElementById('generate-share-link-btn');
    const loadingOverlay = document.getElementById('loading-overlay');

    // Ensure all elements exist
    if (!modal || !modalTitle || !modelNameSpan || !titleInput || !descriptionInput || !generatedLinkContainer || !generatedLinkInput || !errorMessage || !passwordInput || !radioPublic || !radioPassword || !mainButton || !loadingOverlay) {
        console.error('Share modal elements not found!');
        showError('UI Error', 'Could not open share dialog.');
        return;
    }

    // Reset modal state
    modelNameSpan.textContent = originalName || storedName;
    generatedLinkContainer.style.display = 'none';
    errorMessage.style.display = 'none';
    titleInput.value = '';
    descriptionInput.value = '';
    passwordInput.value = '';
    passwordInput.style.display = 'none';
    radioPublic.checked = true;
    mainButton.disabled = false;
    // Remove delete button if it exists from previous opens
    const existingDeleteBtn = document.getElementById('delete-share-link-btn');
    if (existingDeleteBtn) existingDeleteBtn.remove();

    loadingOverlay.style.display = 'flex';

    try {
        // Check session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session?.user) throw new Error('Authentication required.');
        const userId = session.user.id;
        const filePath = `${userId}/${storedName}`;

        // Check if a share already exists for this file path
        const { data: existingShare, error: fetchError } = await supabase
            .from('shared_links')
            .select('id, title, description, access_code')
            .eq('user_id', userId)
            .eq('file_path', filePath)
            .limit(1)
            .maybeSingle(); // Use maybeSingle to handle 0 or 1 result

        if (fetchError) throw fetchError;

        if (existingShare) {
            // --- Manage Existing Share Mode ---
            console.log('Existing share found:', existingShare);
            currentShareId = existingShare.id; // Store the ID

            modalTitle.textContent = 'Manage Share';
            mainButton.textContent = 'Update Link';

            titleInput.value = existingShare.title || '';
            descriptionInput.value = existingShare.description || '';

            if (existingShare.access_code) {
                radioPassword.checked = true;
                passwordInput.style.display = 'block';
                // Don't pre-fill password, maybe add placeholder?
                passwordInput.placeholder = 'Enter new password to change, or leave blank to keep existing';
            } else {
                radioPublic.checked = true;
                passwordInput.style.display = 'none';
            }

            // Show the generated link immediately
            const shareUrl = `${window.location.origin}/index.html?shareId=${currentShareId}`;
            generatedLinkInput.value = shareUrl;
            generatedLinkContainer.style.display = 'block';

            // Add Delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.id = 'delete-share-link-btn';
            deleteBtn.textContent = 'Delete Share Link';
            deleteBtn.className = 'secondary-btn delete-share-btn'; // Reuse styles, add specific class
            deleteBtn.style.marginTop = '1rem';
            deleteBtn.style.width = '100%';
            deleteBtn.style.backgroundColor = 'var(--danger-primary)'; // Make it red
            deleteBtn.style.color = 'var(--text-inverted)';
            deleteBtn.style.borderColor = 'var(--danger-primary)';
            deleteBtn.onclick = () => deleteShareLink(currentShareId);
            mainButton.parentNode.insertBefore(deleteBtn, mainButton.nextSibling); // Insert after main button

        } else {
            // --- Create New Share Mode ---
            console.log('No existing share found for this file.');
            modalTitle.textContent = 'Share Model';
            mainButton.textContent = 'Generate Link';
            passwordInput.placeholder = 'Enter password'; // Reset placeholder
            // Reset fields (already done above)
        }

        modal.style.display = 'flex';

    } catch (error) {
        console.error('Error preparing share modal:', error);
        errorMessage.textContent = `Error loading share info: ${error.message}`;
        errorMessage.style.display = 'block';
        // Optionally close modal or just show error
    } finally {
        loadingOverlay.style.display = 'none';
    }
}

// Function to close the share modal
function closeShareModal() {
    const modal = document.getElementById('share-modal');
    if (modal) {
        modal.style.display = 'none';
        // Remove the delete button if it exists
        const deleteBtn = document.getElementById('delete-share-link-btn');
        if (deleteBtn) deleteBtn.remove();
    }
}

// Function to hash the password (simple example using SubtleCrypto)
async function hashPassword(password) {
    if (!password) return null;
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    } catch (error) {
        console.error('Error hashing password:', error);
        throw new Error('Could not process password.');
    }
}

// Function to create or update the share link in Supabase
async function createShareLink() { // Rename implies create or update now
    const storedName = currentShareStoredName;
    const originalName = currentShareOriginalName;
    const existingShareId = currentShareId; // Get the stored ID

    const errorMessage = document.getElementById('share-error-message');
    const generatedLinkContainer = document.getElementById('generated-link-container');
    const generatedLinkInput = document.getElementById('generated-link');
    const generateBtn = document.getElementById('generate-share-link-btn');
    const loadingOverlay = document.getElementById('loading-overlay');

    // Get Title and Description values
    const titleInput = document.getElementById('share-title');
    const descriptionInput = document.getElementById('share-description');
    const shareTitle = titleInput ? titleInput.value.trim() : null;
    const shareDescription = descriptionInput ? descriptionInput.value.trim() : null;

    if (!storedName || !originalName || !errorMessage || !generatedLinkContainer || !generatedLinkInput || !generateBtn || !loadingOverlay) {
        console.error('Required elements for createShareLink not found');
        showError('Share Error', 'UI elements missing or original name not found.');
        return;
    }

    errorMessage.style.display = 'none';
    generateBtn.disabled = true;
    loadingOverlay.style.display = 'flex';

    try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session?.user) {
            throw new Error('Authentication required.');
        }
        const userId = session.user.id;
        const filePath = `${userId}/${storedName}`;
        const fileType = originalName.split('.').pop()?.toLowerCase();

        if (!fileType) {
            throw new Error('Could not determine file type from original name.');
        }
        
        const shareOption = document.querySelector('input[name="share-option"]:checked').value;
        let accessCode = null;
        let hashedCode = null;
        
        if (shareOption === 'password') {
            accessCode = document.getElementById('share-password').value;
            // If managing an existing link and password field is blank, DO NOT update the hash
            if (existingShareId && !accessCode) {
                hashedCode = undefined; // Special value to signal no change to password hash
            } else if (!accessCode) {
                throw new Error('Password cannot be empty for protected link.');
            } else {
                hashedCode = await hashPassword(accessCode); // Hash the new password
            }
        } else {
            hashedCode = null; // Explicitly set to null for public links
        }

        // Prepare data for insert or update
        const payload = {
            user_id: userId,
            file_path: filePath,
            title: shareTitle || null,
            description: shareDescription || null,
            original_filename: originalName,
            file_type: fileType
            // Only include access_code if it needs to be set or changed
        };
        if (hashedCode !== undefined) { // If hashedCode is not undefined, update it
             payload.access_code = hashedCode;
        }

        let shareId;
        let operationResult;
        let operationError;

        if (existingShareId) {
            // --- Update Existing Share ---
            console.log(`Updating share link ID: ${existingShareId} with payload:`, payload);
            const { data, error } = await supabase
                .from('shared_links')
                .update(payload)
                .eq('id', existingShareId)
                .eq('user_id', userId) // Ensure user owns the record
                .select('id') // Select ID to confirm update
                .single();
            operationResult = data;
            operationError = error;
            shareId = existingShareId; // ID doesn't change on update
            if (!operationError) showSuccess('Share link updated successfully!');

        } else {
            // --- Insert New Share ---
            console.log('Inserting new share link with payload:', payload);
            const { data, error } = await supabase
                .from('shared_links')
                .insert(payload)
                .select('id')
                .single();
            operationResult = data;
            operationError = error;
            if (!operationError && operationResult) {
                 shareId = operationResult.id;
                 currentShareId = shareId; // Store the new ID
                 showSuccess('Share link created successfully!');
            } else if (!operationResult && !operationError) {
                 // Handle case where insert might succeed but return no data unexpectedly
                 operationError = new Error('Failed to retrieve share link ID after creation.');
            }
        }

        if (operationError) {
            console.error('Supabase operation error:', operationError);
            throw new Error(`Failed to ${existingShareId ? 'update' : 'create'} share link: ${operationError.message}`);
        }

        if (!shareId) {
            throw new Error(`Failed to get share link ID after ${existingShareId ? 'update' : 'creation'}.`);
        }

        const shareUrl = `${window.location.origin}/index.html?shareId=${shareId}`;

        generatedLinkInput.value = shareUrl;
        generatedLinkContainer.style.display = 'block';

        // --- Auto-copy logic ---
        generatedLinkInput.select(); // Select the text
        try {
            const successful = document.execCommand('copy');
            const msg = successful ? 'successful' : 'unsuccessful';
            console.log('Auto-copying link was ' + msg);
            // Update copy button text immediately
            const copyBtn = document.getElementById('copy-link-btn');
            if (copyBtn) {
                copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                setTimeout(() => {
                    copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
                }, 2500); // Reset after 2.5 seconds
            }
        } catch (err) {
            console.error('Auto-copy failed:', err);
            // Optionally alert the user or just rely on manual copy
        }
        // --- End Auto-copy logic ---

    } catch (error) {
        console.error('Error creating share link:', error);
        errorMessage.textContent = error.message;
        errorMessage.style.display = 'block';
        generatedLinkContainer.style.display = 'none';
    } finally {
        generateBtn.disabled = false;
        loadingOverlay.style.display = 'none';
    }
}

// --- Add Delete Share Link Function ---
async function deleteShareLink(shareIdToDelete) {
    if (!shareIdToDelete) {
        showError('Delete Error', 'Cannot delete - Share ID is missing.');
        return;
    }

    if (!confirm('Are you sure you want to permanently delete this share link? This cannot be undone.')) {
        return;
    }

    const loadingOverlay = document.getElementById('loading-overlay');
    loadingOverlay.style.display = 'flex';

    try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session?.user) {
            throw new Error('Authentication required.');
        }

        console.log(`Attempting to delete share link ID: ${shareIdToDelete}`);

        const { error: deleteError } = await supabase
            .from('shared_links')
            .delete()
            .eq('id', shareIdToDelete)
            .eq('user_id', session.user.id); // Ensure user owns the record

        if (deleteError) {
            console.error('Supabase delete error:', deleteError);
            throw new Error(`Failed to delete share link: ${deleteError.message}`);
        }

        showSuccess('Share link deleted successfully.');
        closeShareModal();
        await updateModelsGrid(); // Refresh the grid to update the icon

    } catch (error) {
        console.error('Error deleting share link:', error);
        showError('Delete Error', error.message);
    } finally {
        loadingOverlay.style.display = 'none';
    }
}

// Event Listeners for Share Modal
document.addEventListener('DOMContentLoaded', () => {
    const closeModalBtn = document.getElementById('close-share-modal');
    const shareOptions = document.querySelectorAll('input[name="share-option"]');
    const passwordInput = document.getElementById('share-password');
    const generateBtn = document.getElementById('generate-share-link-btn');
    const copyBtn = document.getElementById('copy-link-btn');
    const generatedLinkInput = document.getElementById('generated-link');

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeShareModal);
    }

    if (passwordInput) {
        shareOptions.forEach(radio => {
            radio.addEventListener('change', () => {
                passwordInput.style.display = radio.value === 'password' ? 'block' : 'none';
            });
        });
    }

    if (generateBtn) {
        generateBtn.addEventListener('click', createShareLink);
    }

    if (copyBtn && generatedLinkInput) {
        copyBtn.addEventListener('click', () => {
            generatedLinkInput.select();
            try {
                document.execCommand('copy');
                copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                setTimeout(() => {
                     copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
                }, 2000);
            } catch (err) {
                console.error('Failed to copy link:', err);
                alert('Failed to copy link. Please copy manually.');
            }
        });
    }
});

// --- End Share Link Functionality --- 