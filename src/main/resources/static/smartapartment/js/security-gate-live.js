(() => {
    "use strict";

    if (document.body?.dataset.dashboardRole !== "security") return;

    let residents = [];
    let gates = [
        {value: "Gate 1", label: "Gate 1 · Main Entrance"},
        {value: "Gate 2", label: "Gate 2 · Resident Entry"},
        {value: "Gate 3", label: "Gate 3 · Visitor Entry"},
        {value: "Service Gate", label: "Service Gate · Vendors & Deliveries"},
        {value: "Basement Gate", label: "Basement Gate · Parking Access"}
    ];

    const notify = message => {
        if (typeof window.showToast === "function") window.showToast(message);
        else window.alert(message);
    };

    async function api(path, options = {}) {
        const response = await fetch(path, {
            ...options,
            headers: {
                Accept: "application/json",
                ...(options.body ? {"Content-Type": "application/json"} : {}),
                ...options.headers
            }
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || payload.detail || "Security action could not be completed.");
        return payload;
    }

    function optionLabel(item) {
        return item.label || `${item.unitNo} · ${item.residentName}`;
    }

    function buildResidentSelect(name, id, required = true) {
        const select = document.createElement("select");
        select.className = "form-select shadow-none border-light-subtle";
        select.name = name;
        if (id) select.id = id;
        if (required) select.required = true;
        select.innerHTML = '<option value="">Select resident / flat</option>';
        residents.forEach(item => {
            const option = document.createElement("option");
            option.value = item.unitNo;
            option.dataset.residentId = item.residentId;
            option.dataset.phone = item.phone || "";
            option.textContent = optionLabel(item);
            select.appendChild(option);
        });
        return select;
    }

    function buildGateSelect(name, id, required = true) {
        const select = document.createElement("select");
        select.className = "form-select shadow-none border-light-subtle";
        select.name = name || "gateNumber";
        if (id) select.id = id;
        if (required) select.required = true;
        gates.forEach(gate => {
            const option = document.createElement("option");
            option.value = gate.value;
            option.textContent = gate.label || gate.value;
            select.appendChild(option);
        });
        return select;
    }

    function replaceInputWithResidentDropdown(input) {
        if (!input || input.dataset.residentDropdownReady) return;
        const select = buildResidentSelect(input.name || "unitNo", input.id || "", input.required);
        select.dataset.residentDropdownReady = "true";
        select.addEventListener("change", () => {
            const selected = select.selectedOptions[0];
            const form = select.closest("form");
            let hidden = form?.querySelector('input[name="residentId"][data-live-resident]');
            if (form && !hidden) {
                hidden = document.createElement("input");
                hidden.type = "hidden";
                hidden.name = "residentId";
                hidden.dataset.liveResident = "true";
                form.appendChild(hidden);
            }
            if (hidden) hidden.value = selected?.dataset.residentId || "";
        });
        input.replaceWith(select);
    }

    function hydrateStaticDropdowns() {
        replaceInputWithResidentDropdown(document.getElementById("walkinFlat"));
        replaceInputWithResidentDropdown(document.getElementById("targetFlat"));
        const staffArea = document.querySelector('#staffForm [name="assignedArea"]');
        replaceInputWithResidentDropdown(staffArea);
        hydrateGateSelect(document.getElementById("verificationGate"));
        hydrateGateSelect(document.getElementById("walkinGate"));
        hydrateGateSelect(document.getElementById("deliveryGate"));
    }

    function hydrateGateSelect(select) {
        if (!select || select.dataset.gateDropdownReady) return;
        const replacement = buildGateSelect(select.name || "gateNumber", select.id || "", select.required);
        replacement.dataset.gateDropdownReady = "true";
        select.replaceWith(replacement);
    }

    function patchDynamicWalkInModal() {
        const originalAppend = Element.prototype.appendChild;
        if (Element.prototype._securityResidentPatchReady) return;
        Element.prototype._securityResidentPatchReady = true;
        Element.prototype.appendChild = function patchedAppend(child) {
            const result = originalAppend.call(this, child);
            if (child?.id === "securityWalkInDialog") {
                setTimeout(() => {
                    const input = child.querySelector('[name="unitNo"]');
                    replaceInputWithResidentDropdown(input);
                    hydrateGateSelect(child.querySelector('[name="gateNumber"]'));
                }, 0);
            }
            return result;
        };
    }

    function ensureAssignmentPanel() {
        if (document.getElementById("securityGuardAssignmentPanel")) return;
        const host = document.querySelector('[data-view="overview"] .row.g-4.mb-4') || document.querySelector('[data-view="overview"]');
        if (!host) return;
        const panel = document.createElement("div");
        panel.id = "securityGuardAssignmentPanel";
        panel.className = "card border-0 shadow-sm rounded-4 mb-4";
        panel.innerHTML = `
            <div class="card-header bg-transparent border-0 pt-4 px-4 d-flex flex-wrap justify-content-between align-items-center gap-3">
                <div>
                    <h4 class="fw-bold mb-1">Security Guard Flat Assignments</h4>
                    <p class="text-muted mb-0">Guards can be mapped to selected flats, blocks, or common areas.</p>
                </div>
                <span class="badge bg-primary-subtle text-primary-emphasis border border-primary-subtle">Live backend</span>
            </div>
            <div class="card-body px-4 pb-4">
                <form id="securityAssignmentForm" class="row g-3 bg-light p-3 rounded-4 mb-3 d-none">
                    <div class="col-md-3"><label class="form-label fw-semibold">Security guard</label><select class="form-select" name="securityGuardId" required></select></div>
                    <div class="col-md-2"><label class="form-label fw-semibold">Assign by</label><select class="form-select" name="assignmentType"><option value="FLAT">Flat</option><option value="BLOCK">Block</option><option value="COMMON_AREA">Common area</option></select></div>
                    <div class="col-md-3"><label class="form-label fw-semibold">Flat / block value</label><input class="form-control" name="assignmentValue" required placeholder="A-101 or Block A"></div>
                    <div class="col-md-2"><label class="form-label fw-semibold">Shift</label><input class="form-control" name="shiftName" placeholder="Day / Night"></div>
                    <div class="col-md-2 d-flex align-items-end"><button class="btn btn-primary rounded-pill w-100" type="submit">Save</button></div>
                    <div class="col-12"><textarea class="form-control" name="notes" rows="2" placeholder="Notes / instructions for this guard"></textarea></div>
                </form>
                <div class="table-responsive">
                    <table class="table align-middle mb-0">
                        <thead class="table-light"><tr><th>Guard</th><th>Type</th><th>Assigned flats / block</th><th>Shift</th><th>Notes</th></tr></thead>
                        <tbody id="securityAssignmentRows"><tr><td colspan="5">Loading assignments…</td></tr></tbody>
                    </table>
                </div>
            </div>`;
        host.insertAdjacentElement("afterend", panel);
    }

    async function hydrateAssignmentPanel() {
        ensureAssignmentPanel();
        const rows = document.getElementById("securityAssignmentRows");
        const form = document.getElementById("securityAssignmentForm");
        if (!rows) return;
        const [assignments, teamUsers] = await Promise.all([
            api("/api/society/security/assignments"),
            api("/api/society/team-users").catch(() => [])
        ]);
        const guardSelect = form?.querySelector('[name="securityGuardId"]');
        const guards = Array.isArray(teamUsers) ? teamUsers.filter(user => user.role === "SECURITY_STAFF") : [];
        if (guardSelect && guards.length) {
            guardSelect.replaceChildren(...guards.map(guard => {
                const option = document.createElement("option");
                option.value = guard.id;
                option.textContent = `${guard.name} · ${guard.workShift || "Shift not set"}`;
                return option;
            }));
            form.classList.remove("d-none");
        }
        rows.replaceChildren(...assignments.map(item => {
            const row = document.createElement("tr");
            [item.securityGuardName, item.assignmentType, item.assignmentValue, item.shiftName, item.notes].forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value || "—";
                row.appendChild(cell);
            });
            return row;
        }));
        if (!assignments.length) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.colSpan = 5;
            cell.textContent = "No security guard flat assignments saved yet.";
            row.appendChild(cell);
            rows.replaceChildren(row);
        }
    }

    async function loadResidentsAndHydrate() {
        const [residentOptions, gateOptions] = await Promise.all([
            api("/api/society/security/resident-options"),
            api("/api/society/gates").catch(() => gates)
        ]);
        residents = Array.isArray(residentOptions) ? residentOptions : [];
        gates = Array.isArray(gateOptions) && gateOptions.length ? gateOptions : gates;
        hydrateStaticDropdowns();
        patchDynamicWalkInModal();
    }

    document.addEventListener("submit", async event => {
        if (event.target?.id !== "securityAssignmentForm") return;
        event.preventDefault();
        if (!event.target.reportValidity()) return;
        const submit = event.target.querySelector('[type="submit"]');
        const original = submit.textContent;
        submit.disabled = true;
        submit.textContent = "Saving…";
        try {
            await api("/api/society/security/assignments", {
                method: "POST",
                body: JSON.stringify(Object.fromEntries(new FormData(event.target).entries()))
            });
            event.target.reset();
            notify("Security guard assignment saved.");
            await hydrateAssignmentPanel();
            await loadResidentsAndHydrate();
        } catch (error) {
            notify(error.message);
        } finally {
            submit.disabled = false;
            submit.textContent = original;
        }
    }, true);

    document.addEventListener("DOMContentLoaded", async () => {
        try {
            await loadResidentsAndHydrate();
            await hydrateAssignmentPanel();
        } catch (error) {
            notify(error.message);
        }
    });
})();
