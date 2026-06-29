const apartments = [
    {
        title: "2 BHK Apartment in Manifest Heights",
        society: "Manifest Heights",
        locality: "Hebbal",
        city: "Bangalore",
        rent: 28000,
        maintenance: 2400,
        deposit: "₹2,50,000",
        sqft: "1,080 sqft",
        photo: "1/14 Photos",
        furnishing: "Semi Furnished",
        type: "2 BHK",
        tenant: "Family / Bachelor",
        available: "Ready to Move",
        parking: "Bike Parking Car Parking",
        apartmentType: "Gated Society",
        image: "/shared/images/apartment-living-1.webp",
        nearby: ["Kempapura", "Coffee Board Park", "Ramaiah Hospital"]
    },
    {
        title: "2 BHK Apartment in Sri Balaji Serenity",
        society: "Sri Balaji Serenity",
        locality: "Kaikondrahalli",
        city: "Bangalore",
        rent: 42000,
        maintenance: 3000,
        deposit: "₹1,50,000",
        sqft: "1,140 sqft",
        photo: "1/18 Photos",
        furnishing: "Semi Furnished",
        type: "2 BHK",
        tenant: "All",
        available: "15 Days",
        parking: "Bike Parking Car Parking",
        apartmentType: "Gated Society",
        image: "/shared/images/apartment-living-2.webp",
        nearby: ["Sarjapur Road", "HSR Layout", "Manipal Hospital"]
    },
    {
        title: "3 BHK Apartment in Lake View Residency",
        society: "Lake View Residency",
        locality: "Bellandur",
        city: "Bangalore",
        rent: 50000,
        maintenance: 3500,
        deposit: "₹2,50,000",
        sqft: "1,400 sqft",
        photo: "1/9 Photos",
        furnishing: "Semi Furnished",
        type: "3 BHK",
        tenant: "Company",
        available: "30 Days",
        parking: "Car Parking",
        apartmentType: "Gated Society",
        image: "/shared/images/propertydirect-cinematic-1.webp",
        nearby: ["Wells Fargo", "Marathahalli", "Kundalahalli"]
    },
    {
        title: "1 BHK Apartment in Rajaji Nagar",
        society: "Standalone Apartment",
        locality: "Rajaji Nagar",
        city: "Bangalore",
        rent: 25000,
        maintenance: 0,
        deposit: "₹2,00,000",
        sqft: "850 sqft",
        photo: "1/14 Photos",
        furnishing: "Fully Furnished",
        type: "1 BHK",
        tenant: "All",
        available: "Ready to Move",
        parking: "Bike Parking",
        apartmentType: "Standalone Apartment",
        image: "/shared/images/apartment-bedroom-1.webp",
        nearby: ["Metro Station", "Veeresh Cinemas", "Bank"]
    },
    {
        title: "3 BHK Apartment in Greenview Towers",
        society: "Greenview Towers",
        locality: "Kaikondrahalli",
        city: "Bangalore",
        rent: 52500,
        maintenance: 3500,
        deposit: "₹2,00,000",
        sqft: "1,250 sqft",
        photo: "1/10 Photos",
        furnishing: "Unfurnished",
        type: "3 BHK",
        tenant: "Family",
        available: "Ready to Move",
        parking: "Car Parking",
        apartmentType: "Gated Society",
        image: "/shared/images/apartment-living-2.webp",
        nearby: ["Sarjapur Road", "HSR Layout", "Hospital"]
    }
];

const societyData = [
    ["Standalone Apartment", 172],
    ["Prestige City", 85],
    ["Sobha Dream Gardens", 66],
    ["Brigade El Dorado", 44],
    ["Nikoo Homes", 42],
    ["Greenview Towers", 21]
];

const results = document.getElementById("apartmentResults");
const resultCount = document.getElementById("resultCount");
const societyStrip = document.getElementById("societyStrip");
const toast = document.getElementById("toast");
const modal = document.getElementById("appModal");
const defaultCity = document.getElementById("listingCity")?.value || "Bangalore";
const defaultBudget = document.getElementById("budgetRange")?.value || "80000";
let activeFilters = new Map();
let activeModalKind = "contact";
let activePostType = "rent";
let activeApartmentTitle = "Selected apartment";

function money(value) {
    return `₹${value.toLocaleString("en-IN")}`;
}

function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove("hidden");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.add("hidden"), 2200);
}

function renderSocieties() {
    if (!societyStrip) return;
    societyStrip.innerHTML = societyData.map(([name, count]) => `
        <button class="society-chip" data-society="${name}">
            <span class="society-chip-name">${name}</span>
            <span class="society-chip-count">${count}</span>
            <span class="society-chip-label">Apartments</span>
        </button>
    `).join("");
}

function getApartmentValue(apt, group) {
    const values = {
        bhk: apt.type,
        availability: apt.available,
        furnishing: apt.furnishing,
        parking: apt.parking,
        apartmentType: apt.apartmentType
    };
    return String(values[group] || "").toLowerCase();
}

function matchesGroupedFilters(apt) {
    return [...activeFilters.entries()].every(([group, values]) => {
        if (!values.size) return true;
        const apartmentValue = getApartmentValue(apt, group);
        return [...values].some(value => apartmentValue.includes(value.toLowerCase()));
    });
}

function activeFilterCount() {
    return [...activeFilters.values()].reduce((total, values) => total + values.size, 0);
}

function updateFilterState(message = "") {
    document.querySelectorAll("[data-filter]").forEach(button => {
        const group = button.dataset.filterGroup || "general";
        const active = activeFilters.get(group)?.has(button.dataset.filter) || false;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
    });
    renderApartments();
    if (message) showToast(message);
}

function filteredApartments() {
    const query = (document.getElementById("listingSearch")?.value || "").toLowerCase();
    const city = document.getElementById("listingCity")?.value || "";
    const budget = Number(document.getElementById("budgetRange")?.value || 150000);

    return apartments.filter((apt) => {
        const text = `${apt.title} ${apt.society} ${apt.locality} ${apt.city} ${apt.type} ${apt.furnishing} ${apt.available} ${apt.parking} ${apt.apartmentType}`.toLowerCase();
        const filtersOk = matchesGroupedFilters(apt);
        const queryOk = !query || text.includes(query);
        return apt.city === city && apt.rent <= budget && filtersOk && queryOk;
    });
}

function renderApartments(items = filteredApartments()) {
    if (!results) return;
    resultCount.textContent = items.length;
    if (!items.length) {
        results.innerHTML = `
            <article class="apartment-card empty-results">
                <h2>No apartments matched</h2>
                <p>Try removing one filter, increasing the budget, or changing the city/search keyword.</p>
                <button class="primary" type="button" id="emptyResetFilters">Reset Filters</button>
            </article>
        `;
        return;
    }
    results.innerHTML = items.map((apt, index) => `
        <article class="apartment-card">
            <div class="apt-photo">
                <img src="${apt.image}" alt="${apt.title} at ${apt.society}">
                <span>${apt.photo}</span>
            </div>
            <div class="apt-body">
                <div class="apt-title-row">
                    <div>
                        <h2><a href="/propertydirect/apartment-detail">${apt.title} for Rent in ${apt.locality}</a></h2>
                        <p class="apt-address">${apt.society}, ${apt.locality}, ${apt.city}</p>
                    </div>
                    <button class="icon-action" data-action="shortlist">Shortlist</button>
                </div>
                <div class="apt-price-grid">
                    <article><span>Rent</span><strong>${money(apt.rent)}${apt.maintenance ? ` + ${money(apt.maintenance)}` : ""}</strong>${apt.maintenance ? "<small>maintenance</small>" : ""}</article>
                    <article><span>Deposit</span><strong>${apt.deposit}</strong></article>
                    <article><span>Built-up</span><strong>${apt.sqft}</strong></article>
                </div>
                <div class="apt-facts">
                    <article><span>Furnishing</span><strong>${apt.furnishing}</strong></article>
                    <article><span>BHK Type</span><strong>${apt.type}</strong></article>
                    <article><span>Preferred Tenant</span><strong>${apt.tenant}</strong></article>
                    <article><span>Available From</span><strong>${apt.available}</strong></article>
                </div>
                <p class="apt-nearby">Nearby: ${apt.nearby.join(" | ")}</p>
                <div class="apt-actions">
                    <button class="primary" data-action="owner">Get Owner Details</button>
                    <button class="ghost" data-action="visit">Schedule Visit</button>
                    <button class="ghost" data-action="photos">Request Photos</button>
                    <button class="ghost" data-action="report">Report</button>
                </div>
            </div>
        </article>
    `).join("");
}

function gradient(index) {
    return "none";
}

function contactFields() {
    return `
        <label>Name<input data-modal-field="name" placeholder="Your name"></label>
        <label>Phone<input data-modal-field="phone" placeholder="Mobile number"></label>
        <label>Email<input data-modal-field="email" placeholder="Email address"></label>
    `;
}

function actionFields(kind) {
    if (kind === "post") return postFields(activePostType);
    if (kind === "visit") {
        return `
            <label>Name<input data-modal-field="name" placeholder="Your name"></label>
            <label>Phone<input data-modal-field="phone" placeholder="Mobile number"></label>
            <label>Preferred Date<input data-modal-field="date" placeholder="Example: Saturday"></label>
            <label>Preferred Time<input data-modal-field="time" placeholder="Example: 5 PM"></label>
        `;
    }
    if (kind === "photos") {
        return `
            <label>Name<input data-modal-field="name" placeholder="Your name"></label>
            <label>Phone<input data-modal-field="phone" placeholder="Mobile number"></label>
            <label>Photo Request<input data-modal-field="request" placeholder="Bedroom, balcony, parking..."></label>
        `;
    }
    if (kind === "report") {
        return `
            <label>Your Name<input data-modal-field="name" placeholder="Your name"></label>
            <label>Phone<input data-modal-field="phone" placeholder="Mobile number"></label>
            <label>Email<input data-modal-field="email" type="email" placeholder="Email address"></label>
            <label>Issue Type<select data-modal-field="issue"><option>Wrong price</option><option>Unavailable apartment</option><option>Incorrect photos</option><option>Duplicate listing</option></select></label>
            <label>Details<input data-modal-field="details" placeholder="Explain the issue"></label>
        `;
    }
    return contactFields();
}

function postFields(type = activePostType) {
    const typeLabel = {
        rent: "Apartment for Rent",
        sale: "Apartment for Sale",
        premium: "Premium Apartment"
    }[type] || "Apartment";
    return `
        <div class="post-type-tabs" role="tablist" aria-label="Property type">
            <button type="button" class="${type === "rent" ? "active" : ""}" data-post-type="rent" aria-pressed="${type === "rent"}"><span aria-hidden="true">🏠</span> Rent</button>
            <button type="button" class="${type === "sale" ? "active" : ""}" data-post-type="sale" aria-pressed="${type === "sale"}"><span aria-hidden="true">🏷️</span> Sale</button>
            <button type="button" class="${type === "premium" ? "active" : ""}" data-post-type="premium" aria-pressed="${type === "premium"}"><span aria-hidden="true">✨</span> Premium</button>
        </div>
        <div class="form-grid">
            <label>Owner Name<input data-modal-field="owner" placeholder="Owner name"></label>
            <label>Phone<input data-modal-field="phone" placeholder="Mobile number"></label>
            <label>Property Type<input data-modal-field="propertyType" value="${typeLabel}"></label>
            <label>City<input data-modal-field="city" value="${document.getElementById("listingCity")?.value || defaultCity}"></label>
            <label>Locality<input data-modal-field="locality" placeholder="Locality"></label>
            <label>Apartment / Society<input data-modal-field="society" placeholder="Society name"></label>
            <label>BHK<select data-modal-field="bhk"><option>1 BHK</option><option selected>2 BHK</option><option>3 BHK</option><option>4 BHK</option></select></label>
            <label>${type === "sale" ? "Expected Price" : "Monthly Rent"}<input data-modal-field="price" placeholder="${type === "sale" ? "₹72 L" : "₹28,000"}"></label>
            <label>Furnishing<select data-modal-field="furnishing"><option>Semi Furnished</option><option>Fully Furnished</option><option>Unfurnished</option></select></label>
            <label>Availability<select data-modal-field="available"><option>Ready to Move</option><option>15 Days</option><option>30 Days</option></select></label>
        </div>
    `;
}

function setModalFields(kind) {
    const fields = document.getElementById("modalFields");
    if (!fields) return;
    fields.innerHTML = actionFields(kind);
}

function openModal(title, text, kind = "contact", source = null) {
    if (!modal) {
        showToast(text);
        return;
    }
    activeModalKind = kind;
    activeApartmentTitle = source?.closest?.(".apartment-card")?.querySelector("h2")?.textContent.trim() || "Selected apartment";
    modal.dataset.modalKind = kind;
    const modalTitle = document.getElementById("modalTitle");
    modalTitle.innerHTML = kind === "post"
        ? `<span class="posting-title-icon" aria-hidden="true">＋</span><span>${title}</span>`
        : title;
    document.getElementById("modalText").textContent = text;
    setModalFields(kind);
    const submit = document.getElementById("modalSubmit");
    if (submit) submit.innerHTML = kind === "post" ? `<span aria-hidden="true">＋</span> Post Apartment` : "Submit";
    modal.classList.remove("hidden");
    modal.querySelector("[data-modal-field]")?.focus();
}

function actionMessage(action) {
    const map = {
        contact: ["Contact Verified Owner", "Share your details to unlock verified owner contact."],
        owner: ["Get Owner Details", "Share your details to unlock verified owner contact."],
        visit: ["Schedule Visit", "Choose a preferred visit time for this apartment."],
        photos: ["Request Photos", "We will notify the owner to upload more apartment photos."],
        report: ["Report Apartment", "Tell us what is incorrect in this apartment listing."],
        shortlist: ["Shortlisted", "Apartment added to your shortlist."],
        post: ["Post Apartment", "Choose Rent, Sale or Premium and add clear apartment details."]
    };
    return map[action] || ["Apartment Action", "Action completed."];
}

function resetApartmentSearch() {
    activeFilters = new Map();
    document.querySelectorAll(".filters button.active, [data-view-mode].active").forEach(btn => btn.classList.remove("active"));
    document.querySelector('[data-view-mode="list"]')?.classList.add("active");
    const city = document.getElementById("listingCity");
    const search = document.getElementById("listingSearch");
    const budget = document.getElementById("budgetRange");
    if (city) city.value = defaultCity;
    if (search) search.value = "";
    if (budget) {
        budget.value = defaultBudget;
        document.getElementById("budgetValue").textContent = money(Number(defaultBudget));
    }
    document.getElementById("apartmentResults")?.classList.remove("hidden");
    document.getElementById("mapView")?.classList.add("hidden");
    updateFilterState("Filters reset");
}

function submitPostedApartment() {
    const fields = document.getElementById("modalFields");
    const read = (name) => fields?.querySelector(`[data-modal-field="${name}"]`)?.value.trim() || "";
    const bhk = read("bhk") || "2 BHK";
    const locality = read("locality") || "New Locality";
    const society = read("society") || "Owner Listed Apartment";
    const city = read("city") || defaultCity;
    const rawPrice = read("price").replace(/[^\d]/g, "");
    const rent = activePostType === "sale" ? 75000 : Number(rawPrice || 28000);
    apartments.unshift({
        title: `${bhk} ${activePostType === "premium" ? "Premium Apartment" : "Apartment"} in ${locality}`,
        society,
        locality,
        city,
        rent,
        maintenance: 0,
        deposit: activePostType === "sale" ? "For Sale" : "₹1,00,000",
        sqft: "1,100 sqft",
        photo: "New Listing",
        furnishing: read("furnishing") || "Semi Furnished",
        type: bhk,
        tenant: "All",
        available: read("available") || "Ready to Move",
        parking: "Bike Parking Car Parking",
        apartmentType: activePostType === "premium" ? "Gated Society" : "Standalone Apartment",
        image: activePostType === "premium" ? "/shared/images/propertydirect-cinematic-2.webp" : "/shared/images/apartment-living-1.webp",
        nearby: ["Owner listed", "Direct contact", "No brokerage"]
    });
    const citySelect = document.getElementById("listingCity");
    if (citySelect) citySelect.value = city;
    modal.classList.add("hidden");
    activeFilters = new Map();
    document.querySelectorAll(".filters button.active").forEach(btn => btn.classList.remove("active"));
    const search = document.getElementById("listingSearch");
    if (search) search.value = "";
    const budget = document.getElementById("budgetRange");
    if (budget && Number(budget.value) < rent) {
        budget.value = String(rent);
        document.getElementById("budgetValue").textContent = money(rent);
    }
    document.getElementById("apartmentResults")?.classList.remove("hidden");
    document.getElementById("mapView")?.classList.add("hidden");
    updateFilterState();
    showToast("Apartment posted and added to listings");
}

document.addEventListener("click", (event) => {
    const modalTrigger = event.target.closest("[data-open-modal]");
    if (modalTrigger) {
        event.preventDefault();
        const [title, text] = actionMessage(modalTrigger.dataset.openModal);
        openModal(title, text, modalTrigger.dataset.openModal);
        return;
    }

    const postType = event.target.closest("[data-post-type]");
    if (postType) {
        event.preventDefault();
        activePostType = postType.dataset.postType;
        setModalFields("post");
        modal.querySelectorAll("[data-post-type]").forEach(button => {
            const active = button.dataset.postType === activePostType;
            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", String(active));
        });
        return;
    }

    const filter = event.target.closest("[data-filter]");
    if (filter) {
        event.preventDefault();
        const group = filter.dataset.filterGroup || "general";
        const value = filter.dataset.filter;
        const values = activeFilters.get(group) || new Set();
        if (values.has(value)) values.delete(value);
        else values.add(value);
        if (values.size) activeFilters.set(group, values);
        else activeFilters.delete(group);
        updateFilterState(`${activeFilterCount()} filter${activeFilterCount() === 1 ? "" : "s"} applied`);
        return;
    }

    const society = event.target.closest("[data-society]");
    if (society) {
        document.getElementById("listingSearch").value = society.dataset.society;
        renderApartments();
        showToast(`Showing ${society.dataset.society}`);
    }

    const action = event.target.closest("[data-action]")?.dataset.action || event.target.closest("[data-detail-action]")?.dataset.detailAction;
    if (action) {
        const [title, text] = actionMessage(action);
        if (action === "shortlist") {
            event.target.closest("button")?.classList.toggle("active");
            showToast(text);
        }
        else openModal(title, text, action === "post" ? "post" : action, event.target);
    }

    const view = event.target.closest("[data-view-mode]");
    if (view) {
        document.querySelectorAll("[data-view-mode]").forEach(btn => btn.classList.remove("active"));
        view.classList.add("active");
        document.getElementById("apartmentResults")?.classList.toggle("hidden", view.dataset.viewMode === "map");
        document.getElementById("mapView")?.classList.toggle("hidden", view.dataset.viewMode !== "map");
    }

    const emptyReset = event.target.closest("#emptyResetFilters");
    if (emptyReset) {
        resetApartmentSearch();
    }
});

document.getElementById("listingSearchButton")?.addEventListener("click", () => {
    renderApartments();
    showToast("Apartment search updated");
});

document.getElementById("listingCity")?.addEventListener("change", () => {
    renderApartments();
    showToast(`Showing ${document.getElementById("listingCity")?.value || "selected city"} apartments`);
});

document.getElementById("listingSearch")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") document.getElementById("listingSearchButton")?.click();
});

document.getElementById("clearFilters")?.addEventListener("click", () => {
    resetApartmentSearch();
});

document.getElementById("budgetRange")?.addEventListener("input", (event) => {
    document.getElementById("budgetValue").textContent = money(Number(event.target.value));
    renderApartments();
});

document.getElementById("closeModal")?.addEventListener("click", () => modal.classList.add("hidden"));
document.getElementById("modalSubmit")?.addEventListener("click", () => {
    if (activeModalKind === "post") {
        submitPostedApartment();
        return;
    }
    const fields = document.getElementById("modalFields");
    const read = (name) => fields?.querySelector(`[data-modal-field="${name}"]`)?.value.trim() || "";
    const first = read("name");
    if (activeModalKind === "report") {
        submitApartmentReport({
            name: read("name"),
            phone: read("phone"),
            email: read("email"),
            apartment: activeApartmentTitle,
            issueType: read("issue"),
            details: read("details")
        });
        return;
    }
    modal.classList.add("hidden");
    const messages = {
        owner: "Owner details request submitted",
        contact: "Owner details request submitted",
        visit: "Visit request scheduled",
        photos: "Photo request sent to owner",
        report: "Listing report submitted"
    };
    showToast(`${messages[activeModalKind] || "Submitted successfully"}${first ? ` for ${first}` : ""}`);
});

async function submitApartmentReport(payload) {
    if (!payload.name || !payload.phone || !payload.email) {
        showToast("Please enter name, phone and email");
        return;
    }
    try {
        const response = await fetch("/api/mail/report-apartment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => ({}));
        modal.classList.add("hidden");
        showToast(data.message || `Report email sent to ${payload.email}`);
    } catch (error) {
        showToast("Unable to send report email. Please try again.");
    }
}

function applyUrlSearch() {
    const params = new URLSearchParams(window.location.search);
    const city = params.get("city");
    const query = params.get("q");
    if (city && document.getElementById("listingCity")) document.getElementById("listingCity").value = city;
    if (query && document.getElementById("listingSearch")) document.getElementById("listingSearch").value = query;
}

applyUrlSearch();
renderSocieties();
updateFilterState();
