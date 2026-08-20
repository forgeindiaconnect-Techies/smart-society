const titles = {
    overview: "Overview",
    monitoring: "Apartment Monitoring",
    control: "Approval Control Center",
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
const dashboardStorageKey = `smartsociety-dashboard-state:v12:${dashboardRole}`;
const residentProfileStorageKey = "smartsociety-resident-profile:v1";
const residentAdminInboxKey = "smartsociety-resident-admin-inbox:v1";
const residentPaymentProofsKey = "smartsociety-resident-payment-proofs:v1";
const rolePanelRoutes = {
    superadmin: ["monitoring", "societies", "subscriptions", "analytics"],
    admin: ["control", "billing", "visitors", "complaints"],
    resident: ["billing", "complaints", "amenities", "announcements"],
    security: ["entries", "pass", "visitors", "entries"],
    maintenance: ["tasks", "complaints", "tasks", "profile"]
};
let activeAction = null;
let activePaymentProof = null;

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

function ensureSecurityVisitorTable() {
    if (dashboardRole !== "security") return null;
    const table = document.querySelector('[data-view="visitors"] table');
    if (!table) return null;
    table.dataset.table = "visitors";
    const heading = document.querySelector('[data-view="visitors"] h2');
    if (heading && heading.textContent.trim() === "Current Visitors Inside") {
        heading.textContent = "Visitor Queue";
    }
    return table.querySelector("tbody");
}

function findVisitorRow(visitor, flat) {
    const tbody = ensureSecurityVisitorTable();
    if (!tbody) return null;
    const normalizedVisitor = String(visitor || "").trim().toLowerCase();
    const normalizedFlat = String(flat || "").trim().toLowerCase();
    return [...tbody.querySelectorAll("tr")].find(row => {
        const cells = row.children;
        return cells[0]?.textContent.trim().toLowerCase() === normalizedVisitor
            && cells[2]?.textContent.trim().toLowerCase() === normalizedFlat;
    }) || null;
}

function upsertExpectedVisitorFromPass({ visitor, flat, validUntil }) {
    const tbody = ensureSecurityVisitorTable();
    if (!tbody || !visitor) return;
    const row = findVisitorRow(visitor, flat);
    const expectedTime = validUntil || "Pass approved";
    if (row) {
        const status = row.querySelector(".status");
        const action = row.querySelector("button");
        if (!status || !status.textContent.trim().toLowerCase().includes("inside")) {
            if (row.children[3]) row.children[3].textContent = expectedTime;
            if (row.children[4]) row.children[4].innerHTML = "<span class='status pending'>Expected</span>";
            if (row.children[5]) row.children[5].innerHTML = "<button data-action='checkin'>Check In</button>";
        } else if (action) {
            action.dataset.action = "checkout";
            action.textContent = "Check Out";
        }
        return;
    }
    const newRow = document.createElement("tr");
    newRow.innerHTML = `
        <td>${escapeAttribute(visitor)}</td>
        <td>-</td>
        <td>${escapeAttribute(flat || "D-401")}</td>
        <td>${escapeAttribute(expectedTime)}</td>
        <td><span class="status pending">Expected</span></td>
        <td><button data-action="checkin">Check In</button></td>`;
    tbody.appendChild(newRow);
}

function syncApprovedPassesToVisitors() {
    if (dashboardRole !== "security") return;
    ensureSecurityVisitorTable();
    document.querySelectorAll('[data-table="passes"] tbody tr').forEach(row => {
        const cells = row.children;
        const status = cells[4]?.textContent.trim().toLowerCase() || "";
        if (!status.includes("approved")) return;
        upsertExpectedVisitorFromPass({
            visitor: cells[0]?.textContent.trim(),
            flat: cells[1]?.textContent.trim(),
            validUntil: cells[2]?.textContent.trim()
        });
    });
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

function openSubscriptionSubtab(name) {
    const panel = document.querySelector('[data-view="subscriptions"]');
    if (!panel) return;
    panel.querySelectorAll("[data-subtab]").forEach(button => {
        const active = button.dataset.subtab === name;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", String(active));
    });
    panel.querySelectorAll("[data-subpanel]").forEach(section => {
        section.classList.toggle("hidden", section.dataset.subpanel !== name);
    });
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

function residentInboxItems() {
    try {
        return JSON.parse(localStorage.getItem(residentAdminInboxKey) || "[]");
    } catch {
        localStorage.removeItem(residentAdminInboxKey);
        return [];
    }
}

function pushResidentInboxItem(item) {
    const items = residentInboxItems();
    items.unshift({
        id: `resident-${Date.now()}`,
        resident: "Kavya N",
        flat: "A-101",
        createdAt: new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" }),
        status: "Pending Admin Review",
        ...item
    });
    localStorage.setItem(residentAdminInboxKey, JSON.stringify(items.slice(0, 25)));
}

function residentPaymentProofs() {
    try {
        return JSON.parse(localStorage.getItem(residentPaymentProofsKey) || "[]");
    } catch {
        localStorage.removeItem(residentPaymentProofsKey);
        return [];
    }
}

function writeResidentPaymentProofs(items) {
    localStorage.setItem(residentPaymentProofsKey, JSON.stringify(items.slice(0, 80)));
}

function paymentProofKey(proof) {
    return `${proof.flat || "A-101"}|${proof.month || ""}|${proof.type || ""}`.toLowerCase();
}

function upsertResidentPaymentProof(proof) {
    const key = paymentProofKey(proof);
    const items = residentPaymentProofs().filter(item => paymentProofKey(item) !== key);
    writeResidentPaymentProofs([proof, ...items]);
}

function latestResidentPaymentProof(flat = "A-101", month = "June", type = "Maintenance") {
    const key = paymentProofKey({ flat, month, type });
    return residentPaymentProofs().find(item => paymentProofKey(item) === key);
}

function readFileAsDataUrl(file) {
    if (!file) return Promise.resolve("");
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => resolve("");
        reader.readAsDataURL(file);
    });
}

function renderResidentInboxForAdmins() {
    if (!["admin", "superadmin"].includes(dashboardRole)) return;
    const anchor = document.querySelector('[data-view="overview"] .activity-log')
        || document.querySelector('[data-view="monitoring"] .card')
        || document.querySelector('[data-view="overview"]');
    if (!anchor || document.getElementById("residentAdminInbox")) return;
    const items = residentInboxItems();
    const card = document.createElement("div");
    card.className = "card resident-inbox-card";
    card.id = "residentAdminInbox";
    card.innerHTML = `
        <div class="card-head">
            <h2>Resident Requests & Proofs</h2>
            <span class="inline-state">${items.length} item${items.length === 1 ? "" : "s"}</span>
        </div>
        <table>
            <thead><tr><th>Type</th><th>Resident</th><th>Details</th><th>Status</th></tr></thead>
            <tbody>${items.length ? items.map(item => `
                <tr>
                    <td>${escapeAttribute(item.type || "Request")}</td>
                    <td>${escapeAttribute(item.resident || "Resident")}<br><small>${escapeAttribute(item.flat || "")}</small></td>
                    <td><strong>${escapeAttribute(item.title || item.method || "Resident update")}</strong><br><small>${escapeAttribute(item.details || item.proof || item.createdAt || "")}</small></td>
                    <td><span class="status pending">${escapeAttribute(item.status || "Pending")}</span></td>
                </tr>`).join("") : '<tr><td colspan="4">No resident submissions yet</td></tr>'}</tbody>
        </table>`;
    anchor.insertAdjacentElement("afterend", card);
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

function adminBillingRows() {
    return [
        { flat: "A-101", resident: "Kavya N", type: "Maintenance", defaultStatus: "Unpaid" },
        { flat: "B-204", resident: "Meena Rao", type: "Maintenance", defaultStatus: "Unpaid" },
        { flat: "C-303", resident: "Vijay P", type: "Maintenance", defaultStatus: "Unpaid" },
        { flat: "D-401", resident: "Arun Kumar", type: "Maintenance", defaultStatus: "Unpaid" }
    ];
}

function billingRowData(row) {
    if (!row) return {};
    const cells = [...row.children].map(cell => cell.textContent.trim());
    return {
        flat: row.dataset.flat || cells[0] || "Flat",
        resident: row.dataset.resident || residentNameForFlat(cells[0]) || "Resident",
        month: row.dataset.month || cells[1] || currentMonthName(),
        type: row.dataset.type || "Maintenance",
        amount: row.dataset.amount || cells[2] || "Rs. 0",
        status: row.querySelector(".status")?.textContent.trim() || row.dataset.status || cells[3] || "Pending",
        paidAt: row.dataset.paidAt || "",
        paymentMethod: row.dataset.paymentMethod || "",
        paymentRef: row.dataset.paymentRef || "",
        proof: row.dataset.proof || ""
    };
}

function residentNameForFlat(flat) {
    const map = {
        "A-101": "Kavya N",
        "B-204": "Meena Rao",
        "C-303": "Vijay P",
        "D-401": "Arun Kumar",
        "A-305": "Resident A-305"
    };
    return map[flat] || "";
}

function applyBillingRowMetadata(row, data = {}) {
    if (!row) return;
    const merged = { ...billingRowData(row), ...data };
    row.dataset.flat = merged.flat;
    row.dataset.resident = merged.resident || residentNameForFlat(merged.flat);
    row.dataset.month = merged.month;
    row.dataset.type = merged.type || "Maintenance";
    row.dataset.amount = merged.amount;
    row.dataset.status = merged.status;
    if (merged.paidAt) row.dataset.paidAt = merged.paidAt;
    else delete row.dataset.paidAt;
    if (merged.paymentMethod) row.dataset.paymentMethod = merged.paymentMethod;
    else delete row.dataset.paymentMethod;
    if (merged.paymentRef) row.dataset.paymentRef = merged.paymentRef;
    else delete row.dataset.paymentRef;
    if (merged.proof) row.dataset.proof = merged.proof;
    else delete row.dataset.proof;
}

function ensureAdminBillingMetadata() {
    if (dashboardRole !== "admin") return;
    document.querySelectorAll('[data-table="billing"] tbody tr').forEach(row => {
        const data = billingRowData(row);
        applyBillingRowMetadata(row, {
            resident: data.resident || residentNameForFlat(data.flat),
            type: data.type || "Maintenance",
            paymentMethod: data.status.toLowerCase().includes("paid") ? (data.paymentMethod || "Recorded payment") : data.paymentMethod,
            paymentRef: data.status.toLowerCase().includes("paid") ? (data.paymentRef || `SS-${data.flat}-${data.month}`.replace(/\s+/g, "-")) : data.paymentRef,
            paidAt: data.status.toLowerCase().includes("paid") ? (data.paidAt || new Date().toLocaleDateString("en-IN")) : data.paidAt
        });
    });
}

function billingReceiptText(row) {
    const data = billingRowData(row);
    const receiptNo = `SS-${data.flat}-${data.month}-${data.paymentRef || "REC"}`.replace(/\s+/g, "-").toUpperCase();
    return [
        "SmartSociety Maintenance Receipt",
        `Receipt No: ${receiptNo}`,
        `Society: Green Nest Apartments`,
        `Flat: ${data.flat}`,
        `Resident: ${data.resident}`,
        `Bill Month: ${data.month}`,
        `Bill Type: ${data.type}`,
        `Amount Paid: ${data.amount}`,
        `Payment Status: ${data.status}`,
        `Payment Method: ${data.paymentMethod || "Not recorded"}`,
        `Payment Reference: ${data.paymentRef || "Not recorded"}`,
        `Payment Proof: ${data.proof || "Not attached"}`,
        `Paid / Recorded On: ${data.paidAt || "Not recorded"}`,
        `Generated: ${new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`
    ].join("\n");
}

function showBillingReceipt(row) {
    const data = billingRowData(row);
    if (!data.status.toLowerCase().includes("paid")) {
        showToast("Receipt is available only after payment is marked paid");
        return {
            title: "Receipt unavailable",
            lines: [
                `<strong>Flat:</strong> ${data.flat}`,
                `<strong>Resident:</strong> ${data.resident}`,
                `<strong>Month:</strong> ${data.month}`,
                `<strong>Status:</strong> ${data.status}`
            ]
        };
    }
    const text = billingReceiptText(row);
    downloadText(`SmartSociety-${data.flat}-${data.month}-receipt.txt`.replace(/\s+/g, "-"), text);
    return {
        title: "Billing receipt",
        lines: [
            `<strong>Flat:</strong> ${data.flat}`,
            `<strong>Resident:</strong> ${data.resident}`,
            `<strong>Month:</strong> ${data.month}`,
            `<strong>Amount:</strong> ${data.amount}`,
            `<strong>Method:</strong> ${data.paymentMethod || "Recorded payment"}`,
            `<strong>Reference:</strong> ${data.paymentRef || "Not recorded"}`,
            `<strong>Proof:</strong> ${data.proof || "Not attached"}`,
            `<strong>Paid on:</strong> ${data.paidAt || "Not recorded"}`
        ]
    };
}

function findAdminBillingRow(flat, month, type = "Maintenance") {
    return [...document.querySelectorAll('[data-table="billing"] tbody tr')].find(row => {
        const data = billingRowData(row);
        return String(data.flat).toLowerCase() === String(flat).toLowerCase()
            && String(data.month).toLowerCase() === String(month).toLowerCase()
            && String(data.type || "Maintenance").toLowerCase() === String(type || "Maintenance").toLowerCase();
    });
}

function applyProofDecisionToResidentBill(proof) {
    if (dashboardRole !== "resident") return;
    const row = [...document.querySelectorAll('[data-table="billing"] tbody tr')].find(item => {
        const data = billDetailsFromButton(item.querySelector("[data-action]") || item);
        return String(data.month).toLowerCase() === String(proof.month).toLowerCase()
            && String(data.type).toLowerCase() === String(proof.type).toLowerCase();
    });
    if (!row) return;
    const status = row.querySelector(".status");
    const action = row.querySelector("[data-action]");
    if (!status || !action) return;
    if (proof.status === "Approved") {
        status.textContent = "Paid";
        status.className = "status paid";
        action.textContent = "Receipt";
        action.dataset.action = "receipt";
        action.disabled = false;
    } else if (proof.status === "Rejected") {
        status.textContent = "Unpaid";
        status.className = "status pending";
        action.textContent = "Pay Now";
        action.dataset.action = "pay";
        action.disabled = false;
    } else if (proof.status === "Pending Review") {
        status.textContent = "Pending Review";
        status.className = "status pending";
        action.textContent = "Awaiting Admin";
        action.dataset.action = "pay";
        action.disabled = true;
    }
}

function syncResidentBillingFromProofs() {
    if (dashboardRole !== "resident") return;
    document.querySelectorAll('[data-table="billing"] tbody tr').forEach(row => {
        const action = row.querySelector("[data-action]");
        if (!action) return;
        const bill = billDetailsFromButton(action);
        const proof = latestResidentPaymentProof("A-101", bill.month, bill.type);
        if (proof) {
            applyProofDecisionToResidentBill(proof);
            return;
        }
        const status = row.querySelector(".status");
        if (status?.textContent.trim().toLowerCase().includes("paid")) {
            status.textContent = "Unpaid";
            status.className = "status pending";
            action.textContent = "Pay Now";
            action.dataset.action = "pay";
            action.disabled = false;
        }
    });
}

function renderPaymentProofReviewForAdmins() {
    if (dashboardRole !== "admin") return;
    const billingCard = document.querySelector('[data-view="billing"] .card');
    if (!billingCard || document.getElementById("paymentProofReviewQueue")) return;
    const proofs = residentPaymentProofs();
    billingCard.insertAdjacentHTML("beforeend", `
        <div class="card-head payment-proof-head">
            <h2>Payment Proof Review</h2>
            <span class="inline-state">${proofs.length} proof${proofs.length === 1 ? "" : "s"}</span>
        </div>
        <table id="paymentProofReviewQueue" data-table="payment-proofs">
            <thead><tr><th>Resident</th><th>Bill</th><th>Screenshot</th><th>Status</th><th>Admin Review</th></tr></thead>
            <tbody>${proofs.length ? proofs.map(proof => `
                <tr data-proof-id="${escapeAttribute(proof.id)}">
                    <td>${escapeAttribute(proof.resident || "Resident")}<br><small>${escapeAttribute(proof.flat || "")}</small></td>
                    <td>${escapeAttribute(proof.month || "")} ${escapeAttribute(proof.type || "")}<br><small>${escapeAttribute(proof.amount || "")} | ${escapeAttribute(proof.method || "")}</small></td>
                    <td>${proof.proofImage ? `<a href="${proof.proofImage}" target="_blank" rel="noopener"><img src="${proof.proofImage}" alt="Payment screenshot" style="width:72px;height:72px;object-fit:cover;border-radius:8px;border:1px solid rgba(49,127,196,.25);"></a>` : escapeAttribute(proof.proofName || "No screenshot")}<br><small>${escapeAttribute(proof.proofName || "")}</small></td>
                    <td><span class="status ${proof.status === "Approved" ? "paid" : proof.status === "Rejected" ? "open" : "pending"}">${escapeAttribute(proof.status || "Pending Review")}</span><br><small>${escapeAttribute(proof.submittedAt || "")}</small></td>
                    <td><button data-action="approve-payment-proof">Approve Payment</button> <button data-action="reject-payment-proof">Reject Proof</button></td>
                </tr>`).join("") : '<tr><td colspan="5">No resident payment proofs yet</td></tr>'}</tbody>
        </table>
    `);
}

function syncAdminBillingFromPaymentProofs() {
    if (dashboardRole !== "admin") return;
    const a101Row = findAdminBillingRow("A-101", "June", "Maintenance");
    const a101Action = a101Row?.querySelector("[data-action]");
    const a101Proof = latestResidentPaymentProof("A-101", "June", "Maintenance");
    if (a101Row && a101Action && !a101Proof && billingRowData(a101Row).status.toLowerCase().includes("paid")) {
        setStatus(a101Action, "Unpaid", "pending");
        a101Action.textContent = "Mark Paid";
        a101Action.dataset.action = "pay";
        a101Action.disabled = false;
        applyBillingRowMetadata(a101Row, { ...billingRowData(a101Row), status: "Unpaid", paidAt: "", paymentMethod: "", paymentRef: "", proof: "" });
    }
    residentPaymentProofs().forEach(proof => {
        const row = findAdminBillingRow(proof.flat, proof.month, proof.type);
        const action = row?.querySelector("[data-action]");
        if (!row || !action) return;
        if (proof.status === "Approved") {
            setStatus(action, "Paid", "paid");
            action.textContent = "Receipt";
            action.dataset.action = "receipt";
            action.disabled = false;
            applyBillingRowMetadata(row, {
                ...billingRowData(row),
                status: "Paid",
                paidAt: proof.reviewedAt || proof.submittedAt,
                paymentMethod: proof.method,
                paymentRef: proof.paymentRef,
                proof: proof.proofName
            });
        } else if (proof.status === "Rejected") {
            setStatus(action, "Unpaid", "pending");
            action.textContent = "Mark Paid";
            action.dataset.action = "pay";
            action.disabled = false;
            applyBillingRowMetadata(row, { ...billingRowData(row), status: "Unpaid" });
        } else {
            setStatus(action, "Pending Review", "pending");
            action.textContent = "Review Proof";
            action.dataset.action = "pay";
            action.disabled = true;
            applyBillingRowMetadata(row, { ...billingRowData(row), status: "Pending Review", proof: proof.proofName });
        }
        updateBillingStats(action);
    });
}

function updatePaymentProofStatus(id, status, adminNote = "") {
    const items = residentPaymentProofs();
    const proof = items.find(item => item.id === id);
    if (!proof) return null;
    proof.status = status;
    proof.adminNote = adminNote;
    proof.reviewedAt = new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    writeResidentPaymentProofs(items);
    return proof;
}

function handlePaymentProofReview(action, button, values = []) {
    const row = button.closest("[data-proof-id]");
    const proofId = row?.dataset.proofId;
    if (!proofId) return null;
    const approved = action === "approve-payment-proof";
    const proof = updatePaymentProofStatus(proofId, approved ? "Approved" : "Rejected", values[0] || "");
    if (!proof) return null;
    const status = row.querySelector(".status");
    if (status) {
        status.textContent = proof.status;
        status.className = `status ${approved ? "paid" : "open"}`;
    }
    const billingRow = findAdminBillingRow(proof.flat, proof.month, proof.type);
    const billAction = billingRow?.querySelector("[data-action]");
    if (billingRow && billAction) {
        if (approved) {
            setStatus(billAction, "Paid", "paid");
            billAction.textContent = "Receipt";
            billAction.dataset.action = "receipt";
            billAction.disabled = false;
            applyBillingRowMetadata(billingRow, {
                ...billingRowData(billingRow),
                status: "Paid",
                paidAt: proof.reviewedAt,
                paymentMethod: proof.method,
                paymentRef: proof.paymentRef,
                proof: proof.proofName
            });
            updateBillingStats(billAction);
        } else {
            setStatus(billAction, "Unpaid", "pending");
            billAction.textContent = "Mark Paid";
            billAction.dataset.action = "pay";
            billAction.disabled = false;
            applyBillingRowMetadata(billingRow, { ...billingRowData(billingRow), status: "Unpaid", proof: proof.proofName });
            updateBillingStats(billAction);
        }
    }
    row.querySelectorAll("button").forEach(actionButton => {
        actionButton.disabled = true;
        actionButton.textContent = approved ? "Approved" : "Rejected";
    });
    persistDashboardState();
    appendDashboardActivity(`${proof.status} payment proof for ${proof.flat} ${proof.month}`);
    return {
        title: approved ? "Payment approved" : "Payment proof rejected",
        lines: [
            `<strong>Flat:</strong> ${proof.flat}`,
            `<strong>Resident:</strong> ${proof.resident}`,
            `<strong>Bill:</strong> ${proof.month} ${proof.type}`,
            `<strong>Amount:</strong> ${proof.amount}`,
            `<strong>Proof:</strong> ${proof.proofName}`,
            `<strong>Status:</strong> ${proof.status}`,
            `<strong>Note:</strong> ${proof.adminNote || "No note"}`
        ]
    };
}

function generateMonthlyBillingRows({ month, amount, dueDate, note }) {
    const tbody = document.querySelector('[data-table="billing"] tbody');
    if (!tbody) return { created: 0, skipped: 0 };
    let created = 0;
    let skipped = 0;
    adminBillingRows().forEach(item => {
        const existing = [...tbody.querySelectorAll("tr")].find(row => {
            const data = billingRowData(row);
            return data.flat === item.flat && data.month === month;
        });
        if (existing) {
            skipped += 1;
            return;
        }
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${escapeAttribute(item.flat)}</td>
            <td>${escapeAttribute(month)}</td>
            <td>${escapeAttribute(amount)}</td>
            <td><span class="status pending">Unpaid</span></td>
            <td><button data-action="pay">Mark Paid</button></td>`;
        applyBillingRowMetadata(row, {
            flat: item.flat,
            resident: item.resident,
            type: item.type,
            month,
            amount,
            status: "Unpaid",
            paidAt: "",
            paymentMethod: "",
            paymentRef: "",
            proof: note ? `Due ${dueDate || "not set"} - ${note}` : `Due ${dueDate || "not set"}`
        });
        tbody.appendChild(row);
        created += 1;
    });
    updateBillingStats(tbody);
    return { created, skipped };
}

function controlQueueRowData(button) {
    const row = button?.closest?.('[data-view="control"] table tbody tr');
    if (!row) return null;
    const cells = row.children;
    return {
        row,
        request: cells[0]?.textContent.trim() || "Request",
        module: cells[1]?.textContent.trim() || "Module",
        detail: cells[2]?.textContent.trim() || "",
        status: row.querySelector(".status")?.textContent.trim() || cells[3]?.textContent.trim() || ""
    };
}

function setControlQueueStatus(button, status, cls, actionText, action = button?.dataset.action, disabled = true) {
    setStatus(button, status, cls);
    updateRowAction(button, actionText, action, disabled);
}

function findTableRow(tableName, predicate) {
    const tbody = document.querySelector(`[data-table="${tableName}"] tbody`);
    if (!tbody) return null;
    return [...tbody.querySelectorAll("tr")].find(predicate) || null;
}

function updateResidentQueueRecord({ name, flat, role, status }) {
    const tbody = document.querySelector('[data-table="residents"] tbody');
    if (!tbody) return;
    let row = findTableRow("residents", item =>
        item.children[0]?.textContent.trim().toLowerCase() === name.toLowerCase()
        || item.children[1]?.textContent.trim().toLowerCase() === flat.toLowerCase()
    );
    if (!row) {
        row = document.createElement("tr");
        row.innerHTML = `
            <td>${escapeAttribute(name)}</td>
            <td>${escapeAttribute(flat)}</td>
            <td>${escapeAttribute(role)}</td>
            <td><span class="status ${statusClass(status)}">${escapeAttribute(status)}</span></td>
            <td><button data-action="notify">Notify</button></td>`;
        tbody.appendChild(row);
        return;
    }
    row.children[0].textContent = name;
    row.children[1].textContent = flat;
    row.children[2].textContent = role;
    row.children[3].innerHTML = `<span class="status ${statusClass(status)}">${escapeAttribute(status)}</span>`;
    row.children[4].innerHTML = '<button data-action="notify">Notify</button>';
}

function updateComplaintQueueRecord({ issue, flat, team, status }) {
    const row = findTableRow("complaints", item =>
        item.children[0]?.textContent.trim().toLowerCase().includes(issue.toLowerCase())
        && item.children[1]?.textContent.trim().toLowerCase() === flat.toLowerCase()
    );
    if (!row) {
        addRow("complaints", [
            issue,
            flat,
            team,
            `<span class='status ${statusClass(status)}'>${escapeAttribute(status)}</span>`,
            "<button data-action='close'>Close</button>"
        ]);
        return;
    }
    row.children[2].textContent = team;
    row.children[3].innerHTML = `<span class="status ${statusClass(status)}">${escapeAttribute(status)}</span>`;
    row.children[4].innerHTML = '<button data-action="close">Close</button>';
}

function updateExpenseQueueRecord({ expense, vendor, amount, status }) {
    const row = findTableRow("expenses", item =>
        item.children[0]?.textContent.trim().toLowerCase().includes(expense.toLowerCase())
    );
    if (!row) {
        addRow("expenses", [
            expense,
            vendor,
            amount,
            `<span class='status ${statusClass(status)}'>${escapeAttribute(status)}</span>`,
            "<button data-action='approve' disabled>Approved</button>"
        ]);
        return;
    }
    row.children[1].textContent = vendor;
    row.children[2].textContent = amount;
    row.children[3].innerHTML = `<span class="status ${statusClass(status)}">${escapeAttribute(status)}</span>`;
    row.children[4].innerHTML = '<button data-action="approve" disabled>Approved</button>';
}

function updateAmenityQueueRecord({ amenity, status, note }) {
    const card = [...document.querySelectorAll('[data-view="amenities"] .card')].find(item =>
        item.querySelector("h3")?.textContent.trim().toLowerCase() === amenity.toLowerCase()
    );
    if (!card) return;
    const badge = card.querySelector(".status");
    if (badge) {
        badge.textContent = status;
        badge.className = `status ${statusClass(status)}`;
    }
    const copy = card.querySelector("p");
    if (copy) copy.textContent = note;
    const button = card.querySelector("button");
    updateRowAction(button, status, "approve", true);
}

function findOrCreateBillingRowForFlat(flat, month, amount) {
    const tbody = document.querySelector('[data-table="billing"] tbody');
    if (!tbody) return null;
    let row = findTableRow("billing", item => {
        const data = billingRowData(item);
        return data.flat === flat && data.month === month;
    });
    if (row) return row;
    row = document.createElement("tr");
    row.innerHTML = `
        <td>${escapeAttribute(flat)}</td>
        <td>${escapeAttribute(month)}</td>
        <td>${escapeAttribute(amount)}</td>
        <td><span class="status pending">Unpaid</span></td>
        <td><button data-action="pay">Mark Paid</button></td>`;
    tbody.appendChild(row);
    applyBillingRowMetadata(row, {
        flat,
        resident: residentNameForFlat(flat),
        month,
        amount,
        status: "Unpaid"
    });
    return row;
}

function actionQueueRows() {
    return [...document.querySelectorAll('[data-view="control"] table tbody tr')]
        .filter(row => row.children.length >= 5)
        .map(row => ({
            request: row.children[0]?.textContent.trim() || "",
            module: row.children[1]?.textContent.trim() || "",
            detail: row.children[2]?.textContent.trim() || "",
            status: row.querySelector(".status")?.textContent.trim() || row.children[3]?.textContent.trim() || "",
            action: row.children[4]?.textContent.trim() || ""
        }));
}

function exportControlQueue(values = []) {
    const period = values[0] || currentMonthName();
    const owner = values[1] || "Society Admin";
    const note = values[2] || "Operational queue export";
    const rows = actionQueueRows();
    const text = [
        "SmartSociety Admin Action Queue",
        `Society: Green Nest Apartments`,
        `Period: ${period}`,
        `Prepared by: ${owner}`,
        `Note: ${note}`,
        `Generated: ${new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`,
        "",
        ...rows.map((row, index) => `${index + 1}. ${row.request} | ${row.module} | ${row.detail} | Status: ${row.status} | Action: ${row.action}`)
    ].join("\n");
    downloadText("SmartSociety-admin-action-queue.txt", text);
    appendDashboardActivity(`Action queue exported for ${period}`);
    return {
        title: "Action queue exported",
        lines: [
            `<strong>Period:</strong> ${period}`,
            `<strong>Prepared by:</strong> ${owner}`,
            `<strong>Items:</strong> ${rows.length}`,
            `<strong>Pending:</strong> ${rows.filter(row => /pending|open|waiting|unpaid/i.test(row.status)).length}`,
            `<strong>File:</strong> SmartSociety-admin-action-queue.txt`
        ]
    };
}

function performControlQueueAction(action, button, values = []) {
    const queue = controlQueueRowData(button);
    if (!queue) return null;
    const now = new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    if (queue.module === "Residents" && action === "approve") {
        const name = values[0] || "Vijay P";
        const flat = values[1] || "C-303";
        const role = values[2] || "Tenant";
        const kycRef = values[3] || "KYC verified";
        const accessStart = values[4] || "Today";
        const note = values[5] || "Tenant access approved";
        updateResidentQueueRecord({ name, flat, role, status: "Active" });
        setControlQueueStatus(button, "Approved", "approved", "Approved", "approve", true);
        appendDashboardActivity(`Resident KYC approved: ${name}, ${flat}`);
        return {
            title: "Resident access approved",
            lines: [
                `<strong>Resident:</strong> ${name}`,
                `<strong>Flat:</strong> ${flat}`,
                `<strong>Role:</strong> ${role}`,
                `<strong>KYC reference:</strong> ${kycRef}`,
                `<strong>Access starts:</strong> ${accessStart}`,
                `<strong>Admin note:</strong> ${note}`,
                `<strong>Time:</strong> ${now}`
            ]
        };
    }
    if (queue.module === "Complaints" && action === "assign") {
        const team = values[0] || "Plumbing";
        const technician = values[1] || "Maintenance Team";
        const priority = values[2] || "High";
        const due = values[3] || "Today";
        const note = values[4] || "A-101 requires plumber assignment";
        updateComplaintQueueRecord({ issue: "Water leakage", flat: "A-101", team, status: "In Progress" });
        setControlQueueStatus(button, "Assigned", "progress", "Assigned", "assign", true);
        appendDashboardActivity(`Complaint assigned: Water leakage to ${technician}`);
        return {
            title: "Complaint assigned",
            lines: [
                `<strong>Issue:</strong> Water leakage`,
                `<strong>Flat:</strong> A-101`,
                `<strong>Team:</strong> ${team}`,
                `<strong>Technician:</strong> ${technician}`,
                `<strong>Priority:</strong> ${priority}`,
                `<strong>SLA due:</strong> ${due}`,
                `<strong>Work note:</strong> ${note}`,
                `<strong>Time:</strong> ${now}`
            ]
        };
    }
    if (queue.module === "Amenities" && action === "approve") {
        const amenity = values[0] || "Guest Room";
        const resident = values[1] || "Resident bookings";
        const slot = values[2] || "Next available slot";
        const charges = values[3] || "As per society rules";
        const note = values[4] || "2 bookings approved";
        updateAmenityQueueRecord({ amenity, status: "Approved", note: `${resident} - ${slot} - ${charges}` });
        setControlQueueStatus(button, "Approved", "approved", "Approved", "approve", true);
        appendDashboardActivity(`Amenity booking approved: ${amenity}`);
        return {
            title: "Amenity bookings approved",
            lines: [
                `<strong>Amenity:</strong> ${amenity}`,
                `<strong>Resident / booking:</strong> ${resident}`,
                `<strong>Slot:</strong> ${slot}`,
                `<strong>Charges:</strong> ${charges}`,
                `<strong>Admin note:</strong> ${note}`,
                `<strong>Time:</strong> ${now}`
            ]
        };
    }
    if (queue.module === "Expenses" && action === "approve") {
        const vendor = values[0] || "PowerCare";
        const invoice = values[1] || "PowerCare invoice";
        const amount = values[2] || "Rs. 18,000";
        const paymentMode = values[3] || "Bank transfer";
        const note = values[4] || "Generator service approved";
        updateExpenseQueueRecord({ expense: "Generator service", vendor, amount, status: "Approved" });
        setControlQueueStatus(button, "Approved", "approved", "Approved", "approve", true);
        appendDashboardActivity(`Expense approved: ${vendor} ${amount}`);
        return {
            title: "Expense approved",
            lines: [
                `<strong>Expense:</strong> Generator service`,
                `<strong>Vendor:</strong> ${vendor}`,
                `<strong>Invoice:</strong> ${invoice}`,
                `<strong>Amount:</strong> ${amount}`,
                `<strong>Payment mode:</strong> ${paymentMode}`,
                `<strong>Admin note:</strong> ${note}`,
                `<strong>Time:</strong> ${now}`
            ]
        };
    }
    if (queue.module === "Billing" && action === "pay") {
        const method = values[0] || "Manual verification";
        const ref = values[1] || "B204-JUNE-PAID";
        const paidAt = values[2] || new Date().toLocaleDateString("en-IN");
        const proof = values[3] || "Admin verified";
        const note = values[4] || "June maintenance dues cleared";
        const row = findOrCreateBillingRowForFlat("B-204", "June", "Rs. 2,500");
        if (row) {
            const billButton = row.querySelector("button");
            if (billButton) {
                setStatus(billButton, "Paid", "paid");
                billButton.textContent = "Receipt";
                billButton.dataset.action = "receipt";
            } else {
                row.children[3].innerHTML = '<span class="status paid">Paid</span>';
            }
            applyBillingRowMetadata(row, {
                flat: "B-204",
                resident: residentNameForFlat("B-204"),
                month: "June",
                amount: "Rs. 2,500",
                status: "Paid",
                paidAt,
                paymentMethod: method,
                paymentRef: ref,
                proof: `${proof}${note ? ` - ${note}` : ""}`
            });
            updateBillingStats(row);
        }
        setControlQueueStatus(button, "Paid", "paid", "Receipt", "receipt", false);
        appendDashboardActivity(`Billing marked paid: B-204 June ${ref}`);
        return row ? showBillingReceipt(row) : {
            title: "Bill marked paid",
            lines: [
                `<strong>Flat:</strong> B-204`,
                `<strong>Month:</strong> June`,
                `<strong>Amount:</strong> Rs. 2,500`,
                `<strong>Reference:</strong> ${ref}`
            ]
        };
    }
    if (queue.module === "Billing" && action === "receipt") {
        const row = findOrCreateBillingRowForFlat("B-204", "June", "Rs. 2,500");
        return showBillingReceipt(row);
    }
    return null;
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

function ensureResidentPortal() {
    if (dashboardRole !== "resident") return;
    document.querySelector('[data-panel="pass"]')?.remove();
    document.querySelector('[data-view="pass"]')?.remove();
    document.querySelectorAll('[data-view="overview"] .pill-row span').forEach(chip => {
        if (chip.textContent.trim().toLowerCase().includes("visitor")) {
            chip.textContent = "Book amenities";
        }
    });
    const overviewCopy = document.querySelector('[data-view="overview"] .card p');
    if (overviewCopy) {
        overviewCopy.textContent = "Residents can pay bills, raise complaints, request amenities, read announcements, and update profile details. Society Admin approves complaint assignments, amenity approvals, billing corrections, and closures.";
    }
}

function billDetailsFromButton(button) {
    const row = button.closest("tr");
    const cells = row ? [...row.children].map(cell => cell.textContent.trim()) : [];
    return {
        row,
        flat: dashboardRole === "resident" ? "A-101" : (row?.children?.[0]?.textContent.trim() || "A-101"),
        month: cells[0] || currentMonthName(),
        type: cells[1] || "Maintenance",
        amount: cells[2] || "Rs. 2,500",
        status: cells[3] || "Unpaid"
    };
}

function paymentUriFor(method, bill) {
    const amount = String(bill.amount || "").replace(/[^\d.]/g, "") || "2500";
    const note = `${bill.type} ${bill.month} Flat A-101`;
    return `upi://pay?pa=smartsociety@upi&pn=SmartSociety&am=${encodeURIComponent(amount)}&cu=INR&tn=${encodeURIComponent(note)}&mode=02&purpose=00&mc=0000&tr=SS${Date.now()}`;
}

function paymentMethodLabel(method) {
    const labels = {
        gpay: "Google Pay",
        upi: "UPI",
        paytm: "Paytm",
        phonepe: "PhonePe"
    };
    return labels[method] || "UPI";
}

function openResidentPaymentModal(button) {
    const modal = ensureActionModal();
    const bill = billDetailsFromButton(button);
    activePaymentProof = null;
    activeAction = { action: "resident-pay", button };
    modal.querySelector("#dashboardActionTitle").textContent = "Choose Payment App";
    modal.querySelector("#dashboardActionText").innerHTML = `
        <span class="receipt-line"><strong>Bill:</strong><span>${escapeAttribute(bill.month)} ${escapeAttribute(bill.type)}</span></span>
        <span class="receipt-line"><strong>Amount:</strong><span>${escapeAttribute(bill.amount)}</span></span>`;
    modal.querySelector("#dashboardActionFields").innerHTML = `
        <div class="payment-method-grid">
            <button type="button" data-payment-method="gpay">Google Pay</button>
            <button type="button" data-payment-method="upi">UPI</button>
            <button type="button" data-payment-method="paytm">Paytm</button>
            <button type="button" data-payment-method="phonepe">PhonePe</button>
        </div>`;
    const save = modal.querySelector("#dashboardActionSave");
    save.textContent = "Cancel";
    save.onclick = closeActionModal;
    modal.querySelectorAll("[data-payment-method]").forEach(methodButton => {
        methodButton.addEventListener("click", () => openResidentQrPayment(button, methodButton.dataset.paymentMethod));
    });
    modal.classList.remove("hidden");
}

function openResidentQrPayment(button, method) {
    const modal = ensureActionModal();
    const bill = billDetailsFromButton(button);
    const methodName = paymentMethodLabel(method);
    const upiLink = paymentUriFor(method, bill);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(upiLink)}`;
    modal.querySelector("#dashboardActionTitle").textContent = `${methodName} Scanner`;
    modal.querySelector("#dashboardActionText").innerHTML = `
        <span class="receipt-line"><strong>Amount:</strong><span>${escapeAttribute(bill.amount)}</span></span>
        <span class="receipt-line"><strong>Payee:</strong><span>SmartSociety - Flat A-101</span></span>`;
    modal.querySelector("#dashboardActionFields").innerHTML = `
        <div class="payment-qr-panel">
            <img src="${qrUrl}" alt="${methodName} QR code for ${escapeAttribute(bill.amount)}">
            <div>
                <strong>Scan with ${methodName}</strong>
                <span>UPI ID: smartsociety@upi</span>
                <a class="primary small" href="${upiLink}">Open ${methodName}</a>
                <label class="payment-proof-upload">Upload payment screenshot<input type="file" id="paymentProofUpload" accept="image/*"></label>
                <span id="paymentProofState">Screenshot required before confirming payment.</span>
            </div>
        </div>`;
    const save = modal.querySelector("#dashboardActionSave");
    save.textContent = "I Have Paid";
    save.disabled = true;
    save.onclick = () => confirmResidentPayment(button, methodName);
    const proofInput = modal.querySelector("#paymentProofUpload");
    proofInput?.addEventListener("change", () => {
        const file = proofInput.files?.[0];
        activePaymentProof = file ? { name: file.name, size: file.size, method: methodName, file } : null;
        const state = modal.querySelector("#paymentProofState");
        if (state) state.textContent = file ? `Uploaded: ${file.name}` : "Screenshot required before confirming payment.";
        save.disabled = !file;
    });
}

async function confirmResidentPayment(button, methodName) {
    if (!activePaymentProof?.name) {
        showToast("Upload payment screenshot first");
        return;
    }
    const bill = billDetailsFromButton(button);
    const screenshotDataUrl = await readFileAsDataUrl(activePaymentProof.file);
    const proof = {
        id: `proof-${Date.now()}`,
        flat: "A-101",
        resident: "Kavya N",
        month: bill.month,
        type: bill.type,
        amount: bill.amount,
        method: methodName,
        proofName: activePaymentProof.name,
        proofSize: activePaymentProof.size,
        proofImage: screenshotDataUrl,
        status: "Pending Review",
        submittedAt: new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" }),
        paymentRef: `SS-A-101-${bill.month}-${Date.now()}`.replace(/\s+/g, "-")
    };
    upsertResidentPaymentProof(proof);
    setStatus(button, "Pending Review", "pending");
    button.textContent = "Awaiting Admin";
    button.dataset.action = "pay";
    button.disabled = true;
    updateBillingStats(button);
    pushResidentInboxItem({
        type: "Payment Proof",
        title: `${bill.month} ${bill.type} - ${bill.amount}`,
        method: methodName,
        proof: activePaymentProof.name,
        details: `${methodName} screenshot uploaded: ${activePaymentProof.name}. Waiting for admin approval.`
    });
    persistDashboardState();
    showActionReceipt({
        title: "Payment proof submitted",
        lines: [
            `<strong>Result:</strong> Sent to admin for review`,
            `<strong>Bill:</strong> ${bill.month} ${bill.type}`,
            `<strong>Amount:</strong> ${bill.amount}`,
            `<strong>Proof:</strong> ${activePaymentProof.name}`,
            `<strong>UPI:</strong> smartsociety@upi`,
            `<strong>Status:</strong> Unpaid until admin accepts the screenshot`,
            `<strong>Time:</strong> ${proof.submittedAt}`
        ]
    });
    activePaymentProof = null;
}

function ensureMaintenanceTables() {
    if (dashboardRole !== "maintenance") return;
    const complaintTable = document.querySelector('[data-view="complaints"] table');
    if (complaintTable) complaintTable.dataset.table = "maintenance-complaints";
    const header = document.querySelector(".header");
    document.getElementById("maintenanceAvailabilityState")?.remove();
    if (header && !header.querySelector('[data-action="rest"]')) {
        const actions = header.querySelector(".header-actions") || header;
        actions.insertAdjacentHTML("beforeend", '<button data-action="rest">Take Rest</button>');
    }
}

function maintenanceTaskExists(task, location) {
    const tbody = document.querySelector('[data-table="tasks"] tbody');
    if (!tbody) return false;
    const normalizedTask = String(task || "").trim().toLowerCase();
    const normalizedLocation = String(location || "").trim().toLowerCase();
    return [...tbody.querySelectorAll("tr")].some(row => {
        const cells = row.children;
        return cells[0]?.textContent.trim().toLowerCase().includes(normalizedTask)
            && cells[1]?.textContent.trim().toLowerCase() === normalizedLocation;
    });
}

function addMaintenanceTask({ task, location, priority, status = "Pending", note = "" }) {
    const tbody = document.querySelector('[data-table="tasks"] tbody');
    if (!tbody || !task) return false;
    if (maintenanceTaskExists(task, location)) return false;
    const row = document.createElement("tr");
    const cleanTask = escapeAttribute(task);
    const cleanNote = note ? `<small>${escapeAttribute(note)}</small>` : "";
    row.innerHTML = `
        <td><strong>${cleanTask}</strong>${cleanNote}</td>
        <td>${escapeAttribute(location || "Common Area")}</td>
        <td>${escapeAttribute(priority || "Medium")}</td>
        <td><span class="status ${statusClass(status)}">${escapeAttribute(status)}</span></td>
        <td><button data-action="complete">Complete</button></td>`;
    tbody.appendChild(row);
    return true;
}

function addResidentComplaint(values) {
    const tbody = document.querySelector('[data-table="complaints"] tbody');
    if (!tbody) return;
    const issue = values[0] || "Resident complaint";
    const category = values[1] || "General";
    const location = values[2] || "Flat A-101";
    const urgency = values[3] || "Normal";
    const description = values[4] || "No extra details";
    const row = document.createElement("tr");
    row.innerHTML = `
        <td><strong>${escapeAttribute(issue)}</strong><small>${escapeAttribute(location)} - ${escapeAttribute(description)}</small></td>
        <td>${escapeAttribute(category)} / ${escapeAttribute(urgency)}</td>
        <td><span class="status open">Open</span></td>
        <td><button data-action="close">Close</button></td>`;
    tbody.prepend(row);
}

function updateResidentAmenityBooking(button, values) {
    const card = button.closest(".card");
    if (!card) return;
    const amenity = card.querySelector("h3")?.textContent.trim() || "Amenity";
    const date = values[0] || "Today";
    const time = values[1] || "Preferred slot";
    const guests = values[2] || "Resident";
    const purpose = values[3] || "Personal use";
    let details = card.querySelector(".amenity-booking-details");
    if (!details) {
        details = document.createElement("div");
        details.className = "amenity-booking-details";
        card.appendChild(details);
    }
    details.innerHTML = `
        <span class="status pending">Approval Pending</span>
        <p><strong>${escapeAttribute(date)} - ${escapeAttribute(time)}</strong></p>
        <p>${escapeAttribute(guests)} | ${escapeAttribute(purpose)}</p>`;
    updateRowAction(button, "Requested", "book", true);
    return { amenity, date, time, guests, purpose };
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
    const queue = dashboardRole === "admin" ? controlQueueRowData(button) : null;
    if (action === "save" && label.includes("sync")) {
        return ["Sync Society Data", "Confirm syncing residents, billing, visitors and complaint records for this society.", ["Sync note"]];
    }
    if (action === "save" && panel === "profile") {
        return ["Save Profile", "Confirm and permanently save your resident profile details on this browser.", []];
    }
    if (dashboardRole === "resident" && action === "notify") {
        return ["Contact Admin", "Send a detailed message to the society admin team.", ["Subject", "Category", "Message", "Preferred callback time"]];
    }
    if (dashboardRole === "maintenance" && action === "save" && label.includes("availability")) {
        return ["Update Availability", "Share your current maintenance availability so admin and security can assign work correctly.", ["Availability status", "Current work zone", "Available until", "Notes"]];
    }
    if (dashboardRole === "maintenance" && action === "rest") {
        return ["Take Rest", "Set a rest window and backup contact before pausing new maintenance assignments.", ["Rest until", "Backup teammate", "Reason"]];
    }
    if (dashboardRole === "maintenance" && action === "add" && table === "tasks") {
        return ["Add Maintenance Task", "Create a detailed task with location, priority, assignee, timing, and work notes.", ["Task details", "Location / flat", "Priority", "Assigned to", "Due time", "Work notes"]];
    }
    if (dashboardRole === "maintenance" && action === "assign") {
        const row = button.closest("tr");
        const issue = row?.children[0]?.textContent.trim() || context.target;
        const flat = row?.children[1]?.textContent.trim() || "Common Area";
        return ["Take Complaint Task", `Move "${issue}" from the complaint queue into assigned tasks for ${flat}.`, ["Assigned to", "Priority", "Start time", "Work note"]];
    }
    if (dashboardRole === "admin" && action === "notify" && label.includes("export") && panel === "control") {
        return ["Export Action Queue", "Download a detailed control-center report with request, module, detail, status, and pending action for every row.", ["Report period", "Prepared by", "Export note"]];
    }
    if (queue?.module === "Residents" && action === "approve") {
        return ["Approve Resident KYC", `Verify ${queue.detail} before activating resident portal access.`, ["Resident name", "Flat / unit", "Resident role", "KYC reference", "Access start date", "Admin note"]];
    }
    if (queue?.module === "Complaints" && action === "assign") {
        return ["Assign Complaint Work", `Route ${queue.detail} with team, technician, priority and SLA details.`, ["Team / category", "Technician / vendor", "Priority", "SLA due time", "Work note"]];
    }
    if (queue?.module === "Amenities" && action === "approve") {
        return ["Approve Amenity Booking", `Approve the waiting amenity bookings with slot and charge details.`, ["Amenity", "Resident / booking detail", "Date and time slot", "Charges / deposit", "Approval note"]];
    }
    if (queue?.module === "Expenses" && action === "approve") {
        return ["Approve Vendor Expense", `Check vendor, invoice, amount and payment mode before approval.`, ["Vendor", "Invoice number", "Amount", "Payment mode", "Approval note"]];
    }
    if (queue?.module === "Billing" && action === "pay") {
        return ["Mark Queue Bill Paid", `Record verified payment details for ${queue.detail}.`, ["Payment method", "Reference number", "Received date", "Proof / screenshot filename", "Admin note"]];
    }
    if (queue?.module === "Billing" && action === "receipt") {
        return ["Billing Receipt", "Download the exact receipt for B-204 June maintenance after payment verification.", []];
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
        if (dashboardRole === "admin" && button.closest('[data-table="billing"]')) {
            return ["Billing Receipt", "Generate the exact receipt for this flat, resident, month, and payment reference.", []];
        }
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
        if (dashboardRole === "resident") {
            return ["Raise Complaint", "Send a detailed complaint to the society admin and maintenance team.", ["Issue", "Category", "Location / flat", "Urgency", "Description"]];
        }
        return ["Create Complaint", "Create a complaint ticket and assign the right category.", ["Issue", "Flat / unit", "Team / category"]];
    }
    if (action === "add" && table === "expenses") {
        return ["Add Expense", "Record an expense for approval.", ["Expense title", "Vendor", "Amount"]];
    }
    if (action === "update-plan") {
        const plan = button.dataset.plan || context.target || "Selected plan";
        return [`Update ${plan} Plan`, "Update exact plan limits, price, modules, support level, audit retention and rollout note.", ["Flat limit", "Monthly price", "Enabled modules", "Support level", "Audit retention", "Update note"]];
    }
    if (dashboardRole === "superadmin" && action === "subscription-map") {
        return ["Update Society Subscription", `Correct the subscription mapping for ${context.target}.`, ["Society", "Current plan", "New plan", "Flat usage", "Renewal date", "Admin owner", "Review note"]];
    }
    if (dashboardRole === "superadmin" && action === "admin-seat") {
        const labelText = buttonLabel(button);
        return [`${labelText} - Admin Access`, `Record precise platform access action for ${context.target}.`, ["Admin name", "Society", "Role", "MFA status", "Access decision", "Audit note"]];
    }
    if (dashboardRole === "superadmin" && action === "billing-rule") {
        return ["Update Billing Rule", `Adjust the billing rule for ${context.target}.`, ["Rule name", "Plan", "Amount", "Billing cycle", "Grace period", "Effective from", "Rule note"]];
    }
    if (dashboardRole === "superadmin" && action === "subscription-audit") {
        return ["Run Invoice Dry Run", "Preview subscription invoices without changing live billing records.", ["Invoice month", "Include trials", "Include renewal due societies", "Dry run note"]];
    }
    if (dashboardRole === "admin" && action === "approve-payment-proof") {
        return ["Approve Payment Proof", "Review the screenshot and approve only if the payment is valid. This will mark the resident bill as paid.", ["Admin review note"]];
    }
    if (dashboardRole === "admin" && action === "reject-payment-proof") {
        return ["Reject Payment Proof", "Reject only if the screenshot is wrong, unclear, duplicate, or not matching the bill. The resident bill will stay unpaid.", ["Rejection reason"]];
    }
    const configs = {
        add: ["Add record", `Create a new item in ${titles[panel] || panel}.`, ["Name / title", "Details"]],
        save: ["Save changes", `Confirm updates for ${titles[panel] || panel}.`, []],
        notify: ["Send Notification", `Write a message for: ${context.target}.`, ["Message"]],
        generate: dashboardRole === "admin"
            ? ["Generate Monthly Bills", "Create one maintenance bill per active flat for the selected month. Existing flat/month bills will be skipped.", ["Billing month", "Default amount", "Due date", "Billing note"]]
            : ["Generate Monthly Bills", "Create maintenance bills for all active flats using the selected month and amount.", ["Billing month", "Default amount"]],
        pay: dashboardRole === "admin"
            ? ["Mark Bill Paid", "Record verified payment details so the receipt is exact for this flat and resident.", ["Payment method", "Reference number", "Received date", "Proof / screenshot filename", "Admin note"]]
            : ["Confirm payment", "Record this payment as completed.", ["Reference number"]],
        book: dashboardRole === "resident"
            ? ["Book Amenity", `Request ${button.closest(".card")?.querySelector("h3")?.textContent || button.textContent.trim()} with the details admin needs for approval.`, ["Date", "Time slot", "Guests / vehicles", "Purpose"]]
            : ["Confirm booking", `Reserve ${button.closest(".card")?.querySelector("h3")?.textContent || button.textContent.trim()}.`, ["Date", "Time"]],
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
    if (dashboardRole === "resident" && action === "pay") {
        openResidentPaymentModal(button);
        return;
    }
    if (dashboardRole === "admin" && action === "receipt" && button.closest('[data-table="billing"]')) {
        showActionReceipt(showBillingReceipt(button.closest("tr")));
        return;
    }
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
        assign: dashboardRole === "maintenance" ? `Taken task for ${context.target}` : `Assigned ${context.target}`,
        notify: label.includes("receipt") ? `Receipt generated for ${context.target}` : label.includes("export") ? `Report exported from ${context.panelTitle}` : label.includes("publish") ? `Announcement published from ${context.panelTitle}` : `Notification sent to ${context.target}`,
        checkin: `Checked in ${context.target}`,
        checkout: `Checked out ${context.target}`,
        complete: `Completed ${context.target}`,
        book: `Booking confirmed for ${context.target}`,
        rest: "Maintenance team rest window updated"
    };

    if (dashboardRole === "admin" && (action === "approve-payment-proof" || action === "reject-payment-proof")) {
        const receipt = handlePaymentProofReview(action, button, values);
        if (receipt) return receipt;
    }

    if (dashboardRole === "admin" && action === "notify" && label.includes("export") && context.panel === "control") {
        persistDashboardState();
        return exportControlQueue(values);
    }
    const controlQueueReceipt = dashboardRole === "admin" ? performControlQueueAction(action, button, values) : null;
    if (controlQueueReceipt) {
        persistDashboardState();
        showToast(controlQueueReceipt.title);
        return controlQueueReceipt;
    }

    if (dashboardRole === "maintenance" && action === "save" && label.includes("availability")) {
        const status = values[0] || "Available";
        const zone = values[1] || "All blocks";
        const until = values[2] || "End of shift";
        appendDashboardActivity(`Availability updated: ${status} - ${zone} until ${until}`);
    }
    if (dashboardRole === "maintenance" && action === "rest") {
        const restUntil = values[0] || "30 minutes";
        const backup = values[1] || "Backup team";
        const reason = values[2] || "Break";
        appendDashboardActivity(`Maintenance rest set until ${restUntil}; backup ${backup}; reason ${reason}`);
    }
    if (dashboardRole === "maintenance" && action === "assign") {
        const row = button.closest("tr");
        const issue = row?.children[0]?.textContent.trim() || context.target;
        const location = row?.children[1]?.textContent.trim() || "Common Area";
        const assignee = values[0] || "Maintenance Team";
        const priority = values[1] || "High";
        const startTime = values[2] || "Now";
        const workNote = values[3] || "Taken from complaint queue";
        addMaintenanceTask({
            task: issue,
            location,
            priority,
            status: "In Progress",
            note: `${assignee} - ${startTime} - ${workNote}`
        });
        setStatus(button, "Assigned", "progress");
        updateRowAction(button, "Taken", "assign", true);
        appendDashboardActivity(`Complaint moved to tasks: ${issue} at ${location}`);
    }
    if (dashboardRole === "resident" && action === "notify") {
        pushResidentInboxItem({
            type: "Contact Admin",
            title: values[0] || "Resident message",
            details: `${values[1] || "General"} - ${values[2] || "No message"}${values[3] ? ` | Callback: ${values[3]}` : ""}`
        });
        showToast("Message sent to admin");
        return {
            title: "Message sent",
            lines: [
                `<strong>Subject:</strong> ${values[0] || "Resident message"}`,
                `<strong>Category:</strong> ${values[1] || "General"}`,
                `<strong>Message:</strong> ${values[2] || "No message"}`,
                `<strong>Callback:</strong> ${values[3] || "Not requested"}`,
                `<strong>Status:</strong> Visible to Admin and Super Admin`
            ]
        };
    }

    if (dashboardRole === "superadmin" && action === "notify" && context.panel === "subscriptions" && label.includes("export")) {
        const rows = [...document.querySelectorAll('[data-view="subscriptions"] table tbody tr')].map(row =>
            [...row.children].map(cell => cell.textContent.trim()).join(" | ")
        );
        const text = [
            "SmartSociety Subscription Ledger",
            `Generated: ${now}`,
            `Section: ${context.panelTitle}`,
            "",
            ...rows
        ].join("\n");
        downloadText("SmartSociety-subscription-ledger.txt", text);
        appendPlatformActivity("Subscription ledger exported");
        return {
            title: "Subscription ledger exported",
            lines: [
                `<strong>Rows:</strong> ${rows.length}`,
                `<strong>File:</strong> SmartSociety-subscription-ledger.txt`,
                `<strong>Time:</strong> ${now}`
            ]
        };
    }
    if (dashboardRole === "superadmin" && action === "subscription-map") {
        const row = button.closest("tr");
        const society = values[0] || row?.children[0]?.textContent.trim() || "Society";
        const currentPlan = values[1] || row?.children[1]?.textContent.trim() || "Current plan";
        const newPlan = values[2] || currentPlan;
        const flatUsage = values[3] || row?.children[2]?.textContent.trim() || "0 / 0";
        const renewal = values[4] || row?.children[3]?.textContent.trim() || "Next billing cycle";
        const adminOwner = values[5] || row?.children[4]?.textContent.trim() || "Society Admin";
        const reviewNote = values[6] || "Mapping reviewed";
        if (row) {
            row.children[0].textContent = society;
            row.children[1].textContent = newPlan;
            row.children[2].textContent = flatUsage;
            row.children[3].textContent = renewal;
            row.children[4].textContent = adminOwner;
            row.children[5].innerHTML = '<span class="status approved">Updated</span>';
        }
        updateRowAction(button, "Reviewed", "subscription-map", true);
        appendPlatformActivity(`Subscription mapping updated: ${society} ${currentPlan} to ${newPlan}`);
        persistDashboardState();
        return {
            title: "Subscription mapping updated",
            lines: [
                `<strong>Society:</strong> ${society}`,
                `<strong>Previous plan:</strong> ${currentPlan}`,
                `<strong>Current plan:</strong> ${newPlan}`,
                `<strong>Flat usage:</strong> ${flatUsage}`,
                `<strong>Renewal:</strong> ${renewal}`,
                `<strong>Admin owner:</strong> ${adminOwner}`,
                `<strong>Note:</strong> ${reviewNote}`
            ]
        };
    }
    if (dashboardRole === "superadmin" && action === "admin-seat") {
        const row = button.closest("tr");
        const adminName = values[0] || row?.children[0]?.textContent.trim() || "Admin";
        const society = values[1] || row?.children[1]?.textContent.trim() || "Society";
        const role = values[2] || row?.children[2]?.textContent.trim() || "Society Admin";
        const mfa = values[3] || row?.children[4]?.textContent.trim() || "Enabled";
        const decision = values[4] || buttonLabel(button) || "Audited";
        const auditNote = values[5] || "Access reviewed by Super Admin";
        if (row) {
            row.children[0].textContent = adminName;
            row.children[1].textContent = society;
            row.children[2].textContent = role;
            row.children[3].textContent = now;
            row.children[4].textContent = mfa;
            row.children[5].innerHTML = `<span class="status ${statusClass(decision)}">${escapeAttribute(decision)}</span>`;
        }
        updateRowAction(button, decision.toLowerCase().includes("reset") ? "Reset Sent" : "Audited", "admin-seat", true);
        appendPlatformActivity(`Admin access action: ${adminName} - ${decision}`);
        persistDashboardState();
        return {
            title: "Admin access updated",
            lines: [
                `<strong>Admin:</strong> ${adminName}`,
                `<strong>Society:</strong> ${society}`,
                `<strong>Role:</strong> ${role}`,
                `<strong>MFA:</strong> ${mfa}`,
                `<strong>Decision:</strong> ${decision}`,
                `<strong>Audit note:</strong> ${auditNote}`
            ]
        };
    }
    if (dashboardRole === "superadmin" && action === "billing-rule") {
        const row = button.closest("tr");
        const rule = values[0] || row?.children[0]?.textContent.trim() || "Billing rule";
        const plan = values[1] || row?.children[1]?.textContent.trim() || "Plan";
        const amount = values[2] || row?.children[2]?.textContent.trim() || "Rs. 0";
        const cycle = values[3] || row?.children[3]?.textContent.trim() || "Monthly";
        const grace = values[4] || row?.children[4]?.textContent.trim() || "0 days";
        const effective = values[5] || "Next invoice";
        const ruleNote = values[6] || "Rule reviewed";
        if (row) {
            row.children[0].textContent = rule;
            row.children[1].textContent = plan;
            row.children[2].textContent = amount;
            row.children[3].textContent = cycle;
            row.children[4].textContent = grace;
            row.children[5].innerHTML = '<span class="status approved">Updated</span>';
        }
        updateRowAction(button, "Rule Updated", "billing-rule", true);
        appendPlatformActivity(`Billing rule updated: ${rule} ${amount}`);
        persistDashboardState();
        return {
            title: "Billing rule updated",
            lines: [
                `<strong>Rule:</strong> ${rule}`,
                `<strong>Plan:</strong> ${plan}`,
                `<strong>Amount:</strong> ${amount}`,
                `<strong>Cycle:</strong> ${cycle}`,
                `<strong>Grace:</strong> ${grace}`,
                `<strong>Effective:</strong> ${effective}`,
                `<strong>Note:</strong> ${ruleNote}`
            ]
        };
    }
    if (dashboardRole === "superadmin" && action === "subscription-audit") {
        const invoiceMonth = values[0] || currentMonthName();
        const includeTrials = values[1] || "Yes";
        const includeRenewals = values[2] || "Yes";
        const auditNote = values[3] || "Dry run only";
        const rows = [...document.querySelectorAll('[data-subpanel="mapping"] tbody tr')].map(row => ({
            society: row.children[0]?.textContent.trim(),
            plan: row.children[1]?.textContent.trim(),
            renewal: row.children[3]?.textContent.trim(),
            status: row.querySelector(".status")?.textContent.trim()
        }));
        downloadText("SmartSociety-invoice-dry-run.txt", [
            "SmartSociety Invoice Dry Run",
            `Invoice month: ${invoiceMonth}`,
            `Include trials: ${includeTrials}`,
            `Include renewal due societies: ${includeRenewals}`,
            `Note: ${auditNote}`,
            `Generated: ${now}`,
            "",
            ...rows.map(row => `${row.society} | ${row.plan} | ${row.renewal} | ${row.status}`)
        ].join("\n"));
        appendPlatformActivity(`Invoice dry run completed for ${invoiceMonth}`);
        return {
            title: "Invoice dry run completed",
            lines: [
                `<strong>Invoice month:</strong> ${invoiceMonth}`,
                `<strong>Societies checked:</strong> ${rows.length}`,
                `<strong>Trials:</strong> ${includeTrials}`,
                `<strong>Renewals:</strong> ${includeRenewals}`,
                `<strong>File:</strong> SmartSociety-invoice-dry-run.txt`
            ]
        };
    }

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
    if (action === "assign" && dashboardRole !== "maintenance") {
        setStatus(button, "Assigned", "progress");
        updateRowAction(button, "Assigned", "assign", true);
    }
    if (action === "pay") {
        if (dashboardRole === "admin" && button.closest('[data-table="billing"]')) {
            const row = button.closest("tr");
            const data = billingRowData(row);
            const paidAt = values[2] || new Date().toLocaleDateString("en-IN");
            const method = values[0] || "Manual verification";
            const ref = values[1] || `SS-${data.flat}-${data.month}`.replace(/\s+/g, "-");
            const proof = values[3] || "Admin verified";
            setStatus(button, "Paid", "paid");
            button.textContent = "Receipt";
            button.dataset.action = "receipt";
            applyBillingRowMetadata(row, {
                ...data,
                status: "Paid",
                paidAt,
                paymentMethod: method,
                paymentRef: ref,
                proof
            });
            updateBillingStats(button);
            persistDashboardState();
            return showBillingReceipt(row);
        }
        setStatus(button, "Paid", "paid");
        button.textContent = "Receipt";
        button.dataset.action = "receipt";
        updateBillingStats(button);
    }
    if (action === "receipt") {
        const row = button.closest('[data-table="billing"] tr');
        if (dashboardRole === "admin" && row) return showBillingReceipt(row);
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
    if (dashboardRole === "resident" && action === "book") {
        const booking = updateResidentAmenityBooking(button, values);
        pushResidentInboxItem({
            type: "Amenity Request",
            title: booking?.amenity || "Amenity",
            details: `${booking?.date || "Today"} ${booking?.time || ""} | ${booking?.guests || "Resident"} | ${booking?.purpose || "Personal use"}`
        });
        persistDashboardState();
        showToast(`✓ ${booking?.amenity || "Amenity"} request sent`);
        return {
            title: "Amenity request sent",
            lines: [
                `<strong>Amenity:</strong> ${booking?.amenity || "Amenity"}`,
                `<strong>Slot:</strong> ${booking?.date || "Today"} ${booking?.time || ""}`,
                `<strong>Details:</strong> ${booking?.guests || "Resident"} | ${booking?.purpose || "Personal use"}`,
                `<strong>Status:</strong> Waiting for admin approval`,
                `<strong>Time:</strong> ${now}`
            ]
        };
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
        const plan = button.dataset.plan || context.target;
        const flatLimit = values[0] || "Existing limit";
        const price = values[1] || "Existing price";
        const modules = values[2] || "Existing modules";
        const support = values[3] || "Standard support";
        const retention = values[4] || "90 days";
        const updateNote = values[5] || "Plan details updated";
        const copy = card?.querySelector("p");
        const bullets = card ? [...card.querySelectorAll("li")] : [];
        if (copy) copy.textContent = `${flatLimit} flats, ${modules}. ${price} / month.`;
        if (bullets[0]) bullets[0].textContent = `Modules: ${modules}`;
        if (bullets[1]) bullets[1].textContent = `Support: ${support}`;
        if (bullets[2]) bullets[2].textContent = `Audit retention: ${retention}`;
        if (status) {
            status.textContent = "Updated";
            status.className = "status approved";
        }
        updateRowAction(button, "Plan Updated", "update-plan");
        appendPlatformActivity(`Subscription plan updated: ${plan} (${flatLimit}, ${price}, ${support})`);
        if (dashboardRole === "superadmin") {
            persistDashboardState();
            return {
                title: "Subscription plan updated",
                lines: [
                    `<strong>Plan:</strong> ${plan}`,
                    `<strong>Flat limit:</strong> ${flatLimit}`,
                    `<strong>Monthly price:</strong> ${price}`,
                    `<strong>Modules:</strong> ${modules}`,
                    `<strong>Support:</strong> ${support}`,
                    `<strong>Audit retention:</strong> ${retention}`,
                    `<strong>Note:</strong> ${updateNote}`
                ]
            };
        }
    }
    if (action === "notify" && button.matches("button") && button.closest("tr")) updateRowAction(button, "Notified", "notify");
    if (action === "notify" && dashboardRole === "superadmin") {
        appendPlatformActivity(`Notice sent to ${fieldValues[0] || context.target}${fieldValues[1] ? `: ${fieldValues[1]}` : ""}`);
        setInlineState("platformNoticeState", `Last notice sent ${now}`);
    }
    if (action === "add") {
        const table = button.dataset.table;
        if (dashboardRole === "resident" && table === "complaints") {
            addResidentComplaint(values);
            pushResidentInboxItem({
                type: "Complaint",
                title: values[0] || "Resident complaint",
                details: `${values[1] || "General"} | ${values[2] || "Flat A-101"} | ${values[3] || "Normal"} | ${values[4] || "No extra details"}`
            });
            persistDashboardState();
            showToast(`✓ Complaint raised: ${values[0] || "Resident complaint"}`);
            return {
                title: "Complaint raised",
                lines: [
                    `<strong>Issue:</strong> ${values[0] || "Resident complaint"}`,
                    `<strong>Category:</strong> ${values[1] || "General"}`,
                    `<strong>Location:</strong> ${values[2] || "Flat A-101"}`,
                    `<strong>Urgency:</strong> ${values[3] || "Normal"}`,
                    `<strong>Details:</strong> ${values[4] || "No extra details"}`,
                    `<strong>Status:</strong> Sent to society admin`
                ]
            };
        }
        if (dashboardRole === "maintenance" && table === "tasks") {
            addMaintenanceTask({
                task: values[0] || "New maintenance task",
                location: values[1] || "Common Area",
                priority: values[2] || "Medium",
                status: "Pending",
                note: `${values[3] || "Maintenance Team"} - ${values[4] || "Today"}${values[5] ? ` - ${values[5]}` : ""}`
            });
            persistDashboardState();
            showToast(`✓ Added maintenance task: ${values[0] || "New maintenance task"}`);
            return {
                title: "Action completed",
                lines: [
                    `<strong>Result:</strong> Added maintenance task: ${values[0] || "New maintenance task"}`,
                    `<strong>Section:</strong> ${context.panelTitle}`,
                    `<strong>Target:</strong> ${values[1] || "Common Area"}`,
                    `<strong>Details:</strong> Priority ${values[2] || "Medium"} | Assigned to ${values[3] || "Maintenance Team"} | Due ${values[4] || "Today"}${values[5] ? ` | ${values[5]}` : ""}`,
                    `<strong>Time:</strong> ${now}`
                ]
            };
        }
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
        if (table === "passes") {
            upsertExpectedVisitorFromPass({
                visitor: values[0] || "Visitor",
                flat: values[1] || "D-401",
                validUntil: values[2] || "Today"
            });
        }
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
        if (dashboardRole === "admin") {
            const dueDate = values[2] || "End of month";
            const result = generateMonthlyBillingRows({ month, amount, dueDate, note: values[3] || "" });
            persistDashboardState();
            return {
                title: "Monthly bills generated",
                lines: [
                    `<strong>Month:</strong> ${month}`,
                    `<strong>Amount:</strong> ${amount}`,
                    `<strong>Due date:</strong> ${dueDate}`,
                    `<strong>Created:</strong> ${result.created} bills`,
                    `<strong>Skipped:</strong> ${result.skipped} existing bills`
                ]
            };
        }
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
    const subscriptionTab = event.target.closest("[data-subtab]");
    if (subscriptionTab) {
        event.preventDefault();
        openSubscriptionSubtab(subscriptionTab.dataset.subtab);
        persistDashboardState();
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
ensureResidentPortal();
ensureMaintenanceTables();
ensureAdminBillingMetadata();
syncAdminBillingFromPaymentProofs();
syncResidentBillingFromProofs();
syncApprovedPassesToVisitors();
renderResidentInboxForAdmins();
renderPaymentProofReviewForAdmins();
enhanceDashboardCategories();
wireAutosave();
const initialPanel = location.hash.replace("#", "");
openPanel(document.querySelector(`[data-view="${initialPanel}"]`) ? initialPanel : "overview", false);
animateStats();
