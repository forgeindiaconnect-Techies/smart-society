(function () {
    const root = document.documentElement;
    const storageKey = "app-theme";
    const preferredDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

    const eyeIcon = `
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
            <path d="M2.2 12s3.7-6.5 9.8-6.5S21.8 12 21.8 12s-3.7 6.5-9.8 6.5S2.2 12 2.2 12Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/>
        </svg>`;

    const eyeOffIcon = `
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
            <path d="M3 3l18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M10.6 5.7A9.5 9.5 0 0 1 12 5.5c6.1 0 9.8 6.5 9.8 6.5a18 18 0 0 1-3.1 3.8M6.5 6.9A18.2 18.2 0 0 0 2.2 12s3.7 6.5 9.8 6.5a9 9 0 0 0 4.2-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M9.9 9.9A3 3 0 0 0 14.1 14.1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>`;

    function applyTheme(theme) {
        const nextTheme = theme === "dark" ? "dark" : "light";
        root.dataset.theme = nextTheme;
        localStorage.setItem(storageKey, nextTheme);

        const toggle = document.getElementById("themeToggle");
        if (!toggle) return;
        const dark = nextTheme === "dark";
        toggle.setAttribute("aria-pressed", String(dark));
        toggle.setAttribute("aria-label", `Switch to ${dark ? "light" : "dark"} mode`);
        toggle.querySelector(".theme-toggle-icon").textContent = "";
        toggle.querySelector(".theme-toggle-label").textContent = dark ? "Light mode" : "Dark mode";
    }

    function createThemeToggle() {
        if (document.getElementById("themeToggle")) return;
        const button = document.createElement("button");
        button.id = "themeToggle";
        button.className = "theme-toggle";
        button.type = "button";
        button.innerHTML = '<span class="theme-toggle-icon" aria-hidden="true"></span><span class="theme-toggle-label">Dark mode</span>';
        button.addEventListener("click", () => applyTheme(root.dataset.theme === "dark" ? "light" : "dark"));
        document.body.appendChild(button);
    }

    function enhancePasswordInput(input) {
        if (!input || input.dataset.passwordEnhanced === "true") return;
        input.dataset.passwordEnhanced = "true";

        const wrapper = document.createElement("span");
        wrapper.className = "password-field";
        input.parentNode.insertBefore(wrapper, input);
        wrapper.appendChild(input);

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "password-toggle";
        toggle.setAttribute("aria-label", "Show password");
        toggle.innerHTML = eyeIcon;
        toggle.addEventListener("click", () => {
            const showing = input.type === "text";
            input.type = showing ? "password" : "text";
            toggle.setAttribute("aria-label", showing ? "Show password" : "Hide password");
            toggle.innerHTML = showing ? eyeIcon : eyeOffIcon;
        });
        wrapper.appendChild(toggle);
    }

    function enhancePasswordFields(rootNode = document) {
        rootNode.querySelectorAll?.('input[type="password"], input[data-password-enhanced="true"]').forEach((input) => {
            if (input.matches('input[type="password"]')) enhancePasswordInput(input);
        });
    }

    function watchPasswordFields() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType !== Node.ELEMENT_NODE) return;
                    if (node.matches?.('input[type="password"]')) enhancePasswordInput(node);
                    enhancePasswordFields(node);
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    root.dataset.theme = localStorage.getItem(storageKey) || (preferredDark ? "dark" : "light");

    document.addEventListener("DOMContentLoaded", () => {
        createThemeToggle();
        applyTheme(root.dataset.theme);
        enhancePasswordFields();
        watchPasswordFields();
    });
})();
