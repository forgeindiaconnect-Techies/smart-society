const titles = {
    overview: "Overview",
    societies: "Society Management",
    subscriptions: "Subscriptions",
    users: "Users",
    analytics: "Analytics",
    settings: "Settings",
    flats: "Blocks and Flats",
    residents: "Residents",
    billing: "Maintenance Billing",
    visitors: "Visitor Management",
    complaints: "Complaints",
    amenities: "Amenities",
    announcements: "Announcements",
    expenses: "Expenses",
    payments: "Payments",
    reports: "Reports",
    profile: "Profile",
    pass: "Visitor Pass",
    entries: "Gate Entries",
    tasks: "Maintenance Tasks"
};

const toast = document.getElementById("toast");
const dashboardRole = document.body.dataset.dashboardRole || "admin";
const dashboardStorageKey = `smartsociety-dashboard-state:v11:${dashboardRole}`;
const residentProfileStorageKey = "smartsociety-resident-profile:v1";
const rolePanelRoutes = {
    superadmin: ["societies", "subscriptions", "users", "analytics"],
    admin: ["billing", "visitors", "complaints", "reports"],
    resident: ["billing", "pass", "complaints", "amenities"],
    security: ["entries", "pass", "visitors", "entries"],
    maintenance: ["tasks", "complaints", "tasks", "profile"]
};
let activeAction = null;

function dashboardContentRoot() {
    return document.querySelector(".main");
}

function persistDashboardState() {
    const root = dashboardContentRoot();
    if (!root) return;
    localStorage.setItem(dashboardStorageKey, root.innerHTML);
}

function restoreDashboardState() {
    const root = dashboardContentRoot();
    const saved = localStorage.getItem(dashboardStorageKey);
    if (root && saved) root.innerHTML = saved;
}

function profileInputs() {
    return [...document.querySelectorAll('[data-view="profile"] [data-profile-field]')];
}

function saveResidentProfileState() {
    if (dashboardRole !== "resident") return null;
    const fields = profileInputs();
    if (!fields.length) return null;
    const profile = fields.reduce((data, field) => {
        data[field.dataset.profileField] = field.value.trim();
        return data;
    }, {});
    localStorage.setItem(residentProfileStorageKey, JSON.stringify(profile));
    return profile;
}

function restoreResidentProfileState() {
    if (dashboardRole !== "resident") return;
    try {
        const saved = JSON.parse(localStorage.getItem(residentProfileStorageKey) || "{}");
        profileInputs().forEach(field => {
            const value = saved[field.dataset.profileField];
            if (value) field.value = value;
        });
    } catch {
        localStorage.removeItem(residentProfileStorageKey);
    }
}

function wireAutosave() {
    document.addEventListener("input", event => {
        if (event.target.matches("[data-profile-field]")) saveResidentProfileState();
        if (event.target.closest(".main")) persistDashboardState();
    });
    document.addEventListener("change", event => {
        if (event.target.matches("[data-profile-field]")) saveResidentProfileState();
        if (event.target.closest(".main")) persistDashboardState();
    });
}

function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove("hidden");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.add("hidden"), 4200);
}

function buttonLabel(button) {
    return button?.textContent?.trim() || "";
}

function escapeAttribute(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function currentMonthName() {
    return new Date().toLocaleString("en-IN", { month: "long", year: "numeric" });
}

function readNearbyFields(button) {
    const scope = button?.closest?.(".card, .header, [data-view]") || document;
    return [...scope.querySelectorAll("input, select, textarea")]
        .map(field => {
            const label = field.closest("label")?.childNodes?.[0]?.textContent?.trim();
            const name = label || field.getAttribute("name") || field.placeholder || "Field";
            return `${name}: ${field.value || field.textContent || ""}`.trim();
        })
        .filter(value => !value.endsWith(":"));
}

function downloadText(filename, text) {
    const blob = new Blob([text], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}

function getContext(button) {
    const panel = button.closest("[data-view]")?.dataset.view || "overview";
    const panelTitle = titles[panel] || panel;
    const row = button.closest("tr");
    if (row) {
        const cells = [...row.children].map(cell => cell.textContent.trim()).filter(Boolean);
        return {
            panel,
            panelTitle,
            target: cells.slice(0, Math.min(3, cells.length - 1 || cells.length)).join(" / "),
            detail: cells.join(" | ")
        };
    }
    const card = button.closest(".card");
    if (card) {
        const heading = card.querySelector("h2, h3")?.textContent.trim();
        const copy = card.querySelector("p")?.textContent.trim();
        return { panel, panelTitle, target: heading || button.textContent.trim(), detail: copy || panelTitle };
    }
    const text = button.textContent.trim();
    return { panel, panelTitle, target: text || panelTitle, detail: panelTitle };
}

function showActionReceipt({ title, lines }) {
    const modal = ensureActionModal();
    modal.querySelector("#dashboardActionTitle").textContent = title;
    modal.querySelector("#dashboardActionText").innerHTML = lines.map(line => {
        const clean = String(line).replace(/^<strong>|<\/strong>/g, "");
        const [label, ...rest] = clean.split(":");
        return `<span class="receipt-line"><strong>${label.trim()}:</strong><span>${rest.join(":").trim()}</span></span>`;
    }).join("");
    modal.querySelector("#dashboardActionFields").innerHTML = "";
    const save = modal.querySelector("#dashboardActionSave");
    save.textContent = "Done";
    save.onclick = closeActionModal;
    modal.classList.remove("hidden");
}

function openPanel(panel, updateHistory = true) {
    const selectedView = document.querySelector(`[data-view="${panel}"]`);
    if (!selectedView) return;
    document.querySelectorAll("[data-panel]").forEach(button => {
        const active = button.dataset.panel === panel;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll("[data-view]").forEach(view => {
        view.classList.toggle("hidden", view !== selectedView);
    });
    const title = document.getElementById("title");
    if (title) title.textContent = titles[panel] || "Dashboard";
    if (updateHistory && location.hash !== `#${panel}`) history.pushState(null, "", `#${panel}`);
    selectedView.focus({ preventScroll: true });
}

function animateStats() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    document.querySelectorAll(".stats strong").forEach(stat => {
        const match = stat.textContent.trim().match(/^(\d+)(.*)$/);
        if (!match) return;
        const target = Number(match[1]);
        const suffix = match[2];
        const started = performance.now();
        const tick = now => {
            const progress = Math.min((now - started) / 650, 1);
            stat.textContent = `${Math.round(target * (1 - Math.pow(1 - progress, 3)))}${suffix}`;
            if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    });
}

function addRow(tableName, cells) {
    const tbody = document.querySelector(`[data-table="${tableName}"] tbody`);
    if (!tbody) return;
    const row = document.createElement("tr");
    const columnCount = tbody.querySelector("tr")?.children.length || cells.length;
    row.innerHTML = Array.from({ length: columnCount }, (_, index) => `<td>${cells[index] || "Created"}</td>`).join("");
    tbody.appendChild(row);
}

function setStatus(button, text, cls) {
    const status = button.closest("tr")?.querySelector(".status");
    if (!status) return;
    status.textContent = text;
    status.className = `status ${cls}`;
}

function updateRowAction(button, text, action, disabled = false) {
    if (!button?.matches?.("button")) return;
    button.textContent = text;
    button.dataset.action = action;
    button.disabled = disabled;
}

function setInlineState(id, text) {
    const node = document.getElementById(id);
    if (node) node.textContent = text;
}

function appendDashboardActivity(message) {
    const log = document.getElementById("platformActivityLog") || document.getElementById("societyActivityLog");
    if (!log) return;
    const stamp = new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    const entry = document.createElement("li");
    entry.innerHTML = `<strong>${stamp}</strong><span>${escapeAttribute(message)}</span>`;
    const list = log.querySelector("ul");
    if (!list) return;
    list.prepend(entry);
    [...list.children].slice(5).forEach(item => item.remove());
}

function appendPlatformActivity(message) {
    if (dashboardRole !== "superadmin") return;
    appendDashboardActivity(message);
}

function rowValues(button) {
    const row = button.closest("tr");
    if (!row) return [];
    return [...row.children].slice(0, -1).map(cell => cell.textContent.trim());
}

function updateRowFromValues(button, values) {
    const row = button.closest("tr");
    if (!row) return false;
    const cells = [...row.children];
    const editableCount = Math.max(cells.length - 2, 0);
    for (let index = 0; index < editableCount; index += 1) {
        if (values[index]) cells[index].textContent = values[index];
    }
    const statusValue = values[editableCount];
    if (statusValue && cells[editableCount]) {
        cells[editableCount].innerHTML = `<span class="status ${statusClass(statusValue)}">${statusValue}</span>`;
    }
    return true;
}

function updateVisitorStats(button) {
    const view = button.closest('[data-view="visitors"]');
    if (!view) return;
    const statuses = [...view.querySelectorAll("tbody .status")].map(status => status.textContent.trim().toLowerCase());
    const statValues = view.querySelectorAll(".compact-stats strong");
    if (statValues[0]) statValues[0].textContent = String(statuses.filter(status => status.includes("waiting")).length);
    if (statValues[1]) statValues[1].textContent = String(statuses.filter(status => status.includes("inside")).length);
    if (statValues[2]) statValues[2].textContent = String(statuses.filter(status => status.includes("checked out")).length);
}

function moneyNumber(value) {
    return Number(String(value || "").replace(/[^\d]/g, "")) || 0;
}

function formatRs(value) {
    return `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;
}

function updateBillingStats(scope = document) {
    const view = scope.closest?.('[data-view="billing"]') || document.querySelector('[data-view="billing"]');
    if (!view) return;
    const rows = [...view.querySelectorAll('[data-table="billing"] tbody tr')];
    const totals = rows.reduce((sum, row) => {
        const amount = moneyNumber(row.children[2]?.textContent);
        const status = row.querySelector(".status")?.textContent.toLowerCase() || "";
        sum.total += amount;
        if (status.includes("paid")) sum.collected += amount;
        else sum.pending += amount;
        return sum;
    }, { total: 0, collected: 0, pending: 0 });
    const statValues = view.querySelectorAll(".billing-stats strong");
    if (statValues[0]) statValues[0].textContent = formatRs(totals.total);
    if (statValues[1]) statValues[1].textContent = formatRs(totals.collected);
    if (statValues[2]) statValues[2].textContent = formatRs(totals.pending);
}

function statusClass(value) {
    const text = String(value).toLowerCase();
    if (text.includes("paid")) return "paid";
    if (text.includes("occup") || text.includes("active") || text.includes("live")) return "active";
    if (text.includes("approve")) return "approved";
    if (text.includes("closed") || text.includes("resolve")) return "resolved";
    if (text.includes("progress") || text.includes("inside")) return "progress";
    if (text.includes("open")) return "open";
    return "pending";
}

function ensureActionModal() {
    let modal = document.getElementById("dashboardActionModal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "dashboardActionModal";
    modal.className = "modal hidden";
    modal.innerHTML = `
        <div class="modal-card dashboard-action-card">
            <button class="close" type="button" data-modal-close aria-label="Close">×</button>
            <h2 id="dashboardActionTitle">Complete action</h2>
            <p id="dashboardActionText"></p>
            <div class="form-grid" id="dashboardActionFields"></div>
            <button class="primary full" type="button" id="dashboardActionSave">Confirm</button>
        </div>`;
    document.body.appendChild(modal);
    modal.querySelector("[data-modal-close]").addEventListener("click", closeActionModal);
    modal.addEventListener("click", event => {
        if (event.target === modal) closeActionModal();
    });
    modal.querySelector("#dashboardActionSave").addEventListener("click", submitActionModal);
    return modal;
}

function actionConfig(action, button) {
    const panel = button.closest("[data-view]")?.dataset.view || "overview";
    const context = getContext(button);
    const table = button.dataset.table;
    const label = buttonLabel(button).toLowerCase();
    if (action === "save" && label.includes("sync")) {
        return ["Sync Society Data", "Confirm syncing residents, billing, visitors and complaint records for this society.", ["Sync note"]];
    }
    if (action === "save" && panel === "profile") {
        return ["Save Profile", "Confirm and permanently save your resident profile details on this browser.", []];
    }
    if (action === "save" && label.includes("edit")) {
        const table = button.closest("table")?.dataset.table || "";
        const editFields = {
            flats: ["Flat", "Owner", "Occupancy", "Status"],
            residents: ["Name", "Flat", "Role", "Status"],
            billing: ["Flat / Month", "Type", "Amount", "Status"],
            visitors: ["Visitor", "Flat", "Purpose", "Expected Time", "Status"],
            complaints: ["Issue", "Flat / Category", "Team", "Status"],
            expenses: ["Expense", "Vendor", "Amount", "Status"]
        };
        return ["Edit Record", `Update details for ${context.target}.`, editFields[table] || ["Name / title", "Details", "Status"]];
    }
    if (action === "save") {
        return ["Save Changes", `Save the latest details in ${titles[panel] || panel}.`, []];
    }
    if (action === "notify" && dashboardRole === "superadmin" && !button.closest("tr") && !label.includes("export")) {
        return ["Send Platform Notice", "Send a clear platform-wide notice to selected users and record it in the activity log.", ["Audience", "Subject", "Message"]];
    }
    if (action === "notify" && label.includes("receipt")) {
        return ["Download Receipt", `Generate a receipt for ${context.target}.`, ["Receipt note"]];
    }
    if (action === "receipt") {
        return ["Download Receipt", `Generate a billing receipt for ${context.target}.`, ["Receipt note"]];
    }
    if (action === "notify" && label.includes("export")) {
        return ["Export Report", `Export the visible ${titles[panel] || panel} report.`, ["Report period"]];
    }
    if (action === "notify" && label.includes("publish")) {
        return ["Publish Announcement", "Send this announcement to residents and staff.", ["Audience", "Publish note"]];
    }
    if (action === "notify" && label.includes("contact")) {
        return ["Contact Admin", "Send a clear message to the society admin team.", ["Message"]];
    }
    if (action === "add" && table === "entries") {
        return ["New gate entry", "Record an approved visitor, delivery or service staff entry.", ["Visitor name", "Mobile number", "Flat / unit", "Purpose", "Approved by"]];
    }
    if (action === "add" && table === "visitors") {
        return ["Add Visitor", "Create a visitor record for society access tracking.", ["Visitor name", "Flat / unit", "Purpose", "Expected time"]];
    }
    if (action === "add" && table === "passes") {
        return ["Create visitor pass", "Create a pre-approved pass for the gate desk.", ["Visitor name", "Flat / unit", "Valid date", "Purpose"]];
    }
    if (action === "add" && table === "societies") {
        return ["Add Society", "Register a society tenant with city, plan and onboarding status.", ["Society name", "City", "Plan", "Admin email"]];
    }
    if (action === "add" && table === "users") {
        return ["Create Platform User", "Create an account, assign a role, and connect the user to the right society.", ["Full name", "Role", "Society", "Email / phone"]];
    }
    if (action === "add" && table === "flats") {
        return ["Add Flat", "Create a flat record with owner and occupancy status.", ["Flat number", "Owner name", "Occupancy", "Status"]];
    }
    if (action === "add" && table === "residents") {
        return ["Invite Resident", "Invite a resident and connect them to a flat.", ["Resident name", "Flat / unit", "Owner or tenant", "Mobile / email"]];
    }
    if (action === "add" && table === "complaints") {
        return ["Create Complaint", "Create a complaint ticket and assign the right category.", ["Issue", "Flat / unit", "Team / category"]];
    }
    if (action === "add" && table === "expenses") {
        return ["Add Expense", "Record an expense for approval.", ["Expense title", "Vendor", "Amount"]];
    }
    if (action === "update-plan") {
        const plan = button.dataset.plan || context.target || "Selected plan";
        return [`Update ${plan} Plan`, "Enter the revised subscription limits and rollout note before applying this plan update.", ["Flat limit", "Monthly price", "Enabled modules", "Update note"]];
    }
    const configs = {
        add: ["Add record", `Create a new item in ${titles[panel] || panel}.`, ["Name / title", "Details"]],
        save: ["Save changes", `Confirm updates for ${titles[panel] || panel}.`, []],
        notify: ["Send Notification", `Write a message for: ${context.target}.`, ["Message"]],
        generate: ["Generate Monthly Bills", "Create maintenance bills for all active flats using the selected month and amount.", ["Billing month", "Default amount"]],
        pay: ["Confirm payment", "Record this payment as completed.", ["Reference number"]],
        book: ["Confirm booking", `Reserve ${button.closest(".card")?.querySelector("h3")?.textContent || button.textContent.trim()}.`, ["Date", "Time"]],
        approve: ["Approve item", `Confirm approval for ${context.target}.`, ["Approval note"]],
        suspend: ["Suspend society", "Provide a reason before suspending access.", ["Reason"]],
        assign: ["Assign complaint", "Choose the team responsible for this request.", ["Team"]],
        checkin: ["Visitor check-in", "Confirm visitor entry details.", ["Gate note"]],
        checkout: ["Visitor check-out", "Confirm that the visitor has left.", ["Exit note"]],
        complete: ["Complete task", "Add a completion note for this task.", ["Completion note"]],
        close: ["Close complaint", "Add the resolution used to close this complaint.", ["Resolution"]],
        inspect: ["Category details", `Review details for ${button.textContent.trim()}.`, []]
    };
    return configs[action] || ["Complete action", `Confirm ${button.textContent.trim()} in ${titles[panel] || panel}.`, []];
}

function openActionModal(action, button) {
    const modal = ensureActionModal();
    const [title, text, fields] = actionConfig(action, button);
    const existingValues = action === "save" && buttonLabel(button).toLowerCase().includes("edit") ? rowValues(button) : [];
    activeAction = { action, button };
    modal.querySelector("#dashboardActionTitle").textContent = title;
    modal.querySelector("#dashboardActionText").textContent = text;
    modal.querySelector("#dashboardActionFields").innerHTML = fields
        .map((field, index) => actionInputMarkup(action, field, index, existingValues[index]))
        .join("");
    const save = modal.querySelector("#dashboardActionSave");
    save.textContent = "Confirm";
    save.onclick = null;
    modal.classList.remove("hidden");
    modal.querySelector("[data-action-input]")?.focus();
}

function actionInputMarkup(action, field, index, value = "") {
    if (action === "generate" && index === 0) {
        return `<label>${field}<input data-action-input="${index}" placeholder="${currentMonthName()}" value="${escapeAttribute(currentMonthName())}"></label>`;
    }
    if (action === "generate" && index === 1) {
        return `<label>${field}<input data-action-input="${index}" inputmode="numeric" placeholder="2500" value="2500"></label>`;
    }
    return `<label>${field}<input data-action-input="${index}" placeholder="${field}" value="${escapeAttribute(value)}"></label>`;
}

function closeActionModal() {
    document.getElementById("dashboardActionModal")?.classList.add("hidden");
    activeAction = null;
}

function performAction(action, button, values = []) {
    const context = getContext(button);
    const now = new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    const fieldValues = values.filter(Boolean);
    const nearbyValues = action === "save" || buttonLabel(button).toLowerCase().includes("publish") ? readNearbyFields(button) : [];
    const note = [...fieldValues, ...nearbyValues].filter(Boolean).join(" | ");
    const label = buttonLabel(button).toLowerCase();
    const messages = {
        approve: `Approved ${context.target}`,
        suspend: `Suspended ${context.target}`,
        add: `Added new record in ${context.panelTitle}`,
        "update-plan": `Updated ${button.dataset.plan || context.target} plan`,
        save: label.includes("sync") ? `Synced ${context.panelTitle}` : `Saved ${context.panelTitle}`,
        generate: `Generated monthly bills for ${context.panelTitle}`,
        pay: `Payment marked paid for ${context.target}`,
        close: `Closed ${context.target}`,
        assign: `Assigned ${context.target}`,
        notify: label.includes("receipt") ? `Receipt generated for ${context.target}` : label.includes("export") ? `Report exported from ${context.panelTitle}` : label.includes("publish") ? `Announcement published from ${context.panelTitle}` : `Notification sent to ${context.target}`,
        checkin: `Checked in ${context.target}`,
        checkout: `Checked out ${context.target}`,
        complete: `Completed ${context.target}`,
        book: `Booking confirmed for ${context.target}`
    };

    if (action === "approve") {
        const panel = button.closest("[data-view]")?.dataset.view;
        if (panel === "flats") {
            setStatus(button, "Occupied", "active");
            updateRowAction(button, "Edit", "save");
        } else if (panel === "residents") {
            setStatus(button, "Active", "active");
            updateRowAction(button, "Notify", "notify");
        } else if (panel === "expenses") {
            setStatus(button, "Approved", "approved");
            updateRowAction(button, "Approved", "approve", true);
        } else if (panel === "amenities") {
            const card = button.closest(".card");
            const status = card?.querySelector(".status");
            if (status) {
                status.textContent = "Approved";
                status.className = "status approved";
            }
            updateRowAction(button, "Approved", "approve", true);
        } else {
            setStatus(button, "Active", "active");
            updateRowAction(button, panel === "users" ? "Notify" : "Suspend", panel === "users" ? "notify" : "suspend");
        }
    }
    if (action === "suspend") {
        setStatus(button, "Suspended", "pending");
        updateRowAction(button, "Approve", "approve");
    }
    if (action === "close") setStatus(button, "Closed", "resolved");
    if (action === "complete") setStatus(button, "Completed", "resolved");
    if (action === "close") updateRowAction(button, "Closed", "close", true);
    if (action === "complete") updateRowAction(button, "Completed", "complete", true);
    if (action === "assign") {
        setStatus(button, "Assigned", "progress");
        updateRowAction(button, "Assigned", "assign", true);
    }
    if (action === "pay") {
        setStatus(button, "Paid", "paid");
        button.textContent = "Receipt";
        button.dataset.action = "receipt";
        updateBillingStats(button);
    }
    if (action === "receipt") {
        downloadText("smartsociety-billing-receipt.txt", `SmartSociety Billing Receipt\n${context.detail}\nGenerated: ${now}`);
    }
    if (action === "save" && label.includes("edit")) {
        updateRowFromValues(button, values);
    }
    if (action === "notify" && label.includes("receipt")) {
        downloadText("smartsociety-receipt.txt", `SmartSociety Receipt\n${context.detail}\nGenerated: ${now}`);
    }
    if (action === "notify" && label.includes("export")) {
        downloadText("smartsociety-report.txt", `SmartSociety Report\nSection: ${context.panelTitle}\nTarget: ${context.target}\nGenerated: ${now}`);
    }
    if (action === "notify" && label.includes("publish")) {
        setInlineState("announcementState", `Published ${now}${note ? ` · ${note}` : ""}`);
    }
    if (action === "save" && label.includes("sync")) {
        setInlineState("societySyncState", `Synced ${now}${note ? ` · ${note}` : ""}`);
    }
    if (action === "save" && context.panel === "profile") {
        const profile = saveResidentProfileState();
        const name = profile?.name || context.target;
        setInlineState("residentProfileState", `Saved ${now} · ${name}`);
    }
    if (action === "book") {
        updateRowAction(button, "Booked", "book", true);
        const card = button.closest(".card");
        const status = card?.querySelector(".status");
        if (status) {
            status.textContent = "Booked";
            status.className = "status approved";
        }
    }
    if (action === "checkin") {
        setStatus(button, "Inside", "progress");
        button.textContent = "Check Out";
        button.dataset.action = "checkout";
        updateVisitorStats(button);
    }
    if (action === "checkout") {
        setStatus(button, "Checked Out", "resolved");
        button.textContent = "Done";
        button.disabled = true;
        updateVisitorStats(button);
    }
    if (action === "update-plan") {
        const card = button.closest(".subscription-plan-card, .card");
        const status = card?.querySelector(".status");
        if (status) {
            status.textContent = "Updated";
            status.className = "status approved";
        }
        updateRowAction(button, "Plan Updated", "update-plan");
        appendPlatformActivity(`Subscription plan updated: ${button.dataset.plan || context.target}${note ? ` (${note})` : ""}`);
    }
    if (action === "notify" && button.matches("button") && button.closest("tr")) updateRowAction(button, "Notified", "notify");
    if (action === "notify" && dashboardRole === "superadmin") {
        appendPlatformActivity(`Notice sent to ${fieldValues[0] || context.target}${fieldValues[1] ? `: ${fieldValues[1]}` : ""}`);
        setInlineState("platformNoticeState", `Last notice sent ${now}`);
    }
    if (action === "add") {
        const table = button.dataset.table;
        const rows = {
            societies: [values[0] || "New Society", values[1] || "Chennai", values[2] || "Standard", "<span class='status pending'>Pending</span>", "<button data-action='approve'>Approve</button>"],
            users: [values[0] || "New User", values[1] || "Resident", values[2] || "Green Nest", "<span class='status pending'>Invited</span>", "<button data-action='approve'>Activate</button>"],
            flats: [values[0] || "D-401", values[1] || "New Owner", values[2] || "Vacant", `<span class='status pending'>${values[3] || "Setup"}</span>`, "<button data-action='approve'>Activate</button>"],
            residents: [values[0] || "New Resident", values[1] || "D-401", values[2] || "Tenant", "<span class='status pending'>Invited</span>", "<button data-action='approve'>Approve</button>"],
            visitors: [values[0] || "New Visitor", values[1] || "D-401", values[2] || "Guest", values[3] || "Today", "<span class='status pending'>Waiting</span>", "<button data-action='checkin'>Check In</button>"],
            complaints: [values[0] || "New Complaint", values[1] || "D-401", values[2] || "Maintenance", "<span class='status open'>Open</span>", "<button data-action='assign'>Assign</button> <button data-action='close'>Close</button>"],
            expenses: [values[0] || "New Expense", values[1] || "Vendor", values[2] || "Rs. 5,000", "<span class='status pending'>Pending</span>", "<button data-action='approve'>Approve</button>"],
            passes: [values[0] || "Visitor", values[1] || "D-401", values[2] || "Today", values[3] || "Guest", "<span class='status approved'>Approved</span>"],
            entries: [values[0] || "New Visitor", values[1] || "99999 00000", values[2] || "D-401", values[3] || "Guest", values[4] || "Resident", "<span class='status pending'>Waiting</span>", "<button data-action='checkin'>Check In</button>"],
            tasks: ["New Task", "Common Area", "Medium", "<span class='status pending'>Pending</span>", "<button data-action='complete'>Complete</button>"]
        };
        addRow(table, rows[table] || ["New Item", "Created", "<span class='status pending'>Pending</span>", "<button data-action='approve'>Approve</button>"]);
        if (table === "visitors") updateVisitorStats(button);
        if (dashboardRole === "superadmin") {
            appendPlatformActivity(`${table === "societies" ? "Society registered" : table === "users" ? "User created" : "Record added"}: ${values[0] || "New item"}`);
        }
        if (dashboardRole === "admin") {
            appendDashboardActivity(`${table === "flats" ? "Flat added" : table === "residents" ? "Resident invited" : table === "visitors" ? "Visitor added" : table === "complaints" ? "Complaint ticket created" : table === "expenses" ? "Expense added" : "Record added"}: ${values[0] || "New item"}`);
        }
    }
    if (action === "generate") {
        const month = values[0] || "Current Month";
        const amount = values[1] ? formatRs(moneyNumber(values[1])) : "Rs. 2,500";
        addRow("billing", ["A-305", month, amount, "<span class='status pending'>Unpaid</span>", "<button data-action='pay'>Mark Paid</button>"]);
        updateBillingStats(button);
    }
    const summary = messages[action] || `Completed ${context.target}`;
    if (action === "save" && dashboardRole === "superadmin") {
        setInlineState("settingsSavedAt", `Saved ${now}${note ? ` · ${note}` : ""}`);
        appendPlatformActivity(`Platform settings saved${note ? ` (${note})` : ""}`);
    }
    if ((action === "approve" || action === "suspend") && dashboardRole === "superadmin") {
        appendPlatformActivity(summary);
    }
    if (dashboardRole === "admin" && ["save", "notify", "generate", "pay", "receipt", "book", "approve", "assign", "close", "checkin", "checkout"].includes(action)) {
        appendDashboardActivity(`${summary}${note ? ` (${note})` : ""}`);
    }
    persistDashboardState();
    showToast(`✓ ${summary}`);
    return {
        title: "Action completed",
        lines: [
            `<strong>Result:</strong> ${summary}`,
            `<strong>Section:</strong> ${context.panelTitle}`,
            `<strong>Target:</strong> ${context.target}`,
            note ? `<strong>Details:</strong> ${note}` : "<strong>Details:</strong> No additional note entered",
            `<strong>Time:</strong> ${now}`
        ]
    };
}

function submitActionModal() {
    if (!activeAction) return;
    const modal = ensureActionModal();
    const values = [...modal.querySelectorAll("[data-action-input]")].map(input => input.value.trim());
    const receipt = performAction(activeAction.action, activeAction.button, values);
    activeAction = null;
    showActionReceipt(receipt);
}

function enhanceDashboardCategories() {
    document.querySelectorAll("[data-panel]").forEach(button => {
        button.setAttribute("aria-controls", `panel-${button.dataset.panel}`);
        button.setAttribute("aria-selected", String(button.classList.contains("active")));
    });
    document.querySelectorAll("[data-view]").forEach(view => {
        view.id = `panel-${view.dataset.view}`;
        view.tabIndex = -1;
    });

    const routes = rolePanelRoutes[dashboardRole] || [];
    document.querySelectorAll('[data-view="overview"] .stats article').forEach((tile, index) => {
        const target = routes[index];
        if (!target || !document.querySelector(`[data-view="${target}"]`)) return;
        tile.dataset.categoryPanel = target;
        tile.tabIndex = 0;
        tile.setAttribute("role", "button");
        tile.setAttribute("aria-label", `Open ${titles[target] || target}`);
    });

    document.querySelectorAll(".pill-row span").forEach(chip => {
        chip.dataset.categoryAction = dashboardRole === "resident" ? "book" : "notify";
        chip.tabIndex = 0;
        chip.setAttribute("role", "button");
        chip.setAttribute("aria-label", `Open action for ${chip.textContent.trim()}`);
    });

    document.querySelectorAll('[data-view="overview"] .grid .card').forEach(card => {
        card.dataset.categoryAction = "inspect";
        card.tabIndex = 0;
        card.setAttribute("role", "button");
        card.setAttribute("aria-label", `Review ${card.querySelector("h3")?.textContent.trim() || "overview card"}`);
    });

    document.querySelectorAll('[data-view]:not([data-view="overview"]) .stats article').forEach(tile => {
        tile.dataset.categoryAction = "inspect";
        tile.tabIndex = 0;
        tile.setAttribute("role", "button");
    });
}

document.querySelectorAll("[data-panel]").forEach(button => {
    button.addEventListener("click", () => openPanel(button.dataset.panel));
});

document.addEventListener("click", event => {
    const panelTile = event.target.closest("[data-category-panel]");
    if (panelTile) {
        openPanel(panelTile.dataset.categoryPanel);
        return;
    }
    const categoryAction = event.target.closest("[data-category-action]");
    if (categoryAction) {
        openActionModal(categoryAction.dataset.categoryAction, categoryAction);
        return;
    }
    const button = event.target.closest("[data-action]");
    if (!button) return;
    event.preventDefault();
    openActionModal(button.dataset.action, button);
});

document.addEventListener("keydown", event => {
    const control = event.target.closest("[data-category-panel], [data-category-action]");
    if (control && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        control.click();
    }
    if (event.key === "Escape") closeActionModal();
});

window.addEventListener("hashchange", () => {
    const panel = location.hash.replace("#", "");
    if (panel) openPanel(panel, false);
});

restoreDashboardState();
restoreResidentProfileState();
enhanceDashboardCategories();
wireAutosave();
const initialPanel = location.hash.replace("#", "");
openPanel(document.querySelector(`[data-view="${initialPanel}"]`) ? initialPanel : "overview", false);
animateStats();
