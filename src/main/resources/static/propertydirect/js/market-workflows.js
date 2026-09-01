(() => {
    "use strict";
    const role = document.body.dataset.dashboardRole || "";
    const apiRoot = "/api/property";
    const pendingProperties = new Map();
    const ownerProperties = new Map();

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

    async function absoluteApi(path, options = {}) {
        const response = await fetch(path, {
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
        const normalized = String(value).toUpperCase();
        badge.className = `status ${["VERIFIED", "APPROVED", "ACTIVE", "CONFIRMED", "COMPLETED"].includes(normalized) ? "active" : normalized === "REJECTED" ? "rejected" : "pending"}`;
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
        ownerProperties.clear(); items.forEach(item => ownerProperties.set(String(item.id), item));
        body.replaceChildren(...items.map(item => {
            const row = document.createElement("tr"); cell(row, item.title); cell(row, item.listingType); cell(row, currency(item.price));
            const status = cell(row, ""); status.appendChild(statusBadge(item.verificationStatus)); if (item.verificationStatus === "REJECTED" && item.rejectionReason) { const reason = document.createElement("small"); reason.className = "listing-rejection-reason"; reason.textContent = item.rejectionReason; status.appendChild(reason); } cell(row, item.viewCount || 0);
            const actions = cell(row, ""); if (["REJECTED", "CHANGES_REQUESTED"].includes(item.verificationStatus)) actions.appendChild(actionButton("Edit & Resubmit", "edit-resubmit-listing", item.id)); actions.appendChild(actionButton("Deactivate", "deactivate-listing", item.id));
            return row;
        }));
        const stat = document.querySelector('[data-stat="live"]'); if (stat) stat.textContent = items.filter(item => item.status === "ACTIVE").length;
        return items;
    }

    async function createOwnerListing(form) {
        const input = fields(form);
        const payload = {
            title: input.title, description: input.description, society: input.society || input.locality, locality: input.locality,
            address: input.address, city: input.city, pincode: input.pincode,
            type: String(input.type || "").toUpperCase().includes("SALE") ? "SALE" : "RENT", propertyType: input.propertyType || "APARTMENT",
            price: Number(String(input.price || "").replace(/[^\d.]/g, "")), deposit: input.deposit ? Number(input.deposit) : null,
            maintenance: input.maintenance ? Number(input.maintenance) : null, areaSqft: input.areaSqft ? Number(input.areaSqft) : null,
            bhk: input.bhk, bathrooms: input.bathrooms ? Number(input.bathrooms) : null, furnishing: input.furnishing, parking: input.parking, availableFrom: input.availableFrom || null,
            amenities: input.amenities, imageUrl: null, latitude: input.latitude ? Number(input.latitude) : null, longitude: input.longitude ? Number(input.longitude) : null,
            notes: input.description
        };
        if (!payload.title || !payload.locality || !payload.city || !payload.price) throw new Error("Title, city, locality and a valid price are required.");
        if (form.dataset.editingId) {
            await api(`/listings/${form.dataset.editingId}/resubmit`, {method: "PATCH", body: JSON.stringify(payload)});
            delete form.dataset.editingId; form.reset(); const photosInput=form.querySelector('[name="photos"]'); if(photosInput) photosInput.required=true; const submit=form.querySelector('[data-property-api-action="publish-owner-listing"]'); if(submit) submit.textContent="Submit property for approval"; notify("Property updated and resubmitted. Your listing is pending Super Admin review."); await loadOwnerListings(); openPanel("listings"); return;
        }
        const photos = [...(form.querySelector('[name="photos"]')?.files || [])];
        if (photos.length < 10) throw new Error("Please upload at least 10 property photos.");
        if (photos.length > 20) throw new Error("Please upload no more than 20 property photos.");
        const body = new FormData(); body.append("listing", new Blob([JSON.stringify(payload)], {type: "application/json"})); photos.forEach(photo => body.append("photos", photo));
        await api("/listings/with-photos", {method: "POST", body});
        form.reset(); document.getElementById("propertyPhotoPreview")?.replaceChildren(); const count = document.getElementById("propertyPhotoCount"); if (count) count.textContent = "No photos selected";
        const success = document.getElementById("propertySubmissionSuccess"); if (success) { success.textContent = "Property submitted successfully! Your listing is pending Super Admin review."; success.classList.remove("hidden"); }
        notify("Property submitted successfully! Your listing is pending Super Admin review."); await loadOwnerListings(); openPanel("listings");
    }

    function editAndResubmit(id) {
        const item = ownerProperties.get(String(id));
        const form = document.getElementById("postApartmentForm");
        if (!item || !form) return;
        const values = {title:item.title, description:item.description || item.notes, society:item.society, propertyType:item.propertyType,
            type:item.listingType, bhk:item.bhk, bathrooms:item.bathrooms, areaSqft:item.areaSqft, city:item.city, locality:item.locality,
            address:item.address, pincode:item.pincode, latitude:item.latitude, longitude:item.longitude, price:item.price,
            deposit:item.deposit, maintenance:item.maintenance, availableFrom:item.availableFrom, furnishing:item.furnishing,
            parking:item.parking, amenities:item.amenities};
        Object.entries(values).forEach(([name, value]) => { if (form.elements[name] && value != null) form.elements[name].value = value; });
        form.dataset.editingId = item.id;
        const photos = form.querySelector('[name="photos"]'); if (photos) photos.required = false;
        const button = form.querySelector('[data-property-api-action="publish-owner-listing"]'); if (button) button.textContent = "Save & Resubmit for Approval";
        const upload = form.querySelector(".property-photo-upload"); if (upload) upload.classList.add("optional-on-resubmit");
        openPanel("post-listing");
    }

    function ensureSuperadminGovernancePanel() {
        if (role !== "superadmin") return;
        const nav = document.querySelector(".sidebar-nav"); const main = document.querySelector("main.dash-main"); if (!nav || !main) return;
        if (!nav.querySelector('[data-panel="customers"]')) { const button = document.createElement("button"); button.type = "button"; button.dataset.panel = "customers"; button.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M19 8v6M22 11h-6"></path></svg><span>Customers & Approvals</span>'; nav.appendChild(button); }
        if (!main.querySelector('[data-view="customers"]')) { const section = document.createElement("section"); section.className = "dash-panel hidden"; section.dataset.view = "customers"; section.innerHTML = '<div class="dash-card customer-governance-card"><div class="card-head"><div><h3>Super Admin Property Approval Portal</h3><p>Review every pending submission before it becomes visible in PropertyDirect search.</p></div><button class="primary small" type="button" data-property-api-action="refresh-governance">Refresh</button></div><div class="customer-governance-stats four"><article><span>Total listed</span><strong id="totalPropertyCount">0</strong><small>All property submissions</small></article><article><span>Pending approvals</span><strong id="pendingPropertyCount">0</strong><small>Waiting for review</small></article><article><span>Approved properties</span><strong id="approvedPropertyCount">0</strong><small>Visible publicly</small></article><article><span>Total users</span><strong id="registeredCustomerCount">0</strong><small>Registered customers</small></article></div><div class="governance-title"><h4>Pending property submissions</h4><span id="approvalTableState">Loading…</span></div><div class="dashboard-table-scroll"><table class="approval-data-table"><thead><tr><th>Property title</th><th>Owner</th><th>Price</th><th>Location</th><th>Submitted</th><th>Actions</th></tr></thead><tbody id="propertyApprovalRows"></tbody></table></div></div><div class="property-review-modal hidden" id="propertyReviewModal" data-property-review><div class="property-review-dialog"><button class="property-review-close" type="button" data-property-api-action="close-property-review" aria-label="Close">×</button><div class="property-review-gallery"><img id="propertyReviewMainImage" alt="Property"><div id="propertyReviewThumbs"></div></div><div class="property-review-content"><span class="status pending">Pending approval</span><h3 id="propertyReviewTitle">Property review</h3><p id="propertyReviewOwner"></p><div class="property-review-specs" id="propertyReviewSpecs"></div><section><h4>Description</h4><p id="propertyReviewDescription"></p></section><section><h4>Location</h4><p id="propertyReviewLocation"></p></section><label class="approval-review-note">Review / rejection reason<textarea rows="3" maxlength="2000" data-review-note placeholder="Required when rejecting the property"></textarea></label><div class="property-review-actions"><button class="primary" type="button" data-property-api-action="approve-property">Approve property</button><button type="button" data-property-api-action="reject-property">Reject property</button></div></div></div></div>'; main.insertBefore(section, document.getElementById("dashboardModal") || null); }
    }

    async function loadSuperadminGovernance() {
        if (role !== "superadmin") return;
        const [summary, pending] = await Promise.all([api("/admin/summary"), absoluteApi("/api/admin/properties/pending")]);
        document.getElementById("totalPropertyCount").textContent = summary.totalListings; document.getElementById("registeredCustomerCount").textContent = summary.registeredCustomers; document.getElementById("pendingPropertyCount").textContent = summary.pendingListings; document.getElementById("approvedPropertyCount").textContent = summary.approvedListings;
        pendingProperties.clear(); pending.forEach(item => pendingProperties.set(String(item.id), item));
        const rows = document.getElementById("propertyApprovalRows"); if (rows) { const rendered = pending.map(item => { const row = document.createElement("tr"); cell(row, item.title); cell(row, `${item.ownerName}\n${item.ownerEmail}`); cell(row, currency(item.price)); cell(row, [item.locality, item.city, item.postalCode].filter(Boolean).join(", ")); cell(row, when(item.submittedAt)); const actions = cell(row, ""); const review = document.createElement("button"); review.type = "button"; review.dataset.propertyApiAction = "review-property"; review.dataset.listingId = item.id; review.textContent = "Review"; actions.appendChild(review); return row; }); if (!rendered.length) { const row = document.createElement("tr"); const empty = cell(row, "No properties are waiting for approval."); empty.colSpan = 6; empty.className = "governance-empty"; rendered.push(row); } rows.replaceChildren(...rendered); }
        const state = document.getElementById("approvalTableState"); if (state) state.textContent = `${pending.length} pending`;
    }

    function openPropertyReview(id) {
        const item = pendingProperties.get(String(id));
        const modal = document.getElementById("propertyReviewModal");
        if (!item || !modal) return;
        modal.querySelector("#propertyReviewTitle").textContent = item.title || "Untitled property";
        modal.querySelector("#propertyReviewOwner").textContent = `${item.ownerName || "Unknown owner"} · ${item.ownerEmail || "No email"}`;
        modal.querySelector("#propertyReviewDescription").textContent = item.description || "No description supplied.";
        modal.querySelector("#propertyReviewLocation").textContent = [item.address, item.locality, item.city, item.postalCode, item.latitude && item.longitude ? `${item.latitude}, ${item.longitude}` : ""].filter(Boolean).join(" · ");
        const specs = modal.querySelector("#propertyReviewSpecs");
        specs.replaceChildren(...[
            ["Price", currency(item.price)], ["Deposit", currency(item.deposit)], ["Maintenance", currency(item.maintenance)],
            ["Type", item.propertyType || "—"], ["Bedrooms", item.bedrooms || "—"], ["Area", item.areaSqFt ? `${item.areaSqFt} sq ft` : "—"],
            ["Furnishing", item.furnishing || "—"], ["Parking", item.parking || "—"], ["Available", item.availableFrom || "—"], ["Submitted", when(item.submittedAt)]
        ].map(([label, value]) => { const card = document.createElement("article"); const key = document.createElement("span"); key.textContent = label; const content = document.createElement("strong"); content.textContent = value; card.append(key, content); return card; }));
        const mainImage = modal.querySelector("#propertyReviewMainImage");
        const images = item.images || [];
        mainImage.src = images[0] || "/favicon.svg";
        const thumbs = modal.querySelector("#propertyReviewThumbs");
        thumbs.replaceChildren(...images.map(url => { const image = document.createElement("img"); image.src = url; image.alt = "Property preview"; image.addEventListener("click", () => { mainImage.src = url; }); return image; }));
        modal.querySelectorAll('[data-property-api-action="approve-property"], [data-property-api-action="reject-property"]').forEach(button => { button.dataset.listingId = item.id; });
        modal.querySelector("[data-review-note]").value = "";
        modal.classList.remove("hidden");
        document.body.classList.add("modal-open");
    }

    function closePropertyReview() {
        document.getElementById("propertyReviewModal")?.classList.add("hidden");
        document.body.classList.remove("modal-open");
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
            else if (action === "contact-owner") {
                const values = fields(form);
                const context = [values.message, values.budget && `Budget: ${values.budget}`, values.moveInDate && `Move-in / purchase date: ${values.moveInDate}`, values.occupants && `Occupants: ${values.occupants}`, values.contactMethod && `Preferred contact: ${values.contactMethod}`, values.callbackAt && `Callback time: ${values.callbackAt}`].filter(Boolean).join("\n");
                const payload = {listingId:Number(values.listingId), name:values.name, phone:values.phone, email:values.email, type:values.type, message:context};
                const result = await api("/enquiries", {method: "POST", body: JSON.stringify(payload)}); document.getElementById("ownerContactState").textContent = `Enquiry #${result.id} submitted`; notify("Owner contact enquiry submitted.");
            }
            else if (action === "schedule-visit") {
                const values = fields(form);
                const notes = [values.notes, `Visitor: ${values.visitorName}`, `Phone: ${values.contactPhone}`, `Attendees: ${values.attendees}`, `Mode: ${values.visitMode}`, values.alternateAt && `Alternate time: ${values.alternateAt}`, values.meetingPoint && `Meeting point: ${values.meetingPoint}`, values.vehicleNumber && `Vehicle: ${values.vehicleNumber}`, `Broker involved: ${values.brokerInvolved}`].filter(Boolean).join("\n");
                await api("/visits", {method: "POST", body: JSON.stringify({listingId:Number(values.listingId), scheduledAt:values.scheduledAt, notes})}); notify("Site visit requested."); await loadVisits();
            }
            else if (action === "request-service") {
                const values = fields(form);
                const details = [values.details, `Contact: ${values.contactName} (${values.contactPhone})`, `Address: ${values.serviceAddress}`, `Urgency: ${values.urgency}`, values.alternateAt && `Alternate time: ${values.alternateAt}`, values.budget && `Budget: Rs. ${values.budget}`, `Access: ${values.accessType}`, `Preferred contact: ${values.contactMethod}`].filter(Boolean).join("\n");
                await api("/services", {method: "POST", body: JSON.stringify({listingId:values.listingId ? Number(values.listingId) : null, serviceType:values.serviceType, preferredAt:values.preferredAt, details})}); notify("Home service requested."); await loadServices();
            }
            else if (action === "support-ticket") {
                const values = fields(form);
                const saved = await persistWorkflowAction("support-ticket", button, values);
                const list = document.getElementById("supportTickets");
                const item = document.createElement("li");
                item.textContent = `${values.title} · ${values.category.replaceAll("_", " ")} · ${values.priority} · Ticket #${saved.id || "saved"}`;
                if (list) { if (list.children.length === 1 && list.firstElementChild.textContent.includes("No active")) list.replaceChildren(); list.prepend(item); }
                const state = document.getElementById("supportState"); if (state) state.textContent = `Ticket #${saved.id || "saved"} submitted`;
                form.reset(); setDefaultDates(); notify("Detailed support ticket saved and submitted.");
            }
            else if (action === "save-search") { const payload = fields(form); payload.minPrice = payload.minPrice ? Number(payload.minPrice) : null; payload.maxPrice = payload.maxPrice ? Number(payload.maxPrice) : null; payload.alertsEnabled = form.elements.alertsEnabled.checked; await api("/saved-searches", {method: "POST", body: JSON.stringify(payload)}); notify("Search criteria saved."); await loadSavedSearches(); }
            else if (action === "verify-listing") { notify("Final publication approval is restricted to the Super Admin."); }
            else if (action === "deactivate-listing") { await api(`/listings/${button.dataset.listingId}`, {method: "DELETE"}); notify("Listing deactivated."); await loadOwnerListings(); }
            else if (action === "edit-resubmit-listing") editAndResubmit(button.dataset.listingId);
            else if (action === "publish-owner-listing") await createOwnerListing(form);
            else if (action === "refresh-governance") await loadSuperadminGovernance();
            else if (action === "review-property") openPropertyReview(button.dataset.listingId);
            else if (action === "close-property-review") closePropertyReview();
            else if (["approve-property", "request-property-changes", "reject-property"].includes(action)) {
                const note = button.closest("[data-property-review], .property-approval-card")?.querySelector("[data-review-note]")?.value?.trim() || "";
                const decision = action === "approve-property" ? "APPROVED" : action === "reject-property" ? "REJECTED" : "CHANGES_REQUESTED";
                if (decision !== "APPROVED" && !note) throw new Error("Add a review note explaining the rejection or required changes.");
                if (decision === "CHANGES_REQUESTED") await api(`/listings/${button.dataset.listingId}/verification`, {method: "PATCH", body: JSON.stringify({decision, note, reviewer: "PropertyDirect Super Admin"})});
                else await absoluteApi(`/api/admin/properties/${button.dataset.listingId}/status`, {method: "PATCH", body: JSON.stringify({status: decision, rejectionReason: note})});
                notify(decision === "APPROVED" ? "Property approved and published publicly." : decision === "REJECTED" ? "Property submission rejected with reviewer feedback." : "Changes requested from the property owner.");
                closePropertyReview();
                await loadSuperadminGovernance();
            }
        } catch (error) { notify(error.message); }
        finally { button.disabled = false; }
    }

    document.addEventListener("click", event => {
        let button = event.target.closest("[data-property-api-action]");
        if (!button && event.target.closest('#propertySupportForm [data-action="support"]')) {
            button = event.target.closest('#propertySupportForm [data-action="support"]'); button.dataset.propertyApiAction = "support-ticket"; button.type = "submit";
        }
        if (!button && role === "customer" && event.target.closest('#postApartmentForm [data-action="post-property"]')) {
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
        const listingForm = document.getElementById("postApartmentForm");
        if (listingForm && !listingForm.elements.pincode) {
            const addressLabel = listingForm.elements.address?.closest("label");
            const pincodeLabel = document.createElement("label");
            pincodeLabel.innerHTML = 'Pincode<input name="pincode" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required placeholder="6-digit pincode">';
            addressLabel?.insertAdjacentElement("afterend", pincodeLabel);
        }
        if (listingForm && !listingForm.elements.bathrooms) {
            const bedroomLabel = listingForm.elements.bhk?.closest("label");
            const bathroomLabel = document.createElement("label");
            bathroomLabel.innerHTML = 'Bathrooms<input name="bathrooms" type="number" min="1" max="20" required value="1">';
            bedroomLabel?.insertAdjacentElement("afterend", bathroomLabel);
        }
        if (listingForm && !document.getElementById("propertySubmissionSuccess")) {
            const success = document.createElement("p"); success.id = "propertySubmissionSuccess"; success.className = "property-submission-success hidden"; success.setAttribute("role", "status"); listingForm.appendChild(success);
        }
        const dropZone = listingForm?.querySelector(".property-photo-upload");
        const photoInput = document.getElementById("propertyPhotoFiles");
        if (dropZone && photoInput) {
            dropZone.querySelector("span")?.insertAdjacentText("beforebegin", "Drag and drop images here, or click to browse. ");
            ["dragenter", "dragover"].forEach(type => dropZone.addEventListener(type, event => { event.preventDefault(); dropZone.classList.add("is-dragging"); }));
            ["dragleave", "drop"].forEach(type => dropZone.addEventListener(type, event => { event.preventDefault(); dropZone.classList.remove("is-dragging"); }));
            dropZone.addEventListener("drop", event => { const transfer = new DataTransfer(); [...event.dataTransfer.files].filter(file => file.type.startsWith("image/")).slice(0,20).forEach(file => transfer.items.add(file)); photoInput.files = transfer.files; previewPropertyFiles([...photoInput.files]); });
        }
        setDefaultDates();
        try {
            if (role === "customer") await Promise.all([searchListings(), loadSaved(), loadSavedSearches(), loadVisits(), loadServices(), loadOwnerListings()]);
            else if (role === "admin") await loadOwnerListings();
            else if (role === "superadmin") { ensureSuperadminGovernancePanel(); await loadSuperadminGovernance(); }
            document.documentElement.dataset.propertyBackendConnected = "true";
        } catch (error) { console.error("PropertyDirect workflow hydration failed", error); notify(error.message); }
    });

    function previewPropertyFiles(files) { const count = document.getElementById("propertyPhotoCount"); if (count) { count.textContent = `${files.length} photo${files.length === 1 ? "" : "s"} selected${files.length < 10 ? " — add at least 10" : " — ready"}`; count.classList.toggle("is-invalid", files.length < 10); } const preview = document.getElementById("propertyPhotoPreview"); if (preview) preview.replaceChildren(...files.slice(0,20).map(file => { const img = document.createElement("img"); img.src = URL.createObjectURL(file); img.alt = file.name; return img; })); }
    document.addEventListener("change", event => { if (event.target.matches("#propertyPhotoFiles")) previewPropertyFiles([...event.target.files]); });
})();
