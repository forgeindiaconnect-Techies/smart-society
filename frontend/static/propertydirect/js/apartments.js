const apartments = [];

const publishedListingsStorageKey = "propertydirect-published-listings:v1";
const cityOptionsStorageKey = "propertydirect-city-options:v1";
const ownerContactRequestsStorageKey = "propertydirect-owner-contact-requests:v1";
const defaultCityOptions = ["All Cities", "Bengaluru", "Bangalore", "Chennai", "Mumbai", "Pune", "Hyderabad", "Delhi NCR"];

const societyData = [];

const results = document.getElementById("apartmentResults");
const resultCount = document.getElementById("resultCount");
const societyStrip = document.getElementById("societyStrip");
const toast = document.getElementById("toast");
const modal = document.getElementById("appModal");
const defaultCity = "";
const defaultBudget = document.getElementById("budgetRange")?.value || "250000";
const defaultMinBudget = document.getElementById("minBudgetRange")?.value || "0";
let activeFilters = new Map();
let activeModalKind = "contact";
let activePostType = "rent";
let activeApartmentTitle = "Selected apartment";
let activeApartmentDetails = null;
let activeSearchMode = "";
let approvedDiscoveryLoaded = false;
let approvedDiscoveryListings = [];

function titleCasePlace(value) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, " ")
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

function readPublishedListings() {
    let items = [];
    try {
        items = JSON.parse(localStorage.getItem(publishedListingsStorageKey) || "[]");
    } catch {
        localStorage.removeItem(publishedListingsStorageKey);
        items = [];
    }

    const keys = ["pd_inventory_state", "propertydirect_inventory_states"];
    keys.forEach(k => {
        try {
            const stored = localStorage.getItem(k);
            if (stored) {
                const parsed = JSON.parse(stored);
                for (const key in parsed) {
                    const entry = parsed[key];
                    if (entry && !entry.deleted && !entry.hidden && !entry.rejected && !entry.sold) {
                        const existingIdx = items.findIndex(i => String(i.id).toLowerCase() === String(key).toLowerCase() || String(i.title).toLowerCase() === String(entry.title).toLowerCase());
                        const formatted = {
                            id: key,
                            title: entry.title || "Luxury Property",
                            price: entry.price || "₹1.45 Cr",
                            locality: entry.address || "Anna Nagar, Chennai",
                            city: "Chennai",
                            image: entry.image || "/propertydirect/assets/images/property-1.jpg",
                            video: entry.video || "https://www.w3schools.com/html/mov_bbb.mp4",
                            type: entry.tier || "Featured",
                            rent: Number(String(entry.price || "").replace(/[^\d]/g, "")) || 14500000
                        };
                        if (existingIdx >= 0) {
                            items[existingIdx] = Object.assign({}, items[existingIdx], formatted);
                        } else {
                            items.unshift(formatted);
                        }
                    }
                }
            }
        } catch(e) {}
    });

    return items;
}

function isSameCity(aptCity, filterCity) {
    if (!filterCity) return true;
    const f = String(filterCity).trim().toLowerCase();
    if (!f || f === "all" || f === "all cities") return true;
    const a = String(aptCity || "").trim().toLowerCase();
    if (!a) return false;
    if (a === f) return true;

    const isBlr = (s) => s.includes("bangalore") || s.includes("bengaluru");
    if (isBlr(a) && isBlr(f)) return true;

    const isChn = (s) => s.includes("chennai") || s.includes("madras");
    if (isChn(a) && isChn(f)) return true;

    const isMum = (s) => s.includes("mumbai") || s.includes("bombay");
    if (isMum(a) && isMum(f)) return true;

    return a.includes(f) || f.includes(a);
}

function isModeButtonActive(btnVal, selectedMode) {
    if (!selectedMode || !btnVal) return false;
    const b = String(btnVal).trim().toLowerCase();
    const s = String(selectedMode).trim().toLowerCase();
    if (b === s) return true;
    if ((b === "buy" || b === "sale") && (s === "buy" || s === "sale")) return true;
    return false;
}

function isSameMode(aptMode, filterMode) {
    if (!filterMode) return true;
    const f = String(filterMode).trim().toLowerCase();
    if (!f || f === "all" || f === "all listings") return true;
    const a = String(aptMode || "").trim().toLowerCase();
    if (!a) return true;

    if (f === "rent") return a.includes("rent") && !a.includes("lease");
    if (f === "lease") return a.includes("lease");

    const isBuy = (m) => m.includes("buy") || m.includes("sale") || m.includes("sell");
    if (isBuy(f)) return isBuy(a);

    return a.includes(f) || f.includes(a);
}

function readCityOptions() {
    try {
        const saved = JSON.parse(localStorage.getItem(cityOptionsStorageKey) || "[]");
        const inventoryCities = (approvedDiscoveryListings || []).map(item => item.city).filter(Boolean);
        const postedCities = readPublishedListings().map(item => item.city).filter(Boolean);
        const raw = ["All Cities", ...defaultCityOptions, ...inventoryCities, ...saved, ...postedCities];
        return [...new Set(raw.map(titleCasePlace).filter(Boolean))];
    } catch {
        localStorage.removeItem(cityOptionsStorageKey);
        return defaultCityOptions;
    }
}

function saveCityOption(city) {
    const normalized = titleCasePlace(city);
    if (!normalized || normalized.toLowerCase() === "all cities") return;
    const cities = readCityOptions();
    if (!cities.includes(normalized)) {
        localStorage.setItem(cityOptionsStorageKey, JSON.stringify([...cities, normalized]));
    }
    hydrateCityDropdowns(normalized);
}

function hydrateCityDropdowns(selectedCity = "") {
    document.querySelectorAll("#listingCity, #city").forEach(select => {
        const current = selectedCity !== "" ? selectedCity : (select.value || "");
        const cities = readCityOptions();
        select.innerHTML = cities.map(city => {
            const isAll = city.toLowerCase() === "all cities";
            const val = isAll ? "" : city;
            const label = (city.toLowerCase() === "bangalore" || city.toLowerCase() === "bengaluru") ? "Bangalore / Bengaluru" : city;
            return `<option value="${val}">${label}</option>`;
        }).join("");
        if (current && ![...select.options].some(option => option.value.toLowerCase() === current.toLowerCase())) {
            select.insertAdjacentHTML("beforeend", `<option value="${current}">${current}</option>`);
        }
        if (current) {
            select.value = (current.toLowerCase() === "all cities") ? "" : current;
        } else {
            select.value = "";
        }
    });
}

function publishedApartments() {
    return approvedDiscoveryListings.map((item) => ({
        id: item.id,
        apartmentCode: item.apartmentCode || (item.id ? `PD-${item.id}` : ""),
        listingId: item.listingId || item.id,
        isPublished: true,
        listingMode: item.listingMode || item.listingType || item.type || "Rent",
        title: escapeApartmentText(item.title || `Property in ${item.locality || item.city || "your city"}`),
        society: escapeApartmentText(item.society || item.locality || "Owner Listed Apartment"),
        locality: escapeApartmentText(item.locality || "Owner Listed"),
        city: escapeApartmentText(item.city || "Not specified"),
        rent: Number(item.rent ?? item.price ?? 0),
        price: Number(item.price ?? item.rent ?? 0),
        maintenance: Number(item.maintenance || 0),
        deposit: item.deposit == null ? "Not specified" : money(Number(item.deposit)),
        sqft: item.sqft || (item.areaSqft ? `${Number(item.areaSqft).toLocaleString("en-IN")} sqft` : "Area not specified"),
        photo: "Owner posted",
        furnishing: escapeApartmentText(item.furnishing || "Not specified"),
        type: escapeApartmentText(item.bhk || (item.bedrooms ? `${item.bedrooms} BHK` : "2 BHK")),
        bhk: escapeApartmentText(item.bhk || (item.bedrooms ? `${item.bedrooms} BHK` : "2 BHK")),
        tenant: "All",
        available: escapeApartmentText(item.available || "Ready to Move"),
        constructionStatus: escapeApartmentText(item.constructionStatus || "Ready to Move"),
        parking: escapeApartmentText(item.parking || "Not specified"),
        apartmentType: escapeApartmentText(item.propertyType || item.apartmentType || "Apartment"),
        propertyType: escapeApartmentText(item.propertyType || item.apartmentType || "Apartment"),
        image: safeApartmentImage(item.image || item.imageUrl),
        video: item.video || item.videoUrl || "",
        imageUrls: Array.isArray(item.imageUrls) ? item.imageUrls : [],
        bathrooms: item.bathrooms,
        address: item.address,
        pincode: item.pincode,
        description: item.description,
        amenities: item.amenities || "",
        nearby: [escapeApartmentText(item.amenities || "Amenities not specified"), "Direct contact"]
    }));
}

function escapeApartmentText(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[ch]);}
function safeApartmentImage(value){const url=String(value||"");return /^(\/|https:\/\/)/i.test(url)?escapeApartmentText(url):"/shared/images/apartment-living-1.webp";}

function allApartments() {
    return publishedApartments();
}

function readOwnerContactRequests() {
    try {
        return JSON.parse(localStorage.getItem(ownerContactRequestsStorageKey) || "[]");
    } catch {
        localStorage.removeItem(ownerContactRequestsStorageKey);
        return [];
    }
}

function saveOwnerContactRequest(request) {
    const existing = readOwnerContactRequests();
    localStorage.setItem(ownerContactRequestsStorageKey, JSON.stringify([request, ...existing].slice(0, 120)));
}

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
        bhk: apt.bhk || apt.type,
        mode: apt.listingMode || apt.type,
        propertyType: apt.apartmentType || apt.propertyType,
        apartmentType: apt.apartmentType || apt.propertyType,
        availability: apt.available,
        furnishing: apt.furnishing,
        parking: apt.parking,
        bathrooms: apt.bathrooms,
        amenities: apt.amenities || apt.nearby?.join(" ")
    };
    return String(values[group] || "").toLowerCase();
}

function matchesGroupedFilters(apt) {
    return [...activeFilters.entries()].every(([group, values]) => {
        if (!values.size) return true;

        if (group === "mode") {
            return [...values].some(val => isSameMode(apt.listingMode || apt.type, val));
        }

        if (group === "propertyType") {
            const aptType = String(apt.apartmentType || apt.propertyType || "").toLowerCase();
            return [...values].some(val => {
                const target = String(val).toLowerCase();
                return aptType.includes(target) || target.includes(aptType);
            });
        }

        if (group === "bhk") {
            const aptTypeNum = String(apt.bhk || apt.type || "").replace(/\D/g, "");
            return [...values].some(val => {
                const filterNum = String(val).replace(/\D/g, "");
                if (String(val).includes("+") && filterNum && aptTypeNum) return Number(aptTypeNum) >= Number(filterNum);
                return filterNum && aptTypeNum ? filterNum === aptTypeNum : String(apt.type || "").toLowerCase().includes(String(val).toLowerCase());
            });
        }

        if (group === "bathrooms") {
            const aptBaths = Number(apt.bathrooms || 0);
            return [...values].some(val => {
                const target = String(val).replace(/\D/g, "");
                if (String(val).includes("+") && target) return aptBaths >= Number(target);
                return target ? aptBaths === Number(target) : true;
            });
        }

        if (group === "availability") {
            const aptAvail = String(apt.available || apt.constructionStatus || "").toLowerCase();
            return [...values].some(val => {
                const target = String(val).toLowerCase();
                if (target.includes("ready") || target.includes("immediate")) return aptAvail.includes("ready") || aptAvail.includes("immediate");
                if (target.includes("under") || target.includes("construction")) return aptAvail.includes("under") || aptAvail.includes("construction");
                return aptAvail.includes(target);
            });
        }

        if (group === "furnishing") {
            const aptFurn = String(apt.furnishing || "").toLowerCase();
            return [...values].some(val => {
                const target = String(val).toLowerCase();
                if (target.includes("full")) return aptFurn.includes("full");
                if (target.includes("semi")) return aptFurn.includes("semi");
                if (target.includes("unfurnished") || target.includes("none")) return aptFurn.includes("unfurnished") || aptFurn.includes("none");
                return aptFurn.includes(target);
            });
        }

        if (group === "amenities") {
            const aptAmenities = `${apt.amenities || ""} ${apt.parking || ""} ${apt.nearby?.join(" ") || ""}`.toLowerCase();
            return [...values].some(val => {
                const target = String(val).toLowerCase();
                if (target.includes("security")) return aptAmenities.includes("security") || aptAmenities.includes("gated");
                if (target.includes("pool")) return aptAmenities.includes("pool") || aptAmenities.includes("swimming");
                return aptAmenities.includes(target);
            });
        }

        if (group === "parking") {
            const aptPark = String(apt.parking || "").toLowerCase();
            return [...values].some(val => {
                const target = String(val).toLowerCase();
                if (target.includes("bike") || target.includes("2")) return aptPark.includes("bike") || aptPark.includes("2");
                if (target.includes("car") || target.includes("4")) return aptPark.includes("car") || aptPark.includes("4");
                return aptPark.includes(target);
            });
        }

        const apartmentValue = getApartmentValue(apt, group);
        return [...values].some(value => apartmentValue.includes(String(value).toLowerCase()));
    });
}

function activeFilterCount() {
    return [...activeFilters.values()].reduce((total, values) => total + values.size, 0);
}

function updateFilterState(message = "") {
    document.querySelectorAll("[data-filter]").forEach(button => {
        const group = button.dataset.filterGroup || "general";
        if (group === "mode") {
            const bVal = (button.dataset.filter || "").toLowerCase();
            const active = isModeButtonActive(bVal, activeSearchMode);
            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", String(active));
            return;
        }
        const active = activeFilters.get(group)?.has(button.dataset.filter) || false;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
    });
    renderApartments();
    if (message) showToast(message);
}

function filteredApartments() {
    const searchInput = document.getElementById("listingSearch");
    const query = (searchInput?.value || "").toLowerCase().trim();
    const citySelect = document.getElementById("listingCity");
    const city = (citySelect?.value || "").toLowerCase().trim();
    const budgetEl = document.getElementById("budgetRange");
    const minBudgetEl = document.getElementById("minBudgetRange");
    const budget = Number(budgetEl?.value || 250000);
    const maxBudgetRange = Number(budgetEl?.max || 250000);
    const minBudget = Number(minBudgetEl?.value || 0);
    const mode = (activeSearchMode || "").toLowerCase().trim();

    const cleanQuery = query.replace(/^(listing\s*id[:#\s]*|id[:#\s]*|#)/i, "").trim().toLowerCase();
    const queryNumOnly = query.replace(/[^\d]/g, "");

    return allApartments().filter((apt) => {
        const aptIdStr = String(apt.id || "").toLowerCase();
        const aptCodeStr = String(apt.apartmentCode || "").toLowerCase();

        // Exact Listing ID check
        const isExactIdMatch = cleanQuery && (
            aptIdStr === cleanQuery ||
            aptCodeStr === cleanQuery ||
            `pd-${aptIdStr}` === cleanQuery ||
            `pdt-${aptIdStr}` === cleanQuery ||
            (queryNumOnly && aptIdStr === queryNumOnly)
        );

        // If user typed exact Listing ID (e.g. 579, #579, PDT-0579), match immediately!
        if (isExactIdMatch) return true;

        const isPartialIdMatch = query && (
            aptIdStr.includes(cleanQuery) ||
            aptCodeStr.includes(cleanQuery) ||
            `#${aptIdStr}`.includes(query) ||
            `id: #${aptIdStr}`.includes(query) ||
            `listing id: #${aptIdStr}`.includes(query)
        );

        const text = `${apt.id} #${apt.id} pd-${apt.id} pdt-${apt.id} ${apt.apartmentCode || ""} ${apt.title} ${apt.society} ${apt.locality} ${apt.city} ${apt.bhk || apt.type} ${apt.listingMode || ""} ${apt.furnishing} ${apt.available} ${apt.parking} ${apt.apartmentType || apt.propertyType} ${apt.amenities || ""} ${apt.nearby?.join(" ") || ""}`.toLowerCase();
        const filtersOk = matchesGroupedFilters(apt);
        const queryOk = !query || text.includes(query) || isPartialIdMatch;
        const cityOk = isSameCity(apt.city, city) || isSameCity(apt.locality, city);
        const modeOk = isSameMode(apt.listingMode || apt.type, mode);

        let budgetOk = true;
        const aptPrice = Number(apt.rent ?? apt.price ?? 0);
        const isAptSale = isSameMode(apt.listingMode || apt.type, "buy");
        const isSearchRent = mode === "rent" || mode === "lease";
        const isSearchBuy = mode === "buy" || mode === "sale";

        if (isSearchRent) {
            budgetOk = aptPrice >= minBudget && (budget >= maxBudgetRange || aptPrice <= budget);
        } else if (isSearchBuy) {
            if (minBudget > 0) budgetOk = aptPrice >= minBudget;
            if (budget < maxBudgetRange && budget > 500000) budgetOk = budgetOk && aptPrice <= budget;
        } else {
            if (isAptSale) {
                budgetOk = minBudget > 0 ? aptPrice >= minBudget : true;
            } else {
                budgetOk = aptPrice >= minBudget && (budget >= maxBudgetRange || aptPrice <= budget);
            }
        }

        return cityOk && modeOk && budgetOk && filtersOk && queryOk;
    });
}

function matchingCityModeApartments() {
    return filteredApartments();
}


function getSavedListings() {
    try {
        return JSON.parse(localStorage.getItem("propertydirect-saved-listings") || "[]");
    } catch (e) {
        return [];
    }
}

function isListingSaved(id, title) {
    const saved = getSavedListings();
    const strId = String(id || "").trim();
    const cleanTitle = String(title || "").trim().toLowerCase();
    return saved.some(item => {
        if (strId && item.id && String(item.id).trim() === strId) return true;
        if (cleanTitle && item.title && String(item.title).trim().toLowerCase() === cleanTitle) return true;
        return false;
    });
}

function updateCardSaveButtons(listingId, cardTitle, isSaved) {
    const strId = String(listingId || "").trim();
    const cleanTitle = String(cardTitle || "").trim().toLowerCase();

    document.querySelectorAll('[data-action="shortlist"]').forEach(btn => {
        const parentCard = btn.closest(".apartment-card");
        const btnId = String(btn.dataset.listingId || parentCard?.dataset?.listingId || "").trim();
        const btnTitle = String(parentCard?.dataset?.apartmentTitle || parentCard?.querySelector("h2")?.textContent || "").trim().toLowerCase();

        const matchesId = strId && btnId && btnId === strId;
        const matchesTitle = cleanTitle && btnTitle && btnTitle === cleanTitle;

        if (matchesId || matchesTitle) {
            btn.classList.toggle("active", isSaved);
            btn.classList.toggle("saved", isSaved);
            btn.title = isSaved ? "Saved to favourites (Click to remove)" : "Save to favourites";

            if (btn.classList.contains("icon-action")) {
                const span = btn.querySelector("span");
                if (span) span.textContent = isSaved ? "Saved" : "Save";
                const svg = btn.querySelector("svg");
                if (svg) svg.setAttribute("fill", isSaved ? "currentColor" : "none");
            } else {
                const heart = btn.querySelector(".heart-icon");
                const text = btn.querySelector(".btn-text");
                if (heart && text) {
                    heart.textContent = isSaved ? "❤️" : "♡";
                    text.textContent = isSaved ? "Saved" : "Save";
                } else {
                    btn.innerHTML = `<span class="heart-icon">${isSaved ? '❤️' : '♡'}</span> <span class="btn-text">${isSaved ? 'Saved' : 'Save'}</span>`;
                }
            }
        }
    });
}

function syncAllToolbarBadges() {
    const saved = getSavedListings();
    const savedCount = saved.length;
    const savedBadge = document.getElementById("savedSearchesCountBadge");
    if (savedBadge) savedBadge.textContent = savedCount;
    document.querySelectorAll(".saved-searches-count, .saved-properties-count").forEach(b => {
        b.textContent = savedCount;
        b.style.display = savedCount > 0 ? "inline-flex" : "none";
    });
    const navSaved = document.getElementById("navSavedSearchesCount");
    if (navSaved) {
        navSaved.textContent = savedCount;
        navSaved.style.display = savedCount > 0 ? "inline-flex" : "none";
    }

    let compCount = 0;
    try { compCount = JSON.parse(localStorage.getItem("pd_compare_properties:v1") || "[]").length; } catch(e){}
    const compBadge = document.getElementById("compareCountBadge");
    if (compBadge) compBadge.textContent = compCount;

    let recentCount = 0;
    try { recentCount = JSON.parse(localStorage.getItem("pd_recently_viewed:v1") || "[]").length; } catch(e){}
    const recentBadge = document.getElementById("recentlyViewedCountBadge");
    if (recentBadge) recentBadge.textContent = recentCount;
}

window.activeToolbarMode = "all";
window.setToolbarViewMode = function(mode) {
    window.activeToolbarMode = mode || "all";
    document.querySelectorAll("#apartmentsFeaturesToolbar .feature-bar-btn").forEach(btn => {
        const btnFilter = btn.dataset.viewFilter;
        btn.classList.toggle("active", btnFilter === window.activeToolbarMode);
    });
    syncAllToolbarBadges();
    renderApartments();
    if (mode === "all") {
        const searchInput = document.getElementById("listingSearch");
        if (searchInput) searchInput.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
};

function getApartmentsForCurrentView() {
    if (window.activeToolbarMode === "saved") {
        const saved = getSavedListings();
        const savedIds = new Set(saved.map(s => String(s.id || "")));
        const savedTitles = new Set(saved.map(s => String(s.title || "").trim().toLowerCase()));

        const matched = allApartments().filter(apt => 
            (apt.id && savedIds.has(String(apt.id))) || 
            savedTitles.has(String(apt.title || "").trim().toLowerCase())
        );

        const existingIds = new Set(matched.map(a => String(a.id || "")));
        const existingTitles = new Set(matched.map(a => String(a.title || "").trim().toLowerCase()));

        saved.forEach(s => {
            if ((!s.id || !existingIds.has(String(s.id))) && !existingTitles.has(String(s.title || "").trim().toLowerCase())) {
                matched.push({
                    id: s.id || `saved-${Date.now()}`,
                    title: s.title,
                    society: s.society || s.locality || "Owner Listed Apartment",
                    locality: s.locality || "Owner Listed",
                    city: s.city || "Bangalore",
                    rent: Number(String(s.rent || 0).replace(/[^\d]/g, "")),
                    deposit: s.deposit || "Rs. 1,00,000",
                    sqft: s.sqft || "1,200 sqft",
                    type: s.bhk || "2 BHK",
                    bhk: s.bhk || "2 BHK",
                    furnishing: s.furnishing || "Semi-Furnished",
                    available: s.available || "Ready to Move",
                    apartmentType: "Apartment",
                    image: s.image || "/propertydirect/images/orchid_enclave.jpg"
                });
            }
        });
        return matched;
    }

    if (window.activeToolbarMode === "compare") {
        let compare = [];
        try { compare = JSON.parse(localStorage.getItem("pd_compare_properties:v1") || "[]"); } catch(e){}
        const compareIds = new Set(compare.map(c => String(c.id || "")));
        const compareTitles = new Set(compare.map(c => String(c.title || "").trim().toLowerCase()));

        const matched = allApartments().filter(apt => 
            (apt.id && compareIds.has(String(apt.id))) || 
            compareTitles.has(String(apt.title || "").trim().toLowerCase())
        );

        const existingIds = new Set(matched.map(a => String(a.id || "")));
        compare.forEach(c => {
            if (!c.id || !existingIds.has(String(c.id))) {
                matched.push(c);
            }
        });
        return matched;
    }

    if (window.activeToolbarMode === "recent") {
        let recent = [];
        try { recent = JSON.parse(localStorage.getItem("pd_recently_viewed:v1") || "[]"); } catch(e){}
        const recentIds = new Set(recent.map(r => String(r.id || "")));
        const recentTitles = new Set(recent.map(r => String(r.title || "").trim().toLowerCase()));

        const matched = allApartments().filter(apt => 
            (apt.id && recentIds.has(String(apt.id))) || 
            recentTitles.has(String(apt.title || "").trim().toLowerCase())
        );

        const existingIds = new Set(matched.map(a => String(a.id || "")));
        recent.forEach(r => {
            if (!r.id || !existingIds.has(String(r.id))) {
                matched.push(r);
            }
        });
        return matched;
    }

    return filteredApartments();
}

function renderApartments(items = getApartmentsForCurrentView()) {
    if (!results) return;
    updateListingContext(items.length);
    resultCount.textContent = items.length;
    if (!items.length) {
        if (window.activeToolbarMode === "saved") {
            results.innerHTML = `
                <article class="apartment-card empty-results">
                    <h2>No saved properties yet</h2>
                    <p>Click the ♡ Save button on any property card to save your favourite homes.</p>
                    <button class="primary" type="button" onclick="setToolbarViewMode('all')">Browse All Properties</button>
                </article>
            `;
        } else if (window.activeToolbarMode === "compare") {
            results.innerHTML = `
                <article class="apartment-card empty-results">
                    <h2>No properties in comparison</h2>
                    <p>Click the Compare button on any property card to compare features side-by-side.</p>
                    <button class="primary" type="button" onclick="setToolbarViewMode('all')">Browse All Properties</button>
                </article>
            `;
        } else if (window.activeToolbarMode === "recent") {
            results.innerHTML = `
                <article class="apartment-card empty-results">
                    <h2>No recently viewed properties</h2>
                    <p>Properties you explore will automatically appear here.</p>
                    <button class="primary" type="button" onclick="setToolbarViewMode('all')">Browse All Properties</button>
                </article>
            `;
        } else {
            results.innerHTML = `
                <article class="apartment-card empty-results">
                    <h2>No apartments matched</h2>
                    <p>Try removing one filter, increasing the budget, or changing the city/search keyword.</p>
                    <button class="primary" type="button" id="emptyResetFilters">Reset Filters</button>
                </article>
            `;
        }
        return;
    }
    let bannerHtml = "";
    if (window.activeToolbarMode === "compare") {
        bannerHtml = `
            <div style="grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 12px 18px; margin-bottom: 8px;">
                <div>
                    <strong style="color: #1e3a8a; font-size: 0.92rem;">Comparing ${items.length} Properties</strong>
                    <p style="margin: 2px 0 0 0; font-size: 0.78rem; color: #3b82f6;">Side-by-side comparison matrix of price, BHK, area & furnishing</p>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button type="button" onclick="if(typeof openCompareDrawer==='function') openCompareDrawer();" class="primary" style="padding: 6px 14px; font-size: 0.8rem; border-radius: 8px; font-weight: 700; cursor: pointer;">⚖️ Open Comparison Matrix</button>
                    <button type="button" onclick="if(typeof clearComparisonList==='function') clearComparisonList(); setToolbarViewMode('compare');" style="background: #ffffff; border: 1px solid #cbd5e1; color: #475569; padding: 6px 12px; font-size: 0.8rem; border-radius: 8px; font-weight: 700; cursor: pointer;">Clear</button>
                </div>
            </div>
        `;
    } else if (window.activeToolbarMode === "saved") {
        bannerHtml = `
            <div style="grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 12px; padding: 12px 18px; margin-bottom: 8px;">
                <div>
                    <strong style="color: #9f1239; font-size: 0.92rem;">♥ Saved Properties (${items.length})</strong>
                    <p style="margin: 2px 0 0 0; font-size: 0.78rem; color: #e11d48;">Your personal collection of shortlisted listings</p>
                </div>
                <button type="button" onclick="setToolbarViewMode('all')" style="background: #ffffff; border: 1px solid #fecdd3; color: #e11d48; padding: 6px 12px; font-size: 0.8rem; border-radius: 8px; font-weight: 700; cursor: pointer;">← Browse All</button>
            </div>
        `;
    } else if (window.activeToolbarMode === "recent") {
        bannerHtml = `
            <div style="grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 18px; margin-bottom: 8px;">
                <div>
                    <strong style="color: #0f172a; font-size: 0.92rem;">🕒 Recently Viewed Properties (${items.length})</strong>
                    <p style="margin: 2px 0 0 0; font-size: 0.78rem; color: #64748b;">Properties you have recently explored</p>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button type="button" onclick="if(typeof clearRecentlyViewed==='function') clearRecentlyViewed(); setToolbarViewMode('recent');" style="background: #ffffff; border: 1px solid #cbd5e1; color: #475569; padding: 6px 12px; font-size: 0.8rem; border-radius: 8px; font-weight: 700; cursor: pointer;">Clear History</button>
                    <button type="button" onclick="setToolbarViewMode('all')" style="background: #ffffff; border: 1px solid #cbd5e1; color: #1e293b; padding: 6px 12px; font-size: 0.8rem; border-radius: 8px; font-weight: 700; cursor: pointer;">← Browse All</button>
                </div>
            </div>
        `;
    }
    results.innerHTML = bannerHtml + items.map((apt, index) => {
        const rawSlug = `${apt.type || "2-BHK"}-${apt.apartmentType || "apartment"}-for-${(apt.listingMode || "rent").toLowerCase()}-in-${apt.locality || "central"}-${apt.city || "chennai"}`
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
        const detailUrl = `/propertydirect/apartment-detail?id=${encodeURIComponent(apt.id)}`;
        const bathroomsText = apt.bathrooms ? `${apt.bathrooms} Baths` : "Bathrooms not specified";
        const ownerAgentLabel = "Approved Owner / Builder Listing";
        const savedState = isListingSaved(apt.id, apt.title);
        return `
        <article class="apartment-card" data-listing-id="${apt.id}"
            data-apartment-title="${safeAttribute(apt.title)}"
            data-apartment-city="${safeAttribute(apt.city)}"
            data-apartment-locality="${safeAttribute(apt.locality)}"
            data-apartment-society="${safeAttribute(apt.society)}"
            data-apartment-rent="${safeAttribute(money(apt.rent))}"
            data-apartment-deposit="${safeAttribute(apt.deposit)}"
            data-apartment-sqft="${safeAttribute(apt.sqft)}"
            data-apartment-bhk="${safeAttribute(apt.type)}"
            data-apartment-furnishing="${safeAttribute(apt.furnishing)}"
            data-apartment-availability="${safeAttribute(apt.available)}"
            data-apartment-mode="${safeAttribute(apt.listingMode || activeSearchMode || "Rent")}">
            <div class="apt-photo" style="position: relative;">
                <img src="${apt.image || '/propertydirect/images/orchid_enclave.jpg'}" alt="${apt.title} at ${apt.society}" onerror="this.onerror=null; this.src='/propertydirect/images/orchid_enclave.jpg';">
                <span class="apt-status-tag">${apt.apartmentType || "Apartment"} · ${apt.available}</span>
                <span class="listing-id-pill">ID: #${apt.id}</span>
                <span class="verified-badge">✓ Verified Property</span>
                ${apt.video ? `<button type="button" onclick="event.stopPropagation(); if (typeof playPropertyVideo === 'function') playPropertyVideo('${apt.video}', '${safeAttribute(apt.title)}')" style="position: absolute; bottom: 10px; right: 10px; background: linear-gradient(135deg, #1d4ed8, #2563eb); color: #ffffff; border: none; padding: 5px 12px; border-radius: 6px; font-weight: 800; font-size: 0.76rem; cursor: pointer; box-shadow: 0 4px 12px rgba(37,99,235,0.4); display: inline-flex; align-items: center; gap: 4px; z-index: 3;">Play Video Tour</button>` : ''}
            </div>
            <div class="apt-body">
                <div class="apt-title-row">
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                            <span class="listing-id-badge" style="font-size: 0.74rem; font-weight: 800; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 2px 8px; border-radius: 6px; letter-spacing: 0.02em;">Listing ID: #${apt.id}</span>
                        </div>
                        <h2><a href="${detailUrl}">${apt.title}</a></h2>
                        <p class="apt-address">📍 ${apt.society}, ${apt.locality}, ${apt.city}</p>
                    </div>
                    <button class="icon-action ${savedState ? 'active saved' : ''}" data-action="shortlist" data-listing-id="${apt.id}" title="${savedState ? 'Saved to favourites (Click to remove)' : 'Save to favourites'}"><svg width="14" height="14" viewBox="0 0 24 24" fill="${savedState ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg><span>${savedState ? 'Saved' : 'Save'}</span></button>
                </div>
                <div class="apt-price-grid">
                    <article><span>Price</span><strong>${money(apt.rent)}</strong></article>
                    <article><span>Area</span><strong>${apt.sqft}</strong></article>
                    <article><span>BHK / Baths</span><strong>${apt.type} | ${bathroomsText}</strong></article>
                </div>
                <div class="apt-facts">
                    <article><span>Type</span><strong>${apt.apartmentType || "Apartment"}</strong></article>
                    <article><span>Furnishing</span><strong>${apt.furnishing}</strong></article>
                    <article><span>Status</span><strong>${apt.available}</strong></article>
                    <article><span>Listed by</span><strong>${ownerAgentLabel}</strong></article>
                </div>
                <div class="apt-actions">
                    <a class="primary" href="${detailUrl}">View Details</a>
                    <button class="primary" data-action="owner">Get Owner Details</button>
                    <button class="ghost" data-action="visit">Schedule Visit</button>
                    <button class="ghost btn-save-action ${savedState ? 'active saved' : ''}" data-action="shortlist" data-listing-id="${apt.id}" title="${savedState ? 'Saved to favourites (Click to remove)' : 'Save to favourites'}"><span class="heart-icon">${savedState ? '❤️' : '♡'}</span> <span class="btn-text">${savedState ? 'Saved' : 'Save'}</span></button>
                </div>
            </div>
        </article>
    `; }).join("");
}

let leafletMapInstance = null;
let leafletMarkers = [];

function renderMapView() {
    const mapView = document.getElementById("mapView");
    if (!mapView) return;
    const items = matchingCityModeApartments();
    const city = document.getElementById("listingCity")?.value || defaultCity;
    
    mapView.innerHTML = `
        <div class="map-shell">
            <div class="map-sidebar">
                <div class="map-sidebar-head">
                    <h3>Apartments in ${city}</h3>
                    <span class="map-count">${items.length} locations mapped</span>
                </div>
                <div class="map-card-list">
                    ${items.map((apt, idx) => `
                        <div class="map-mini-card ${idx === 0 ? 'active' : ''}" data-map-pin="${idx}">
                            <img src="${apt.image}" alt="${apt.title}">
                            <div class="map-mini-info">
                                <strong>${money(apt.rent)}</strong>
                                <h4>${apt.type} in ${apt.locality}</h4>
                                <p>${apt.society}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="map-canvas-container" style="position: relative; height: 100%;">
                <div id="leafletMapContainer" style="width: 100%; height: 100%; z-index: 1;"></div>
            </div>
        </div>
    `;

    if (leafletMapInstance) {
        leafletMapInstance.remove();
        leafletMapInstance = null;
    }

    setTimeout(() => {
        const mapContainer = document.getElementById("leafletMapContainer");
        if (!mapContainer || typeof L === "undefined") return;

        const isMumbai = city.toLowerCase().includes("mumbai");
        const defaultLat = isMumbai ? 19.0760 : 12.9716;
        const defaultLng = isMumbai ? 72.8777 : 77.5946;

        leafletMapInstance = L.map("leafletMapContainer", {
            center: [defaultLat, defaultLng],
            zoom: 12,
            zoomControl: true
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(leafletMapInstance);

        leafletMarkers = [];
        const bounds = [];

        const coordsMap = {
            "hebbal": [13.0358, 77.5970],
            "kaikondrahalli": [12.9121, 77.6747],
            "bellandur": [12.9304, 77.6784],
            "rajaji nagar": [12.9982, 77.5530],
            "sarjapur road": [12.9250, 77.6850],
            "koramangala": [12.9352, 77.6245],
            "indiranagar": [12.9784, 77.6408],
            "hsr layout": [12.9121, 77.6446],
            "whitefield": [12.9698, 77.7500],
            "bandra": [19.0596, 72.8295],
            "andheri": [19.1197, 72.8464]
        };

        items.forEach((apt, idx) => {
            const localityKey = String(apt.locality || "").toLowerCase();
            let baseCoord = coordsMap[localityKey];
            if (!baseCoord) {
                const angle = (idx / Math.max(1, items.length)) * 2 * Math.PI;
                const radius = 0.02 + (idx * 0.008);
                baseCoord = [defaultLat + Math.sin(angle) * radius, defaultLng + Math.cos(angle) * radius];
            }

            bounds.push(baseCoord);

            const customIcon = L.divIcon({
                className: "leaflet-price-badge-icon",
                html: `<div class="leaflet-price-badge ${idx === 0 ? "active" : ""}">${money(apt.rent)}</div>`,
                iconSize: [80, 30],
                iconAnchor: [40, 15]
            });

            const marker = L.marker(baseCoord, { icon: customIcon }).addTo(leafletMapInstance);

            marker.bindPopup(`
                <div style="font-family: 'Manrope', sans-serif; padding: 4px; max-width: 200px;">
                    <img src="${apt.image}" style="width:100%; height:90px; object-fit:cover; border-radius:8px; margin-bottom:6px;" alt="${apt.title}">
                    <strong style="color:#1d376c; font-size:1rem; display:block;">${money(apt.rent)}</strong>
                    <h4 style="font-size:0.82rem; margin:2px 0; color:#17223b;">${apt.title}</h4>
                    <p style="font-size:0.75rem; color:#64748b; margin:0;">${apt.society}</p>
                </div>
            `);

            leafletMarkers.push(marker);

            marker.on("click", () => {
                mapView.querySelectorAll(".map-mini-card").forEach(el => el.classList.remove("active"));
                const miniCard = mapView.querySelector(`.map-mini-card[data-map-pin="${idx}"]`);
                miniCard?.classList.add("active");
                miniCard?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            });
        });

        if (bounds.length > 0) {
            leafletMapInstance.fitBounds(bounds, { padding: [40, 40] });
        }
        leafletMapInstance.invalidateSize();
        
        // Update nearby properties when user moves or zooms map
        leafletMapInstance.on("moveend", () => {
            const center = leafletMapInstance.getCenter();
            const countEl = document.querySelector(".map-count");
            if (countEl) {
                countEl.textContent = `Showing properties near (${center.lat.toFixed(3)}, ${center.lng.toFixed(3)})`;
            }
            showToast("Map view updated: Showing nearby properties in viewport");
        });

        setTimeout(() => { if (leafletMapInstance) leafletMapInstance.invalidateSize(); }, 250);
    }, 100);

    mapView.querySelectorAll(".map-mini-card").forEach(card => {
        card.addEventListener("click", () => {
            const idx = parseInt(card.dataset.mapPin, 10);
            mapView.querySelectorAll(".map-mini-card").forEach(el => el.classList.remove("active"));
            card.classList.add("active");
            if (leafletMarkers[idx] && leafletMapInstance) {
                leafletMarkers[idx].openPopup();
                leafletMapInstance.panTo(leafletMarkers[idx].getLatLng());
            }
        });
    });
}

function gradient(index) {
    return "none";
}

function contactFields() {
    return `
        <label>Full Name<input data-modal-field="name" placeholder="Your name"></label>
        <label>Mobile Number<input data-modal-field="phone" type="tel" placeholder="Mobile number"></label>
        <label>Email Address<input data-modal-field="email" type="email" placeholder="Email address"></label>
        <label>Contact Purpose<select data-modal-field="purpose"><option>Check availability</option><option>Schedule discussion</option><option>Negotiate price</option><option>Request documents</option><option>Other</option></select></label>
        <label>Preferred Contact Time<input data-modal-field="preferredTime" type="datetime-local"></label>
        <label>Move-in / Purchase Timeline<input data-modal-field="timeline" placeholder="Immediate, 30 days, 3 months..."></label>
        <label>Financing Status<select data-modal-field="financing"><option>Not applicable</option><option>Funds ready</option><option>Loan pre-approved</option><option>Loan assistance required</option></select></label>
        <label>Message to Owner<textarea data-modal-field="message" placeholder="Share your requirement and questions"></textarea></label>
    `;
}

function safeAttribute(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function detailsFromApartmentCard(card) {
    if (!card) {
        return {
            title: activeApartmentTitle,
            city: document.getElementById("listingCity")?.value || defaultCity,
            mode: activeSearchMode || "Rent"
        };
    }
    return {
        title: card.dataset.apartmentTitle || card.querySelector("h2")?.textContent.trim() || "Selected apartment",
        city: card.dataset.apartmentCity || document.getElementById("listingCity")?.value || defaultCity,
        locality: card.dataset.apartmentLocality || "",
        society: card.dataset.apartmentSociety || "",
        rent: card.dataset.apartmentRent || "",
        deposit: card.dataset.apartmentDeposit || "",
        sqft: card.dataset.apartmentSqft || "",
        bhk: card.dataset.apartmentBhk || "",
        furnishing: card.dataset.apartmentFurnishing || "",
        available: card.dataset.apartmentAvailability || "",
        mode: card.dataset.apartmentMode || activeSearchMode || "Rent"
    };
}

function actionFields(kind) {
    if (kind === "post") return postFields(activePostType);
    if (kind === "visit") {
        return `
            <label>Visitor Name<input data-modal-field="name" placeholder="Your name"></label>
            <label>Mobile Number<input data-modal-field="phone" type="tel" placeholder="Mobile number"></label>
            <label>Email Address<input data-modal-field="email" type="email" placeholder="Email address"></label>
            <label>Preferred Date<input data-modal-field="date" type="date"></label>
            <label>Start Time<input data-modal-field="time" type="time"></label>
            <label>Alternate Date<input data-modal-field="alternateDate" type="date"></label>
            <label>Visitor Count<input data-modal-field="visitorCount" type="number" min="1" value="1"></label>
            <label>Visit Mode<select data-modal-field="visitMode"><option>In-person</option><option>Video tour</option><option>Agent-assisted</option></select></label>
            <label>Vehicle Number<input data-modal-field="vehicle" placeholder="Optional"></label>
            <label>Questions / Access Instructions<textarea data-modal-field="instructions" placeholder="Parking, landmark, accessibility or property questions"></textarea></label>
        `;
    }
    if (kind === "photos") {
        return `
            <label>Name<input data-modal-field="name" placeholder="Your name"></label>
            <label>Phone<input data-modal-field="phone" placeholder="Mobile number"></label>
            <label>Email<input data-modal-field="email" type="email" placeholder="Email address"></label>
            <label>Rooms / Areas Required<input data-modal-field="request" placeholder="Bedroom, balcony, parking..."></label>
            <label>Preferred Format<select data-modal-field="format"><option>Photos</option><option>Walkthrough video</option><option>Both photos and video</option></select></label>
            <label>Additional Instructions<textarea data-modal-field="instructions" placeholder="Angles, fixtures or amenities to capture"></textarea></label>
        `;
    }
    if (kind === "report") {
        return `
            <label>Your Name<input data-modal-field="name" placeholder="Your name"></label>
            <label>Phone<input data-modal-field="phone" placeholder="Mobile number"></label>
            <label>Email<input data-modal-field="email" type="email" placeholder="Email address"></label>
            <label>Issue Type<select data-modal-field="issue"><option>Wrong price</option><option>Unavailable apartment</option><option>Incorrect photos</option><option>Duplicate listing</option></select></label>
            <label>Listing Reference<input data-modal-field="reference" placeholder="Property or listing reference"></label>
            <label>Evidence Reference<input data-modal-field="evidence" placeholder="Screenshot or document URL"></label>
            <label>Preferred Follow-up<select data-modal-field="followup"><option>Email</option><option>Phone</option><option>In-app</option></select></label>
            <label>Detailed Issue<textarea data-modal-field="details" placeholder="Explain what is incorrect and the expected correction"></textarea></label>
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

function postFields(type = activePostType) {
    const typeLabel = {
        rent: "Apartment for Rent",
        sale: "Apartment for Sale",
        premium: "Premium Apartment"
    }[type] || "Apartment";
    return `
        <div class="post-type-tabs" role="tablist" aria-label="Property type">
            <button type="button" class="${type === "rent" ? "active" : ""}" data-post-type="rent" aria-pressed="${type === "rent"}">Rent</button>
            <button type="button" class="${type === "sale" ? "active" : ""}" data-post-type="sale" aria-pressed="${type === "sale"}">Sale</button>
            <button type="button" class="${type === "premium" ? "active" : ""}" data-post-type="premium" aria-pressed="${type === "premium"}">Premium</button>
        </div>
        <div class="form-grid">
            <label>Owner Name<input data-modal-field="owner" placeholder="Owner name"></label>
            <label>Phone<input data-modal-field="phone" placeholder="Mobile number"></label>
            <label>Property Type<input data-modal-field="propertyType" value="${typeLabel}"></label>
            <label>Apartment Type<select data-modal-field="apartmentType"><option>Gated Society</option><option>Standalone Apartment</option><option>Villa</option><option>Studio</option><option>Builder Floor</option></select></label>
            <label>City / Town<input data-modal-field="city" list="propertydirectCityOptions" value="${document.getElementById("listingCity")?.value || defaultCity}" placeholder="Example: Bargur"></label>
            <label>Locality<input data-modal-field="locality" placeholder="Locality"></label>
            <label>Apartment / Society<input data-modal-field="society" placeholder="Society name"></label>
            <label>BHK<select data-modal-field="bhk"><option>1 BHK</option><option selected>2 BHK</option><option>3 BHK</option><option>4 BHK</option><option>5 BHK</option></select></label>
            <label>${type === "sale" ? "Expected Price" : "Monthly Rent"}<input data-modal-field="price" placeholder="${type === "sale" ? "Rs. 72 L" : "Rs. 28,000"}"></label>
            <label>Deposit<input data-modal-field="deposit" placeholder="Example: Rs. 1,00,000"></label>
            <label>Built-up Sqft<input data-modal-field="sqft" placeholder="Example: 1,100 sqft"></label>
            <label>Furnishing<select data-modal-field="furnishing"><option>Semi Furnished</option><option>Fully Furnished</option><option>Unfurnished</option></select></label>
            <label>Availability<select data-modal-field="available"><option>Ready to Move</option><option>15 Days</option><option>30 Days</option><option>Under Construction</option></select></label>
            <label>Parking<select data-modal-field="parking"><option>Bike Parking Car Parking</option><option>Car Parking</option><option>Bike Parking</option><option>No Parking</option></select></label>
            <label>Preferred Tenant<select data-modal-field="tenant"><option>All</option><option>Family</option><option>Family / Bachelor</option><option>Company</option></select></label>
            <label>Property Photo<input data-modal-field="image" type="file" accept="image/*"></label>
            <label>More Details<textarea data-modal-field="notes" placeholder="Balcony, lift, water, nearby landmark..."></textarea></label>
        </div>
        <datalist id="propertydirectCityOptions">${readCityOptions().map(city => `<option value="${city}"></option>`).join("")}</datalist>
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
    activeApartmentDetails = detailsFromApartmentCard(source?.closest?.(".apartment-card"));
    activeApartmentTitle = activeApartmentDetails.title || "Selected apartment";
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
    activeSearchMode = "";
    document.querySelectorAll(".filters button.active, [data-view-mode].active").forEach(btn => btn.classList.remove("active"));
    document.querySelector('[data-view-mode="list"]')?.classList.add("active");
    document.querySelectorAll("[data-search-mode]").forEach(b => {
        b.classList.toggle("active", b.dataset.searchMode === "");
    });
    const city = document.getElementById("listingCity");
    const search = document.getElementById("listingSearch");
    const budget = document.getElementById("budgetRange");
    const minBudget = document.getElementById("minBudgetRange");
    if (city) city.value = "";
    if (search) search.value = "";
    if (budget) {
        budget.value = defaultBudget;
        document.getElementById("budgetValue").textContent = money(Number(defaultBudget));
    }
    if (minBudget) {
        minBudget.value = defaultMinBudget;
        document.getElementById("minBudgetValue").textContent = money(Number(defaultMinBudget));
    }
    document.getElementById("apartmentResults")?.classList.remove("hidden");
    document.getElementById("mapView")?.classList.add("hidden");
    updateFilterState("Filters reset");
}

function matchingCityModeApartments() {
    const city = (document.getElementById("listingCity")?.value || "").toLowerCase();
    return allApartments().filter((apt) => {
        const cityOk = !city || String(apt.city || "").toLowerCase() === city;
        const text = `${apt.title} ${apt.society} ${apt.locality} ${apt.city} ${apt.type} ${apt.listingMode || ""} ${apt.apartmentType || ""}`.toLowerCase();
        const modeOk = !activeSearchMode || apt.isPublished || String(apt.listingMode || "").toLowerCase().includes(activeSearchMode.toLowerCase()) || text.includes(activeSearchMode.toLowerCase());
        return cityOk && modeOk;
    });
}

function syncBudgetForCurrentSearch() {
    const budget = document.getElementById("budgetRange");
    if (!budget) return;
    const maxRent = matchingCityModeApartments().reduce((max, apt) => Math.max(max, Number(apt.rent || 0)), Number(defaultBudget));
    if (maxRent > Number(budget.max || 0)) budget.max = String(maxRent);
    if (maxRent > Number(budget.value || 0)) budget.value = String(maxRent);
    document.getElementById("budgetValue").textContent = money(Number(budget.value));
}

function updateListingContext(count = Number(resultCount?.textContent || 0)) {
    const city = document.getElementById("listingCity")?.value || "";
    const cityLabel = city && city.toLowerCase() !== "all cities" ? city : "All Cities";
    const breadcrumb = document.querySelector(".breadcrumb");
    const modeLabel = activeSearchMode ? ` / ${activeSearchMode}` : "";
    if (breadcrumb) breadcrumb.textContent = `Home / Apartments / ${cityLabel}${modeLabel}`;
    const liveCount = document.getElementById("resultCount");
    if (liveCount) liveCount.textContent = String(count);

    const h1 = document.querySelector(".results-header h1");
    if (h1) {
        if (window.activeToolbarMode === "saved") {
            h1.innerHTML = `<span id="resultCount">${count}</span> saved apartments in your shortlist`;
        } else if (window.activeToolbarMode === "compare") {
            h1.innerHTML = `<span id="resultCount">${count}</span> apartments in comparison`;
        } else if (window.activeToolbarMode === "recent") {
            h1.innerHTML = `<span id="resultCount">${count}</span> recently viewed apartments`;
        } else {
            h1.innerHTML = `<span id="resultCount">${count}</span> verified apartments without brokerage`;
        }
    }
}

function readImageFile(file) {
    if (!file) return Promise.resolve("");
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => resolve("");
        reader.readAsDataURL(file);
    });
}

async function submitPostedApartment() {
    const fields = document.getElementById("modalFields");
    const read = (name) => fields?.querySelector(`[data-modal-field="${name}"]`)?.value.trim() || "";
    const imageFile = fields?.querySelector('[data-modal-field="image"]')?.files?.[0] || null;
    const bhk = read("bhk") || "2 BHK";
    const locality = read("locality") || "New Locality";
    const society = read("society") || "Owner Listed Apartment";
    const city = titleCasePlace(read("city") || defaultCity);
    const rawPrice = read("price").replace(/[^\d]/g, "");
    const rent = activePostType === "sale" ? Number(rawPrice || 7500000) : Number(rawPrice || 28000);
    const mode = activePostType === "sale" ? "Buy" : activePostType === "premium" ? "Premium" : "Rent";
    const uploadedImage = await readImageFile(imageFile);
    const postedApartment = {
        title: `${bhk} ${activePostType === "premium" ? "Premium Apartment" : "Apartment"} in ${locality}`,
        society,
        locality,
        city,
        rent,
        maintenance: 0,
        deposit: read("deposit") || (mode === "Buy" ? "For Sale" : "Rs. 1,00,000"),
        sqft: read("sqft") || "1,100 sqft",
        photo: uploadedImage ? "Uploaded Photo" : "New Listing",
        furnishing: read("furnishing") || "Semi Furnished",
        type: bhk,
        tenant: read("tenant") || "All",
        available: read("available") || "Ready to Move",
        parking: read("parking") || "Bike Parking Car Parking",
        apartmentType: read("apartmentType") || (mode === "Premium" ? "Gated Society" : "Standalone Apartment"),
        image: uploadedImage || (mode === "Premium" ? "/shared/images/propertydirect-cinematic-2.webp" : "/shared/images/apartment-living-1.webp"),
        nearby: [read("notes") || "Owner listed", "Direct contact", "No brokerage"]
    };
    apartments.unshift(postedApartment);
    const published = readPublishedListings().filter(item => item.title !== postedApartment.title);
    localStorage.setItem(publishedListingsStorageKey, JSON.stringify([{
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title: postedApartment.title,
        society,
        locality,
        city,
        type: mode,
        price: read("price") || (mode === "Buy" ? "Rs. 75,00,000" : "Rs. 28,000"),
        rent,
        maintenance: 0,
        deposit: postedApartment.deposit,
        sqft: postedApartment.sqft,
        bhk,
        furnishing: postedApartment.furnishing,
        available: postedApartment.available,
        parking: postedApartment.parking,
        tenant: postedApartment.tenant,
        apartmentType: postedApartment.apartmentType,
        notes: read("notes") || "",
        image: postedApartment.image,
        status: "Live",
        publishedAt: new Date().toISOString()
    }, ...published].slice(0, 80)));
    saveCityOption(city);
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
    syncAllToolbarBadges();
    showToast(`Apartment posted in ${city} and city dropdown updated`);
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

        if (group === "mode") {
            const targetMode = value.toLowerCase();
            activeSearchMode = (activeSearchMode === targetMode) ? "" : targetMode;
            document.querySelectorAll("[data-search-mode]").forEach(b => {
                b.classList.toggle("active", (b.dataset.searchMode || "") === activeSearchMode);
            });
            document.querySelectorAll('[data-filter-group="mode"]').forEach(b => {
                const bVal = (b.dataset.filter || "").toLowerCase();
                const isActive = isModeButtonActive(bVal, activeSearchMode);
                b.classList.toggle("active", Boolean(isActive));
                b.setAttribute("aria-pressed", String(Boolean(isActive)));
            });
            renderApartments();
            showToast(activeSearchMode ? `Showing ${activeSearchMode.toUpperCase()} properties` : "Showing all listings");
            return;
        }

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

    if (window.location.pathname.includes("apartment-detail")) return;

    const action = event.target.closest("[data-action]")?.dataset.action || event.target.closest("[data-detail-action]")?.dataset.detailAction;
    if (action) {
        const [title, text] = actionMessage(action);
        if (action === "shortlist") {
            event.preventDefault();
            event.stopPropagation();
            const btn = event.target.closest("button");
            const card = event.target.closest(".apartment-card") || document.querySelector(".detail-hero");
            const details = detailsFromApartmentCard(card);
            const listingId = card?.dataset?.listingId || btn?.dataset?.listingId || details.id || "";
            const cleanTitle = String(details.title || "").trim();
            const cleanTitleLower = cleanTitle.toLowerCase();
            const strListingId = String(listingId || "").trim();

            let saved = getSavedListings();
            const index = saved.findIndex(item => {
                if (strListingId && item.id && String(item.id).trim() === strListingId) return true;
                if (cleanTitleLower && item.title && String(item.title).trim().toLowerCase() === cleanTitleLower) return true;
                return false;
            });

            let isNowSaved = false;
            if (index >= 0) {
                saved.splice(index, 1);
                isNowSaved = false;
                showToast(`Removed "${cleanTitle}" from saved properties`);
                if (strListingId && /^\d+$/.test(strListingId)) {
                    fetch(`/api/property/saved/${encodeURIComponent(strListingId)}`, { method: "DELETE" }).catch(() => {});
                }
            } else {
                saved.unshift({
                    id: strListingId,
                    title: cleanTitle,
                    rent: details.rent,
                    deposit: details.deposit,
                    locality: details.locality,
                    city: details.city,
                    society: details.society,
                    bhk: details.bhk,
                    sqft: details.sqft,
                    furnishing: details.furnishing,
                    available: details.available,
                    mode: details.mode,
                    image: card?.querySelector("img")?.src || "/propertydirect/images/orchid_enclave.jpg"
                });
                isNowSaved = true;
                showToast(`Saved "${cleanTitle}" to favourites!`);
                if (strListingId && /^\d+$/.test(strListingId)) {
                    fetch(`/api/property/saved/${encodeURIComponent(strListingId)}`, { method: "POST" }).catch(() => {});
                }
            }
            localStorage.setItem("propertydirect-saved-listings", JSON.stringify(saved));

            updateCardSaveButtons(strListingId, cleanTitle, isNowSaved);
            syncAllToolbarBadges();

            if (window.activeToolbarMode === "saved") {
                renderApartments();
            }
            return;
        }
        else openModal(title, text, action === "post" ? "post" : action, event.target);
    }

    const searchModeBtn = event.target.closest("[data-search-mode]");
    if (searchModeBtn) {
        event.preventDefault();
        document.querySelectorAll("[data-search-mode]").forEach(b => b.classList.remove("active"));
        searchModeBtn.classList.add("active");
        activeSearchMode = searchModeBtn.dataset.searchMode || "";
        
        document.querySelectorAll('[data-filter-group="mode"]').forEach(b => {
            const bVal = (b.dataset.filter || "").toLowerCase();
            const isActive = isModeButtonActive(bVal, activeSearchMode);
            b.classList.toggle("active", Boolean(isActive));
            b.setAttribute("aria-pressed", String(Boolean(isActive)));
        });

        renderApartments();
        showToast(activeSearchMode ? `Filtered by ${activeSearchMode.toUpperCase()}` : "Showing all listings");
    }

    const emptyReset = event.target.closest("#emptyResetFilters");
    if (emptyReset) {
        resetApartmentSearch();
    }
});

document.querySelectorAll(".view-toggle button[data-view-mode]").forEach(btn => {
    btn.addEventListener("click", (e) => {
        e.preventDefault();
        document.querySelectorAll(".view-toggle button").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        
        const mode = btn.dataset.viewMode;
        const listView = document.getElementById("apartmentResults");
        const mapView = document.getElementById("mapView");
        const societyStrip = document.querySelector(".society-strip");

        if (mode === "map") {
            if (listView) listView.classList.add("hidden");
            if (societyStrip) societyStrip.classList.add("hidden");
            if (mapView) mapView.classList.remove("hidden");
            renderMapView();
            showToast("Switched to Interactive Map View");
        } else {
            if (mapView) mapView.classList.add("hidden");
            if (listView) listView.classList.remove("hidden");
            if (societyStrip) societyStrip.classList.remove("hidden");
            renderApartments();
            showToast("Switched to List View");
        }
    });
});

document.getElementById("listingSearchButton")?.addEventListener("click", () => {
    const isMapActive = document.querySelector(".view-toggle button[data-view-mode='map']")?.classList.contains("active");
    if (isMapActive) renderMapView(); else renderApartments();
    showToast("Apartment search updated");
});

document.getElementById("listingSearch")?.addEventListener("input", () => {
    const isMapActive = document.querySelector(".view-toggle button[data-view-mode='map']")?.classList.contains("active");
    if (isMapActive) renderMapView(); else renderApartments();
});

document.getElementById("listingCity")?.addEventListener("change", () => {
    const isMapActive = document.querySelector(".view-toggle button[data-view-mode='map']")?.classList.contains("active");
    if (isMapActive) renderMapView(); else renderApartments();
    showToast(`Showing ${document.getElementById("listingCity")?.value || "selected city"} apartments`);
});

document.getElementById("listingSearch")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") document.getElementById("listingSearchButton")?.click();
});

document.getElementById("clearFilters")?.addEventListener("click", () => {
    resetApartmentSearch();
    const isMapActive = document.querySelector(".view-toggle button[data-view-mode='map']")?.classList.contains("active");
    if (isMapActive) renderMapView();
});

document.getElementById("budgetRange")?.addEventListener("input", (event) => {
    const minimum = document.getElementById("minBudgetRange");
    if (minimum && Number(event.target.value) < Number(minimum.value)) minimum.value = event.target.value;
    document.getElementById("budgetValue").textContent = money(Number(event.target.value));
    const isMapActive = document.querySelector(".view-toggle button[data-view-mode='map']")?.classList.contains("active");
    if (isMapActive) renderMapView(); else renderApartments();
});

document.getElementById("minBudgetRange")?.addEventListener("input", (event) => {
    const maximum = document.getElementById("budgetRange");
    if (maximum && Number(event.target.value) > Number(maximum.value)) maximum.value = event.target.value;
    document.getElementById("minBudgetValue").textContent = money(Number(event.target.value));
    if (maximum) document.getElementById("budgetValue").textContent = money(Number(maximum.value));
    const isMapActive = document.querySelector(".view-toggle button[data-view-mode='map']")?.classList.contains("active");
    if (isMapActive) renderMapView(); else renderApartments();
});

document.getElementById("closeModal")?.addEventListener("click", () => modal.classList.add("hidden"));
document.getElementById("cancelModal")?.addEventListener("click", () => modal.classList.add("hidden"));
document.getElementById("modalSubmit")?.addEventListener("click", async () => {
    if (activeModalKind === "post") {
        await submitPostedApartment();
        return;
    }
    const fields = document.getElementById("modalFields");
    const read = (name) => fields?.querySelector(`[data-modal-field="${name}"]`)?.value.trim() || "";
    const first = read("name");
    if (activeModalKind === "owner" || activeModalKind === "contact") {
        if (!read("name") || !read("phone") || !read("email")) {
            showToast("Please enter name, phone and email");
            return;
        }
        const request = {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            name: read("name"),
            phone: read("phone"),
            email: read("email"),
            apartment: activeApartmentDetails?.title || activeApartmentTitle,
            city: activeApartmentDetails?.city || document.getElementById("listingCity")?.value || defaultCity,
            locality: activeApartmentDetails?.locality || "",
            society: activeApartmentDetails?.society || "",
            rent: activeApartmentDetails?.rent || "",
            deposit: activeApartmentDetails?.deposit || "",
            sqft: activeApartmentDetails?.sqft || "",
            bhk: activeApartmentDetails?.bhk || "",
            furnishing: activeApartmentDetails?.furnishing || "",
            available: activeApartmentDetails?.available || "",
            mode: activeApartmentDetails?.mode || activeSearchMode || "Rent",
            status: "New",
            submittedAt: new Date().toISOString()
        };
        request.purpose=read("purpose");request.preferredTime=read("preferredTime");request.timeline=read("timeline");request.financing=read("financing");request.message=read("message");
        saveOwnerContactRequest(request);
        modal.classList.add("hidden");
        showToast(`Owner details request saved for ${request.apartment}`);
        return;
    }
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
    const mode = params.get("mode") || params.get("type");
    if (mode) activeSearchMode = String(mode).toLowerCase();
    if (city) saveCityOption(city);
    if (city && document.getElementById("listingCity")) document.getElementById("listingCity").value = titleCasePlace(city);
    if (query && document.getElementById("listingSearch")) document.getElementById("listingSearch").value = query;
    syncBudgetForCurrentSearch();
    updateListingContext();
}

hydrateCityDropdowns();
applyUrlSearch();
renderSocieties();
updateFilterState();
async function loadPublicInventory() {
    const items=[];
    for(let page=0;;page++) {
        const response=await fetch(`/api/properties/public?page=${page}&size=100`,{headers:{Accept:'application/json'}});
        if(!response.ok) throw new Error('Properties could not be loaded. Please try again.');
        const payload=await response.json();
        items.push(...(Array.isArray(payload)?payload:payload.content||[]));
        if(Array.isArray(payload)||!payload.hasNext) break;
    }
    return items;
}
if(results) results.innerHTML='<article class="apartment-card empty-results" role="status"><h2>Loading properties…</h2><p>Finding approved, available listings.</p></article>';
function updateSocietiesFromListings() {
    const counts = {};
    (approvedDiscoveryListings || []).forEach(apt => {
        const soc = apt.society || apt.locality;
        if (soc && soc !== "Owner Listed Apartment" && soc !== "Approved Society") {
            counts[soc] = (counts[soc] || 0) + 1;
        }
    });
    societyData.length = 0;
    Object.entries(counts).forEach(([k, v]) => societyData.push([k, v]));
}

loadPublicInventory().then(items => {
    const mapped = items.map(x => ({
        id: x.id,
        apartmentCode: x.apartmentCode || (x.id ? `PD-${x.id}` : ""),
        listingId: x.id,
        title: x.title,
        society: x.society || x.locality || "Approved Society",
        locality: x.locality || x.city || "Direct Listing",
        city: x.city,
        listingMode: x.listingType || "Rent",
        listingType: x.listingType || "Rent",
        type: x.listingType || "Rent",
        rent: Number(x.price || 0),
        price: Number(x.price || 0),
        bhk: x.bhk || (x.bedrooms ? `${x.bedrooms} BHK` : "2 BHK"),
        bedrooms: x.bedrooms,
        bathrooms: x.bathrooms,
        furnishing: x.furnishing,
        image: x.imageUrl || "/propertydirect/images/orchid_enclave.jpg",
        imageUrl: x.imageUrl || "/propertydirect/images/orchid_enclave.jpg",
        imageUrls: String(x.imageUrls || "").split(/\r?\n/).filter(Boolean),
        video: x.videoUrl,
        videoUrl: x.videoUrl,
        deposit: x.deposit,
        maintenance: x.maintenance,
        areaSqft: x.areaSqft,
        sqft: x.areaSqft ? `${Number(x.areaSqft).toLocaleString("en-IN")} sqft` : "Area on request",
        parking: x.parking,
        address: x.address,
        pincode: x.pincode,
        description: x.description,
        amenities: x.amenities,
        available: x.availableFrom ? new Date(x.availableFrom).toLocaleDateString("en-IN") : (x.constructionStatus || "Ready to Move"),
        constructionStatus: x.constructionStatus || "Ready to Move",
        propertyType: x.propertyType || "Apartment",
        apartmentType: x.propertyType || "Apartment"
    }));
    approvedDiscoveryListings = mapped;
    approvedDiscoveryLoaded = true;

    [...new Set(mapped.map(x => x.city).filter(Boolean))].forEach(c => saveCityOption(c));
    hydrateCityDropdowns(document.getElementById("listingCity")?.value || "");
    updateSocietiesFromListings();
    syncBudgetForCurrentSearch();
    renderSocieties();
    updateFilterState();
}).catch(error => {
    approvedDiscoveryListings = [];
    approvedDiscoveryLoaded = true;
    if (results) results.innerHTML = '<article class="apartment-card empty-results" role="alert"><h2>Properties could not be loaded</h2><p>Please retry. Your filters have been kept.</p><button class="primary" type="button" onclick="location.reload()">Try again</button></article>';
});
