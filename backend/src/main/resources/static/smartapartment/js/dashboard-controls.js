(function () {
    "use strict";

    function isSmartDashboard() {
        return document.body && document.body.classList.contains("dashboard-body")
            && !document.body.matches('[data-platform="propertydirect"]');
    }

    if (!isSmartDashboard()) return;

    function toast(message) {
        if (typeof window.showToast === "function") {
            window.showToast(message);
            return;
        }
        var existing = document.getElementById("smartDashboardBridgeToast");
        var box = existing || document.createElement("div");
        box.id = "smartDashboardBridgeToast";
        box.textContent = message;
        box.style.cssText = "position:fixed;right:24px;bottom:24px;z-index:999999;background:#0f172a;color:#fff;border:1px solid rgba(255,255,255,.16);border-radius:12px;padding:12px 18px;font:800 13px/1.25 Arial,sans-serif;box-shadow:0 16px 34px rgba(15,23,42,.28);";
        if (!existing) document.body.appendChild(box);
        clearTimeout(box._timer);
        box._timer = setTimeout(function () { box.remove(); }, 2800);
    }

    function role() {
        return document.body.dataset.dashboardRole
            || (document.title || "dashboard").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
            || "dashboard";
    }

    function panel() {
        var active = document.querySelector(".nav-link.active[data-panel], [data-panel].active");
        return active?.dataset?.panel || (location.hash || "#overview").slice(1) || "overview";
    }

    function labelFor(target) {
        return (target.innerText || target.textContent || target.getAttribute("aria-label") || target.title || target.dataset.action || "Dashboard action")
            .trim()
            .replace(/\s+/g, " ");
    }

    function rowContext(target) {
        var row = target.closest("tr");
        if (row) return row.innerText.trim().replace(/\s+/g, " ").slice(0, 300);
        var card = target.closest(".card, .dash-card, article, .list-group-item");
        if (card) return card.innerText.trim().replace(/\s+/g, " ").slice(0, 300);
        return labelFor(target);
    }

    function actionType(target) {
        var action = target.dataset.action || "";
        if (action) return action;
        var lower = labelFor(target).toLowerCase();
        if (lower.includes("pay")) return "pay";
        if (lower.includes("book") || lower.includes("reserve")) return "book";
        if (lower.includes("close") || lower.includes("resolved")) return "close";
        if (lower.includes("save") || lower.includes("submit")) return "save";
        if (lower.includes("download") || lower.includes("print")) return "export";
        return "button-click";
    }

    async function persist(target) {
        var response = await fetch("/api/workflows", {
            method: "POST",
            credentials: "same-origin",
            headers: {"Content-Type": "application/json", Accept: "application/json"},
            body: JSON.stringify({
                workspace: "SmartSociety",
                dashboardRole: role(),
                panel: panel(),
                actionType: actionType(target),
                targetLabel: labelFor(target),
                details: {
                    context: rowContext(target),
                    id: target.id || "",
                    className: target.className || ""
                }
            })
        });
        var payload = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(payload.message || payload.error || "Dashboard login is required");
        return payload;
    }

    function updateVisualState(target) {
        var action = actionType(target);
        var row = target.closest("tr");
        if (row && /close|resolve/i.test(action)) {
            var last = row.cells[row.cells.length - 1];
            if (last) last.innerHTML = '<span class="text-success fw-bold small">Closed</span>';
        }
        if (row && /pay/i.test(action)) {
            var badge = row.querySelector(".badge");
            if (badge) {
                badge.className = "badge bg-success";
                badge.textContent = "Paid";
            }
        }
    }

    function shouldBridge(target) {
        if (!target || target.disabled) return false;
        if (target.closest(".modal, .dropdown-menu")) return false;
        if (target.closest("form")) return false;
        if (target.matches("[data-panel], [data-bs-toggle], [data-sidebar-close], [data-sidebar-open]")) return false;
        var action = target.dataset.action || "";
        if (!action) return false;
        if (["register", "plan", "superadmin-login", "dashboard-login", "search", "filter", "platform"].indexOf(action) !== -1) return false;
        return true;
    }

    document.addEventListener("click", async function (event) {
        var target = event.target.closest("button[data-action], a[data-action], [role='button'][data-action]");
        if (!shouldBridge(target)) return;
        event.preventDefault();
        if (target.dataset.smartPersisting === "true") return;
        target.dataset.smartPersisting = "true";
        var original = target.textContent;
        try {
            target.setAttribute("aria-busy", "true");
            await persist(target);
            updateVisualState(target);
            toast(labelFor(target) + " saved to backend.");
        } catch (error) {
            toast(error.message || "Dashboard login is required.");
        } finally {
            target.removeAttribute("aria-busy");
            target.textContent = original;
            delete target.dataset.smartPersisting;
        }
    }, true);
})();
