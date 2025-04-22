// theme.js
(function() {
    const themeToggleButton = document.getElementById('theme-toggle');
    const themeToggleButtonLogin = document.getElementById('theme-toggle-login'); // Button on login page
    const body = document.body;

    // Function to get the icon element dynamically, as it might not exist on all pages
    const getThemeIcon = () => {
        const button = themeToggleButton || themeToggleButtonLogin;
        return button ? button.querySelector('i') : null;
    }

    const applyTheme = (theme) => {
        body.classList.remove('light-mode', 'dark-mode');
        body.classList.add(theme + '-mode');
        const themeIcon = getThemeIcon();
        if (themeIcon) {
            themeIcon.className = `fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`;
        }
        localStorage.setItem('theme', theme);
        console.log(`Theme applied: ${theme}`);
    };

    const toggleTheme = () => {
        const currentTheme = body.classList.contains('dark-mode') ? 'dark' : 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme);
    };

    // Add event listeners to both buttons if they exist
    if (themeToggleButton) {
        themeToggleButton.addEventListener('click', toggleTheme);
    }
    if (themeToggleButtonLogin) {
        themeToggleButtonLogin.addEventListener('click', toggleTheme);
    }

    // Apply saved theme on load or system preference
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme) {
        applyTheme(savedTheme);
    } else if (prefersDark) {
        applyTheme('dark');
    } else {
        applyTheme('light'); // Default to light
    }

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (!localStorage.getItem('theme')) { // Only apply if no user preference is set
            applyTheme(e.matches ? 'dark' : 'light');
        }
    });

})(); 