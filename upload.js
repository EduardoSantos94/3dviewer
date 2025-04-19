document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Supabase client
    const supabaseUrl = 'https://lwmcnwwkgdauqgxukwhn.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3bWNud3drZ2RhdXFneHVrd2huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ5NzcwNzcsImV4cCI6MjA2MDU1MzA3N30._NfRA6_3PL9JLEG9-X9P3Tzg5E59NuXtcmQzOdkraNE';
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

    // Get DOM elements
    const dropZone = document.getElementById('drop-zone');
    const addFilesBtn = document.getElementById('add-files');
    const selectFilesBtn = document.getElementById('select-files');
    const addFilesEmptyBtn = document.getElementById('add-files-empty');
    const fileList = document.getElementById('file-list');
    const emptyState = document.getElementById('empty-state');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');

    // Create file input
    let fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.accept = '.glb,.gltf,.obj,.fbx,.3dm,.stl';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    // Check auth state on load
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (session) {
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'block';
        loadUserFiles();
    } else {
        loginBtn.style.display = 'block';
        logoutBtn.style.display = 'none';
    }

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
            if (!session) {
                window.location.href = 'login.html';
                return;
            }
            fileInput.click();
        });
    });

    fileInput.addEventListener('change', () => {
        const files = Array.from(fileInput.files);
        handleFiles(files);
    });

    // File handling
    async function handleFiles(files) {
        if (!session) {
            window.location.href = 'login.html';
            return;
        }

        if (files.length === 0) return;

        showLoadingOverlay();
        
        // Filter for supported file types
        const supportedFiles = files.filter(file => {
            const ext = file.name.toLowerCase().split('.').pop();
            return ['glb', 'gltf', 'obj', 'fbx', '3dm', 'stl'].includes(ext);
        });

        if (supportedFiles.length === 0) {
            hideLoadingOverlay();
            alert('Please upload supported 3D model files (.glb, .gltf, .obj, .fbx, .3dm, .stl)');
            return;
        }

        try {
            await uploadFiles(supportedFiles);
            await loadUserFiles();
        } catch (error) {
            console.error('Error handling files:', error);
            alert('Error uploading files. Please try again.');
        } finally {
            hideLoadingOverlay();
        }
    }

    async function uploadFiles(files) {
        const userId = session.user.id;
        
        for (const file of files) {
            const timestamp = Date.now();
            const randomString = Math.random().toString(36).substring(7);
            const fileName = `${timestamp}-${randomString}-${file.name}`;
            const filePath = `${userId}/${fileName}`;

            try {
                const { data, error } = await supabase.storage
                    .from('client-files')
                    .upload(filePath, file, {
                        cacheControl: '3600',
                        upsert: false,
                        contentType: file.type
                    });

                if (error) throw error;
                console.log('Uploaded file:', fileName);
            } catch (error) {
                console.error('Error uploading file:', file.name, error);
                throw error;
            }
        }
    }

    async function loadUserFiles() {
        if (!session) return;

        try {
            const { data: files, error } = await supabase.storage
                .from('client-files')
                .list(session.user.id + '/', {
                    limit: 100,
                    offset: 0,
                    sortBy: { column: 'created_at', order: 'desc' }
                });

            if (error) throw error;

            updateFileList(files);
        } catch (error) {
            console.error('Error loading files:', error);
            alert('Error loading your files. Please refresh the page.');
        }
    }

    function updateFileList(files) {
        if (!files || files.length === 0) {
            emptyState.style.display = 'block';
            fileList.style.display = 'none';
            return;
        }

        emptyState.style.display = 'none';
        fileList.style.display = 'block';
        fileList.innerHTML = '';

        files.forEach(file => {
            const originalName = file.name.split('-').slice(2).join('-');
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <div class="file-info">
                    <i class="fas fa-cube"></i>
                    <span>${originalName}</span>
                </div>
                <div class="file-actions">
                    <button class="view-btn" title="View Model">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="delete-btn" title="Delete Model">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;

            // Add view handler
            const viewBtn = fileItem.querySelector('.view-btn');
            viewBtn.addEventListener('click', async () => {
                try {
                    const { data: { signedUrl }, error } = await supabase.storage
                        .from('client-files')
                        .createSignedUrl(`${session.user.id}/${file.name}`, 3600);

                    if (error) throw error;

                    // Redirect to viewer with signed URL
                    const params = new URLSearchParams({
                        model: encodeURIComponent(signedUrl),
                        filename: encodeURIComponent(originalName)
                    });
                    window.location.href = `index.html?${params.toString()}`;
                } catch (error) {
                    console.error('Error getting signed URL:', error);
                    alert('Error viewing file. Please try again.');
                }
            });

            // Add delete handler
            const deleteBtn = fileItem.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', async () => {
                if (!confirm('Are you sure you want to delete this file?')) return;

                try {
                    const { error } = await supabase.storage
                        .from('client-files')
                        .remove([`${session.user.id}/${file.name}`]);

                    if (error) throw error;

                    await loadUserFiles();
                } catch (error) {
                    console.error('Error deleting file:', error);
                    alert('Error deleting file. Please try again.');
                }
            });

            fileList.appendChild(fileItem);
        });
    }

    function showLoadingOverlay() {
        loadingOverlay.style.display = 'flex';
    }

    function hideLoadingOverlay() {
        loadingOverlay.style.display = 'none';
    }

    // Auth handlers
    loginBtn.addEventListener('click', () => {
        window.location.href = 'login.html';
    });

    logoutBtn.addEventListener('click', async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Error signing out:', error);
            alert('Error signing out. Please try again.');
        }
    });

    // Listen for auth state changes
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') {
            loginBtn.style.display = 'none';
            logoutBtn.style.display = 'block';
            loadUserFiles();
        } else if (event === 'SIGNED_OUT') {
            loginBtn.style.display = 'block';
            logoutBtn.style.display = 'none';
            emptyState.style.display = 'block';
            fileList.style.display = 'none';
        }
    });
}); 