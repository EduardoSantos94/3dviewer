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
    const progressBar = document.querySelector('.upload-progress');
    const progressBarFill = progressBar?.querySelector('.progress-bar');
    const progressText = progressBar?.querySelector('.progress-text');

    try {
        if (!currentSession?.user?.id) throw new Error('No active session');

        // Validate file size (max 50MB)
        const MAX_FILE_SIZE = 50 * 1024 * 1024;
        if (file.size > MAX_FILE_SIZE) {
            throw new Error(`File size exceeds 50MB limit: ${formatFileSize(file.size)}`);
        }

        // Validate file type
        const allowedTypes = ['.3dm', '.obj', '.stl', '.glb', '.gltf'];
        const fileExt = '.' + file.name.split('.').pop().toLowerCase();
        if (!allowedTypes.includes(fileExt)) {
            throw new Error(`Unsupported file type: ${fileExt}`);
        }

        // Create a safe filename
        const timestamp = Date.now();
        const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileName = `${timestamp}-${safeFileName}`;
        const filePath = `${currentSession.user.id}/${fileName}`;

        // Show upload progress
        if (progressBar) progressBar.style.display = 'block';
        if (progressBarFill) progressBarFill.style.width = '0%';
        if (progressText) progressText.textContent = 'Uploading...';

        // Upload the file
        const { data, error } = await supabase.storage
            .from('client-files')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) throw error;

        // Update the file list
        await updateFileList();
        showSuccess('File uploaded successfully');
    } catch (error) {
        console.error('Upload error:', error);
        showErrorMessage(error.message || 'Failed to upload file');
    } finally {
        if (progressBar) progressBar.style.display = 'none';
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
    // Add Files button
    const addFilesBtn = document.getElementById('add-files-btn');
    if (addFilesBtn) {
        addFilesBtn.addEventListener('click', () => {
            const uploadArea = document.getElementById('upload-area');
            if (uploadArea) {
                uploadArea.style.display = uploadArea.style.display === 'none' ? 'block' : 'none';
                addFilesBtn.innerHTML = uploadArea.style.display === 'none' ? 
                    '<i class="fas fa-plus"></i> Add Files' : 
                    '<i class="fas fa-times"></i> Cancel';
            }
        });
    }

    // Add First Model button
    const addFirstModelBtn = document.getElementById('add-first-model-btn');
    if (addFirstModelBtn) {
        addFirstModelBtn.addEventListener('click', () => {
            const uploadArea = document.getElementById('upload-area');
            if (uploadArea) {
                uploadArea.style.display = 'block';
                const addFilesBtn = document.getElementById('add-files-btn');
                if (addFilesBtn) {
                    addFilesBtn.innerHTML = '<i class="fas fa-times"></i> Cancel';
                }
            }
        });
    }

    // Select Files button
    const selectFilesBtn = document.getElementById('select-files-btn');
    if (selectFilesBtn) {
        selectFilesBtn.addEventListener('click', () => {
            document.getElementById('file-input').click();
        });
    }

    // File input change
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                const uploadArea = document.getElementById('upload-area');
                if (uploadArea) {
                    uploadArea.style.display = 'none';
                }
                const addFilesBtn = document.getElementById('add-files-btn');
                if (addFilesBtn) {
                    addFilesBtn.innerHTML = '<i class="fas fa-plus"></i> Add Files';
                }
                files.forEach(file => uploadFile(file));
            }
            e.target.value = ''; // Reset input
        });
    }

    // Login button
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            window.location.href = 'login.html';
        });
    }

    // Logout button
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

    // Initialize
    checkAuth();
});

// Make functions globally available
window.viewFile = viewFile;
window.deleteFile = deleteFile;
window.uploadFile = uploadFile;
window.showSuccess = showSuccess;
window.showErrorMessage = showErrorMessage;

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
        await updateFileList();
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