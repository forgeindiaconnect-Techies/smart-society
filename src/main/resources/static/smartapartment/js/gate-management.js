(() => {
    "use strict";
    if (document.body?.dataset.dashboardRole !== "admin") return;

    async function api(path, options = {}) {
        const response = await fetch(path, {
            ...options,
            headers: {Accept: "application/json", ...(options.body ? {"Content-Type": "application/json"} : {}), ...options.headers}
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || payload.detail || "Gate management request failed");
        return payload;
    }
    const notify = message => typeof window.showToast === "function" ? window.showToast(message) : window.alert(message);

    function mount() {
        if (document.getElementById("gateManagementPanel")) return;
        const host = document.querySelector('[data-view="overview"]') || document.querySelector('.main-content');
        if (!host) return;
        const panel = document.createElement("section");
        panel.id = "gateManagementPanel";
        panel.className = "card border-0 shadow-sm rounded-4 mb-4";
        panel.innerHTML = `
            <div class="card-header bg-transparent border-0 pt-4 px-4 d-flex flex-wrap justify-content-between align-items-center gap-3">
                <div><h4 class="fw-bold mb-1">Gate Management</h4><p class="text-muted mb-0">Create apartment gates and assign security guards without hardcoded gate numbers.</p></div>
                <button class="btn btn-primary rounded-pill" type="button" data-gate-new>Add Gate</button>
            </div>
            <div class="card-body px-4 pb-4">
                <form id="gateEditor" class="row g-3 bg-light rounded-4 p-3 mb-4 d-none">
                    <input type="hidden" name="id">
                    <div class="col-md-2"><label class="form-label">Gate number</label><input class="form-control" name="gateNumber" placeholder="Gate 1" required></div>
                    <div class="col-md-3"><label class="form-label">Gate name</label><input class="form-control" name="gateName" placeholder="Main Entrance" required></div>
                    <div class="col-md-2"><label class="form-label">Type</label><select class="form-select" name="gateType"><option>ENTRY</option><option>EXIT</option><option selected>BOTH</option></select></div>
                    <div class="col-md-3"><label class="form-label">Location</label><input class="form-control" name="location" placeholder="North side / Tower A"></div>
                    <div class="col-md-2"><label class="form-label">Status</label><select class="form-select" name="status"><option>ACTIVE</option><option>INACTIVE</option></select></div>
                    <div class="col-12 d-flex justify-content-end gap-2"><button class="btn btn-light" type="button" data-gate-cancel>Cancel</button><button class="btn btn-primary" type="submit">Save Gate</button></div>
                </form>
                <div class="table-responsive mb-4"><table class="table align-middle"><thead class="table-light"><tr><th>Gate</th><th>Type</th><th>Location</th><th>Status</th><th>Actions</th></tr></thead><tbody id="gateRows"><tr><td colspan="5">Loading gates…</td></tr></tbody></table></div>
                <hr>
                <h5 class="fw-bold mt-4">Assign Guard to Gate</h5>
                <form id="gateAssignmentForm" class="row g-3 align-items-end">
                    <div class="col-md-4"><label class="form-label">Security guard</label><select class="form-select" name="securityId" required></select></div>
                    <div class="col-md-3"><label class="form-label">Gate</label><select class="form-select" name="gateId" required></select></div>
                    <div class="col-md-2"><label class="form-label">Shift start</label><input class="form-control" type="time" name="shiftStart"></div>
                    <div class="col-md-2"><label class="form-label">Shift end</label><input class="form-control" type="time" name="shiftEnd"></div>
                    <div class="col-md-1"><button class="btn btn-outline-primary w-100" type="submit">Assign</button></div>
                </form>
            </div>`;
        host.prepend(panel);
    }

    let gateCache = [];
    async function refresh() {
        const [gates, team] = await Promise.all([api("/api/society/gates"), api("/api/society/team-users")]);
        gateCache = Array.isArray(gates) ? gates : [];
        const rows = document.getElementById("gateRows");
        rows.replaceChildren(...gateCache.map(gate => {
            const row = document.createElement("tr");
            row.innerHTML = `<td><strong></strong><div class="small text-muted"></div></td><td></td><td></td><td></td><td><div class="d-flex gap-2"><button class="btn btn-sm btn-outline-primary" type="button" data-gate-edit>Edit</button><button class="btn btn-sm btn-outline-danger" type="button" data-gate-delete>Deactivate</button></div></td>`;
            row.querySelector("strong").textContent = gate.gateNumber || gate.value;
            row.querySelector("td div.small").textContent = gate.gateName || "";
            row.children[1].textContent = gate.gateType || "BOTH";
            row.children[2].textContent = gate.location || "—";
            row.children[3].textContent = gate.status || "ACTIVE";
            row.querySelector("[data-gate-edit]").dataset.id = gate.id;
            row.querySelector("[data-gate-delete]").dataset.id = gate.id;
            return row;
        }));
        if (!gateCache.length) rows.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No gates configured.</td></tr>';
        const gateSelect = document.querySelector('#gateAssignmentForm [name="gateId"]');
        gateSelect.replaceChildren(...gateCache.filter(g => g.status === "ACTIVE").map(g => Object.assign(document.createElement("option"), {value: g.id, textContent: g.label || `${g.gateNumber} · ${g.gateName}`})));
        const guards = Array.isArray(team) ? team.filter(u => u.role === "SECURITY_STAFF") : [];
        const guardSelect = document.querySelector('#gateAssignmentForm [name="securityId"]');
        guardSelect.replaceChildren(...guards.map(g => Object.assign(document.createElement("option"), {value: g.id, textContent: g.name})));
    }

    function openEditor(gate = null) {
        const form = document.getElementById("gateEditor");
        form.reset(); form.classList.remove("d-none");
        if (gate) Object.entries(gate).forEach(([key, value]) => { if (form.elements[key]) form.elements[key].value = value ?? ""; });
    }

    document.addEventListener("click", async event => {
        const add = event.target.closest("[data-gate-new]");
        const cancel = event.target.closest("[data-gate-cancel]");
        const edit = event.target.closest("[data-gate-edit]");
        const del = event.target.closest("[data-gate-delete]");
        if (add) openEditor();
        if (cancel) document.getElementById("gateEditor")?.classList.add("d-none");
        if (edit) openEditor(gateCache.find(g => String(g.id) === edit.dataset.id));
        if (del && confirm("Deactivate this gate? New entries will no longer be allowed through it.")) {
            try { await api(`/api/society/gates/${del.dataset.id}`, {method: "DELETE"}); await refresh(); notify("Gate deactivated."); } catch (error) { notify(error.message); }
        }
    });

    document.addEventListener("submit", async event => {
        if (event.target?.id === "gateEditor") {
            event.preventDefault();
            const data = Object.fromEntries(new FormData(event.target));
            const id = data.id; delete data.id;
            try { await api(id ? `/api/society/gates/${id}` : "/api/society/gates", {method: id ? "PUT" : "POST", body: JSON.stringify(data)}); event.target.classList.add("d-none"); await refresh(); notify("Gate saved."); } catch (error) { notify(error.message); }
        }
        if (event.target?.id === "gateAssignmentForm") {
            event.preventDefault();
            const data = Object.fromEntries(new FormData(event.target));
            const securityId = data.securityId; delete data.securityId;
            if (!data.shiftStart) delete data.shiftStart; if (!data.shiftEnd) delete data.shiftEnd;
            data.gateId = Number(data.gateId);
            try { await api(`/api/society/security/${securityId}/gates`, {method: "POST", body: JSON.stringify(data)}); notify("Guard assigned to gate."); } catch (error) { notify(error.message); }
        }
    });

    document.addEventListener("DOMContentLoaded", async () => { mount(); try { await refresh(); } catch (error) { notify(error.message); } });
})();
