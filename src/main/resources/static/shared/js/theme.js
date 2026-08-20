(function () {
    const root = document.documentElement;
    const storageKey = "app-theme";
    const preferredDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

    if (window.location.pathname.startsWith("/propertydirect")) {
        root.classList.add("propertydirect-theme-surface");
    }

    const sunSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;

    const moonSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

    function playSwitchClickSound(isDark) {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(isDark ? 220 : 340, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(isDark ? 90 : 140, ctx.currentTime + 0.045);
            gain.gain.setValueAtTime(0.12, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.045);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.045);
        } catch (e) {}
    }

    function createSwitchHtml(isDark) {
        return `
            <div class="modern-theme-switch ${isDark ? 'is-dark' : 'is-light'}" title="${isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}">
                <span class="switch-option sun-option">${sunSvg}</span>
                <span class="switch-option moon-option">${moonSvg}</span>
                <div class="switch-thumb"></div>
            </div>
        `;
    }

    function applyTheme(theme, userTriggered = false) {
        const nextTheme = theme === "dark" ? "dark" : "light";
        root.dataset.theme = nextTheme;
        localStorage.setItem(storageKey, nextTheme);
        const dark = nextTheme === "dark";

        if (userTriggered) {
            playSwitchClickSound(dark);
        }

        document.querySelectorAll("#electricalSwitchFixed").forEach((toggle) => {
            toggle.setAttribute("aria-pressed", String(dark));
            toggle.setAttribute("aria-label", `Switch to ${dark ? "light" : "dark"} mode`);
            toggle.innerHTML = createSwitchHtml(dark);
        });
    }

    function createThemeToggle() {
        if (document.getElementById("electricalSwitchFixed")) return;

        const fixedWrapper = document.createElement("div");
        fixedWrapper.id = "electricalSwitchFixed";
        fixedWrapper.className = "electrical-switch-wrapper fixed-electrical-switch";
        fixedWrapper.setAttribute("role", "button");
        fixedWrapper.setAttribute("tabindex", "0");
        fixedWrapper.addEventListener("click", () => {
            applyTheme(root.dataset.theme === "dark" ? "light" : "dark", true);
        });
        fixedWrapper.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                applyTheme(root.dataset.theme === "dark" ? "light" : "dark", true);
            }
        });

        document.body.appendChild(fixedWrapper);
    }

    const savedTheme = localStorage.getItem(storageKey);
    root.dataset.theme = savedTheme || (preferredDark ? "dark" : "light");

    document.addEventListener("DOMContentLoaded", () => {
        createThemeToggle();
        applyTheme(root.dataset.theme);
    });
})();
