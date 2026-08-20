(() => {
    "use strict";

    const role = document.body.dataset.dashboardRole || "";
    const apiRoot = "/api/society/advanced";

    const text = (value) => value === null || value === undefined || value === "" ? "—" : String(value);
    const money = (value) => `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;
    const dateTime = (value) => value ? new Date(value).toLocaleString("en-IN", {dateStyle: "medium", timeStyle: "short"}) : "—";
    const date = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {dateStyle: "medium"}) : "—";

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

    async function request(path, options = {}) {
        const response = await fetch(`${apiRoot}${path}`, {
            ...options,
            headers: {Accept: "application/json", ...(options.body ? {"Content-Type": "application/json"} : {}), ...options.headers}
        });
        const payload = await response.json().catch(() => ({}));
        if (response.status === 401 || response.status === 403) throw new Error("This action is not available for your role.");
        if (!response.ok) throw new Error(payload.message || payload.detail || "The operation could not be completed.");
        return payload;
    }

    function appendCell(row, value, className) {
        const cell = document.createElement("td");
        if (className) {
            const badge = document.createElement("span");
            badge.className = `status ${className}`;
            badge.textContent = text(value);
            cell.appendChild(badge);
        } else cell.textContent = text(value);
        row.appendChild(cell);
        return cell;
    }

    function statusClass(value) {
        const normalized = String(value || "").toUpperCase();
        if (["COLLECTED", "VERIFIED", "ACTIVE"].includes(normalized)) return "active";
        if (["BLACKLISTED", "REJECTED", "EXPIRED"].includes(normalized)) return "open";
        return "pending";
    }

    function formPayload(form) {
        return Object.fromEntries(new FormData(form).entries());
    }

    async function loadBillingRules() {
        const body = document.getElementById("billingRulesBody");
        if (!body) return;
        const items = await request("/billing-rules");
        if (!items.length) {
            body.innerHTML = '<tr><td colspan="7" class="text-muted text-center py-4">No recurring charge rules yet. Create your first rule above.</td></tr>';
            return;
        }
        body.replaceChildren(...items.map(item => {
            const row = document.createElement("tr");
            appendCell(row, `${item.name}${item.addressProof ? ` · ID: ${item.addressProof}` : ""}${item.notes ? ` · ${item.notes}` : ""}`);
            appendCell(row, money(item.amount));
            appendCell(row, `${item.frequency || "MONTHLY"} · Day ${item.dueDay}`);
            appendCell(row, money(item.lateFee));
            appendCell(row, date(item.nextRunDate));
            appendCell(row, item.automatic ? "Automatic" : "Manual", statusClass(item.automatic ? "ACTIVE" : "PENDING"));
            const action = appendCell(row, "");
            [["edit-billing-rule", "Edit", "btn-outline-primary"], ["run-billing-rule", "Generate bills", "btn-primary"], ["delete-billing-rule", "Delete", "btn-outline-danger"]].forEach(([actionName, label, className]) => {
                const button = document.createElement("button");
                button.type = "button"; button.className = `btn btn-sm ${className} me-2`;
                button.dataset.advancedAction = actionName; button.dataset.id = item.id; button.textContent = label;
                if (actionName === "edit-billing-rule") button.dataset.rule = JSON.stringify(item);
                action.appendChild(button);
            });
            return row;
        }));
    }

    function resetBillingRuleForm() {
        const form = document.getElementById("billingRuleForm"); if (!form) return;
        form.reset(); form.dataset.editingId = "";
        form.elements.name.value = "Monthly maintenance"; form.elements.amount.value = "2500"; form.elements.dueDay.value = "10"; form.elements.lateFee.value = "100";
        document.getElementById("saveBillingRule")?.classList.remove("d-none");
        const save = document.getElementById("saveBillingRule"); if (save) { save.dataset.advancedAction = "create-billing-rule"; save.innerHTML = '<i class="fa-solid fa-plus me-2"></i>Create Rule'; }
        document.getElementById("cancelBillingRuleEdit")?.classList.add("d-none");
        const state = document.getElementById("billingRuleState"); if (state) { state.textContent = "Ready to create"; state.className = "badge bg-primary-subtle text-primary-emphasis border border-primary-subtle px-3 py-2"; }
    }

    function editBillingRule(button) {
        const form = document.getElementById("billingRuleForm"); if (!form) return;
        const rule = JSON.parse(button.dataset.rule || "{}");
        form.dataset.editingId = rule.id || "";
        form.elements.name.value = rule.name || ""; form.elements.amount.value = rule.amount ?? ""; form.elements.dueDay.value = rule.dueDay ?? ""; form.elements.lateFee.value = rule.lateFee ?? "";
        form.elements.frequency.value = rule.frequency || "MONTHLY"; form.elements.nextRunDate.value = rule.nextRunDate || ""; form.elements.automatic.checked = Boolean(rule.automatic);
        const save = document.getElementById("saveBillingRule"); if (save) { save.dataset.advancedAction = "save-billing-rule"; save.innerHTML = '<i class="fa-solid fa-floppy-disk me-2"></i>Save Changes'; }
        document.getElementById("cancelBillingRuleEdit")?.classList.remove("d-none");
        const state = document.getElementById("billingRuleState"); if (state) { state.textContent = `Editing ${rule.name}`; state.className = "badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-3 py-2"; }
        form.scrollIntoView({behavior: "smooth", block: "center"}); form.elements.name.focus();
    }

    async function loadStaff() {
        const body = document.getElementById("staffBody");
        if (!body) return;
        const items = await request("/staff");
        if (!items.length) {
            body.innerHTML = '<tr><td colspan="7" class="text-muted text-center py-4">No domestic staff records yet. Register a verified worker above.</td></tr>';
            return;
        }
        body.replaceChildren(...items.map(item => {
            const row = document.createElement("tr");
            appendCell(row, item.name);
            appendCell(row, `${item.serviceType || "—"}${item.assignedArea ? ` · ${item.assignedArea}` : ""}`);
            appendCell(row, `${item.phone || "—"}${item.emergencyContact ? ` · Emergency: ${item.emergencyContact}` : ""}`);
            appendCell(row, `${item.workingDays || "Days not set"}${item.shiftStart || item.shiftEnd ? ` · ${item.shiftStart || "—"}–${item.shiftEnd || "—"}` : ""}`);
            appendCell(row, item.identityStatus, statusClass(item.identityStatus));
            appendCell(row, `${item.passCode || "—"} · ${item.blacklisted ? "Suspended" : "Active"}`, statusClass(item.blacklisted ? "BLACKLISTED" : "ACTIVE"));
            const action = appendCell(row, "");
            if (role === "admin") {
                [["edit-staff", "Edit", "btn-outline-primary"], ["toggle-blacklist", item.blacklisted ? "Restore access" : "Suspend access", item.blacklisted ? "btn-outline-success" : "btn-outline-danger"], ["delete-staff", "Remove", "btn-outline-secondary"]].forEach(([actionName, label, className]) => {
                    const button = document.createElement("button"); button.type = "button"; button.className = `btn btn-sm ${className} me-2`;
                    button.dataset.advancedAction = actionName; button.dataset.id = item.id; button.textContent = label;
                    if (actionName === "toggle-blacklist") button.dataset.value = String(!item.blacklisted);
                    if (actionName === "edit-staff") button.dataset.staff = JSON.stringify(item);
                    action.appendChild(button);
                });
            }
            return row;
        }));
    }

    function resetStaffForm() {
        const form = document.getElementById("staffForm"); if (!form) return;
        form.reset(); form.dataset.editingId = "";
        const save = document.getElementById("saveStaff"); if (save) { save.dataset.advancedAction = "create-staff"; save.innerHTML = '<i class="fa-solid fa-user-plus me-2"></i>Register Staff'; }
        document.getElementById("cancelStaffEdit")?.classList.add("d-none");
        const state = document.getElementById("staffRegistryState"); if (state) { state.textContent = "New staff record"; state.className = "badge bg-primary-subtle text-primary-emphasis border border-primary-subtle px-3 py-2"; }
    }

    function editStaff(button) {
        const form = document.getElementById("staffForm"); if (!form) return;
        const staffMember = JSON.parse(button.dataset.staff || "{}"); form.dataset.editingId = staffMember.id || "";
        ["name", "phone", "serviceType", "identityStatus", "assignedArea", "emergencyContact", "addressProof", "workingDays", "shiftStart", "shiftEnd", "notes"].forEach(field => { if (form.elements[field]) form.elements[field].value = staffMember[field] || ""; });
        const save = document.getElementById("saveStaff"); if (save) { save.dataset.advancedAction = "save-staff"; save.innerHTML = '<i class="fa-solid fa-floppy-disk me-2"></i>Save Staff Details'; }
        document.getElementById("cancelStaffEdit")?.classList.remove("d-none");
        const state = document.getElementById("staffRegistryState"); if (state) { state.textContent = `Editing ${staffMember.name}`; state.className = "badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-3 py-2"; }
        form.scrollIntoView({behavior: "smooth", block: "center"}); form.elements.name.focus();
    }

    async function loadDeliveries() {
        const body = document.getElementById("deliveriesBody");
        if (!body) return;
        const items = await request("/deliveries");
        if (!items.length) {
            body.innerHTML = '<tr><td colspan="7" class="text-muted text-center py-4">No deliveries recorded yet. Record the next courier arrival above.</td></tr>';
            return;
        }
        body.replaceChildren(...items.map(item => {
            const row = document.createElement("tr");
            appendCell(row, `${item.recipientName || "Resident"} · ${item.unitNo}`);
            appendCell(row, `${item.provider || "—"}${item.trackingNumber ? ` · ${item.trackingNumber}` : ""}${item.agentName ? ` · ${item.agentName}` : ""}`);
            appendCell(row, `${item.packageType || "—"}${item.packageCondition ? ` · ${item.packageCondition}` : ""}`);
            appendCell(row, `${item.storageLocation || "No storage location"}${item.deliveryNotes ? ` · ${item.deliveryNotes}` : ""}`);
            appendCell(row, `${dateTime(item.arrivedAt)}${item.collectedAt ? ` · Collected ${dateTime(item.collectedAt)}${item.collectedBy ? ` by ${item.collectedBy}` : ""}` : ""}`);
            appendCell(row, item.approvalStatus, statusClass(item.approvalStatus));
            const action = appendCell(row, "");
            if (role !== "resident") {
                [["edit-delivery", "Edit", "btn-outline-primary"], !item.collectedAt && ["collect-delivery", "Mark collected", "btn-success"], role === "admin" && ["delete-delivery", "Remove", "btn-outline-secondary"]].filter(Boolean).forEach(([actionName, label, className]) => {
                    const button = document.createElement("button"); button.type = "button"; button.className = `btn btn-sm ${className} me-2`;
                    button.dataset.advancedAction = actionName; button.dataset.id = item.id; button.textContent = label;
                    if (actionName === "edit-delivery") button.dataset.delivery = JSON.stringify(item);
                    action.appendChild(button);
                });
            }
            return row;
        }));
    }

    function resetDeliveryForm() {
        const form = document.getElementById("deliveryForm"); if (!form) return;
        form.reset(); form.dataset.editingId = "";
        const save = document.getElementById("saveDelivery"); if (save) { save.dataset.advancedAction = "create-delivery"; save.innerHTML = '<i class="fa-solid fa-box-open me-2"></i>Record Arrival'; }
        document.getElementById("cancelDeliveryEdit")?.classList.add("d-none");
        const state = document.getElementById("deliveryDeskState"); if (state) { state.textContent = "New arrival"; state.className = "badge bg-primary-subtle text-primary-emphasis border border-primary-subtle px-3 py-2"; }
    }

    function editDelivery(button) {
        const form = document.getElementById("deliveryForm"); if (!form) return;
        const delivery = JSON.parse(button.dataset.delivery || "{}"); form.dataset.editingId = delivery.id || "";
        ["unitNo", "provider", "trackingNumber", "agentName", "phone", "recipientName", "packageType", "packageCondition", "storageLocation", "photoReference", "deliveryNotes"].forEach(field => { if (form.elements[field]) form.elements[field].value = delivery[field] || ""; });
        const save = document.getElementById("saveDelivery"); if (save) { save.dataset.advancedAction = "save-delivery"; save.innerHTML = '<i class="fa-solid fa-floppy-disk me-2"></i>Save Delivery Details'; }
        document.getElementById("cancelDeliveryEdit")?.classList.remove("d-none");
        const state = document.getElementById("deliveryDeskState"); if (state) { state.textContent = `Editing ${delivery.provider || "delivery"}`; state.className = "badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-3 py-2"; }
        form.scrollIntoView({behavior: "smooth", block: "center"}); form.elements.unitNo.focus();
    }

    async function loadPolls() {
        const container = document.getElementById("pollsList");
        if (!container) return;
        const items = await request("/polls");
        if (!items.length) { container.innerHTML = '<div class="col-12 text-muted text-center py-4">No community polls published yet. Create a poll above to collect resident feedback.</div>'; return; }
        container.replaceChildren(...items.map(item => {
            const column = document.createElement("div"); column.className = "col-12";
            const card = document.createElement("article"); card.className = "card p-4 shadow-sm border-0 rounded-4";
            const heading = document.createElement("h3");
            heading.textContent = item.question;
            const details = document.createElement("p"); details.className = "text-muted mb-2";
            details.textContent = item.description || "No additional context was supplied.";
            const meta = document.createElement("div"); meta.className = "d-flex flex-wrap gap-2 mb-3";
            [item.category || "General", item.audience || "Residents", item.anonymous ? "Anonymous vote" : "Named vote", item.closed ? "Closed" : `Closes ${dateTime(item.closesAt)}`, `${item.totalVotes || 0} vote${item.totalVotes === 1 ? "" : "s"}`].forEach((value, index) => { const badge = document.createElement("span"); badge.className = `badge ${index === 3 && item.closed ? "text-bg-secondary" : "bg-primary-subtle text-primary-emphasis"}`; badge.textContent = value; meta.appendChild(badge); });
            card.append(heading, details, meta);
            const total = Number(item.totalVotes || 0);
            item.options.forEach((option, index) => {
                const line = document.createElement("div"); line.className = "mb-2";
                const count = item.counts?.[index] || 0;
                if (role === "resident") {
                    const button = document.createElement("button");
                    button.type = "button"; button.className = `btn btn-sm ${item.selectedOption === index ? "btn-primary" : "btn-outline-primary"} me-2`;
                    button.dataset.advancedAction = "vote";
                    button.dataset.id = item.id;
                    button.dataset.option = index;
                    button.disabled = Boolean(item.closed);
                    button.textContent = `${item.selectedOption === index ? "✓ " : ""}${option}`;
                    line.appendChild(button);
                }
                if (role !== "resident" || item.resultsVisible) {
                    const percentage = total ? Math.round((count / total) * 100) : 0;
                    const result = document.createElement("span"); result.className = "small text-muted"; result.textContent = `${count} vote${count === 1 ? "" : "s"} · ${percentage}%`;
                    line.appendChild(result);
                }
                card.appendChild(line);
            });
            if (role === "admin") {
                const actions = document.createElement("div"); actions.className = "mt-3 d-flex gap-2";
                if (!item.closed) { const close = document.createElement("button"); close.type = "button"; close.className = "btn btn-sm btn-outline-danger"; close.dataset.advancedAction = "close-poll"; close.dataset.id = item.id; close.textContent = "Close poll"; actions.appendChild(close); }
                const remove = document.createElement("button"); remove.type = "button"; remove.className = "btn btn-sm btn-outline-secondary"; remove.dataset.advancedAction = "delete-poll"; remove.dataset.id = item.id; remove.textContent = "Remove"; actions.appendChild(remove); card.appendChild(actions);
            }
            column.appendChild(card); return column;
        }));
    }

    async function loadAssets() {
        const body = document.getElementById("assetsBody");
        if (!body) return;
        const items = await request("/assets");
        if (!items.length) {
            body.innerHTML = '<tr><td colspan="6" class="text-muted text-center py-4">No assets registered yet. Add equipment above to start tracking warranty and preventive service.</td></tr>';
            return;
        }
        body.replaceChildren(...items.map(item => {
            const row = document.createElement("tr");
            appendCell(row, `${item.name}${item.serialNumber ? ` · ${item.serialNumber}` : ""}${item.category ? ` · ${item.category}` : ""}`);
            appendCell(row, `${item.location || "—"} · ${(item.assetCondition || "GOOD").replaceAll("_", " ")}`, statusClass(item.assetCondition === "OUT_OF_SERVICE" ? "EXPIRED" : item.assetCondition === "NEEDS_ATTENTION" ? "PENDING" : "ACTIVE"));
            appendCell(row, `${item.vendorName || "No vendor"}${item.vendorPhone ? ` · ${item.vendorPhone}` : ""}${item.amcProvider ? ` · AMC: ${item.amcProvider}` : ""}${item.amcUntil ? ` until ${date(item.amcUntil)}` : ""}`);
            appendCell(row, item.warrantyUntil ? date(item.warrantyUntil) : "No warranty recorded", statusClass(item.warrantyUntil && new Date(`${item.warrantyUntil}T00:00:00`) < new Date() ? "EXPIRED" : "ACTIVE"));
            appendCell(row, `${item.lastServiceDate ? `Last: ${date(item.lastServiceDate)}` : "No service recorded"}${item.nextServiceDate ? ` · Next: ${date(item.nextServiceDate)}` : ""}${item.serviceIntervalDays ? ` · Every ${item.serviceIntervalDays} days` : ""}`);
            const action = appendCell(row, "");
            [["edit-asset", "Edit", "btn-outline-primary"], ["service-asset", "Service completed", "btn-success"], role === "admin" && ["delete-asset", "Remove", "btn-outline-secondary"]].filter(Boolean).forEach(([actionName, label, className]) => {
                const button = document.createElement("button"); button.type = "button"; button.className = `btn btn-sm ${className} me-2 mb-1`;
                button.dataset.advancedAction = actionName; button.dataset.id = item.id; button.textContent = label;
                if (actionName === "edit-asset") button.dataset.asset = JSON.stringify(item);
                if (actionName === "service-asset") button.dataset.interval = item.serviceIntervalDays || 90;
                action.appendChild(button);
            });
            return row;
        }));
    }

    function resetAssetForm() {
        const form = document.getElementById("assetForm"); if (!form) return;
        form.reset(); form.dataset.editingId = "";
        const save = document.getElementById("saveAsset"); if (save) { save.dataset.advancedAction = "create-asset"; save.innerHTML = '<i class="fa-solid fa-plus me-2"></i>Add Asset'; }
        document.getElementById("cancelAssetEdit")?.classList.add("d-none");
        const state = document.getElementById("assetRegistryState"); if (state) { state.textContent = "New asset record"; state.className = "badge bg-primary-subtle text-primary-emphasis border border-primary-subtle px-3 py-2"; }
    }

    function editAsset(button) {
        const form = document.getElementById("assetForm"); if (!form) return;
        const asset = JSON.parse(button.dataset.asset || "{}"); form.dataset.editingId = asset.id || "";
        ["name", "category", "location", "serialNumber", "purchasedOn", "purchaseCost", "warrantyUntil", "nextServiceDate", "vendorId", "vendorName", "vendorPhone", "amcProvider", "amcUntil", "lastServiceDate", "serviceIntervalDays", "assetCondition", "notes"].forEach(field => { if (form.elements[field]) form.elements[field].value = asset[field] ?? ""; });
        const save = document.getElementById("saveAsset"); if (save) { save.dataset.advancedAction = "save-asset"; save.innerHTML = '<i class="fa-solid fa-floppy-disk me-2"></i>Save Asset Details'; }
        document.getElementById("cancelAssetEdit")?.classList.remove("d-none");
        const state = document.getElementById("assetRegistryState"); if (state) { state.textContent = `Editing ${asset.name}`; state.className = "badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-3 py-2"; }
        form.scrollIntoView({behavior: "smooth", block: "center"}); form.elements.name.focus();
    }

    async function refresh() {
        const loaders = [loadBillingRules, loadStaff, loadDeliveries, loadPolls, loadAssets];
        const results = await Promise.allSettled(loaders.map(load => load()));
        results.filter(result => result.status === "rejected").forEach(result => console.warn("Advanced module unavailable", result.reason));
        document.documentElement.dataset.advancedBackendConnected = "true";
    }

    async function submitAction(button) {
        const action = button.dataset.advancedAction;
        const form = button.closest("form");
        if (form && !form.reportValidity()) return;
        button.disabled = true;
        try {
            if (action === "create-billing-rule" || action === "save-billing-rule") {
                const values = formPayload(form);
                const payload = {...values, amount: Number(values.amount), dueDay: Number(values.dueDay), lateFee: Number(values.lateFee), nextRunDate: values.nextRunDate || null, automatic: form.elements.automatic.checked};
                const editingId = form.dataset.editingId;
                await request(editingId ? `/billing-rules/${editingId}` : "/billing-rules", {method: editingId ? "PATCH" : "POST", body: JSON.stringify(payload)});
                notify(editingId ? "Recurring charge rule updated." : "Recurring charge rule created.");
                resetBillingRuleForm();
                await loadBillingRules();
            } else if (action === "edit-billing-rule") {
                editBillingRule(button);
            } else if (action === "delete-billing-rule") {
                if (!window.confirm("Delete this recurring charge rule? Existing bills will not be removed.")) return;
                await request(`/billing-rules/${button.dataset.id}`, {method: "DELETE"});
                notify("Recurring charge rule deleted.");
                await loadBillingRules();
            } else if (action === "run-billing-rule") {
                const result = await request(`/billing-rules/${button.dataset.id}/run`, {method: "POST"});
                notify(`${result.created} bill(s) generated for ${result.month}.`);
                await loadBillingRules();
            } else if (action === "create-staff" || action === "save-staff") {
                const editingId = form.dataset.editingId;
                await request(editingId ? `/staff/${editingId}` : "/staff", {method: editingId ? "PATCH" : "POST", body: JSON.stringify(formPayload(form))});
                notify(editingId ? "Domestic staff details updated." : "Domestic staff member registered.");
                resetStaffForm();
                await loadStaff();
            } else if (action === "edit-staff") {
                editStaff(button);
            } else if (action === "toggle-blacklist") {
                await request(`/staff/${button.dataset.id}/blacklist?value=${button.dataset.value}`, {method: "PATCH"});
                notify("Staff access status updated.");
                await loadStaff();
            } else if (action === "delete-staff") {
                if (!window.confirm("Remove this domestic staff record? This cannot be undone.")) return;
                await request(`/staff/${button.dataset.id}`, {method: "DELETE"});
                notify("Domestic staff record removed.");
                await loadStaff();
            } else if (action === "create-delivery" || action === "save-delivery") {
                const editingId = form.dataset.editingId;
                await request(editingId ? `/deliveries/${editingId}` : "/deliveries", {method: editingId ? "PATCH" : "POST", body: JSON.stringify(formPayload(form))});
                notify(editingId ? "Delivery details updated." : "Delivery arrival recorded.");
                resetDeliveryForm();
                await loadDeliveries();
            } else if (action === "edit-delivery") {
                editDelivery(button);
            } else if (action === "collect-delivery") {
                await request(`/deliveries/${button.dataset.id}/collect`, {method: "PATCH"});
                notify("Delivery marked as collected.");
                await loadDeliveries();
            } else if (action === "delete-delivery") {
                if (!window.confirm("Remove this delivery record? This cannot be undone.")) return;
                await request(`/deliveries/${button.dataset.id}`, {method: "DELETE"});
                notify("Delivery record removed.");
                await loadDeliveries();
            } else if (action === "create-poll") {
                const values = formPayload(form);
                const options = values.options.split(",").map(value => value.trim()).filter(Boolean);
                if (options.length < 2) throw new Error("Enter at least two poll options.");
                await request("/polls", {method: "POST", body: JSON.stringify({question: values.question, options, closesAt: values.closesAt, anonymous: form.elements.anonymous.checked, description: values.description || "", category: values.category || "General", audience: values.audience || "RESIDENTS", resultsVisible: form.elements.resultsVisible.checked})});
                form.reset();
                setPollDefault();
                notify("Community poll published.");
                await loadPolls();
            } else if (action === "close-poll") {
                if (!window.confirm("Close this poll now? Residents will no longer be able to vote.")) return;
                await request(`/polls/${button.dataset.id}/close`, {method: "PATCH"});
                notify("Community poll closed.");
                await loadPolls();
            } else if (action === "delete-poll") {
                if (!window.confirm("Remove this community poll and its results?")) return;
                await request(`/polls/${button.dataset.id}`, {method: "DELETE"});
                notify("Community poll removed.");
                await loadPolls();
            } else if (action === "vote") {
                await request(`/polls/${button.dataset.id}/vote?option=${button.dataset.option}`, {method: "POST"});
                notify("Your vote was recorded.");
                await loadPolls();
            } else if (action === "create-asset" || action === "save-asset") {
                const values = formPayload(form);
                const editingId = form.dataset.editingId;
                const dates = ["purchasedOn", "warrantyUntil", "nextServiceDate", "amcUntil", "lastServiceDate"];
                const payload = {...values, purchaseCost: values.purchaseCost ? Number(values.purchaseCost) : null, vendorId: values.vendorId ? Number(values.vendorId) : null, serviceIntervalDays: values.serviceIntervalDays ? Number(values.serviceIntervalDays) : null};
                dates.forEach(field => payload[field] = values[field] || null);
                await request(editingId ? `/assets/${editingId}` : "/assets", {method: editingId ? "PATCH" : "POST", body: JSON.stringify(payload)});
                resetAssetForm();
                notify(editingId ? "Asset details updated." : "Society asset added.");
                await loadAssets();
            } else if (action === "edit-asset") {
                editAsset(button);
            } else if (action === "service-asset") {
                const next = new Date();
                const interval = Number(button.dataset.interval || 90);
                next.setDate(next.getDate() + interval);
                await request(`/assets/${button.dataset.id}/service?nextDate=${next.toISOString().slice(0, 10)}`, {method: "PATCH"});
                notify(`Service completed; next service scheduled in ${interval} days.`);
                await loadAssets();
            } else if (action === "delete-asset") {
                if (!window.confirm("Remove this asset from the maintenance register?")) return;
                await request(`/assets/${button.dataset.id}`, {method: "DELETE"});
                notify("Asset removed.");
                await loadAssets();
            }
        } catch (error) {
            notify(error.message);
        } finally {
            button.disabled = false;
        }
    }

    function setPollDefault() {
        const resultsVisible = document.querySelector('#pollForm [name="resultsVisible"]');
        if (resultsVisible) resultsVisible.checked = true;
        const input = document.querySelector('#pollForm [name="closesAt"]');
        if (!input || input.value) return;
        const closes = new Date(Date.now() + 7 * 86400000);
        closes.setMinutes(closes.getMinutes() - closes.getTimezoneOffset());
        input.value = closes.toISOString().slice(0, 16);
    }

    document.addEventListener("click", event => {
        const button = event.target.closest("[data-advanced-action]");
        if (!button) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        submitAction(button);
    }, true);
    document.getElementById("cancelBillingRuleEdit")?.addEventListener("click", resetBillingRuleForm);
    document.getElementById("cancelStaffEdit")?.addEventListener("click", resetStaffForm);
    document.getElementById("cancelDeliveryEdit")?.addEventListener("click", resetDeliveryForm);
    document.getElementById("cancelAssetEdit")?.addEventListener("click", resetAssetForm);
    document.addEventListener("submit", event => {
        const button = event.submitter?.closest("[data-advanced-action]");
        if (!button) return;
        event.preventDefault();
    }, true);
    document.addEventListener("DOMContentLoaded", () => {
        setPollDefault();
        refresh();
    });
})();
