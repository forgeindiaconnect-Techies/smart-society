(() => {
    "use strict";
    if (document.body?.dataset.dashboardRole !== "resident") return;
    const notify = message => typeof window.showToast === "function" ? window.showToast(message) : window.alert(message);
    async function api(path, options = {}) {
        const response = await fetch(path, {...options, headers: {Accept: "application/json", ...options.headers}});
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || "Unable to update visitor approval");
        return payload;
    }
    function mount() {
        if (document.getElementById("residentGateApprovals")) return;
        const host = document.querySelector('[data-view="visitors"]') || document.querySelector('[data-view="overview"]');
        if (!host) return;
        const panel = document.createElement("div");
        panel.id = "residentGateApprovals";
        panel.className = "card border-0 shadow-sm rounded-4 mb-4";
        panel.innerHTML = `<div class="card-header bg-transparent border-0 pt-4 px-4"><h4 class="fw-bold mb-1">Gate Approval Requests</h4><p class="text-muted mb-0">Approve or reject visitors waiting at an apartment gate.</p></div><div class="card-body px-4 pb-4"><div id="residentGateApprovalRows" class="d-grid gap-3"><span class="text-muted">Loading approval requests…</span></div></div>`;
        host.prepend(panel);
    }
    async function refresh() {
        const entries = await api("/api/society/gate-entries");
        const pending = Array.isArray(entries) ? entries.filter(e => String(e.approvalStatus).toUpperCase() === "PENDING" || String(e.status).toUpperCase() === "PENDING_APPROVAL") : [];
        const rows = document.getElementById("residentGateApprovalRows");
        rows.replaceChildren(...pending.map(entry => {
            const card = document.createElement("div");
            card.className = "border rounded-4 p-3 d-flex flex-wrap justify-content-between align-items-center gap-3";
            card.innerHTML = `<div><strong class="d-block"></strong><span class="small text-muted"></span><div class="small mt-1"></div></div><div class="d-flex gap-2"><button class="btn btn-outline-danger btn-sm" data-reject>Reject</button><button class="btn btn-success btn-sm" data-approve>Approve</button></div>`;
            card.querySelector("strong").textContent = entry.visitorName || entry.name || "Visitor";
            card.querySelector("span").textContent = `${entry.visitorCategory || "Guest"} · ${entry.entryGateNumber || "Gate"}`;
            card.querySelector("div.small.mt-1").textContent = entry.purpose || "Visit";
            card.querySelector("[data-reject]").dataset.id = entry.id;
            card.querySelector("[data-approve]").dataset.id = entry.id;
            return card;
        }));
        if (!pending.length) rows.innerHTML = '<span class="text-muted">No visitor approvals are waiting.</span>';
    }
    document.addEventListener("click", async event => {
        const approve = event.target.closest("[data-approve]");
        const reject = event.target.closest("[data-reject]");
        if (!approve && !reject) return;
        const button = approve || reject; button.disabled = true;
        try { await api(`/api/society/gate-entries/${button.dataset.id}/${approve ? "approve" : "reject"}`, {method: "PATCH"}); await refresh(); notify(approve ? "Visitor approved." : "Visitor rejected."); } catch (error) { notify(error.message); } finally { button.disabled = false; }
    });
    document.addEventListener("DOMContentLoaded", async () => { mount(); try { await refresh(); } catch (error) { notify(error.message); } });
})();
