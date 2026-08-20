(() => {
    "use strict";

    const body = document.body;
    if (!body.matches(".dashboard-body, .app-dashboard")) return;

    const platform = "SmartApartment";
    const role = body.dataset.dashboardRole || "user";
    const roleNames = {
        superadmin: "Super Admin",
        admin: "Society Admin",
        resident: "Resident Workspace",
        security: "Security Console",
        maintenance: "Maintenance Desk",
        customer: "Customer Workspace"
    };
    const roleName = roleNames[role] || "Workspace";
    const sidebar = document.querySelector(".sidebar, .dash-sidebar");
    const brand = sidebar?.querySelector(".brand, .dash-brand");
    const navigation = sidebar?.querySelector("nav");
    const header = document.querySelector(".header, .dash-header");

    body.classList.add("dashboard-redesign");

    if (brand && !brand.querySelector(".dashboard-brand-mark")) {
        brand.textContent = "";
        brand.setAttribute("aria-label", `${platform} home`);
        const mark = document.createElement("span");
        mark.className = "dashboard-brand-mark";
        mark.textContent = "⌂";
        mark.setAttribute("aria-hidden", "true");
        brand.append(mark);
    }

    sidebar?.querySelector(".dashboard-sidebar-label")?.remove();

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "dashboard-sidebar-close";
    closeButton.setAttribute("aria-label", "Close dashboard navigation");
    closeButton.innerHTML = "<span aria-hidden=\"true\">&times;</span>";
    sidebar?.prepend(closeButton);

    const menuButton = document.createElement("button");
    menuButton.type = "button";
    menuButton.className = "dashboard-menu-toggle";
    menuButton.setAttribute("aria-label", "Open dashboard navigation");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.innerHTML = "<span></span>";

    const meta = document.createElement("div");
    meta.className = "dashboard-header-meta";
    const status = document.createElement("span");
    status.className = "dashboard-live-status";
    status.innerHTML = "<i aria-hidden=\"true\"></i>Live workspace";
    const avatar = document.createElement("span");
    avatar.className = "dashboard-avatar";
    avatar.textContent = roleName.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();
    avatar.title = roleName;
    meta.append(status, avatar);

    if (header) {
        header.prepend(menuButton);
        header.append(meta);
    }

    function placeThemeToggle() {
        const themeToggle = document.getElementById("themeToggle");
        if (themeToggle && !themeToggle.closest("#electricalSwitchFixed, .fixed-electrical-switch") && !meta.contains(themeToggle)) {
            meta.prepend(themeToggle);
        }
    }

    placeThemeToggle();
    document.addEventListener("DOMContentLoaded", placeThemeToggle, { once: true });

    const scrim = document.createElement("button");
    scrim.type = "button";
    scrim.className = "dashboard-scrim";
    scrim.setAttribute("aria-label", "Close dashboard navigation");
    body.append(scrim);

    function setMenu(open) {
        if (open) body.classList.remove("dashboard-sidebar-collapsed");
        body.classList.toggle("dashboard-menu-open", open);
        menuButton.setAttribute("aria-expanded", String(open));
        menuButton.setAttribute("aria-label", open ? "Close dashboard navigation" : "Open dashboard navigation");
    }

    function closeSidebar() {
        if (window.matchMedia("(max-width: 900px)").matches) {
            setMenu(false);
            return;
        }
        setMenu(false);
        body.classList.add("dashboard-sidebar-collapsed");
    }

    menuButton.addEventListener("click", () => {
        if (window.matchMedia("(max-width: 900px)").matches) {
            setMenu(!body.classList.contains("dashboard-menu-open"));
            return;
        }
        body.classList.remove("dashboard-sidebar-collapsed");
        menuButton.setAttribute("aria-expanded", "true");
    });
    closeButton.addEventListener("click", closeSidebar);
    scrim.addEventListener("click", () => setMenu(false));
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") setMenu(false);
    });

    navigation?.querySelectorAll("button[data-panel]").forEach(button => {
        button.addEventListener("click", () => {
            window.setTimeout(() => syncNavigation(), 0);
            if (window.matchMedia("(max-width: 900px)").matches) setMenu(false);
        });
    });

    function syncNavigation() {
        navigation?.querySelectorAll("button[data-panel]").forEach(button => {
            const active = button.classList.contains("active");
            if (active) button.setAttribute("aria-current", "page");
            else button.removeAttribute("aria-current");
        });
    }
    syncNavigation();

    document.querySelectorAll("table").forEach(table => {
        if (table.parentElement?.classList.contains("dashboard-table-scroll")) return;
        const wrapper = document.createElement("div");
        wrapper.className = "dashboard-table-scroll";
        wrapper.setAttribute("role", "region");
        wrapper.setAttribute("aria-label", "Scrollable data table");
        wrapper.tabIndex = 0;
        table.before(wrapper);
        wrapper.append(table);
    });

    const panelObserver = new MutationObserver(syncNavigation);
    document.querySelectorAll("button[data-panel]").forEach(button => {
        panelObserver.observe(button, { attributes: true, attributeFilter: ["class"] });
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 900) setMenu(false);
        else body.classList.remove("dashboard-sidebar-collapsed");
    }, { passive: true });
})();
