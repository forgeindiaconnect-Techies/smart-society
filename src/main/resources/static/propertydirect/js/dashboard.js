const panelTitles = {
    overview: "Overview",
    users: "User Management",
    properties: "Apartment Management",
    subscriptions: "Subscription Plans",
    payments: "Payments",
    services: "Services",
    analytics: "Analytics",
    support: "Support",
    settings: "Settings",
    post: "Post Apartment",
    listings: "My Apartment Listings",
    leads: "Apartment Leads",
    visits: "Visit Schedule",
    plans: "Plans",
    profile: "Profile",
    search: "Search Apartments",
    shortlist: "Shortlisted Apartments",
    contacts: "Owner Contacts",
    rentpay: "Rent Pay"
};

const toast = document.getElementById("toast");
const dashboardRole = document.body.dataset.dashboardRole || "customer";
const dashboardStorageKey = `propertydirect-dashboard-state:v6:${dashboardRole}`;
let modal = document.getElementById("dashboardModal");
let modalTitle = document.getElementById("modalTitle");
let modalText = document.getElementById("modalText");
let modalFields = document.getElementById("modalFields");
let modalSave = document.getElementById("modalSave");
let activeModalTarget = null;
const rolePanelRoutes = {
    superadmin: ["users", "properties", "payments", "analytics"],
    admin: ["listings", "leads", "visits", "plans"],
    customer: ["shortlist", "contacts", "visits", "rentpay"]
};

function dashboardContentRoot() {
    return document.querySelector(".dash-main");
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

function wireAutosave() {
    document.addEventListener("input", event => {
        if (event.target.closest(".dash-main")) persistDashboardState();
    });
    document.addEventListener("change", event => {
        if (event.target.closest(".dash-main")) persistDashboardState();
    });
}

const actionForms = {
    "post-property": {
        title: "Publish Apartment",
        text: "Add the apartment to your live listings.",
        fields: ["Apartment title", "City", "Locality", "Rent / Price", "Apartment type", "BHK"],
        save: (values) => {
            const form = readPostApartmentForm();
            const title = values[0] || form.title || "New Apartment";
            const city = values[1] || form.city || "Bangalore";
            const locality = values[2] || form.locality || "Owner Listed";
            const price = values[3] || form.price || "₹28,000";
            const type = values[4] || form.type || "Rent Apartment";
            const bhk = values[5] || form.bhk || "2 BHK";
            addListing(`${bhk} ${title}`, type, "Pending", price);
            addTask(`Review newly posted apartment: ${title} (${price})`);
            incrementStat("live", 1);
            openPanel("listings");
            return receipt(`Apartment listing published: ${title}`, activeModalTarget, [title, city, locality, price, type, bhk], [`<strong>Next:</strong> Added to listings as Pending for review`]);
        }
    },
    "preview-apartment": {
        title: "Apartment Preview",
        text: "Preview generated from your post form.",
        fields: [],
        save: () => {
            const form = readPostApartmentForm();
            return receipt("Apartment preview generated", activeModalTarget, [
                form.title || "Untitled apartment",
                form.city || "City missing",
                form.locality || "Locality missing",
                form.price || "Price missing",
                form.deposit || "Deposit missing",
                form.sqft || "Sqft missing",
                form.bhk || "BHK missing"
            ], [`<strong>Checked:</strong> Title, rent/price, deposit, sqft and BHK fields`]);
        }
    },
    "add-lead": {
        title: "Add Apartment Lead",
        text: "Create a lead and add it to the lead table.",
        fields: ["Lead name", "Apartment need", "Status"],
        save: (values) => {
            addLead(values[0] || "New Lead", values[1] || "2 BHK apartment", values[2] || "New");
            incrementStat("leads", 1);
            return receipt(`Lead added: ${values[0] || "New Lead"}`, activeModalTarget, values, [`<strong>Next:</strong> Lead table updated`]);
        }
    },
    "new-visit": {
        title: "Schedule Visit",
        text: "Add a new apartment visit schedule.",
        fields: ["Visitor name", "Date and time", "Apartment"],
        save: (values) => {
            addVisit(`${values[1] || "Tomorrow 5 PM"} - ${values[0] || "Customer"} (${values[2] || "Apartment"})`);
            incrementStat("visits", 1);
            return receipt(`Visit scheduled for ${values[0] || "Customer"}`, activeModalTarget, values, [`<strong>Next:</strong> Visit schedule updated`]);
        }
    },
    "add-payment": {
        title: "Add Payment",
        text: "Record a plan or service payment.",
        fields: ["Payment item", "Amount", "Status"],
        save: (values) => {
            addPayment(values[0] || "Apartment Service", values[1] || "₹999", values[2] || "Pending");
            return receipt(`Payment added: ${values[0] || "Apartment Service"}`, activeModalTarget, values, [`<strong>Amount:</strong> ${values[1] || "₹999"}`]);
        }
    },
    "book-service": {
        title: "Book Apartment Service",
        text: "Confirm a service request for this apartment.",
        fields: ["Service date", "Apartment", "Notes"],
        save: (values) => {
            addServiceRequest(values[1] || activeModalTarget?.textContent?.trim() || "Apartment service", values[0] || "Selected date", values[2] || "Requested");
            addTask(`Service booked: ${values[1] || "Apartment"} on ${values[0] || "selected date"}`);
            return receipt(`Service booked for ${values[1] || "Apartment"}`, activeModalTarget, values);
        }
    },
    upgrade: {
        title: "Upgrade Plan",
        text: "Upgrade to Assisted plan for better apartment leads.",
        fields: ["Billing name", "Phone"],
        save: (values) => receipt("Plan upgrade request submitted", activeModalTarget, values)
    },
    support: {
        title: "Raise Support Ticket",
        text: "Send an issue to support.",
        fields: ["Issue title", "Description"],
        save: (values) => {
            addSupportTicket(values[0] || readNearbyFields(activeModalTarget)[0]?.replace("Issue: ", "") || "Support issue", values[1] || "Customer requested help");
            let state = document.getElementById("supportState");
            if (!state) {
                const heading = document.querySelector('[data-view="support"] .dash-card h3');
                heading?.insertAdjacentHTML("afterend", '<span class="inline-state" id="supportState">Ready</span>');
                state = document.getElementById("supportState");
            }
            if (state) state.textContent = "Ticket raised";
            return receipt("Support ticket raised", activeModalTarget, values);
        }
    },
    schedule: {
        title: "Schedule Site Visit",
        text: "Choose a convenient visit slot.",
        fields: ["Apartment", "Date", "Time"],
        save: (values) => {
            addVisit(`${values[1] || "Selected date"} ${values[2] || ""} - ${values[0] || "Apartment"}`);
            return receipt(`Site visit scheduled for ${values[0] || "Apartment"}`, activeModalTarget, values);
        }
    },
    pay: {
        title: "Pay Rent",
        text: "Record a secure rent payment.",
        fields: ["Apartment / owner", "Amount", "Payment reference"],
        save: (values) => {
            addRentPayment(values[0] || "Current apartment", values[1] || "₹28,000", values[2] || "Manual reference");
            const state = document.getElementById("rentPayState");
            if (state) state.textContent = "Last rent payment recorded";
            return receipt("Rent payment completed", activeModalTarget, values);
        }
    },
    call: {
        title: "Owner Contact",
        text: "Confirm that you want to unlock this owner contact.",
        fields: ["Contact note"],
        save: (values) => {
            const row = activeModalTarget?.closest("tr");
            const status = row?.querySelector(".status");
            if (status) {
                status.textContent = "Unlocked";
                status.className = "status active";
            }
            if (activeModalTarget) {
                activeModalTarget.textContent = "Contacted";
                activeModalTarget.disabled = true;
            }
            return receipt("Owner contact unlocked", activeModalTarget, values, ["<strong>Next:</strong> Phone contact is now marked as unlocked"]);
        }
    },
    "edit-row": {
        title: "Edit Apartment Row",
        text: "Update the selected apartment listing row.",
        fields: ["Apartment title", "Type", "Status"],
        save: (values) => {
            const row = activeModalTarget?.closest("tr");
            if (row) {
                if (values[0]) row.children[0].textContent = values[0];
                if (values[1]) row.children[1].textContent = values[1];
                if (values[2] && row.children[2]) row.children[2].innerHTML = `<span class="status pending">${values[2]}</span>`;
            }
            return receipt("Apartment row updated", activeModalTarget, values);
        }
    },
    "call-lead": {
        title: "Call Lead",
        text: "Record the exact call outcome for this apartment lead.",
        fields: ["Call outcome", "Follow-up note"],
        save: (values) => {
            const row = activeModalTarget?.closest("tr");
            if (row?.children[2]) row.children[2].textContent = values[0] || "Called";
            return receipt("Lead call outcome saved", activeModalTarget, values);
        }
    },
    "schedule-lead": {
        title: "Schedule Lead Visit",
        text: "Move this lead into the visit schedule.",
        fields: ["Visit date", "Visit time", "Apartment"],
        save: (values) => {
            const row = activeModalTarget?.closest("tr");
            const lead = row?.children[0]?.textContent || "Lead";
            const apartment = values[2] || row?.children[1]?.textContent || "Apartment";
            addVisit(`${values[0] || "Selected date"} ${values[1] || ""} - ${lead} (${apartment})`);
            if (row?.children[2]) row.children[2].textContent = "Visit Scheduled";
            incrementStat("visits", 1);
            return receipt(`Visit scheduled for ${lead}`, activeModalTarget, values);
        }
    },
    "manage-plan": {
        title: "Manage Plan",
        text: "Update pricing and availability for this plan.",
        fields: ["Plan price", "Plan benefits"],
        save: (values) => receipt("Plan updated", activeModalTarget, values)
    },
    "resolve-task": {
        title: "Resolve Category Item",
        text: "Add a resolution note for this item.",
        fields: ["Resolution note"],
        save: (values) => receipt("Item resolved", activeModalTarget, values)
    },
    inspect: {
        title: "Category Details",
        text: "Review the selected metric and its current category status.",
        fields: [],
        save: (values) => receipt("Category reviewed", activeModalTarget, values)
    }
};

function ensureModal() {
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "dashboardModal";
    modal.className = "modal hidden";
    modal.innerHTML = `
        <div class="modal-card">
            <button class="close" type="button" data-action="close-modal" aria-label="Close">×</button>
            <h2 id="modalTitle">Action</h2>
            <p id="modalText">Complete this action.</p>
            <div id="modalFields"></div>
            <button class="primary full" id="modalSave">Save</button>
        </div>`;
    document.body.appendChild(modal);
    modalTitle = modal.querySelector("#modalTitle");
    modalText = modal.querySelector("#modalText");
    modalFields = modal.querySelector("#modalFields");
    modalSave = modal.querySelector("#modalSave");
    modal.addEventListener("click", event => {
        if (event.target === modal) closeModal();
    });
    return modal;
}

function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove("hidden");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.add("hidden"), 4200);
}

function safeHtml(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function appendDashboardActivity(message) {
    const log = document.getElementById("propertyActivityLog");
    const list = log?.querySelector("ul");
    if (!list) return;
    const stamp = new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    const entry = document.createElement("li");
    entry.innerHTML = `<strong>${stamp}</strong><span>${safeHtml(message)}</span>`;
    list.prepend(entry);
    [...list.children].slice(6).forEach(item => item.remove());
}

function getContext(target) {
    const panel = target?.closest?.("[data-view]")?.dataset.view || "overview";
    const panelTitle = panelTitles[panel] || panel;
    const row = target?.closest?.("tr");
    if (row) {
        const cells = [...row.children].map(cell => cell.textContent.trim()).filter(Boolean);
        return {
            panel,
            panelTitle,
            target: cells.slice(0, Math.min(3, cells.length - 1 || cells.length)).join(" / "),
            detail: cells.join(" | ")
        };
    }
    const card = target?.closest?.(".dash-card");
    if (card) {
        const heading = card.querySelector("h2, h3")?.textContent.trim();
        const copy = card.querySelector("p")?.textContent.trim();
        return { panel, panelTitle, target: heading || target.textContent?.trim() || panelTitle, detail: copy || panelTitle };
    }
    const text = target?.textContent?.trim();
    return { panel, panelTitle, target: text || panelTitle, detail: panelTitle };
}

function showActionReceipt({ title = "Action completed", lines = [] }) {
    persistDashboardState();
    ensureModal();
    modalTitle.textContent = title;
    modalText.innerHTML = lines.map(line => {
        const clean = String(line).replace(/^<strong>|<\/strong>/g, "");
        const [label, ...rest] = clean.split(":");
        return `<span class="receipt-line"><strong>${label.trim()}:</strong><span>${rest.join(":").trim()}</span></span>`;
    }).join("");
    modalFields.innerHTML = "";
    modalSave.textContent = "Done";
    modalSave.onclick = closeModal;
    modal.classList.remove("hidden");
}

function receipt(title, target, values = [], extra = []) {
    const context = getContext(target || document.body);
    const now = new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    const details = values.filter(Boolean).join(" | ");
    const lines = [
        `<strong>Result:</strong> ${title}`,
        `<strong>Section:</strong> ${context.panelTitle}`,
        `<strong>Target:</strong> ${context.target}`,
        details ? `<strong>Details:</strong> ${details}` : "<strong>Details:</strong> No additional note entered",
        ...extra,
        `<strong>Time:</strong> ${now}`
    ];
    appendDashboardActivity(title);
    showToast(`✓ ${title}`);
    return { title: "Action receipt", lines };
}

function openPanel(panel, updateHistory = true) {
    const selectedView = document.querySelector(`[data-view="${panel}"]`);
    if (!selectedView) return;
    document.querySelectorAll("[data-panel]").forEach((button) => {
        const active = button.dataset.panel === panel;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll("[data-view]").forEach((view) => {
        view.classList.toggle("hidden", view !== selectedView);
    });
    const title = document.getElementById("panelTitle");
    if (title) title.textContent = panelTitles[panel] || "Dashboard";
    if (updateHistory && location.hash !== `#${panel}`) history.pushState(null, "", `#${panel}`);
    selectedView.focus({ preventScroll: true });
}

function animateStats() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    document.querySelectorAll(".dash-grid strong").forEach((stat) => {
        const match = stat.textContent.trim().match(/^(\d+)(.*)$/);
        if (!match) return;
        const target = Number(match[1]);
        const suffix = match[2];
        const started = performance.now();
        const tick = (now) => {
            const progress = Math.min((now - started) / 650, 1);
            stat.textContent = `${Math.round(target * (1 - Math.pow(1 - progress, 3)))}${suffix}`;
            if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    });
}

function readField(formId, name) {
    const form = document.getElementById(formId);
    return form?.querySelector(`[name="${name}"]`)?.value.trim();
}

function readPostApartmentForm() {
    return {
        title: readField("postApartmentForm", "title"),
        city: readField("postApartmentForm", "city"),
        locality: readField("postApartmentForm", "locality"),
        price: readField("postApartmentForm", "price"),
        type: readField("postApartmentForm", "type"),
        bhk: readField("postApartmentForm", "bhk"),
        deposit: readField("postApartmentForm", "deposit"),
        sqft: readField("postApartmentForm", "sqft")
    };
}

function readNearbyFields(target) {
    const scope = target?.closest?.(".dash-card, .dash-header, [data-view]") || document;
    return [...scope.querySelectorAll("input, select, textarea")]
        .map(field => {
            const label = field.closest("label")?.childNodes?.[0]?.textContent?.trim();
            const name = label || field.getAttribute("name") || field.placeholder || "Field";
            return `${name}: ${field.value || ""}`;
        })
        .filter(value => !value.endsWith(": "));
}

function incrementStat(name, amount) {
    const stat = document.querySelector(`[data-stat="${name}"]`);
    if (!stat) return;
    const next = Number(stat.textContent || 0) + amount;
    stat.textContent = String(next);
}

function addTask(text) {
    const list = document.getElementById("ownerTasks");
    if (!list) return;
    const li = document.createElement("li");
    li.textContent = text;
    list.prepend(li);
}

function addListing(title, type, status, price = "") {
    const table = document.querySelector('[data-table="listings"] tbody');
    if (!table) return;
    const row = document.createElement("tr");
    row.innerHTML = `<td>${title}${price ? ` - ${price}` : ""}</td><td>${type}</td><td><span class="status pending">${status}</span></td><td><button data-action="edit-row">Edit</button> <button data-action="activate-row">Make Live</button></td>`;
    table.appendChild(row);
}

function addLead(name, need, status) {
    const table = document.querySelector('[data-table="leads"] tbody');
    if (!table) return;
    const row = document.createElement("tr");
    row.innerHTML = `<td>${name}</td><td>${need}</td><td>${status}</td><td><button data-action="call-lead">Call</button> <button data-action="schedule-lead">Schedule</button></td>`;
    table.appendChild(row);
}

function addVisit(text) {
    const list = document.getElementById("visitList");
    if (!list) return;
    const span = document.createElement("span");
    span.textContent = text;
    list.appendChild(span);
}

function addPayment(item, amount, status) {
    const table = document.querySelector('[data-table="payments"] tbody');
    if (!table) return;
    const row = document.createElement("tr");
    row.innerHTML = `<td>${item}</td><td>${amount}</td><td>${status}</td><td><button data-action="mark-paid">Mark Paid</button></td>`;
    table.appendChild(row);
}

function addRentPayment(apartment, amount, reference) {
    let list = document.getElementById("rentPaymentHistory");
    if (!list) {
        const card = document.querySelector('[data-view="rentpay"] .dash-card');
        if (card) {
            card.insertAdjacentHTML("beforeend", '<h3>Payment History</h3><ul class="task-list" id="rentPaymentHistory"></ul>');
            list = document.getElementById("rentPaymentHistory");
        }
    }
    if (!list) return;
    const item = document.createElement("li");
    item.textContent = `${apartment} - ${amount} - ${reference}`;
    list.prepend(item);
}

function addServiceRequest(service, date, notes) {
    let list = document.getElementById("serviceRequests");
    if (!list) {
        const card = document.querySelector('[data-view="services"] .dash-card');
        if (card) {
            card.insertAdjacentHTML("beforeend", '<h3>Service Requests</h3><ul class="task-list" id="serviceRequests"></ul>');
            list = document.getElementById("serviceRequests");
        }
    }
    if (!list) return;
    if (list.children.length === 1 && list.children[0].textContent.toLowerCase().includes("no new")) list.innerHTML = "";
    const item = document.createElement("li");
    item.textContent = `${service} - ${date} - ${notes}`;
    list.prepend(item);
}

function addSupportTicket(issue, description) {
    let list = document.getElementById("supportTickets");
    if (!list) {
        const card = document.querySelector('[data-view="support"] .dash-card');
        if (card) {
            card.insertAdjacentHTML("beforeend", '<h3>Tickets</h3><ul class="task-list" id="supportTickets"></ul>');
            list = document.getElementById("supportTickets");
        }
    }
    if (!list) return;
    if (list.children.length === 1 && list.children[0].textContent.toLowerCase().includes("no active")) list.innerHTML = "";
    const item = document.createElement("li");
    item.textContent = `${issue} - ${description}`;
    list.prepend(item);
}

function ensureCustomerDashboardScaffold() {
    if (dashboardRole !== "customer") return;

    const overview = document.querySelector('[data-view="overview"]');
    if (overview && !document.getElementById("propertyActivityLog")) {
        overview.insertAdjacentHTML("beforeend", `
            <div class="activity-log" id="propertyActivityLog" aria-live="polite">
                <h3>Customer activity</h3>
                <ul><li><strong>Ready</strong><span>Use each PropertyDirect customer tab. Completed actions will appear here.</span></li></ul>
            </div>`);
    }

    const shortlist = document.querySelector('[data-view="shortlist"] .task-list');
    if (shortlist && !shortlist.querySelector("[data-action]")) {
        shortlist.classList.add("actionable-list");
        [...shortlist.querySelectorAll("li")].forEach(item => {
            const text = item.textContent.trim();
            item.innerHTML = `<span>${safeHtml(text)}</span><button data-action="contact-owner">Contact Owner</button><button data-action="schedule">Visit</button><button data-action="remove-shortlist">Remove</button>`;
        });
    }

    const contactsTable = document.querySelector('[data-view="contacts"] table');
    if (contactsTable && !contactsTable.textContent.includes("Status")) {
        contactsTable.querySelectorAll("tr").forEach((row, index) => {
            if (index === 0) {
                const header = document.createElement("th");
                header.textContent = "Status";
                row.insertBefore(header, row.lastElementChild);
            } else {
                const statusCell = document.createElement("td");
                statusCell.innerHTML = '<span class="status pending">Locked</span>';
                row.insertBefore(statusCell, row.lastElementChild);
            }
        });
    }

    const visitList = document.getElementById("visitList") || document.querySelector('[data-view="visits"] .pill-row');
    if (visitList && !visitList.id) visitList.id = "visitList";
    if (visitList && !visitList.querySelector("[data-action='complete-visit']")) {
        [...visitList.querySelectorAll("span")].forEach(item => {
            const text = item.textContent.trim();
            item.innerHTML = `${safeHtml(text)} <button data-action="complete-visit">Complete</button>`;
        });
    }

    const rentCard = document.querySelector('[data-view="rentpay"] .dash-card');
    if (rentCard && !document.getElementById("rentPayState")) {
        rentCard.querySelector("h3")?.insertAdjacentHTML("afterend", '<span class="inline-state" id="rentPayState">No payment recorded yet</span>');
    }
    if (rentCard && !document.getElementById("rentPaymentHistory")) {
        rentCard.insertAdjacentHTML("beforeend", '<h3>Payment History</h3><ul class="task-list" id="rentPaymentHistory"><li>No rent payment recorded yet</li></ul>');
    }

    const servicesCard = document.querySelector('[data-view="services"] .dash-card');
    if (servicesCard && !document.getElementById("serviceRequests")) {
        servicesCard.insertAdjacentHTML("beforeend", '<h3>Service Requests</h3><ul class="task-list" id="serviceRequests"><li>No new service requests</li></ul>');
    }

    const plansGrid = document.querySelector('[data-view="plans"] .dash-grid');
    if (plansGrid && !plansGrid.querySelector("[data-action]")) {
        [...plansGrid.querySelectorAll("article")].forEach((plan, index) => {
            const current = index === 1;
            plan.insertAdjacentHTML("beforeend", `<span class="status ${current ? "active" : "pending"}">${current ? "Current Plan" : "Available"}</span><button data-action="${current ? "current-plan" : "select-plan"}">${current ? "Current Plan" : "Select Plan"}</button>`);
        });
    }

    const supportCard = document.querySelector('[data-view="support"] .dash-card');
    if (supportCard && !document.getElementById("supportState")) {
        supportCard.querySelector("h3")?.insertAdjacentHTML("afterend", '<span class="inline-state" id="supportState">Ready</span>');
    }
    if (supportCard && !document.getElementById("supportTickets")) {
        supportCard.insertAdjacentHTML("beforeend", '<h3>Tickets</h3><ul class="task-list" id="supportTickets"><li>No active support tickets</li></ul>');
    }
}

function openModal(action, target = null) {
    ensureModal();
    const config = actionForms[action];
    if (!config || !modal) return false;
    activeModalTarget = target;

    modalTitle.textContent = config.title;
    modalText.textContent = config.text;
    modalFields.innerHTML = config.fields.map((field, index) => `
        <label>${field}<input data-modal-input="${index}" placeholder="${field}"></label>
    `).join("");
    modalSave.textContent = "Save";
    modalSave.onclick = () => {
        const values = [...modalFields.querySelectorAll("[data-modal-input]")].map(input => input.value.trim());
        const result = config.save(values);
        if (result?.lines) {
            showActionReceipt(result);
        } else {
            closeModal();
        }
    };
    modal.classList.remove("hidden");
    modalFields.querySelector("[data-modal-input]")?.focus();
    return true;
}

function closeModal() {
    modal?.classList.add("hidden");
    activeModalTarget = null;
}

function setRowStatus(button, label, cls) {
    const row = button.closest("tr");
    const status = row?.querySelector(".status") || row?.children[2];
    if (!status) return;
    status.className = `status ${cls}`;
    status.textContent = label;
}

function downloadText(filename, text) {
    const blob = new Blob([text], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}

function handleSimpleAction(action, target) {
    const context = getContext(target);
    const messages = {
        export: `Report exported from ${context.panelTitle}`,
        approve: `Approved ${context.target}`,
        save: `Saved ${context.panelTitle}`,
        search: "Matching apartments loaded",
        schedule: "Visit scheduler opened",
        support: `Support ticket raised for ${context.target}`,
        "add-row": `New row added in ${context.panelTitle}`,
        call: `Owner contact unlocked for ${context.target}`,
        pay: `Rent payment opened for ${context.target}`,
        "current-plan": "Premium plan is already active",
        "select-plan": `Free plan selected for ${context.target}`,
        receipt: `Receipt downloaded for ${context.target}`,
        "call-lead": `Lead call completed for ${context.target}`,
        "schedule-lead": `Lead moved to visit schedule: ${context.target}`,
        "edit-row": `Apartment row ready for editing: ${context.target}`,
        "activate-row": `Apartment listing is live: ${context.target}`,
        "deactivate-row": `Apartment listing deactivated: ${context.target}`,
        "mark-paid": `Payment marked paid for ${context.target}`,
        "download-owner-report": `Owner report downloaded from ${context.panelTitle}`
        ,
        "search-listings": "Opening matching apartment listings",
        "contact-owner": `Owner contact requested for ${context.target}`,
        "remove-shortlist": `Removed from shortlist: ${context.target}`,
        "complete-visit": `Visit completed: ${context.target}`,
        "manage-plan": `Plan editor opened for ${context.target}`,
        "resolve-task": `Item resolved: ${context.target}`
    };

    if (action === "activate-row") setRowStatus(target, "Live", "live");
    if (action === "deactivate-row") setRowStatus(target, "Inactive", "inactive");
    if (action === "approve") setRowStatus(target, "Live", "live");
    if (action === "add-row") {
        const table = target.closest(".dash-card")?.querySelector("table tbody");
        if (table) {
            const cells = table.querySelector("tr:last-child")?.children.length || 3;
            const row = document.createElement("tr");
            row.innerHTML = Array.from({ length: cells }, (_, index) => `<td>${index === 0 ? "New item" : index === cells - 1 ? "Active" : "Created"}</td>`).join("");
            table.appendChild(row);
        }
    }
    if (action === "search") {
        if (document.querySelector('[data-view="search"]')) {
            openPanel("search");
        } else {
            window.location.href = "/propertydirect/apartments";
            return;
        }
    }
    if (action === "search-listings") {
        const view = target.closest('[data-view="search"]');
        const inputs = view ? [...view.querySelectorAll("input, select")].map(field => field.value.trim()) : [];
        const params = new URLSearchParams({ city: inputs[0] || "Bangalore", q: inputs[1] || "", mode: (inputs[2] || "Rent").replace(" Apartment", "") });
        window.location.href = `/propertydirect/apartments?${params.toString()}`;
        return;
    }
    if (action === "contact-owner") {
        openPanel("contacts");
    }
    if (action === "remove-shortlist") {
        target.closest("li")?.remove();
    }
    if (action === "complete-visit") {
        const chip = target.closest("span");
        if (chip) {
            chip.textContent = `${chip.textContent.replace("Completed - ", "")} · Completed`;
            chip.classList.add("active");
        }
        target.textContent = "Completed";
        target.disabled = true;
    }
    if (action === "select-plan" || action === "current-plan") {
        document.querySelectorAll('[data-view="plans"] .dash-grid article .status').forEach(status => {
            status.textContent = "Available";
            status.className = "status pending";
        });
        const card = target.closest("article");
        const status = card?.querySelector(".status");
        if (status) {
            status.textContent = action === "current-plan" ? "Current Plan" : "Selected";
            status.className = "status active";
        }
        if (action === "select-plan") target.textContent = "Selected";
    }
    if (action === "schedule") {
        if (document.querySelector('[data-view="visits"]')) openPanel("visits");
    }
    if (action === "pay") {
        if (document.querySelector('[data-view="rentpay"]')) openPanel("rentpay");
    }
    if (action === "mark-paid") {
        const row = target.closest("tr");
        if (row?.children[2]) row.children[2].innerHTML = `<span class="status paid">Paid</span>`;
    }
    if (action === "download-owner-report") {
        downloadText("owner-apartment-report.txt", "PropertyDirect Owner Report\nLive apartments, leads, visits and payments exported.");
    }
    if (action === "receipt") {
        downloadText("payment-receipt.txt", "PropertyDirect Receipt\nPayment received successfully.");
    }
    persistDashboardState();
    showActionReceipt(receipt(messages[action] || `Completed ${context.target}`, target, action === "save" ? readNearbyFields(target) : []));
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
    document.querySelectorAll('[data-view="overview"] .dash-grid article').forEach((tile, index) => {
        const targetPanel = routes[index];
        if (!targetPanel || !document.querySelector(`[data-view="${targetPanel}"]`)) return;
        tile.dataset.categoryPanel = targetPanel;
        tile.tabIndex = 0;
        tile.setAttribute("role", "button");
        tile.setAttribute("aria-label", `Open ${panelTitles[targetPanel] || targetPanel}`);
    });

    document.querySelectorAll(".pill-row span").forEach(chip => {
        if (chip.querySelector("button")) return;
        chip.dataset.categoryAction = dashboardRole === "superadmin" ? "manage-plan" : "book-service";
        chip.tabIndex = 0;
        chip.setAttribute("role", "button");
    });

    document.querySelectorAll('[data-view="subscriptions"] .dash-grid article, [data-view="plans"] .dash-grid article').forEach(plan => {
        if (plan.querySelector("button")) return;
        plan.dataset.categoryAction = "manage-plan";
        plan.tabIndex = 0;
        plan.setAttribute("role", "button");
    });

    document.querySelectorAll(".task-list li").forEach(item => {
        if (item.querySelector("button")) return;
        item.dataset.categoryAction = "resolve-task";
        item.tabIndex = 0;
        item.setAttribute("role", "button");
    });

    document.querySelectorAll('[data-view]:not([data-view="overview"]) .dash-grid article, .report-bars > div').forEach(tile => {
        if (tile.querySelector("button") || tile.dataset.categoryAction) return;
        tile.dataset.categoryAction = "inspect";
        tile.tabIndex = 0;
        tile.setAttribute("role", "button");
    });
}

document.querySelectorAll("[data-panel]").forEach((button) => {
    button.addEventListener("click", () => openPanel(button.dataset.panel));
});

document.addEventListener("click", (event) => {
    const panelTile = event.target.closest("[data-category-panel]");
    if (panelTile) {
        openPanel(panelTile.dataset.categoryPanel);
        return;
    }
    const categoryAction = event.target.closest("[data-category-action]");
    if (categoryAction) {
        event.preventDefault();
        openModal(categoryAction.dataset.categoryAction, categoryAction);
        return;
    }
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;

    if (action === "close-modal") {
        closeModal();
        return;
    }

    event.preventDefault();
    if (openModal(action, button)) return;
    handleSimpleAction(action, button);
});

document.addEventListener("keydown", event => {
    const control = event.target.closest("[data-category-panel], [data-category-action]");
    if (control && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        control.click();
    }
    if (event.key === "Escape") closeModal();
});

window.addEventListener("hashchange", () => {
    const panel = location.hash.replace("#", "");
    if (panel) openPanel(panel, false);
});

restoreDashboardState();
ensureCustomerDashboardScaffold();
enhanceDashboardCategories();
wireAutosave();
const initialPanel = location.hash.replace("#", "");
openPanel(document.querySelector(`[data-view="${initialPanel}"]`) ? initialPanel : "overview", false);
animateStats();
