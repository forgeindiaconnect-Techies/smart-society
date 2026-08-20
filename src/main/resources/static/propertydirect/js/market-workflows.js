(() => {
    "use strict";
    const role = document.body.dataset.dashboardRole || "";
    const apiRoot = "/api/property";

    const currency = value => `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;
    const when = value => value ? new Date(value).toLocaleString("en-IN", {dateStyle: "medium", timeStyle: "short"}) : "—";

    function notify(message) {
        if (typeof showToast === "function") showToast(message);
        else {
            const toast = document.getElementById("toast");
            if (!toast) return;
            toast.textContent = message;
            toast.classList.remove("hidden");
            setTimeout(() => toast.classList.add("hidden"), 3600);
        }
    }

    async function api(path, options = {}) {
        const response = await fetch(`${apiRoot}${path}`, {
            ...options,
            headers: {Accept: "application/json", ...(options.body ? {"Content-Type": "application/json"} : {}), ...options.headers}
        });
        const payload = await response.json().catch(() => ({}));
        if (response.status === 401 || response.status === 403) throw new Error("Please sign in with the required PropertyDirect role.");
        if (!response.ok) throw new Error(payload.message || payload.detail || "The operation could not be completed.");
        return payload;
    }

    const fields = form => Object.fromEntries(new FormData(form).entries());

    function fillInput(formId, name, value) {
        const input = document.querySelector(`#${formId} [name="${name}"]`);
        if (input) input.value = value;
    }

    function openPanel(panel) {
        document.querySelector(`.sidebar-nav [data-panel="${panel}"]`)?.click();
    }

    function statusBadge(value) {
        const badge = document.createElement("span");
        badge.className = `status ${["VERIFIED", "ACTIVE", "CONFIRMED", "COMPLETED"].includes(String(value).toUpperCase()) ? "active" : "pending"}`;
        badge.textContent = value || "PENDING";
        return badge;
    }

    function cell(row, value) {
        const td = document.createElement("td");
        td.textContent = value ?? "—";
        row.appendChild(td);
        return td;
    }

    function actionButton(label, action, listingId) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.dataset.propertyApiAction = action;
        if (listingId !== undefined) button.dataset.listingId = listingId;
        return button;
    }

    function listingCard(listing) {
        const card = document.createElement("article");
        card.className = "dash-card";
        const title = document.createElement("h3"); title.textContent = listing.title;
        const place = document.createElement("p"); place.textContent = `${listing.society} · ${listing.locality}, ${listing.city}`;
        const detail = document.createElement("p"); detail.textContent = `${listing.bhk} · ${listing.furnishing || "Furnishing not specified"} · ${listing.areaSqft ? `${listing.areaSqft} sqft` : "Area not specified"}`;
        const price = document.createElement("strong"); price.textContent = currency(listing.price);
        const verification = document.createElement("p"); verification.append("Verification: ", statusBadge(listing.verificationStatus));
        const actions = document.createElement("p");
        actions.append(actionButton("Shortlist", "shortlist", listing.id), " ", actionButton("Contact Owner", "prepare-contact", listing.id), " ", actionButton("Request Visit", "prepare-visit", listing.id));
        card.append(title, place, detail, price, verification, actions);
        return card;
    }

    async function searchListings(form = document.getElementById("propertySearchForm")) {
        if (!form) return [];
        const params = new URLSearchParams();
        Object.entries(fields(form)).forEach(([key, value]) => { if (value !== "") params.set(key, value); });
        const items = await api(`/listings?${params}`);
        document.getElementById("propertySearchResults")?.replaceChildren(...items.map(listingCard));
        const state = document.getElementById("searchResultState");
        if (state) state.textContent = `${items.length} matching propert${items.length === 1 ? "y" : "ies"}`;
        return items;
    }

    function updateStat(name, value) {
        const node = document.querySelector(`[data-property-stat="${name}"]`);
        if (node) node.textContent = value;
    }

    async function loadSaved() {
        const list = document.getElementById("savedPropertiesList");
        if (!list) return [];
        const items = await api("/saved");
        const rows = items.map(item => {
            const listing = item.listing;
            const row = document.createElement("li");
            const description = document.createElement("span");
            description.textContent = `${listing.title} · ${listing.locality} · ${currency(listing.price)}`;
            row.append(description, actionButton("Contact", "prepare-contact", listing.id), actionButton("Visit", "prepare-visit", listing.id), actionButton("Remove", "remove-shortlist", listing.id));
            return row;
        });
        if (!rows.length) { const empty = document.createElement("li"); empty.textContent = "No shortlisted properties yet. Use Search Properties to add one."; rows.push(empty); }
        list.replaceChildren(...rows);
        updateStat("saved", items.length);
        return items;
    }

    async function loadSavedSearches() {
        const body = document.getElementById("savedSearchesBody");
        if (!body) return [];
        const items = await api("/saved-searches");
        body.replaceChildren(...items.map(item => {
            const row = document.createElement("tr");
            cell(row, item.name); cell(row, [item.locality, item.city].filter(Boolean).join(", ") || "Any area"); cell(row, item.listingType || "Any"); cell(row, item.bhk || "Any"); cell(row, `${item.minPrice ? currency(item.minPrice) : "Any"} – ${item.maxPrice ? currency(item.maxPrice) : "Any"}`);
            const status = cell(row, ""); status.replaceChildren(statusBadge(item.alertsEnabled ? "ACTIVE" : "OFF"));
            return row;
        }));
        updateStat("searches", items.length);
        return items;
    }

    async function loadVisits() {
        const body = document.getElementById("propertyVisitsBody");
        if (!body) return [];
        const items = await api("/visits");
        body.replaceChildren(...items.map(item => {
            const row = document.createElement("tr"); cell(row, item.listing?.title || `Listing ${item.listing?.id || ""}`); cell(row, when(item.scheduledAt));
            const status = cell(row, ""); status.replaceChildren(statusBadge(item.visitStatus)); cell(row, item.notes || "—"); return row;
        }));
        updateStat("visits", items.length);
        return items;
    }

    async function loadServices() {
        const body = document.getElementById("propertyServicesBody");
        if (!body) return [];
        const items = await api("/services");
        body.replaceChildren(...items.map(item => {
            const row = document.createElement("tr"); cell(row, item.serviceType); cell(row, when(item.preferredAt));
            const status = cell(row, ""); status.replaceChildren(statusBadge(item.requestStatus)); cell(row, item.details || "—"); return row;
        }));
        updateStat("services", items.length);
        return items;
    }

    function setDefaultDates() {
        document.querySelectorAll('input[type="datetime-local"]').forEach(input => {
            if (input.value) return;
            const future = new Date(Date.now() + 2 * 86400000); future.setHours(11, 0, 0, 0); future.setMinutes(future.getMinutes() - future.getTimezoneOffset());
            input.value = future.toISOString().slice(0, 16);
        });
    }

    async function loadOwnerListings() {
        const body = document.getElementById("ownerListingsBody");
        if (!body) return [];
        const items = await api("/my-listings");
        body.replaceChildren(...items.map(item => {
            const row = document.createElement("tr"); cell(row, item.title); cell(row, item.listingType); cell(row, currency(item.price));
            const status = cell(row, ""); status.replaceChildren(statusBadge(item.verificationStatus)); cell(row, item.viewCount || 0);
            const actions = cell(row, ""); if (item.verificationStatus !== "VERIFIED") actions.appendChild(actionButton("Verify", "verify-listing", item.id)); actions.append(" ", actionButton("Deactivate", "deactivate-listing", item.id));
            return row;
        }));
        const stat = document.querySelector('[data-stat="live"]'); if (stat) stat.textContent = items.filter(item => item.status === "ACTIVE").length;
        return items;
    }

    async function createOwnerListing(form) {
        const input = fields(form);
        const payload = {
            title: input.title, society: input.society || input.locality, locality: input.locality, city: input.city,
            type: String(input.type || "").toUpperCase().includes("SALE") ? "SALE" : "RENT", propertyType: "APARTMENT",
            price: Number(String(input.price || "").replace(/[^\d.]/g, "")), deposit: input.deposit ? Number(input.deposit) : null,
            maintenance: input.maintenance ? Number(input.maintenance) : null, areaSqft: input.areaSqft ? Number(input.areaSqft) : null,
            bhk: input.bhk, furnishing: input.furnishing, parking: input.parking, availableFrom: input.availableFrom || null,
            amenities: input.amenities, imageUrl: input.imageUrl, notes: input.notes
        };
        if (!payload.title || !payload.locality || !payload.city || !payload.price) throw new Error("Title, city, locality and a valid price are required.");
        await api("/listings", {method: "POST", body: JSON.stringify(payload)});
        form.reset(); notify("Property published and sent for verification."); await loadOwnerListings(); openPanel("listings");
    }

    async function handle(button) {
        const action = button.dataset.propertyApiAction;
        const form = button.closest("form");
        if (form && !form.reportValidity()) return;
        button.disabled = true;
        try {
            if (action === "search") await searchListings(form);
            else if (action === "shortlist") { await api(`/saved/${button.dataset.listingId}`, {method: "POST"}); notify("Property added to your shortlist."); await loadSaved(); }
            else if (action === "remove-shortlist") { await api(`/saved/${button.dataset.listingId}`, {method: "DELETE"}); notify("Property removed from your shortlist."); await loadSaved(); }
            else if (action === "prepare-contact") { fillInput("ownerContactForm", "listingId", button.dataset.listingId); openPanel("contacts"); }
            else if (action === "prepare-visit") { fillInput("propertyVisitForm", "listingId", button.dataset.listingId); openPanel("visits"); }
            else if (action === "contact-owner") { const payload = fields(form); payload.listingId = Number(payload.listingId); const result = await api("/enquiries", {method: "POST", body: JSON.stringify(payload)}); document.getElementById("ownerContactState").textContent = `Enquiry #${result.id} submitted`; notify("Owner contact enquiry submitted."); }
            else if (action === "schedule-visit") { const payload = fields(form); payload.listingId = Number(payload.listingId); await api("/visits", {method: "POST", body: JSON.stringify(payload)}); notify("Site visit requested."); await loadVisits(); }
            else if (action === "request-service") { const payload = fields(form); payload.listingId = payload.listingId ? Number(payload.listingId) : null; await api("/services", {method: "POST", body: JSON.stringify(payload)}); notify("Home service requested."); await loadServices(); }
            else if (action === "save-search") { const payload = fields(form); payload.minPrice = payload.minPrice ? Number(payload.minPrice) : null; payload.maxPrice = payload.maxPrice ? Number(payload.maxPrice) : null; payload.alertsEnabled = form.elements.alertsEnabled.checked; await api("/saved-searches", {method: "POST", body: JSON.stringify(payload)}); notify("Search criteria saved."); await loadSavedSearches(); }
            else if (action === "verify-listing") { await api(`/listings/${button.dataset.listingId}/verification?status=VERIFIED`, {method: "PATCH"}); notify("Listing marked as verified."); await loadOwnerListings(); }
            else if (action === "deactivate-listing") { await api(`/listings/${button.dataset.listingId}`, {method: "DELETE"}); notify("Listing deactivated."); await loadOwnerListings(); }
            else if (action === "publish-owner-listing") await createOwnerListing(form);
        } catch (error) { notify(error.message); }
        finally { button.disabled = false; }
    }

    document.addEventListener("click", event => {
        let button = event.target.closest("[data-property-api-action]");
        if (!button && (role === "admin" || role === "customer") && event.target.closest('#postApartmentForm [data-action="post-property"]')) {
            button = event.target.closest('#postApartmentForm [data-action="post-property"]'); button.dataset.propertyApiAction = "publish-owner-listing";
        }
        if (!button) return;
        event.preventDefault(); event.stopImmediatePropagation(); handle(button);
    }, true);

    document.addEventListener("submit", event => {
        if (!event.submitter?.matches("[data-property-api-action]")) return;
        event.preventDefault();
    }, true);

    document.addEventListener("DOMContentLoaded", async () => {
        setDefaultDates();
        try {
            if (role === "customer") await Promise.all([searchListings(), loadSaved(), loadSavedSearches(), loadVisits(), loadServices(), loadOwnerListings()]);
            else if (role === "admin") await loadOwnerListings();
            document.documentElement.dataset.propertyBackendConnected = "true";
        } catch (error) { console.error("PropertyDirect workflow hydration failed", error); notify(error.message); }
    });
})();
