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
        const multipart = options.body instanceof FormData;
        const response = await fetch(`${apiRoot}${path}`, {
            ...options,
            headers: {Accept: "application/json", ...(options.body && !multipart ? {"Content-Type": "application/json"} : {}), ...options.headers}
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
            const actions = cell(row, ""); actions.appendChild(actionButton("Deactivate", "deactivate-listing", item.id));
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
            amenities: input.amenities, imageUrl: null, latitude: input.latitude ? Number(input.latitude) : null, longitude: input.longitude ? Number(input.longitude) : null,
            notes: [input.description, input.address ? `Address: ${input.address}` : ""].filter(Boolean).join("\n")
        };
        if (!payload.title || !payload.locality || !payload.city || !payload.price) throw new Error("Title, city, locality and a valid price are required.");
        const photos = [...(form.querySelector('[name="photos"]')?.files || [])];
        if (photos.length < 10) throw new Error("Please upload at least 10 property photos.");
        if (photos.length > 20) throw new Error("Please upload no more than 20 property photos.");
        const body = new FormData(); body.append("listing", new Blob([JSON.stringify(payload)], {type: "application/json"})); photos.forEach(photo => body.append("photos", photo));
        await api("/listings/with-photos", {method: "POST", body});
        form.reset(); document.getElementById("propertyPhotoPreview")?.replaceChildren(); const count = document.getElementById("propertyPhotoCount"); if (count) count.textContent = "No photos selected";
        notify("Property submitted. It will become public after Super Admin approval."); await loadOwnerListings(); openPanel("listings");
    }

    function ensureSuperadminGovernancePanel() {
        if (role !== "superadmin") return;
        const nav = document.querySelector(".sidebar-nav"); const main = document.querySelector("main.dash-main"); if (!nav || !main) return;
        if (!nav.querySelector('[data-panel="customers"]')) { const button = document.createElement("button"); button.type = "button"; button.dataset.panel = "customers"; button.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M19 8v6M22 11h-6"></path></svg><span>Customers & Approvals</span>'; nav.appendChild(button); }
        if (!main.querySelector('[data-view="customers"]')) { const section = document.createElement("section"); section.className = "dash-panel hidden"; section.dataset.view = "customers"; section.innerHTML = '<div class="dash-card customer-governance-card"><div class="card-head"><div><h3>Customers and property approvals</h3><p>Review registered PropertyDirect customers and approve submitted properties before public publication.</p></div><button class="primary small" type="button" data-property-api-action="refresh-governance">Refresh</button></div><div class="customer-governance-stats"><article><span>Registered customers</span><strong id="registeredCustomerCount">0</strong><small>All PropertyDirect customer accounts</small></article><article><span>Pending properties</span><strong id="pendingPropertyCount">0</strong><small>Waiting for Super Admin review</small></article><article><span>Approved properties</span><strong id="approvedPropertyCount">0</strong><small>Visible in public search</small></article></div><div class="governance-grid"><section><div class="governance-title"><h4>Registered customer details</h4><span id="customerTableState">Loading…</span></div><div class="dashboard-table-scroll"><table><thead><tr><th>Customer</th><th>Contact</th><th>Username</th><th>Registered</th><th>Properties</th></tr></thead><tbody id="propertyCustomerRows"></tbody></table></div></section><section><div class="governance-title"><h4>Pending property approvals</h4><span>Approval controls public visibility</span></div><div class="approval-card-list" id="propertyApprovalRows"></div></section></div></div>'; main.insertBefore(section, document.getElementById("dashboardModal") || null); }
    }

    async function loadSuperadminGovernance() {
        if (role !== "superadmin") return;
        const [summary, customers, pending] = await Promise.all([api("/admin/summary"), api("/admin/customers"), api("/admin/listings?verificationStatus=PENDING")]);
        document.getElementById("registeredCustomerCount").textContent = summary.registeredCustomers; document.getElementById("pendingPropertyCount").textContent = summary.pendingListings; document.getElementById("approvedPropertyCount").textContent = summary.approvedListings;
        const customerRows = document.getElementById("propertyCustomerRows"); if (customerRows) customerRows.replaceChildren(...customers.map(item => { const row = document.createElement("tr"); cell(row, `${item.name} (#${item.id})`); cell(row, `${item.email} · ${item.phone}`); cell(row, item.username); cell(row, item.registeredAt ? new Date(item.registeredAt).toLocaleDateString("en-IN") : "—"); cell(row, item.listingCount); return row; }));
        const state = document.getElementById("customerTableState"); if (state) state.textContent = `${customers.length} registered`;
        const approvalRows = document.getElementById("propertyApprovalRows"); if (approvalRows) { const cards = pending.map(item => { const card = document.createElement("article"); card.className = "property-approval-card"; const photos = String(item.imageUrls || item.imageUrl || "").split(/\n/).filter(Boolean); card.innerHTML = `<div class="approval-photo-strip">${photos.slice(0,4).map(url => `<img src="${url}" alt="Property photo">`).join("")}</div><div class="approval-card-body"><div><h5>${item.title}</h5><p>${item.society} · ${item.locality}, ${item.city}</p><small>${item.bhk} · ${item.areaSqft || "—"} sq ft · ${currency(item.price)} · ${photos.length} photos</small></div><div class="approval-actions"><button type="button" data-property-api-action="approve-property" data-listing-id="${item.id}">Approve & publish</button><button type="button" data-property-api-action="reject-property" data-listing-id="${item.id}">Reject</button></div></div>`; return card; }); if (!cards.length) { const empty = document.createElement("p"); empty.className = "governance-empty"; empty.textContent = "No properties are waiting for approval."; cards.push(empty); } approvalRows.replaceChildren(...cards); }
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
            else if (action === "refresh-governance") await loadSuperadminGovernance();
            else if (action === "approve-property") { await api(`/listings/${button.dataset.listingId}/verification?status=VERIFIED`, {method: "PATCH"}); notify("Property approved and published publicly."); await loadSuperadminGovernance(); }
            else if (action === "reject-property") { await api(`/listings/${button.dataset.listingId}/verification?status=REJECTED`, {method: "PATCH"}); notify("Property submission rejected."); await loadSuperadminGovernance(); }
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
            else if (role === "superadmin") { ensureSuperadminGovernancePanel(); await loadSuperadminGovernance(); }
            document.documentElement.dataset.propertyBackendConnected = "true";
        } catch (error) { console.error("PropertyDirect workflow hydration failed", error); notify(error.message); }
    });

    document.addEventListener("change", event => { if (!event.target.matches("#propertyPhotoFiles")) return; const files = [...event.target.files]; const count = document.getElementById("propertyPhotoCount"); if (count) { count.textContent = `${files.length} photo${files.length === 1 ? "" : "s"} selected${files.length < 10 ? " — add at least 10" : " — ready"}`; count.classList.toggle("is-invalid", files.length < 10); } const preview = document.getElementById("propertyPhotoPreview"); if (preview) preview.replaceChildren(...files.slice(0,20).map(file => { const img = document.createElement("img"); img.src = URL.createObjectURL(file); img.alt = file.name; return img; })); });
})();
