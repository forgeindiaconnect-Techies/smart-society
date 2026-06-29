const listings = [
    {
        title: "2 BHK Apartment in Whitefield",
        city: "Bangalore",
        locality: "Whitefield",
        type: "Rent",
        price: "₹28,000",
        image: "/shared/images/apartment-living-1.webp",
        meta: ["2 BHK", "Semi Furnished", "Owner Listed"]
    },
    {
        title: "3 BHK Family Home in Adyar",
        city: "Chennai",
        locality: "Adyar",
        type: "Buy",
        price: "₹1.35 Cr",
        image: "/shared/images/apartment-living-2.webp",
        meta: ["3 BHK", "Ready to Move", "Zero Brokerage"]
    },
    {
        title: "Premium 3 BHK Apartment near Hitech City",
        city: "Hyderabad",
        locality: "Hitech City",
        type: "Premium",
        price: "₹85,000",
        image: "/shared/images/propertydirect-cinematic-1.webp",
        meta: ["3 BHK", "Fully Furnished", "Gated Society"]
    },
    {
        title: "1 BHK Studio in Powai",
        city: "Mumbai",
        locality: "Powai",
        type: "Rent",
        price: "₹42,000",
        image: "/shared/images/apartment-bedroom-1.webp",
        meta: ["1 BHK", "Furnished", "Pet Friendly"]
    },
    {
        title: "2 BHK Flat in Wakad",
        city: "Pune",
        locality: "Wakad",
        type: "Buy",
        price: "₹72 L",
        image: "/shared/images/propertydirect-cinematic-2.webp",
        meta: ["2 BHK", "New Project", "Owner Listed"]
    },
    {
        title: "Premium 4 BHK Apartment in Koramangala",
        city: "Bangalore",
        locality: "Koramangala",
        type: "Premium",
        price: "₹1.2 L",
        image: "/shared/images/apartment-living-2.webp",
        meta: ["4 BHK", "Luxury Apartment", "Gated Society"]
    }
];

let activeMode = "Buy";

const modeViews = {
    Buy: {
        key: "buy",
        icon: "B",
        label: "Homes to own",
        title: "Find a home that is truly yours.",
        description: "Explore owner-listed apartments for sale, compare neighbourhoods and connect directly without brokerage.",
        browseLabel: "Browse Homes for Sale",
        searchLabel: "Search Homes to Buy",
        placeholder: "Search homes for sale, locality or landmark...",
        filters: ["Ready to Move", "New Project", "Owner Listed", "Gated Society"]
    },
    Rent: {
        key: "rent",
        icon: "R",
        label: "Move in sooner",
        title: "Rent directly. Settle in faster.",
        description: "Discover verified rental homes, speak with owners and schedule visits without agent calls or brokerage fees.",
        browseLabel: "Browse Rental Homes",
        searchLabel: "Search Homes to Rent",
        placeholder: "Search rental homes, locality or monthly budget...",
        filters: ["Furnished", "Semi Furnished", "Pet Friendly", "Owner Listed"]
    },
    Premium: {
        key: "premium",
        icon: "P",
        label: "Curated residences",
        title: "Exceptional homes, personally curated.",
        description: "Explore luxury apartments in sought-after neighbourhoods with priority support and guided owner connections.",
        browseLabel: "Explore Premium Homes",
        searchLabel: "Search Premium Homes",
        placeholder: "Search luxury homes, premium societies or landmarks...",
        filters: ["Luxury Apartment", "Fully Furnished", "Gated Society", "3 BHK"]
    }
};

const grid = document.getElementById("propertyGrid");
const toast = document.getElementById("toast");
const modal = document.getElementById("appModal");
const modalTitle = document.getElementById("modalTitle");
const modalText = document.getElementById("modalText");
const modalFields = document.getElementById("modalFields");
const superadminModal = document.getElementById("superadminModal");
const closeSuperadminModal = document.getElementById("closeSuperadminModal");
const submitSuperadminLogin = document.getElementById("submitSuperadminLogin");
const superadminUsername = document.getElementById("superadminUsername");
const superadminPassword = document.getElementById("superadminPassword");
const dashboardLoginModal = document.getElementById("dashboardLoginModal");
const closeDashboardLoginModal = document.getElementById("closeDashboardLoginModal");
const submitDashboardLogin = document.getElementById("submitDashboardLogin");
const dashboardLoginTitle = document.getElementById("dashboardLoginTitle");
const dashboardLoginHelp = document.getElementById("dashboardLoginHelp");
const dashboardUsername = document.getElementById("dashboardUsername");
const dashboardPassword = document.getElementById("dashboardPassword");
const propertyExperience = document.getElementById("propertyExperience");
const modeFilters = document.getElementById("modeFilters");
const localityInput = document.getElementById("locality");
const searchButton = document.getElementById("searchButton");

let pendingDashboardLogin = null;
let activeModalKind = "contact";

const dashboardLoginHints = {
    superadmin: ["PropertyDirect Super Admin Login", "Sign in to open the platform dashboard."],
    admin: ["PropertyDirect Admin Login", "Sign in to open the admin dashboard."],
    customer: ["PropertyDirect Customer Login", "Sign in to open the customer dashboard."]
};

const dashboardTargets = {
    superadmin: "/propertydirect/dashboards/superadmin",
    admin: "/propertydirect/dashboards/admin",
    customer: "/propertydirect/dashboards/customer"
};

function renderListings(items = listings) {
    grid.innerHTML = items.map((item, index) => `
        <article class="property-card">
            <div class="property-image property-image-${index % 4}">
                <img src="${item.image}" alt="${item.title}">
                <span class="listing-badge">${item.type === "Premium" ? "Curated" : "Owner listed"}</span>
                <button class="save-property" type="button" aria-label="Save ${item.title}">♡</button>
            </div>
            <div class="property-body">
                <h3>${item.title}</h3>
                <div class="meta">
                    <span>${item.city}</span>
                    <span>${item.locality}</span>
                    <span>${item.type}</span>
                </div>
                <div class="meta">${item.meta.map((m) => `<span>${m}</span>`).join("")}</div>
                <div class="price-row">
                    <span class="price">${item.price}</span>
                    <button class="ghost" data-contact="${item.title}">Contact Owner</button>
                </div>
            </div>
        </article>
    `).join("");
}

function gradient(index) {
    const colors = ["none"];
    return colors[index % colors.length];
}

function renderModeView(mode) {
    const view = modeViews[mode];
    if (!view) return;
    if (propertyExperience) propertyExperience.dataset.currentMode = view.key;
    if (searchButton) searchButton.textContent = view.searchLabel;
    if (localityInput) localityInput.placeholder = view.placeholder;
    if (modeFilters) modeFilters.innerHTML = view.filters.map(filter => `<button data-filter="${filter}">${filter}</button>`).join("");
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.remove("hidden");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.add("hidden"), 2400);
}

function openModal(kind) {
    activeModalKind = kind;
    const copy = {
        login: ["Login", "Enter your details to continue."],
        post: ["Post Free Property Ad", "List your property and connect with verified tenants or buyers."],
        plan: ["Assisted Plans", "Get a dedicated property expert and faster matching alerts."],
        contact: ["Contact Owner", "Share your details to unlock owner contact information."]
    };
    const fields = {
        post: `
            <label>Owner Name<input placeholder="Your name"></label>
            <label>Phone<input placeholder="Mobile number"></label>
            <label>Property Type<select><option>Apartment for Rent</option><option>Apartment for Sale</option><option>Premium Apartment</option></select></label>
            <label>City<input placeholder="City"></label>
            <label>Locality<input placeholder="Locality or apartment society"></label>
            <label>Expected Price<input placeholder="Example: Rs. 28,000"></label>
        `,
        plan: `
            <label>Name<input placeholder="Your name"></label>
            <label>Phone<input placeholder="Mobile number"></label>
            <label>Requirement<select><option>Buy Apartment</option><option>Rent Apartment</option><option>Premium Search</option></select></label>
            <label>Preferred City<input placeholder="City"></label>
        `,
        contact: `
            <label>Name<input placeholder="Your name"></label>
            <label>Phone<input placeholder="Mobile number"></label>
            <label>Email<input placeholder="Email address"></label>
        `
    };
    const [title, text] = copy[kind] || copy.login;
    modalTitle.textContent = title;
    modalText.textContent = text;
    modalFields.innerHTML = fields[kind] || fields.contact;
    modal.classList.remove("hidden");
}

function readModalFieldValues() {
    return [...modalFields.querySelectorAll("input, select, textarea")]
        .map(field => field.value?.trim())
        .filter(Boolean);
}

function openDashboardLogin({ platform, role, target }) {
    pendingDashboardLogin = { platform, role, target };
    const [title, help] = dashboardLoginHints[role] || ["Dashboard Login", "Sign in to open this dashboard."];
    if (dashboardLoginTitle) dashboardLoginTitle.textContent = title;
    if (dashboardLoginHelp) dashboardLoginHelp.textContent = help;
    if (dashboardUsername) dashboardUsername.value = "";
    if (dashboardPassword) dashboardPassword.value = "";
    dashboardLoginModal?.classList.remove("hidden");
    window.setTimeout(() => dashboardUsername?.focus(), 80);
}

async function submitDashboardCredentials() {
    if (!pendingDashboardLogin) return;
    try {
        const response = await fetch("/api/auth/dashboard-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                platform: pendingDashboardLogin.platform,
                role: pendingDashboardLogin.role,
                username: dashboardUsername?.value || "",
                password: dashboardPassword?.value || ""
            })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            showToast(data.message || "Invalid username or password");
            return;
        }
        dashboardLoginModal?.classList.add("hidden");
        window.location.href = pendingDashboardLogin.target || data.redirect;
    } catch (error) {
        showToast("Login failed. Please try again.");
    }
}

document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((item) => {
            item.classList.remove("active");
            item.setAttribute("aria-selected", "false");
        });
        tab.classList.add("active");
        tab.setAttribute("aria-selected", "true");
        activeMode = tab.dataset.mode;
        renderModeView(activeMode);
        renderListings(listings.filter((item) => item.type === activeMode));
    });
});

document.getElementById("searchButton").addEventListener("click", () => {
    const city = document.getElementById("city").value.toLowerCase();
    const query = document.getElementById("locality").value.toLowerCase();
    const filtered = listings.filter((item) => {
        const text = `${item.city} ${item.locality} ${item.title} ${item.meta.join(" ")}`.toLowerCase();
        return item.type === activeMode && text.includes(city) && (!query || text.includes(query));
    });
    renderListings(filtered);
    showToast(`${filtered.length} matching properties found`);
    window.setTimeout(() => {
        const params = new URLSearchParams({ city: document.getElementById("city").value, q: document.getElementById("locality").value, mode: activeMode });
        window.location.href = `/propertydirect/apartments?${params.toString()}`;
    }, 500);
});

localityInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") searchButton?.click();
});

document.addEventListener("click", (event) => {
    const dashboardLink = event.target.closest("[data-dashboard-login]");
    if (dashboardLink) {
        event.preventDefault();
        openDashboardLogin({
            platform: dashboardLink.dataset.platform,
            role: dashboardLink.dataset.role,
            target: dashboardLink.dataset.target || dashboardLink.getAttribute("href")
        });
        return;
    }

    const filterButton = event.target.closest("[data-filter]");
    if (filterButton) {
        const filter = filterButton.dataset.filter.toLowerCase();
        const filtered = listings.filter((item) => item.type === activeMode && item.meta.join(" ").toLowerCase().includes(filter));
        document.querySelectorAll("[data-filter]").forEach((button) => button.classList.toggle("active", button === filterButton));
        renderListings(filtered);
        showToast(`${filtered.length} ${filterButton.dataset.filter} homes found`);
        return;
    }

    const protectedLink = event.target.closest("[data-protected='superadmin']");
    if (protectedLink) {
        event.preventDefault();
        openDashboardLogin({ platform: "propertydirect", role: "superadmin", target: "/propertydirect/dashboards/superadmin" });
        return;
    }

    const modalButton = event.target.closest("[data-open-modal]");
    if (modalButton) {
        event.preventDefault();
        openModal(modalButton.dataset.openModal);
        return;
    }

    const contactButton = event.target.closest("[data-contact]");
    if (contactButton) {
        openModal("contact");
        return;
    }

    const saveButton = event.target.closest(".save-property");
    if (saveButton) {
        saveButton.classList.toggle("saved");
        saveButton.textContent = saveButton.classList.contains("saved") ? "♥" : "♡";
        showToast(saveButton.classList.contains("saved") ? "Property saved" : "Property removed from saved list");
    }
});

document.getElementById("closeModal").addEventListener("click", () => modal.classList.add("hidden"));
modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.classList.add("hidden");
});
document.getElementById("modalSubmit").addEventListener("click", () => {
    const values = readModalFieldValues();
    modal.classList.add("hidden");
    const first = values[0] ? ` for ${values[0]}` : "";
    const messages = {
        post: `Property ad submitted${first}`,
        plan: `Assisted plan request submitted${first}`,
        contact: `Owner contact request submitted${first}`,
        login: `Login request submitted${first}`
    };
    showToast(messages[activeModalKind] || `Request submitted${first}`);
});
closeSuperadminModal.addEventListener("click", () => superadminModal.classList.add("hidden"));
superadminModal.addEventListener("click", (event) => {
    if (event.target === superadminModal) superadminModal.classList.add("hidden");
});
submitSuperadminLogin.addEventListener("click", () => {
    superadminModal.classList.add("hidden");
    openDashboardLogin({ platform: "propertydirect", role: "superadmin", target: "/propertydirect/dashboards/superadmin" });
});
closeDashboardLoginModal?.addEventListener("click", () => dashboardLoginModal?.classList.add("hidden"));
dashboardLoginModal?.addEventListener("click", (event) => {
    if (event.target === dashboardLoginModal) dashboardLoginModal.classList.add("hidden");
});
submitDashboardLogin?.addEventListener("click", submitDashboardCredentials);
dashboardPassword?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") submitDashboardCredentials();
});
document.getElementById("resetListings").addEventListener("click", () => renderListings(listings.filter((item) => item.type === activeMode)));
document.getElementById("menuButton").addEventListener("click", () => document.querySelector(".nav").classList.toggle("open"));

const requiredDashboardRole = new URLSearchParams(window.location.search).get("loginRequired");
if (requiredDashboardRole && dashboardTargets[requiredDashboardRole]) {
    openDashboardLogin({
        platform: "propertydirect",
        role: requiredDashboardRole,
        target: dashboardTargets[requiredDashboardRole]
    });
}

renderListings(listings.filter((item) => item.type === activeMode));

setupMotion();

function setupMotion() {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const targets = document.querySelectorAll(".section, .split-section, .owner-banner, .property-card");
    targets.forEach((target) => target.classList.add("reveal"));
    if (reducedMotion || !("IntersectionObserver" in window)) {
        targets.forEach((target) => target.classList.add("is-visible"));
        return;
    }
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12 });
    targets.forEach((target) => observer.observe(target));
}
