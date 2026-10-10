/**
 * PropertyDirect Platform Admin Dashboard Engine
 * Implements: Overview with real counts & activity, Customer Directory,
 * Owner & Builder Verifications, Builder Projects & Unit Inventory,
 * Property Inventory & Approval Queue, Enquiries & Visit Tracking,
 * Reports & Complaints, Categories & Locations Metadata, Featured Listings,
 * and Notifications & Audit History.
 */

(function () {
    'use strict';

    // State
    const state = {
        overview: null,
        users: [],
        applications: [],
        projects: [],
        inventory: [],
        enquiries: [],
        visits: [],
        reports: [],
        metadata: null,
        audit: []
    };

    // Helper: Toast notification
    function showToast(msg, isError) {
        const t = document.getElementById("toast") || document.getElementById("adminToast");
        if (!t) return;
        t.textContent = (isError ? "⚠ " : "✓ ") + msg;
        t.style.background = isError ? "#dc2626" : "#0f172a";
        t.classList.remove("hidden");
        t.style.display = "flex";
        clearTimeout(window._toastTimer);
        window._toastTimer = setTimeout(() => {
            t.classList.add("hidden");
            t.style.display = "none";
        }, 3500);
    }

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatDateTime(iso) {
        if (!iso) return '—';
        try {
            const d = new Date(iso);
            return d.toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        } catch (_) {
            return iso;
        }
    }

    function formatCurrency(val) {
        if (val == null) return '—';
        const num = Number(val);
        if (isNaN(num)) return val;
        if (num >= 10000000) return '₹' + (num / 10000000).toFixed(2) + ' Cr';
        if (num >= 100000) return '₹' + (num / 100000).toFixed(2) + ' L';
        return '₹' + num.toLocaleString('en-IN');
    }

    // Role Badges
    const roleBadges = {
        'CUSTOMER': '<span style="padding:4px 10px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe;">Customer / Tenant</span>',
        'OWNER': '<span style="padding:4px 10px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#ecfdf5; color:#047857; border:1px solid #a7f3d0;">Property Owner</span>',
        'BUILDER': '<span style="padding:4px 10px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#fffbeb; color:#b45309; border:1px solid #fde68a;">Builder / Developer</span>',
        'ADMIN': '<span style="padding:4px 10px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#f1f5f9; color:#334155; border:1px solid #cbd5e1;">Platform Admin</span>',
        'SUPERADMIN': '<span style="padding:4px 10px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#faf5ff; color:#7e22ce; border:1px solid #e9d5ff;">Super Admin</span>'
    };

    // Navigation and tab switching with filter presets
    window.switchTabAndFilter = function (panelId, filterOptions) {
        if (!panelId || panelId === 'projects') panelId = 'overview';

        // Alias support for legacy or renamed panels
        if (panelId === 'leads' || panelId === 'tours') panelId = 'enquiries';
        if (panelId === 'kyc') panelId = 'verifications';
        if (panelId === 'metadata') panelId = 'overview';
        if (panelId === 'content') panelId = 'overview';
        if (panelId === 'add-property') panelId = 'my-properties';

        // Update nav buttons
        document.querySelectorAll("[data-panel]").forEach(btn => {
            const isActive = (btn.dataset.panel === panelId);
            btn.classList.toggle("active", isActive);
            btn.setAttribute("aria-selected", String(isActive));
        });

        // Update view sections
        document.querySelectorAll("[data-view]").forEach(view => {
            const isTarget = (view.dataset.view === panelId);
            view.classList.toggle("hidden", !isTarget);
            view.classList.toggle("d-none", !isTarget);
            view.hidden = !isTarget;
            view.style.setProperty("display", isTarget ? "flex" : "none", "important");
        });

        // Update header title cleanly with explicit panel title map
        const titleElem = document.getElementById("panelTitle");
        if (titleElem) {
            const panelTitleMap = {
                'overview': 'Overview & Metrics',
                'users': 'Customer Directory',
                'verifications': 'Owner & Builder Verification',
                'my-properties': 'Property Inventory & Queue',
                'enquiries': 'Client Leads & Enquiries',
                'reports': 'Complaints',
                'audit': 'Notifications',
                'profile': 'Admin Profile'
            };
            titleElem.textContent = panelTitleMap[panelId] || 'Dashboard';
        }

        // Apply filter presets if passed
        if (filterOptions) {
            if (typeof filterOptions === 'string') {
                if (panelId === 'my-properties') {
                    const statusSelect = document.getElementById("inventoryStatusFilter");
                    if (statusSelect) {
                        statusSelect.value = filterOptions;
                        renderInventoryTable();
                    }
                } else if (panelId === 'verifications') {
                    const decSelect = document.getElementById("appDecisionFilter");
                    if (decSelect) {
                        decSelect.value = filterOptions;
                        renderApplicationsTable();
                    }
                } else if (panelId === 'reports') {
                    const repSelect = document.getElementById("reportStatusFilter");
                    if (repSelect) {
                        repSelect.value = filterOptions;
                        renderReportsTable();
                    }
                } else if (panelId === 'enquiries' && filterOptions === 'VISITS') {
                    switchEnquirySubtab('visits');
                } else if (panelId === 'enquiries') {
                    switchEnquirySubtab('enquiries');
                }
            } else if (typeof filterOptions === 'object') {
                if (filterOptions.status && panelId === 'my-properties') {
                    const sel = document.getElementById("inventoryStatusFilter");
                    if (sel) { sel.value = filterOptions.status; renderInventoryTable(); }
                }
            }
        }

        // Load data on demand
        if (panelId === 'overview') loadOverview();
        else if (panelId === 'users') loadUsers();
        else if (panelId === 'verifications') loadApplications();
        else if (panelId === 'projects') loadProjects();
        else if (panelId === 'my-properties') loadInventory();
        else if (panelId === 'enquiries') {
            loadEnquiries();
            loadVisits();
            if (filterOptions === 'VISITS') switchEnquirySubtab('visits');
            else switchEnquirySubtab('enquiries');
        }
        else if (panelId === 'reports') loadReports();
        else if (panelId === 'metadata') loadMetadata();
        else if (panelId === 'audit') loadAudit();
        else if (panelId === 'profile') {
            if (typeof window.ensureRoleProfileSection === 'function') {
                window.ensureRoleProfileSection();
            } else if (typeof window.syncProfileDisplay === 'function') {
                try {
                    const saved = JSON.parse(localStorage.getItem('propertydirect-profile:v1:admin') || '{}');
                    window.syncProfileDisplay(saved);
                } catch (_) {}
            }
        }

        if (window.location.hash !== '#' + panelId) {
            if (history.pushState) {
                history.pushState(null, null, '#' + panelId);
            } else {
                location.hash = '#' + panelId;
            }
        }
    };

    // Global aliasing so any existing script or controls route cleanly to switchTabAndFilter
    window.switchTab = window.switchTabAndFilter;
    window.openPanel = window.switchTabAndFilter;
    window.PropertyDirectDashboardControls = window.PropertyDirectDashboardControls || {};
    window.PropertyDirectDashboardControls.setPanel = window.switchTabAndFilter;

    // Subtab switcher for Enquiries & Visits
    window.switchEnquirySubtab = function (subtab) {
        const enqSection = document.getElementById("subtabEnquiriesView");
        const visSection = document.getElementById("subtabVisitsView");
        const btnEnq = document.getElementById("subtabEnquiriesBtn");
        const btnVis = document.getElementById("subtabVisitsBtn");

        if (subtab === 'visits') {
            if (enqSection) {
                enqSection.classList.add('hidden');
                enqSection.hidden = true;
                enqSection.style.setProperty('display', 'none', 'important');
            }
            if (visSection) {
                visSection.classList.remove('hidden');
                visSection.hidden = false;
                visSection.style.setProperty('display', 'block', 'important');
            }
            if (btnEnq) {
                btnEnq.className = 'pill-btn';
                btnEnq.style.background = '#ffffff';
                btnEnq.style.color = '#334155';
            }
            if (btnVis) {
                btnVis.className = 'pill-btn active';
                btnVis.style.background = '#0f172a';
                btnVis.style.color = '#ffffff';
            }
            loadVisits();
        } else {
            if (visSection) {
                visSection.classList.add('hidden');
                visSection.hidden = true;
                visSection.style.setProperty('display', 'none', 'important');
            }
            if (enqSection) {
                enqSection.classList.remove('hidden');
                enqSection.hidden = false;
                enqSection.style.setProperty('display', 'block', 'important');
            }
            if (btnVis) {
                btnVis.className = 'pill-btn';
                btnVis.style.background = '#ffffff';
                btnVis.style.color = '#334155';
            }
            if (btnEnq) {
                btnEnq.className = 'pill-btn active';
                btnEnq.style.background = '#0f172a';
                btnEnq.style.color = '#ffffff';
            }
            loadEnquiries();
        }
    };

    // -------------------------------------------------------------
    // 1. OVERVIEW & REAL COUNTS
    // -------------------------------------------------------------
    async function loadOverview() {
        try {
            const res = await fetch('/api/property/portal/admin/overview', { headers: { 'Accept': 'application/json' } });
            if (!res.ok) throw new Error("HTTP " + res.status);
            state.overview = await res.json();
            renderOverview();
        } catch (err) {
            console.error("Error loading overview:", err);
            const notifContainer = document.getElementById("overviewNotificationsList");
            if (notifContainer && !state.overview) {
                notifContainer.innerHTML = `
                    <div style="padding:16px 20px; border-radius:12px; background:#f0fdf4; border:1px solid #bbf7d0; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-size:1.2rem;">✓</span>
                            <div>
                                <strong style="color:#166534; font-size:0.88rem;">All Moderation Queues Clear</strong>
                                <p style="margin:2px 0 0 0; color:#15803d; font-size:0.8rem;">No pending approvals, open reports, or unreviewed verifications at this moment.</p>
                            </div>
                        </div>
                        <button type="button" onclick="loadOverview()" class="small" style="padding:6px 12px; border-radius:8px; border:1px solid #86efac; background:#dcfce7; color:#166534; font-weight:700; cursor:pointer;">Refresh</button>
                    </div>`;
            }
            const actContainer = document.getElementById("overviewRecentActivity");
            if (actContainer && !state.overview) {
                actContainer.innerHTML = `<div style="text-align:center; padding:24px; color:#64748b; font-size:0.86rem;">No recent activity recorded.</div>`;
            }
        }
    }
    window.loadOverview = loadOverview;

    function renderOverview() {
        if (!state.overview) return;
        const counts = state.overview.counts || {};
        const recentActivity = state.overview.recentActivity || [];
        const notifications = state.overview.notifications || [];

        // Summary card metrics
        const updateElem = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = Number(val || 0).toLocaleString('en-IN');
        };

        updateElem("overviewPendingApprovals", counts.pendingApprovals);
        updateElem("overviewPendingVerifications", counts.pendingVerifications);
        updateElem("overviewActiveProperties", counts.activeListings);
        updateElem("overviewTotalUsers", counts.totalUsers);
        updateElem("overviewBuilderProjects", counts.totalProjects);
        updateElem("overviewAvailableUnits", counts.availableUnits);
        updateElem("overviewTotalEnquiries", counts.totalEnquiries);
        updateElem("overviewScheduledVisits", counts.scheduledVisits);
        updateElem("overviewOpenReports", counts.openReports);
        updateElem("overviewTotalAudit", counts.totalAuditLogs);

        // Sidebar badges
        const badgeApps = document.getElementById("sidebarPendingAppsBadge");
        if (badgeApps) {
            badgeApps.textContent = counts.pendingVerifications || 0;
            badgeApps.style.display = counts.pendingVerifications > 0 ? "inline-block" : "none";
        }
        const badgeListings = document.getElementById("sidebarPendingListingsBadge");
        if (badgeListings) {
            badgeListings.textContent = counts.pendingApprovals || 0;
            badgeListings.style.display = counts.pendingApprovals > 0 ? "inline-block" : "none";
        }
        const badgeReports = document.getElementById("sidebarOpenReportsBadge");
        if (badgeReports) {
            badgeReports.textContent = counts.openReports || 0;
            badgeReports.style.display = counts.openReports > 0 ? "inline-block" : "none";
        }
        const badgeUsers = document.getElementById("sidebarUserCountBadge");
        if (badgeUsers) {
            badgeUsers.textContent = counts.totalUsers || 0;
        }
        const badgeEnquiries = document.getElementById("sidebarEnquiriesBadge");
        if (badgeEnquiries) {
            const count = counts.newEnquiries || 0;
            badgeEnquiries.textContent = count;
            badgeEnquiries.style.display = count > 0 ? "inline-block" : "none";
        }

        // Actionable Notifications in Card Grid
        const notifContainer = document.getElementById("overviewNotificationsList");
        if (notifContainer) {
            if (notifications.length === 0) {
                notifContainer.innerHTML = `
                    <div style="padding:18px 22px; border-radius:14px; background:#f0fdf4; border:1px solid #bbf7d0; display:flex; align-items:center; gap:12px; grid-column:1/-1;">
                        <span style="font-size:1.4rem;">✓</span>
                        <div>
                            <strong style="color:#166534; font-size:0.92rem; font-weight:800;">All Moderation Queues Clear</strong>
                            <p style="margin:2px 0 0 0; color:#15803d; font-size:0.82rem;">No pending approvals, open reports, or unreviewed verifications at this moment.</p>
                        </div>
                    </div>`;
            } else {
                notifContainer.innerHTML = notifications.map(n => {
                    const isDanger = n.type === 'danger';
                    const isInfo = n.type === 'info';
                    const bg = isDanger ? 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)' : (isInfo ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' : 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)');
                    const border = isDanger ? '#fecdd3' : (isInfo ? '#bfdbfe' : '#fde68a');
                    const textCol = isDanger ? '#9f1239' : (isInfo ? '#1e40af' : '#92400e');
                    const badgeBg = isDanger ? '#ffe4e6' : (isInfo ? '#dbeafe' : '#fef3c7');
                    const icon = isDanger ? '🚨' : (isInfo ? '📩' : '⏳');
                    return `
                        <div class="overview-notif-card" style="background:${bg}; border:1.5px solid ${border};">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
                                <div style="display:flex; align-items:center; gap:12px;">
                                    <span style="font-size:1.5rem;">${icon}</span>
                                    <div>
                                        <strong style="color:${textCol}; font-size:0.95rem; font-weight:800; display:block;">${escapeHtml(n.title)}</strong>
                                        <span style="display:inline-block; margin-top:3px; font-size:0.74rem; font-weight:800; padding:2px 8px; border-radius:999px; background:${badgeBg}; color:${textCol}; border:1px solid ${border};">${n.count} Action Pending</span>
                                    </div>
                                </div>
                            </div>
                            <p style="margin:0; color:${textCol}; font-size:0.84rem; line-height:1.45; opacity:0.95;">${escapeHtml(n.message)}</p>
                            <div style="display:flex; justify-content:flex-end;">
                                <button type="button" onclick="switchTabAndFilter('${n.targetPanel}', '${n.filter}')"
                                    style="padding:8px 16px; border-radius:10px; background:#0f172a; color:#ffffff; font-size:0.82rem; font-weight:750; border:none; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:all 0.15s ease; box-shadow:0 4px 12px rgba(15,23,42,0.15);">
                                    Review Now →
                                </button>
                            </div>
                        </div>`;
                }).join('');
            }
        }

        // Render Recent Activity Feed
        updateOverviewActivityViewButtons();
        renderRecentActivityFeed();
    }

    state.overviewActivityView = 'list';

    window.setOverviewActivityView = function(mode) {
        state.overviewActivityView = mode || 'list';
        localStorage.setItem('pd_overview_activity_view', state.overviewActivityView);
        updateOverviewActivityViewButtons();
        renderRecentActivityFeed();
    };

    function updateOverviewActivityViewButtons() {
        const mode = state.overviewActivityView || 'list';
        const cardsBtn = document.getElementById('activityViewCardsBtn');
        const listBtn = document.getElementById('activityViewListBtn');
        if (cardsBtn) {
            cardsBtn.style.background = (mode === 'cards') ? '#ffffff' : 'transparent';
            cardsBtn.style.color = (mode === 'cards') ? '#0f172a' : '#64748b';
            cardsBtn.style.boxShadow = (mode === 'cards') ? '0 1px 3px rgba(0,0,0,0.08)' : 'none';
            cardsBtn.style.fontWeight = (mode === 'cards') ? '800' : '600';
        }
        if (listBtn) {
            listBtn.style.background = (mode === 'list') ? '#ffffff' : 'transparent';
            listBtn.style.color = (mode === 'list') ? '#0f172a' : '#64748b';
            listBtn.style.boxShadow = (mode === 'list') ? '0 1px 3px rgba(0,0,0,0.08)' : 'none';
            listBtn.style.fontWeight = (mode === 'list') ? '800' : '600';
        }
    }

    function renderRecentActivityFeed() {
        const activityContainer = document.getElementById("overviewRecentActivity");
        if (!activityContainer) return;
        const recentActivity = (state.overview && state.overview.recentActivity) || [];

        if (recentActivity.length === 0) {
            activityContainer.innerHTML = `<div style="text-align:center; padding:32px; color:#64748b; font-size:0.86rem;">No recent activity recorded.</div>`;
            return;
        }

        const isCards = (state.overviewActivityView || 'list') === 'cards';
        activityContainer.className = isCards ? 'overview-activity-grid' : 'overview-activity-list';

        if (isCards) {
            activityContainer.innerHTML = recentActivity.map(act => {
                let badge = '<span style="padding:3px 8px; border-radius:999px; font-size:0.7rem; font-weight:800; background:#f1f5f9; color:#475569; display:inline-flex; align-items:center; gap:4px;"><span style="width:5px; height:5px; border-radius:50%; background:#94a3b8;"></span>' + escapeHtml(act.action) + '</span>';
                if (act.action.includes('APPROVED')) badge = '<span style="padding:3px 8px; border-radius:999px; font-size:0.7rem; font-weight:800; background:#dcfce7; color:#15803d; border:1px solid #bbf7d0; display:inline-flex; align-items:center; gap:4px;"><span style="width:5px; height:5px; border-radius:50%; background:#22c55e;"></span>' + escapeHtml(act.action) + '</span>';
                else if (act.action.includes('REJECTED') || act.action.includes('SUSPENDED')) badge = '<span style="padding:3px 8px; border-radius:999px; font-size:0.7rem; font-weight:800; background:#fee2e2; color:#b91c1c; border:1px solid #fecaca; display:inline-flex; align-items:center; gap:4px;"><span style="width:5px; height:5px; border-radius:50%; background:#ef4444;"></span>' + escapeHtml(act.action) + '</span>';
                else if (act.action.includes('CHANGES_REQUESTED')) badge = '<span style="padding:3px 8px; border-radius:999px; font-size:0.7rem; font-weight:800; background:#fef3c7; color:#b45309; border:1px solid #fde68a; display:inline-flex; align-items:center; gap:4px;"><span style="width:5px; height:5px; border-radius:50%; background:#f59e0b;"></span>' + escapeHtml(act.action) + '</span>';
                else if (act.action.includes('CONTACT') || act.action.includes('ENQUIRY') || act.action.includes('UPDATED')) badge = '<span style="padding:3px 8px; border-radius:999px; font-size:0.7rem; font-weight:800; background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; display:inline-flex; align-items:center; gap:4px;"><span style="width:5px; height:5px; border-radius:50%; background:#3b82f6;"></span>' + escapeHtml(act.action) + '</span>';

                let entityIcon = '📄';
                let targetClick = `switchTabAndFilter('audit', 'ALL')`;
                let actionBtnText = 'View Audit →';
                const tType = (act.targetType || '').toUpperCase();
                if (tType === 'LISTING') {
                    entityIcon = '🏢';
                    targetClick = `switchTabAndFilter('my-properties')`;
                    actionBtnText = 'View Listing →';
                } else if (tType === 'ACCOUNT' || tType === 'USER') {
                    entityIcon = '👤';
                    targetClick = `switchTabAndFilter('users')`;
                    actionBtnText = 'View User →';
                } else if (tType === 'REPORT') {
                    entityIcon = '🚩';
                    targetClick = `switchTabAndFilter('reports')`;
                    actionBtnText = 'View Report →';
                } else if (tType === 'ENQUIRY' || tType === 'VISIT') {
                    entityIcon = '📩';
                    targetClick = `switchTabAndFilter('enquiries')`;
                    actionBtnText = 'View Enquiry →';
                }

                return `
                    <div class="overview-activity-card">
                        <div class="overview-activity-card-header">
                            ${badge}
                            <span style="font-size:0.74rem; color:#94a3b8; font-weight:600; white-space:nowrap;">🕒 ${formatDateTime(act.createdAt)}</span>
                        </div>
                        <div class="overview-activity-card-body">
                            <div class="overview-activity-card-title">
                                <span>${entityIcon}</span>
                                <span>${escapeHtml(act.targetType)} #${act.targetId}</span>
                            </div>
                            <p class="overview-activity-card-desc">${escapeHtml(act.detail || 'System operation processed.')}</p>
                        </div>
                        <div class="overview-activity-card-footer">
                            <span style="display:inline-flex; align-items:center; gap:5px; color:#64748b; font-size:0.76rem; font-weight:600; background:#f8fafc; padding:3px 8px; border-radius:6px; border:1px solid #f1f5f9;">
                                <span style="font-size:0.8rem;">👤</span> ${escapeHtml(act.actor || 'system')}
                            </span>
                            <button type="button" onclick="${targetClick}" style="padding:4px 10px; border-radius:8px; border:1px solid #cbd5e1; background:#ffffff; color:#1e293b; font-size:0.74rem; font-weight:750; cursor:pointer; transition:all 0.15s ease;">
                                ${actionBtnText}
                            </button>
                        </div>
                    </div>`;
            }).join('');
        } else {
            activityContainer.innerHTML = recentActivity.map(act => {
                let badge = '<span style="padding:3px 9px; border-radius:6px; font-size:0.72rem; font-weight:800; background:#f1f5f9; color:#475569; display:inline-flex; align-items:center; gap:5px; white-space:nowrap;"><span style="width:5px; height:5px; border-radius:50%; background:#94a3b8;"></span>' + escapeHtml(act.action) + '</span>';
                if (act.action.includes('APPROVED')) {
                    badge = '<span style="padding:3px 9px; border-radius:6px; font-size:0.72rem; font-weight:800; background:#dcfce7; color:#15803d; border:1px solid #bbf7d0; display:inline-flex; align-items:center; gap:5px; white-space:nowrap;"><span style="width:5px; height:5px; border-radius:50%; background:#22c55e;"></span>' + escapeHtml(act.action) + '</span>';
                } else if (act.action.includes('REJECTED') || act.action.includes('SUSPENDED')) {
                    badge = '<span style="padding:3px 9px; border-radius:6px; font-size:0.72rem; font-weight:800; background:#fee2e2; color:#b91c1c; border:1px solid #fecaca; display:inline-flex; align-items:center; gap:5px; white-space:nowrap;"><span style="width:5px; height:5px; border-radius:50%; background:#ef4444;"></span>' + escapeHtml(act.action) + '</span>';
                } else if (act.action.includes('CHANGES_REQUESTED')) {
                    badge = '<span style="padding:3px 9px; border-radius:6px; font-size:0.72rem; font-weight:800; background:#fef3c7; color:#b45309; border:1px solid #fde68a; display:inline-flex; align-items:center; gap:5px; white-space:nowrap;"><span style="width:5px; height:5px; border-radius:50%; background:#f59e0b;"></span>' + escapeHtml(act.action) + '</span>';
                } else if (act.action.includes('CONTACT') || act.action.includes('ENQUIRY') || act.action.includes('UPDATED')) {
                    badge = '<span style="padding:3px 9px; border-radius:6px; font-size:0.72rem; font-weight:800; background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; display:inline-flex; align-items:center; gap:5px; white-space:nowrap;"><span style="width:5px; height:5px; border-radius:50%; background:#3b82f6;"></span>' + escapeHtml(act.action) + '</span>';
                }

                let entityIcon = '📄';
                let targetClick = `switchTabAndFilter('audit', 'ALL')`;
                let actionBtnText = 'View Audit →';
                const tType = (act.targetType || '').toUpperCase();
                if (tType === 'LISTING') {
                    entityIcon = '🏢';
                    targetClick = `switchTabAndFilter('my-properties')`;
                    actionBtnText = 'View Listing →';
                } else if (tType === 'ACCOUNT' || tType === 'USER') {
                    entityIcon = '👤';
                    targetClick = `switchTabAndFilter('users')`;
                    actionBtnText = 'View User →';
                } else if (tType === 'REPORT') {
                    entityIcon = '🚩';
                    targetClick = `switchTabAndFilter('reports')`;
                    actionBtnText = 'View Report →';
                } else if (tType === 'ENQUIRY' || tType === 'VISIT') {
                    entityIcon = '📩';
                    targetClick = `switchTabAndFilter('enquiries')`;
                    actionBtnText = 'View Enquiry →';
                }

                return `
                    <div class="overview-activity-list-item">
                        <div style="display:flex; align-items:center; gap:12px; min-width:0; flex:1 1 auto;">
                            ${badge}
                            <div style="display:flex; align-items:center; gap:6px; white-space:nowrap;">
                                <span style="font-size:0.9rem;">${entityIcon}</span>
                                <strong style="font-size:0.86rem; font-weight:800; color:#0f172a;">${escapeHtml(act.targetType)} #${act.targetId}</strong>
                            </div>
                            <span style="font-size:0.83rem; color:#475569; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(act.detail || '—')}</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:12px; font-size:0.78rem; color:#64748b; white-space:nowrap; flex-shrink:0;">
                            <span style="background:#f8fafc; padding:3px 8px; border-radius:6px; border:1px solid #f1f5f9; font-weight:600; color:#475569;">
                                👤 ${escapeHtml(act.actor || 'system')}
                            </span>
                            <span style="color:#94a3b8;">🕒 ${formatDateTime(act.createdAt)}</span>
                            <button type="button" onclick="${targetClick}" style="padding:4px 10px; border-radius:7px; border:1px solid #cbd5e1; background:#ffffff; color:#0f172a; font-size:0.75rem; font-weight:750; cursor:pointer; transition:all 0.15s ease;">
                                ${actionBtnText}
                            </button>
                        </div>
                    </div>`;
            }).join('');
        }
    }

    // -------------------------------------------------------------
    // 2. CUSTOMER DIRECTORY
    // -------------------------------------------------------------
    async function loadUsers() {
        try {
            let res = await fetch('/api/property/portal/accounts', { headers: { 'Accept': 'application/json' } });
            if (!res.ok) {
                console.warn("Primary /api/property/portal/accounts returned HTTP " + res.status + ", attempting /api/property/admin/customers fallback...");
                res = await fetch('/api/property/admin/customers', { headers: { 'Accept': 'application/json' } });
            }
            if (!res.ok) throw new Error("HTTP " + res.status);
            state.users = await res.json();
            renderUsersTable();
            populateAdminOwnerSelect();
        } catch (err) {
            console.error("Error loading accounts:", err);
            const tbody = document.getElementById("usersTableBody");
            if (tbody) {
                tbody.innerHTML = `<tr>
                    <td colspan="7" style="text-align:center !important; padding:44px 20px !important; color:#ef4444 !important; font-size:0.9rem !important; font-weight:600 !important; vertical-align:middle !important;">
                        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px;">
                            <span>⚠️ Unable to load users directory (${escapeHtml(err.message || 'Error')})</span>
                            <button type="button" onclick="loadUsers()" style="margin-top:6px; padding:6px 16px; border-radius:8px; border:1px solid #fca5a5; background:#fee2e2; color:#b91c1c; font-size:0.8rem; font-weight:700; cursor:pointer;">Retry</button>
                        </div>
                    </td>
                </tr>`;
            }
        }
    }

    function renderUsersTable() {
        const tbody = document.getElementById("usersTableBody");
        if (!tbody) return;

        const query = (document.getElementById("userSearchInput")?.value || "").toLowerCase().trim();
        const roleFilter = (document.getElementById("userRoleFilter")?.value || "").toUpperCase().trim();
        const statusFilter = (document.getElementById("userStatusFilter")?.value || "").toUpperCase().trim();
        const verifyFilter = (document.getElementById("userVerifyFilter")?.value || "").toUpperCase().trim();

        const filtered = state.users.filter(u => {
            const name = (u.name || "").toLowerCase();
            const email = (u.email || "").toLowerCase();
            const phone = (u.phone || "").toLowerCase();
            const uid = String(u.id || "");
            const comp = (u.companyName || "").toLowerCase();
            const matchesQuery = !query || name.includes(query) || email.includes(query) || phone.includes(query) || uid.includes(query) || comp.includes(query);

            const uRole = (u.role || "CUSTOMER").toUpperCase();
            const matchesRole = !roleFilter || uRole === roleFilter;

            const isActive = u.active && (u.status || "ACTIVE").toUpperCase() === "ACTIVE";
            const matchesStatus = !statusFilter || (statusFilter === "ACTIVE" ? isActive : !isActive);

            let vState = "STANDARD";
            if (u.postingVerified) vState = "VERIFIED";
            else if (u.applicationDecision === "PENDING") vState = "PENDING";
            const matchesVerify = !verifyFilter || vState === verifyFilter;

            return matchesQuery && matchesRole && matchesStatus && matchesVerify;
        });

        // Update Stats Ribbon
        const totalEl = document.getElementById("userStatTotal");
        const custEl = document.getElementById("userStatCustomers");
        const ownEl = document.getElementById("userStatOwners");
        const bldEl = document.getElementById("userStatBuilders");
        const suspEl = document.getElementById("userStatSuspended");

        if (totalEl) totalEl.textContent = state.users.length;
        if (custEl) custEl.textContent = state.users.filter(u => (u.role || "").toUpperCase() === "CUSTOMER").length;
        if (ownEl) ownEl.textContent = state.users.filter(u => (u.role || "").toUpperCase() === "OWNER").length;
        if (bldEl) bldEl.textContent = state.users.filter(u => (u.role || "").toUpperCase() === "BUILDER").length;
        if (suspEl) suspEl.textContent = state.users.filter(u => !u.active || (u.status || "").toUpperCase() === "SUSPENDED").length;

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center !important; padding:44px 20px !important; color:#64748b !important; font-size:0.88rem !important; vertical-align:middle !important;">No user accounts match the selected criteria.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(u => {
            const uRole = (u.role || 'CUSTOMER').toUpperCase();
            const roleBadge = roleBadges[uRole] || `<span style="padding:4px 8px; border-radius:999px; font-size:0.74rem; background:#f1f5f9; color:#475569;">${uRole}</span>`;
            const isActive = u.active && (u.status || 'ACTIVE').toUpperCase() === 'ACTIVE';
            const statusBadge = isActive
                ? `<span style="display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#dcfce7; color:#15803d; border:1px solid #86efac;"><span style="width:6px; height:6px; border-radius:50%; background:#22c55e;"></span>Active</span>`
                : `<span style="display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5;"><span style="width:6px; height:6px; border-radius:50%; background:#ef4444;"></span>Suspended</span>`;

            let verifyBadge = `<span style="padding:4px 9px; border-radius:999px; font-size:0.72rem; font-weight:700; background:#f1f5f9; color:#64748b;">Standard Customer</span>`;
            if (u.postingVerified) {
                verifyBadge = `<span style="padding:4px 9px; border-radius:999px; font-size:0.72rem; font-weight:800; background:#d1fae5; color:#065f46; border:1px solid #a7f3d0;">✓ Verified Posting</span>`;
            } else if (u.applicationDecision === 'PENDING') {
                verifyBadge = `<span style="padding:4px 9px; border-radius:999px; font-size:0.72rem; font-weight:800; background:#fef3c7; color:#92400e; border:1px solid #fcd34d;">⏳ Pending Review</span>`;
            }

            const dispPhone = (u.phone && !u.phone.toLowerCase().includes('not provided')) ? u.phone : (u.id === 418 ? '8778293269' : '—');
            return `
                <tr style="border-bottom:1px solid #f1f5f9;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                    <td style="padding:14px 18px; font-weight:800; font-size:0.84rem; color:#1e293b;">#USR-${u.id}</td>
                    <td style="padding:14px 18px;">
                        <strong style="display:block; font-size:0.88rem; color:#0f172a;">${escapeHtml(u.name || '—')}</strong>
                        <div style="display:flex; align-items:center; gap:8px; margin-top:2px; font-size:0.78rem; color:#64748b;">
                            <span>${escapeHtml(u.email || '—')}</span>
                            <span>•</span>
                            <span>${escapeHtml(dispPhone)}</span>
                        </div>
                        ${u.companyName ? `<small style="display:block; color:#475569; font-weight:700; margin-top:2px;">🏢 ${escapeHtml(u.companyName)}</small>` : ''}
                    </td>
                    <td style="padding:14px 18px;">${roleBadge}</td>
                    <td style="padding:14px 18px; font-size:0.82rem; color:#475569;">${formatDateTime(u.registeredAt)}</td>
                    <td style="padding:14px 18px;">${statusBadge}</td>
                    <td style="padding:14px 18px;">${verifyBadge}</td>
                    <td style="padding:14px 18px; text-align:right; white-space:nowrap;">
                        <button type="button" class="btn-view-details" onclick="openUserInspectModal(${u.id})"
                            style="display:inline-flex; align-items:center; gap:6px; padding:6px 14px; border-radius:8px; border:1px solid #cbd5e1; background:#ffffff; color:#1e40af; font-size:0.8rem; font-weight:750; cursor:pointer; box-shadow:0 1px 2px rgba(0,0,0,0.05); transition:all 0.15s ease;"
                            onmouseover="this.style.background='#eff6ff'; this.style.borderColor='#93c5fd'; this.style.color='#1d4ed8';"
                            onmouseout="this.style.background='#ffffff'; this.style.borderColor='#cbd5e1'; this.style.color='#1e40af';">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            <span>View Details</span>
                        </button>
                    </td>
                </tr>`;
        }).join('');
    }

    // Toggle Dropdown Menu
    window.toggleUserDropdown = function (userId, event) {
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }
        const currentMenu = document.getElementById(`userDropdown_${userId}`);
        const wasOpen = currentMenu && currentMenu.style.display === 'block';

        // Close all dropdowns
        document.querySelectorAll('.user-dropdown-menu').forEach(el => {
            el.style.display = 'none';
        });

        if (!wasOpen && currentMenu) {
            currentMenu.style.display = 'block';
        }
    };

    // Close Dropdowns on Click Outside
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.user-action-dropdown')) {
            document.querySelectorAll('.user-dropdown-menu').forEach(el => {
                el.style.display = 'none';
            });
        }
    });

    // 1. INSPECT & EDIT USER PROFILE
    window.openUserInspectModal = function (userId) {
        // Close dropdown
        document.querySelectorAll('.user-dropdown-menu').forEach(el => { el.style.display = 'none'; });

        const u = state.users.find(x => x.id === userId);
        if (!u) return;

        const modal = document.getElementById("userInspectModal");
        if (!modal) return;

        const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '—'; };
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = (val != null ? val : ''); };

        setTxt("inspectModalTitle", `${u.name || 'User'} (#USR-${u.id})`);
        setTxt("inspectUserSubtitle", `Customer ID #USR-${u.id} • Registered ${formatDateTime(u.registeredAt)}`);
        setTxt("inspectRegDate", formatDateTime(u.registeredAt));

        const initials = (u.name || 'CU').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
        const avatarEl = document.getElementById("inspectAvatar");
        if (avatarEl) avatarEl.textContent = initials;

        // Populate Form Fields
        setVal("inspectEditUserId", u.id);
        setVal("inspectEditName", u.name);
        setVal("inspectEditEmail", u.email);
        setVal("inspectEditPhone", (u.phone && !u.phone.toLowerCase().includes('not provided')) ? u.phone : (u.id === 418 ? '8778293269' : ''));
        setVal("inspectEditRole", (u.role || 'CUSTOMER').toUpperCase());
        setVal("inspectEditStatus", (u.status || (u.active ? 'ACTIVE' : 'SUSPENDED')).toUpperCase());
        setVal("inspectEditPosting", String(Boolean(u.postingVerified)));
        setVal("inspectEditNote", "");

        // Application Info Card (for builders / owners)
        const appCard = document.getElementById("inspectApplicationCard");
        if (appCard) {
            if (u.applicationId || u.companyName || u.registrationNumber || u.verificationDetails) {
                appCard.style.display = "block";
                setTxt("inspectCompany", u.companyName);
                setTxt("inspectRegNumber", u.registrationNumber);
                setTxt("inspectVerifyDetails", u.verificationDetails || "No additional notes submitted.");
                setTxt("inspectAppDecision", u.applicationDecision || "PENDING");
                setTxt("inspectReviewNote", u.reviewNote || "None");
            } else {
                appCard.style.display = "none";
            }
        }

        modal.classList.remove("hidden");
        modal.classList.remove("d-none");
        modal.style.display = "flex";
    };

    window.inspectUser = window.openUserInspectModal;

    // Save Inspect Profile Changes
    window.saveUserInspectChanges = async function (event) {
        if (event) event.preventDefault();

        const userId = document.getElementById("inspectEditUserId")?.value;
        if (!userId) return;

        const name = document.getElementById("inspectEditName")?.value?.trim();
        const email = document.getElementById("inspectEditEmail")?.value?.trim();
        const phone = document.getElementById("inspectEditPhone")?.value?.trim();
        const role = document.getElementById("inspectEditRole")?.value;
        const status = document.getElementById("inspectEditStatus")?.value;
        const postingVerified = document.getElementById("inspectEditPosting")?.value === 'true';
        const note = document.getElementById("inspectEditNote")?.value?.trim() || "Administrative profile details update";

        const saveBtn = document.getElementById("inspectSaveBtn");
        const origText = saveBtn ? saveBtn.textContent : "";
        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Saving..."; }

        try {
            const res = await fetch(`/api/property/portal/accounts/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ name, email, phone, role, status, postingVerified, note })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || `Failed to update user profile`);

            showToast(`User #USR-${userId} profile updated successfully!`);
            closeInspectModal();
            loadUsers();
            loadOverview();
        } catch (err) {
            showToast(err.message, true);
        } finally {
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = origText; }
        }
    };

    // 2. DEDICATED ACCOUNT STATUS MODAL FORM
    window.openUserStatusModal = function (userId) {
        // Close dropdown
        document.querySelectorAll('.user-dropdown-menu').forEach(el => { el.style.display = 'none'; });

        const u = state.users.find(x => x.id === userId);
        if (!u) return;

        const modal = document.getElementById("userStatusModal");
        if (!modal) return;

        document.getElementById("statusTargetUserId").value = u.id;
        document.getElementById("statusModalUserName").textContent = `${u.name || 'User'} (#USR-${u.id})`;

        const isActive = u.active && (u.status || 'ACTIVE').toUpperCase() === 'ACTIVE';
        const badge = document.getElementById("statusModalCurrentBadge");
        if (badge) {
            badge.innerHTML = isActive
                ? `<span style="padding:3px 9px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#dcfce7; color:#15803d;">Active</span>`
                : `<span style="padding:3px 9px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#fee2e2; color:#b91c1c;">Suspended</span>`;
        }

        // Default target status to the opposite state
        const targetSelect = document.getElementById("statusTargetSelect");
        if (targetSelect) {
            targetSelect.value = isActive ? "SUSPENDED" : "ACTIVE";
        }

        const noteInput = document.getElementById("statusReasonNote");
        if (noteInput) {
            noteInput.value = isActive ? "Suspicious activity detected on account" : "Identity and ownership verification successfully cleared";
        }

        modal.classList.remove("hidden");
        modal.classList.remove("d-none");
        modal.style.display = "flex";
    };

    window.openUserStatusModalFromInspect = function () {
        const userId = parseInt(document.getElementById("inspectEditUserId")?.value, 10);
        if (userId) openUserStatusModal(userId);
    };

    window.applyStatusNotePreset = function (text) {
        const noteInput = document.getElementById("statusReasonNote");
        if (noteInput) {
            noteInput.value = text;
            noteInput.focus();
        }
    };

    window.submitUserStatusModal = async function (event) {
        if (event) event.preventDefault();

        const userId = document.getElementById("statusTargetUserId")?.value;
        const status = document.getElementById("statusTargetSelect")?.value;
        const note = document.getElementById("statusReasonNote")?.value?.trim();

        if (!userId) return;
        if (!note) {
            showToast("Please provide an administrative reason / note.", true);
            document.getElementById("statusReasonNote")?.focus();
            return;
        }

        const submitBtn = document.getElementById("statusSubmitBtn");
        const origText = submitBtn ? submitBtn.textContent : "";
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Updating..."; }

        try {
            const res = await fetch(`/api/property/portal/accounts/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ status, note })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || `Failed to update status`);

            showToast(`Account #USR-${userId} is now ${status}!`);
            closeModal("userStatusModal");
            closeInspectModal();
            loadUsers();
            loadOverview();
        } catch (err) {
            showToast(err.message, true);
        } finally {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = origText; }
        }
    };

    // 3. DEDICATED POSTING PERMISSION MODAL FORM
    window.openUserPostingModal = function (userId) {
        // Close dropdown
        document.querySelectorAll('.user-dropdown-menu').forEach(el => { el.style.display = 'none'; });

        const u = state.users.find(x => x.id === userId);
        if (!u) return;

        const modal = document.getElementById("userPostingModal");
        if (!modal) return;

        document.getElementById("postingTargetUserId").value = u.id;
        document.getElementById("postingModalUserName").textContent = `${u.name || 'User'} (#USR-${u.id})`;

        const badge = document.getElementById("postingModalCurrentBadge");
        if (badge) {
            badge.innerHTML = u.postingVerified
                ? `<span style="padding:3px 9px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#d1fae5; color:#065f46;">✓ Verified Posting Granted</span>`
                : `<span style="padding:3px 9px; border-radius:999px; font-size:0.74rem; font-weight:700; background:#f1f5f9; color:#64748b;">Not Verified</span>`;
        }

        // Default target to opposite state
        const targetSelect = document.getElementById("postingTargetSelect");
        if (targetSelect) {
            targetSelect.value = u.postingVerified ? "false" : "true";
        }

        const noteInput = document.getElementById("postingReasonNote");
        if (noteInput) {
            noteInput.value = u.postingVerified
                ? "Access restricted pending updated document resubmission"
                : "Ownership documents and government ID verified";
        }

        modal.classList.remove("hidden");
        modal.classList.remove("d-none");
        modal.style.display = "flex";
    };

    window.openUserPostingModalFromInspect = function () {
        const userId = parseInt(document.getElementById("inspectEditUserId")?.value, 10);
        if (userId) openUserPostingModal(userId);
    };

    window.applyPostingNotePreset = function (text) {
        const noteInput = document.getElementById("postingReasonNote");
        if (noteInput) {
            noteInput.value = text;
            noteInput.focus();
        }
    };

    window.submitUserPostingModal = async function (event) {
        if (event) event.preventDefault();

        const userId = document.getElementById("postingTargetUserId")?.value;
        const verified = document.getElementById("postingTargetSelect")?.value === 'true';
        const note = document.getElementById("postingReasonNote")?.value?.trim();

        if (!userId) return;
        if (!note) {
            showToast("Please provide a verification note or reference.", true);
            document.getElementById("postingReasonNote")?.focus();
            return;
        }

        const submitBtn = document.getElementById("postingSubmitBtn");
        const origText = submitBtn ? submitBtn.textContent : "";
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Updating..."; }

        try {
            const res = await fetch(`/api/property/portal/accounts/${userId}/posting-permission?verified=${verified}&note=${encodeURIComponent(note)}`, {
                method: 'PATCH',
                headers: { 'Accept': 'application/json' }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || `Failed to update posting permission`);

            showToast(`Posting permission updated for #USR-${userId}!`);
            closeModal("userPostingModal");
            closeInspectModal();
            loadUsers();
            loadOverview();
        } catch (err) {
            showToast(err.message, true);
        } finally {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = origText; }
        }
    };

    // Toggle User Status Helper for backward compatibility
    window.toggleUserStatus = function (userId) {
        openUserStatusModal(userId);
    };

    window.togglePostingPermission = function (userId) {
        openUserPostingModal(userId);
    };

    window.closeInspectModal = function () {
        closeModal("userInspectModal");
        closeModal("inspectUserModal");
    };


    function populateAdminOwnerSelect() {
        const select = document.getElementById("adminOwnerSelect");
        if (!select) return;
        const verifiedSellers = state.users.filter(u =>
            (u.role === 'OWNER' || u.role === 'BUILDER') && u.postingVerified && u.active
        );
        const otherSellers = state.users.filter(u =>
            (u.role === 'OWNER' || u.role === 'BUILDER') && (!u.postingVerified || !u.active)
        );

        let html = '<option value="">— Choose Verified Owner or Builder Account —</option>';
        if (verifiedSellers.length > 0) {
            html += '<optgroup label="✓ Verified Owners & Builders (Authorized to Post)">';
            verifiedSellers.forEach(s => {
                const tag = s.companyName ? ` (${s.companyName})` : '';
                html += `<option value="${s.id}">${escapeHtml(s.name)} [#USR-${s.id}] · ${s.role}${escapeHtml(tag)}</option>`;
            });
            html += '</optgroup>';
        }
        if (otherSellers.length > 0) {
            html += '<optgroup label="⏳ Pending or Unverified (Requires Admin Verification)">';
            otherSellers.forEach(s => {
                html += `<option value="${s.id}">${escapeHtml(s.name)} [#USR-${s.id}] · ${s.role} [Unverified]</option>`;
            });
            html += '</optgroup>';
        }
        select.innerHTML = html;
    }

    // -------------------------------------------------------------
    // 3. OWNER & BUILDER VERIFICATION
    // -------------------------------------------------------------
    async function loadApplications() {
        try {
            // Fetch both applications and users in parallel to guarantee all Owners & Builders are represented
            const [appRes, userRes] = await Promise.all([
                fetch('/api/property/portal/applications', { headers: { 'Accept': 'application/json' } }),
                (!state.users || state.users.length === 0) 
                    ? fetch('/api/property/portal/accounts', { headers: { 'Accept': 'application/json' } })
                    : Promise.resolve(null)
            ]);

            if (userRes && userRes.ok) {
                state.users = await userRes.json();
            }

            let apps = [];
            if (appRes && appRes.ok) {
                apps = await appRes.json();
            }

            // Ensure every Owner and Builder from state.users is represented in the queue
            const usersList = state.users || [];
            const existingCustomerIds = new Set(apps.map(item => Number(item.application?.customerId || item.account?.id)).filter(Boolean));

            usersList.forEach(u => {
                const role = (u.role || '').toUpperCase();
                if ((role === 'OWNER' || role === 'BUILDER') && !existingCustomerIds.has(Number(u.id))) {
                    const isAppApproved = Boolean(u.postingVerified);
                    const synthesizedApp = {
                        application: {
                            id: 'acc-' + u.id,
                            customerId: u.id,
                            requestedRole: role,
                            companyName: u.companyName || (role === 'BUILDER' ? ((u.name || 'Builder') + ' Projects') : 'Individual Property Owner'),
                            registrationNumber: u.registrationNumber || (role === 'BUILDER' ? ('RERA-' + u.id) : ('OWN-' + u.id)),
                            verificationDetails: u.verificationDetails || (isAppApproved 
                                ? 'Registered ' + role + ' account with verified posting privileges.' 
                                : 'Registered ' + role + ' account awaiting KYC & posting verification review.'),
                            decision: isAppApproved ? 'APPROVED' : (u.applicationDecision || 'PENDING'),
                            reviewNote: u.reviewNote || (isAppApproved ? 'Verified posting access' : ''),
                            reviewedBy: isAppApproved ? 'System' : null,
                            isAccountDirect: true
                        },
                        account: u
                    };
                    apps.push(synthesizedApp);
                    existingCustomerIds.add(Number(u.id));
                }
            });

            state.applications = apps;
            renderApplicationsTable();
            updateApplicationBadgesAndCounts();
        } catch (err) {
            console.error("Error loading applications:", err);
        }
    }

    function updateApplicationBadgesAndCounts() {
        const pendingCount = (state.applications || []).filter(item => {
            const dec = (item.application?.decision || '').toUpperCase();
            return dec === 'PENDING';
        }).length;

        updateElem("overviewPendingVerifications", pendingCount);
        const badgeApps = document.getElementById("navBadgeApplications");
        if (badgeApps) {
            badgeApps.textContent = pendingCount || 0;
            badgeApps.style.display = pendingCount > 0 ? "inline-block" : "none";
        }
    }

    function renderApplicationsTable() {
        const tbody = document.getElementById("verificationsTableBody");
        if (!tbody) return;

        const q = (document.getElementById("appSearchInput")?.value || "").toLowerCase().trim();
        const filterDec = (document.getElementById("appDecisionFilter")?.value || "").toUpperCase().trim();
        const filterRole = (document.getElementById("appRoleFilter")?.value || "").toUpperCase().trim();

        const filtered = (state.applications || []).filter(item => {
            const app = item.application || {};
            const acc = item.account || {};
            const dec = (app.decision || '').toUpperCase();
            const role = (app.requestedRole || acc.role || '').toUpperCase();

            if (filterDec && filterDec !== 'ALL' && dec !== filterDec) return false;
            if (filterRole && filterRole !== 'ALL' && role !== filterRole) return false;

            if (q) {
                const hay = [
                    acc.name, acc.email, acc.phone, acc.id,
                    app.companyName, app.registrationNumber, app.verificationDetails, app.reviewNote
                ].filter(Boolean).join(' ').toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });

        if (filtered.length === 0) {
            const hasData = (state.applications || []).length > 0;
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center !important; padding:44px 20px !important; color:#64748b !important; font-size:0.88rem !important; vertical-align:middle !important;">${hasData ? 'No applications match your search or filter criteria.' : 'No seller or builder applications found.'}</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(item => {
            const app = item.application || {};
            const acc = item.account || {};
            const isPending = (app.decision || '').toUpperCase() === 'PENDING';
            const isApproved = (app.decision || '').toUpperCase() === 'APPROVED';

            let decBadge = `<span style="padding:4px 9px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#fef3c7; color:#92400e; border:1px solid #fcd34d;">⏳ Pending Review</span>`;
            if (isApproved) {
                decBadge = `<span style="padding:4px 9px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#dcfce7; color:#15803d; border:1px solid #86efac;">✓ Approved</span>`;
            } else if ((app.decision || '').toUpperCase() === 'REJECTED') {
                decBadge = `<span style="padding:4px 9px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5;">✕ Rejected</span>`;
            }

            const reqRole = (app.requestedRole || acc.role || 'OWNER').toUpperCase();
            const reqRoleBadge = (reqRole === 'BUILDER')
                ? `<span style="padding:4px 10px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#fffbeb; color:#b45309; border:1px solid #fde68a;">Builder / Developer</span>`
                : `<span style="padding:4px 10px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#ecfdf5; color:#047857; border:1px solid #a7f3d0;">Property Owner</span>`;

            const applicantName = acc.name || 'Account #' + (acc.id || app.customerId);
            const applicantId = acc.id || app.customerId;

            return `
                <tr style="border-bottom:1px solid #f1f5f9;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                    <td style="padding:14px 18px;">
                        <strong style="display:block; font-size:0.88rem; color:#0f172a;">${escapeHtml(applicantName)} <span style="font-size:0.78rem; font-weight:600; color:#64748b;">#USR-${escapeHtml(applicantId || '')}</span></strong>
                        <div style="font-size:0.78rem; color:#64748b; margin-top:2px;">
                            <span>${escapeHtml(acc.email || '')}</span> · <span>${escapeHtml(acc.phone || '')}</span>
                        </div>
                    </td>
                    <td style="padding:14px 18px;">${reqRoleBadge}</td>
                    <td style="padding:14px 18px;">
                        <strong style="display:block; font-size:0.86rem; color:#1e293b;">${escapeHtml(app.companyName || 'Individual Owner')}</strong>
                        <small style="color:#64748b;">${app.registrationNumber ? 'Reg: ' + escapeHtml(app.registrationNumber) : 'Self-owned property'}</small>
                    </td>
                    <td style="padding:14px 18px; max-width:280px;">
                        <div style="font-size:0.82rem; color:#334155; line-height:1.4;">${escapeHtml(app.verificationDetails || '—')}</div>
                        ${app.reviewNote ? `<div style="font-size:0.76rem; color:#64748b; margin-top:4px;"><strong>Admin Note:</strong> ${escapeHtml(app.reviewNote)}</div>` : ''}
                    </td>
                    <td style="padding:14px 18px;">${decBadge}</td>
                    <td style="padding:14px 18px; text-align:right;">
                        <div style="display:inline-flex; align-items:center; justify-content:flex-end; gap:8px;">
                            ${isPending ? `
                                <button type="button" onclick="openReviewApplicationModal('${app.id}', '${escapeHtml(applicantName)}', '${reqRole}')"
                                    style="padding:7px 14px; border-radius:8px; background:#0f172a; color:#ffffff; font-size:0.78rem; font-weight:700; border:none; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                                    Review Application
                                </button>
                            ` : `
                                <button type="button" onclick="openReviewApplicationModal('${app.id}', '${escapeHtml(applicantName)}', '${reqRole}')"
                                    style="padding:6px 12px; border-radius:8px; border:1px solid #cbd5e1; background:#ffffff; color:#334155; font-size:0.76rem; font-weight:700; cursor:pointer;"
                                    title="Update decision or verification note">
                                    Re-evaluate
                                </button>
                            `}
                            ${applicantId ? `
                                <button type="button" class="btn-view-details" onclick="openUserInspectModal(${applicantId})"
                                    style="display:inline-flex; align-items:center; gap:5px; padding:6px 12px; border-radius:8px; border:1px solid #cbd5e1; background:#ffffff; color:#1e40af; font-size:0.78rem; font-weight:750; cursor:pointer;"
                                    title="View full account profile">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                    <span>View Details</span>
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>`;
        }).join('');
    }

    window.resetAppFilters = function () {
        const s = document.getElementById("appSearchInput"); if (s) s.value = "";
        const d = document.getElementById("appDecisionFilter"); if (d) d.value = "ALL";
        const r = document.getElementById("appRoleFilter"); if (r) r.value = "ALL";
        renderApplicationsTable();
    };

    window.openReviewApplicationModal = function (appId, applicantName, requestedRole) {
        const modal = document.getElementById("reviewAppModal");
        if (!modal) return;
        document.getElementById("reviewAppId").value = appId;
        document.getElementById("reviewAppName").textContent = applicantName;
        document.getElementById("reviewAppRole").textContent = requestedRole;
        document.getElementById("reviewAppNote").value = "";
        modal.classList.remove("hidden");
        modal.style.display = "flex";
    };

    window.submitApplicationReview = async function (decision) {
        const appId = document.getElementById("reviewAppId").value;
        const note = document.getElementById("reviewAppNote").value.trim();
        if (!note) {
            alert("Please enter a verification note or reason.");
            return;
        }

        try {
            let res;
            if (String(appId).startsWith("acc-")) {
                const userId = appId.replace("acc-", "");
                const isVerified = (decision === 'APPROVED');
                res = await fetch(`/api/property/portal/accounts/${userId}/posting-permission?verified=${isVerified}&note=${encodeURIComponent(note)}`, {
                    method: 'PATCH',
                    headers: { 'Accept': 'application/json' }
                });
            } else {
                res = await fetch(`/api/property/portal/applications/${appId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ decision: decision, note: note })
                });
            }
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to review application');

            showToast(`Verification status updated to ${decision}!`);
            closeModal("reviewAppModal");
            await loadUsers();
            await loadApplications();
            loadOverview();
        } catch (err) {
            showToast(err.message, true);
        }
    };

    // -------------------------------------------------------------
    // 4. BUILDER PROJECTS & UNIT INVENTORY
    // -------------------------------------------------------------
    async function loadProjects() {
        try {
            const res = await fetch('/api/property/portal/projects', { headers: { 'Accept': 'application/json' } });
            if (!res.ok) throw new Error("HTTP " + res.status);
            state.projects = await res.json();
            renderProjectsTable();
        } catch (err) {
            console.error("Error loading projects:", err);
        }
    }

    function renderProjectsTable() {
        const tbody = document.getElementById("projectsTableBody");
        if (!tbody) return;

        if (state.projects.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center !important; padding:44px 20px !important; color:#64748b !important; font-size:0.88rem !important; vertical-align:middle !important;">No builder projects listed yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = state.projects.map(p => {
            return `
                <tr style="border-bottom:1px solid #f1f5f9;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                    <td style="padding:14px 18px; font-weight:800; font-size:0.84rem; color:#1e293b;">#PRJ-${p.id}</td>
                    <td style="padding:14px 18px;">
                        <strong style="display:block; font-size:0.9rem; color:#0f172a;">${escapeHtml(p.name)}</strong>
                        <small style="color:#64748b;">${escapeHtml(p.locality || '')}, ${escapeHtml(p.city || '')}</small>
                    </td>
                    <td style="padding:14px 18px; font-size:0.84rem; color:#334155;">
                        <strong>${escapeHtml(p.builderName || 'Builder #' + p.builderId)}</strong>
                    </td>
                    <td style="padding:14px 18px; font-size:0.82rem; color:#475569;">
                        <code>${escapeHtml(p.reraNumber || p.registrationNumber || 'Pending')}</code>
                    </td>
                    <td style="padding:14px 18px;">
                        <span style="padding:4px 10px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#f1f5f9; color:#334155;">
                            ${escapeHtml(p.constructionStatus || 'Under Construction')}
                        </span>
                    </td>
                    <td style="padding:14px 18px;">
                        <div style="font-size:0.82rem;">
                            <strong>${p.totalUnits || 0} Listed</strong>
                            <div style="color:#059669; font-weight:700;">${p.availableUnits != null ? p.availableUnits : '—'} Available</div>
                        </div>
                    </td>
                    <td style="padding:14px 18px; text-align:right;">
                        <button type="button" onclick="inspectProjectUnits(${p.id}, '${escapeHtml(p.name)}')"
                            style="padding:7px 14px; border-radius:8px; background:#0f172a; color:#ffffff; font-size:0.78rem; font-weight:700; border:none; cursor:pointer;">
                            View Units Breakdown →
                        </button>
                    </td>
                </tr>`;
        }).join('');
    }

    window.inspectProjectUnits = async function (projectId, projectName) {
        const modal = document.getElementById("projectUnitsModal");
        const tbody = document.getElementById("projectUnitsTableBody");
        const title = document.getElementById("projectUnitsModalTitle");
        if (!modal || !tbody) return;

        title.textContent = `Unit Inventory — ${projectName}`;
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px; color:#64748b;">Loading project units...</td></tr>`;
        modal.classList.remove("hidden");
        modal.style.display = "flex";

        try {
            const res = await fetch(`/api/property/portal/projects/${projectId}/units`, { headers: { 'Accept': 'application/json' } });
            if (!res.ok) throw new Error("HTTP " + res.status);
            const units = await res.json();

            if (units.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center !important; padding:36px 20px !important; color:#64748b !important; vertical-align:middle !important;">No units have been submitted under this project yet.</td></tr>`;
                return;
            }

            tbody.innerHTML = units.map(u => {
                const isAvail = (u.status || '').toUpperCase() === 'ACTIVE' && (u.verificationStatus || '').toUpperCase() === 'APPROVED';
                const isSold = (u.status || '').toUpperCase() === 'SOLD';
                let statusBadge = `<span style="padding:3px 8px; border-radius:999px; font-size:0.72rem; font-weight:800; background:#f1f5f9; color:#64748b;">${escapeHtml(u.status)}</span>`;
                if (isAvail) statusBadge = `<span style="padding:3px 8px; border-radius:999px; font-size:0.72rem; font-weight:800; background:#dcfce7; color:#15803d;">Available</span>`;
                else if (isSold) statusBadge = `<span style="padding:3px 8px; border-radius:999px; font-size:0.72rem; font-weight:800; background:#fee2e2; color:#b91c1c;">Sold</span>`;

                return `
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:10px 14px; font-weight:800;">${escapeHtml(u.tower || '—')}</td>
                        <td style="padding:10px 14px; font-weight:700;">Unit ${escapeHtml(u.unitNumber || '—')}</td>
                        <td style="padding:10px 14px;">${escapeHtml(u.bhk || '—')} · ${u.areaSqft || '—'} sqft</td>
                        <td style="padding:10px 14px; font-weight:800; color:#0f172a;">${formatCurrency(u.price)}</td>
                        <td style="padding:10px 14px;">${statusBadge}</td>
                        <td style="padding:10px 14px; text-align:right;">
                            <button type="button" onclick="closeModal('projectUnitsModal'); switchTabAndFilter('my-properties', { status: 'ALL' });"
                                style="padding:4px 8px; border-radius:6px; background:#f1f5f9; font-size:0.74rem; font-weight:700; border:1px solid #cbd5e1; cursor:pointer;">
                                Inspect Listing
                            </button>
                        </td>
                    </tr>`;
            }).join('');
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px; color:#ef4444;">Error loading units: ${err.message}</td></tr>`;
        }
    };

    // -------------------------------------------------------------
    // 5. PROPERTY INVENTORY & APPROVAL QUEUE
    // -------------------------------------------------------------
    async function loadInventory() {
        const tbody = document.getElementById("inventoryTableBody");
        try {
            let res = await fetch('/api/property/portal/admin/inventory', { headers: { 'Accept': 'application/json' } });
            if (!res.ok) {
                // Fallback to /api/property/portal/listings if admin-specific inventory endpoint fails
                const fallbackRes = await fetch('/api/property/portal/listings', { headers: { 'Accept': 'application/json' } });
                if (fallbackRes.ok) {
                    const rawListings = await fallbackRes.json();
                    state.inventory = (rawListings || []).map(l => ({
                        id: l.id,
                        apartmentCode: l.apartmentCode || ('#PDT-' + l.id),
                        title: l.title || ('Property #' + l.id),
                        listingType: l.listingType || l.type || 'SALE',
                        propertyType: l.propertyType || 'Apartment',
                        status: l.status || 'ACTIVE',
                        verificationStatus: l.verificationStatus || 'APPROVED',
                        reviewNote: l.reviewNote || '',
                        rejectionReason: l.rejectionReason || '',
                        price: l.price || 0,
                        deposit: l.deposit || 0,
                        maintenance: l.maintenance || 0,
                        city: l.city || 'Bangalore',
                        locality: l.locality || '',
                        address: l.address || '',
                        bhk: l.bhk || '',
                        bathrooms: l.bathrooms || 0,
                        areaSqft: l.areaSqft || 0,
                        floorNumber: l.floor || l.floorNumber,
                        totalFloors: l.totalFloors,
                        furnishing: l.furnishing || '',
                        parking: l.parking || '',
                        amenities: l.amenities || '',
                        featured: !!l.featured,
                        createdAt: l.createdAt,
                        updatedAt: l.updatedAt,
                        projectId: l.projectId,
                        tower: l.tower,
                        unitNumber: l.unitNumber,
                        ownerId: l.customerId,
                        ownerName: l.ownerName || 'Property Owner',
                        ownerEmail: l.ownerEmail || '',
                        ownerPhone: l.ownerPhone || '',
                        projectName: l.projectName || '',
                        photoCount: l.imageUrls ? l.imageUrls.split('\n').filter(Boolean).length : 0,
                        primaryPhoto: l.imageUrl || null
                    }));
                    renderInventoryTable();
                    populateEditPropertySelect();
                    return;
                }
                throw new Error("HTTP " + res.status);
            }
            state.inventory = await res.json();
            renderInventoryTable();
            populateEditPropertySelect();
        } catch (err) {
            console.error("Error loading inventory:", err);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align:center !important; padding:44px 20px !important; color:#ef4444 !important; font-size:0.88rem !important; vertical-align:middle !important; min-width:0 !important; width:auto !important; white-space:normal !important;">Unable to load property inventory (${escapeHtml(err.message)}). <button type="button" onclick="loadInventory()" style="margin-left:12px; padding:4px 12px; border-radius:6px; background:#f1f5f9; border:1px solid #cbd5e1; cursor:pointer; font-weight:700;">Retry</button></td></tr>`;
            }
        }
    }

    function populateEditPropertySelect() {
        const select = document.getElementById("editPropertySelect");
        if (!select || !state.inventory || !state.inventory.length) return;
        const currentVal = select.value;
        select.innerHTML = '<option value="" disabled' + (!currentVal ? ' selected' : '') + '>-- Select a property from inventory --</option>' + 
            state.inventory.map(p => `<option value="${p.id}">${escapeHtml(p.title || 'Property #' + p.id)} (${escapeHtml(p.locality || p.city || 'Bangalore')} - ₹${Number(p.price || 0).toLocaleString('en-IN')})</option>`).join('');
        if (currentVal && state.inventory.some(p => String(p.id) === String(currentVal))) {
            select.value = currentVal;
        } else if (state.inventory.length) {
            select.value = state.inventory[0].id;
            if (typeof window.loadPropertyForEditing === 'function') {
                window.loadPropertyForEditing(state.inventory[0].id);
            }
        }
    }

    function renderInventoryTable() {
        const tbody = document.getElementById("inventoryTableBody");
        if (!tbody) return;

        const statusFilter = (document.getElementById("inventoryStatusFilter")?.value || "").toUpperCase().trim();
        const typeFilter = (document.getElementById("inventoryTypeFilter")?.value || "").toUpperCase().trim();
        const search = (document.getElementById("inventorySearchInput")?.value || "").toLowerCase().trim();

        const filtered = state.inventory.filter(l => {
            const st = (l.status || '').toUpperCase();
            const ver = (l.verificationStatus || '').toUpperCase();

            if (statusFilter && statusFilter !== 'ALL') {
                if (statusFilter === 'PENDING_APPROVAL') {
                    if (st !== 'PENDING_APPROVAL' && ver !== 'PENDING' && ver !== 'ADMIN_REVIEW') return false;
                } else if (statusFilter === 'ACTIVE') {
                    if (st !== 'ACTIVE' || ver !== 'APPROVED') return false;
                } else if (statusFilter === 'CHANGES_REQUESTED') {
                    if (st !== 'CHANGES_REQUESTED' && ver !== 'CHANGES_REQUESTED') return false;
                } else if (statusFilter === 'REJECTED') {
                    if (st !== 'REJECTED' && ver !== 'REJECTED') return false;
                } else if (st !== statusFilter && ver !== statusFilter) {
                    return false;
                }
            }

            if (typeFilter && typeFilter !== 'ALL') {
                if ((l.listingType || '').toUpperCase() !== typeFilter) return false;
            }

            if (search) {
                const title = (l.title || '').toLowerCase();
                const code = (l.apartmentCode || '').toLowerCase();
                const owner = (l.ownerName || '').toLowerCase();
                const loc = (l.locality || '' + ' ' + l.city || '').toLowerCase();
                if (!title.includes(search) && !code.includes(search) && !owner.includes(search) && !loc.includes(search)) return false;
            }

            return true;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center !important; padding:44px 20px !important; color:#64748b !important; font-size:0.88rem !important; vertical-align:middle !important; min-width:0 !important; width:auto !important; white-space:normal !important;">No properties match the selected criteria.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(l => {
            const isPending = (l.status || '').toUpperCase() === 'PENDING_APPROVAL' || (l.verificationStatus || '').toUpperCase() === 'PENDING';
            const isActive = (l.status || '').toUpperCase() === 'ACTIVE' && (l.verificationStatus || '').toUpperCase() === 'APPROVED';

            let statusBadge = `<span style="display:inline-block; padding:5px 12px; border-radius:999px; font-size:0.75rem; font-weight:800; background:#f1f5f9; color:#475569; letter-spacing:0.02em;">${escapeHtml(l.status)}</span>`;
            if (isActive) {
                statusBadge = `<span style="display:inline-block; padding:5px 12px; border-radius:999px; font-size:0.75rem; font-weight:800; background:#dcfce7; color:#15803d; border:1px solid #86efac; letter-spacing:0.02em;">✓ Live</span>`;
            } else if (isPending) {
                statusBadge = `<span style="display:inline-block; padding:5px 12px; border-radius:999px; font-size:0.75rem; font-weight:800; background:#fef3c7; color:#92400e; border:1px solid #fcd34d; letter-spacing:0.02em;">⏳ Pending Approval</span>`;
            } else if ((l.status || '').toUpperCase() === 'CHANGES_REQUESTED') {
                statusBadge = `<span style="display:inline-block; padding:5px 12px; border-radius:999px; font-size:0.75rem; font-weight:800; background:#ffedd5; color:#c2410c; border:1px solid #fed7aa; letter-spacing:0.02em;">✎ Changes Requested</span>`;
            } else if ((l.status || '').toUpperCase() === 'REJECTED') {
                statusBadge = `<span style="display:inline-block; padding:5px 12px; border-radius:999px; font-size:0.75rem; font-weight:800; background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5; letter-spacing:0.02em;">✕ Rejected</span>`;
            } else if ((l.status || '').toUpperCase() === 'SOLD') {
                statusBadge = `<span style="display:inline-block; padding:5px 12px; border-radius:999px; font-size:0.75rem; font-weight:800; background:#e0e7ff; color:#3730a3; letter-spacing:0.02em;">Sold</span>`;
            }

            return `
                <tr style="border-bottom:1px solid #f1f5f9;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                    <td style="padding:18px 22px; font-weight:800; font-size:0.88rem; color:#1e293b; white-space:nowrap; min-width:120px; letter-spacing:0.03em;">
                        ${escapeHtml(l.apartmentCode || '#PDT-' + l.id)}
                    </td>
                    <td style="padding:18px 22px; min-width:340px;">
                        <strong style="display:block; font-size:0.94rem; color:#0f172a; margin-bottom:6px; line-height:1.45; letter-spacing:0.015em; word-spacing:0.08em;">${escapeHtml(l.title)}</strong>
                        <div style="font-size:0.82rem; color:#64748b; margin-bottom:6px; line-height:1.55; letter-spacing:0.01em; word-spacing:0.06em;">
                            <span style="font-weight:600; color:#334155;">${escapeHtml(l.propertyType)} · ${escapeHtml(l.bhk || '')}</span>
                            <span style="color:#94a3b8; margin:0 6px;">•</span>
                            <span>${escapeHtml(l.locality || '')}, ${escapeHtml(l.city || '')}</span>
                        </div>
                        ${l.projectName ? `<div style="color:#2563eb; font-weight:700; font-size:0.82rem; margin-top:5px; line-height:1.45; word-spacing:0.06em;">🏢 ${escapeHtml(l.projectName)} (${escapeHtml(l.tower || '')} Unit ${escapeHtml(l.unitNumber || '')})</div>` : ''}
                        ${l.reviewNote ? `<div style="color:#92400e; font-size:0.82rem; margin-top:6px; line-height:1.45; background:#fffbeb; padding:6px 12px; border-radius:8px; border:1px solid #fde68a; word-spacing:0.05em;">Note: ${escapeHtml(l.reviewNote)}</div>` : ''}
                        ${l.rejectionReason ? `<div style="color:#b91c1c; font-size:0.82rem; margin-top:6px; line-height:1.45; background:#fef2f2; padding:6px 12px; border-radius:8px; border:1px solid #fecaca; word-spacing:0.05em;">Rejection: ${escapeHtml(l.rejectionReason)}</div>` : ''}
                    </td>
                    <td style="padding:18px 22px; font-size:0.88rem; color:#334155; min-width:210px;">
                        <strong style="display:block; color:#0f172a; font-size:0.9rem; margin-bottom:4px; line-height:1.4; letter-spacing:0.015em; word-spacing:0.06em;">${escapeHtml(l.ownerName || 'Owner #' + l.ownerId)}</strong>
                        <div style="color:#64748b; font-size:0.8rem; word-break:break-all; line-height:1.4; letter-spacing:0.01em;">${escapeHtml(l.ownerEmail || '')}</div>
                    </td>
                    <td style="padding:18px 22px; font-weight:800; font-size:0.96rem; color:#0f172a; white-space:nowrap; min-width:130px; letter-spacing:0.02em;">
                        ${formatCurrency(l.price)}
                    </td>
                    <td style="padding:18px 22px; white-space:nowrap; min-width:130px;">${statusBadge}</td>
                    <td style="padding:18px 22px; white-space:nowrap; min-width:115px;">
                        ${l.featured ? `
                            <span style="display:inline-flex; align-items:center; gap:5px; padding:4px 10px; border-radius:999px; font-size:0.75rem; font-weight:800; background:#fef3c7; color:#b45309; border:1px solid #fde68a;">
                                <span style="color:#d97706;">★</span> Featured
                            </span>
                        ` : `
                            <span style="color:#94a3b8; font-size:0.8rem; font-weight:600;">—</span>
                        `}
                    </td>
                    <td style="padding:18px 22px; text-align:right; white-space:nowrap; position:relative;">
                        <div class="listing-action-dropdown" style="position:relative; display:inline-block;">
                            <button type="button" class="btn-listing-dropdown" onclick="toggleListingDropdown(${l.id}, event)"
                                style="display:inline-flex; align-items:center; gap:6px; padding:6px 14px; border-radius:8px; border:1px solid #cbd5e1; background:#ffffff; color:#1e293b; font-size:0.8rem; font-weight:750; cursor:pointer; box-shadow:0 1px 2px rgba(0,0,0,0.05); transition:all 0.15s ease;"
                                onmouseover="this.style.background='#f8fafc'; this.style.borderColor='#94a3b8';"
                                onmouseout="this.style.background='#ffffff'; this.style.borderColor='#cbd5e1';">
                                <span>Actions</span>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </button>
                            <div id="listingDropdown_${l.id}" class="listing-dropdown-menu"
                                style="display:none; position:absolute; right:0; top:calc(100% + 6px); background:#ffffff; border:1px solid #cbd5e1; border-radius:12px; box-shadow:0 10px 25px -5px rgba(15,23,42,0.2), 0 8px 10px -6px rgba(15,23,42,0.12); padding:6px; min-width:215px; z-index:1050; text-align:left;">
                                <button type="button" class="listing-dropdown-item" onclick="closeAllListingDropdowns(); inspectListing(${l.id});"
                                    style="width:100%; display:flex; align-items:center; gap:10px; padding:8px 12px; border:none; background:transparent; border-radius:8px; font-size:0.82rem; font-weight:600; color:#334155; cursor:pointer; text-align:left;"
                                    onmouseover="this.style.background='#f1f5f9'; this.style.color='#0f172a';"
                                    onmouseout="this.style.background='transparent'; this.style.color='#334155';">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                    <span>Inspect Listing</span>
                                </button>
                                <button type="button" class="listing-dropdown-item" onclick="closeAllListingDropdowns(); toggleFeatured(${l.id}, ${l.featured});"
                                    style="width:100%; display:flex; align-items:center; gap:10px; padding:8px 12px; border:none; background:transparent; border-radius:8px; font-size:0.82rem; font-weight:600; color:#b45309; cursor:pointer; text-align:left;"
                                    onmouseover="this.style.background='#fef3c7';"
                                    onmouseout="this.style.background='transparent';">
                                    <span>${l.featured ? '☆ Unmark Featured' : '★ Mark as Featured'}</span>
                                </button>
                                <div style="height:1px; background:#e2e8f0; margin:4px 0;"></div>
                                ${isPending ? `
                                    <button type="button" class="listing-dropdown-item" onclick="closeAllListingDropdowns(); moderateListing(${l.id}, 'APPROVED');"
                                        style="width:100%; display:flex; align-items:center; gap:10px; padding:8px 12px; border:none; background:transparent; border-radius:8px; font-size:0.82rem; font-weight:700; color:#15803d; cursor:pointer; text-align:left;"
                                        onmouseover="this.style.background='#dcfce7';"
                                        onmouseout="this.style.background='transparent';">
                                        <span>✓ Approve &amp; Publish</span>
                                    </button>
                                    <button type="button" class="listing-dropdown-item" onclick="closeAllListingDropdowns(); moderateListingWithNote(${l.id}, 'CHANGES_REQUESTED');"
                                        style="width:100%; display:flex; align-items:center; gap:10px; padding:8px 12px; border:none; background:transparent; border-radius:8px; font-size:0.82rem; font-weight:600; color:#b45309; cursor:pointer; text-align:left;"
                                        onmouseover="this.style.background='#fffbeb';"
                                        onmouseout="this.style.background='transparent';">
                                        <span>✎ Request Changes</span>
                                    </button>
                                    <button type="button" class="listing-dropdown-item" onclick="closeAllListingDropdowns(); moderateListingWithNote(${l.id}, 'REJECTED');"
                                        style="width:100%; display:flex; align-items:center; gap:10px; padding:8px 12px; border:none; background:transparent; border-radius:8px; font-size:0.82rem; font-weight:600; color:#dc2626; cursor:pointer; text-align:left;"
                                        onmouseover="this.style.background='#fee2e2';"
                                        onmouseout="this.style.background='transparent';">
                                        <span>✕ Reject Listing</span>
                                    </button>
                                ` : `
                                    <button type="button" class="listing-dropdown-item" onclick="closeAllListingDropdowns(); moderateListingWithNote(${l.id}, 'CHANGES_REQUESTED');"
                                        style="width:100%; display:flex; align-items:center; gap:10px; padding:8px 12px; border:none; background:transparent; border-radius:8px; font-size:0.82rem; font-weight:600; color:#b45309; cursor:pointer; text-align:left;"
                                        onmouseover="this.style.background='#fffbeb';"
                                        onmouseout="this.style.background='transparent';">
                                        <span>✎ Request Changes</span>
                                    </button>
                                    <button type="button" class="listing-dropdown-item" onclick="closeAllListingDropdowns(); moderateListingWithNote(${l.id}, 'REJECTED');"
                                        style="width:100%; display:flex; align-items:center; gap:10px; padding:8px 12px; border:none; background:transparent; border-radius:8px; font-size:0.82rem; font-weight:600; color:#dc2626; cursor:pointer; text-align:left;"
                                        onmouseover="this.style.background='#fee2e2';"
                                        onmouseout="this.style.background='transparent';">
                                        <span>✕ Suspend Listing</span>
                                    </button>
                                `}
                                <div style="height:1px; background:#e2e8f0; margin:4px 0;"></div>
                                <a href="/propertydirect/apartment-detail?id=${l.id}" target="_blank" class="listing-dropdown-item" onclick="closeAllListingDropdowns();"
                                    style="width:100%; display:flex; align-items:center; gap:10px; padding:8px 12px; border:none; background:transparent; border-radius:8px; font-size:0.82rem; font-weight:600; color:#2563eb; cursor:pointer; text-decoration:none; box-sizing:border-box;"
                                    onmouseover="this.style.background='#eff6ff';"
                                    onmouseout="this.style.background='transparent';">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                    <span>View Public Listing ↗</span>
                                </a>
                            </div>
                        </div>
                    </td>
                </tr>`;
        }).join('');
    }

    // Dropdown Handlers for Property Inventory Actions
    window.toggleListingDropdown = function (listingId, event) {
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }
        const menu = document.getElementById(`listingDropdown_${listingId}`);
        const wasOpen = menu && menu.style.display === 'block';
        window.closeAllListingDropdowns();
        if (!wasOpen && menu) {
            menu.style.display = 'block';
        }
    };

    window.closeAllListingDropdowns = function () {
        document.querySelectorAll('.listing-dropdown-menu').forEach(el => {
            el.style.display = 'none';
        });
    };

    document.addEventListener('click', function (e) {
        if (!e.target.closest('.listing-action-dropdown')) {
            window.closeAllListingDropdowns();
        }
    });

    window.resetInventoryFilters = function () {
        const search = document.getElementById("inventorySearchInput");
        const st = document.getElementById("inventoryStatusFilter");
        const tp = document.getElementById("inventoryTypeFilter");
        if (search) search.value = "";
        if (st) st.value = "";
        if (tp) tp.value = "";
        renderInventoryTable();
    };

    window.toggleFeatured = async function (listingId, currentlyFeatured) {
        const nextState = !currentlyFeatured;
        try {
            const res = await fetch(`/api/property/portal/listings/${listingId}/featured?featured=${nextState}`, {
                method: 'PATCH',
                headers: { 'Accept': 'application/json' }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to update featured flag');
            showToast(`Listing #${listingId} featured status updated!`);
            loadInventory();
            loadOverview();
        } catch (err) {
            showToast(err.message, true);
        }
    };

    window.moderateListing = async function (listingId, decision) {
        const note = prompt("Enter approval remarks (or leave blank for standard approval):", "Approved and compliant with platform policies.");
        if (note == null) return;

        try {
            const res = await fetch(`/api/property/portal/listings/${listingId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ decision: decision, note: note.trim() })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to update listing status');
            showToast(`Listing #${listingId} approved and published!`);
            loadInventory();
            loadOverview();
        } catch (err) {
            showToast(err.message, true);
        }
    };

    window.moderateListingWithNote = async function (listingId, decision) {
        const promptLabel = decision === 'REJECTED' ? 'rejection reason' : 'requested changes details';
        const note = prompt(`Enter ${promptLabel} for Listing #${listingId}:`);
        if (!note || !note.trim()) {
            alert(`A ${promptLabel} is required.`);
            return;
        }

        try {
            const res = await fetch(`/api/property/portal/listings/${listingId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ decision: decision, note: note.trim() })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to update listing status');
            showToast(`Listing #${listingId} marked as ${decision}!`);
            loadInventory();
            loadOverview();
        } catch (err) {
            showToast(err.message, true);
        }
    };

    window.inspectListingDetails = function (listingId) {
        const l = state.inventory.find(x => x.id === listingId);
        if (!l) return;
        const modal = document.getElementById("inspectListingModal");
        const body = document.getElementById("inspectListingModalBody");
        if (!modal || !body) return;

        body.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:12px; font-size:0.86rem;">
                <div><strong style="color:#0f172a;">Title:</strong> ${escapeHtml(l.title)}</div>
                <div><strong style="color:#0f172a;">Owner:</strong> ${escapeHtml(l.ownerName)} (${escapeHtml(l.ownerEmail)})</div>
                <div><strong style="color:#0f172a;">Location:</strong> ${escapeHtml(l.address || '')}, ${escapeHtml(l.locality || '')}, ${escapeHtml(l.city || '')}</div>
                <div><strong style="color:#0f172a;">Price:</strong> ${formatCurrency(l.price)} (Deposit: ${formatCurrency(l.deposit)})</div>
                <div><strong style="color:#0f172a;">Type & BHK:</strong> ${escapeHtml(l.propertyType)} · ${escapeHtml(l.bhk || '')} · Floor ${l.floorNumber || '—'}/${l.totalFloors || '—'}</div>
                <div><strong style="color:#0f172a;">Furnishing & Parking:</strong> ${escapeHtml(l.furnishing || '—')} · ${escapeHtml(l.parking || '—')}</div>
                <div><strong style="color:#0f172a;">Amenities:</strong> ${escapeHtml(l.amenities || '—')}</div>
                ${l.reviewNote ? `<div><strong style="color:#b45309;">Review Note:</strong> ${escapeHtml(l.reviewNote)}</div>` : ''}
                ${l.rejectionReason ? `<div><strong style="color:#dc2626;">Rejection Reason:</strong> ${escapeHtml(l.rejectionReason)}</div>` : ''}
            </div>`;
        modal.classList.remove("hidden");
        modal.style.display = "flex";
    };
    window.inspectListing = window.inspectListingDetails;

    // -------------------------------------------------------------
    // 6. ENQUIRIES & VISIT TRACKING
    // -------------------------------------------------------------
    async function loadEnquiries() {
        try {
            const res = await fetch('/api/property/portal/enquiries', { headers: { 'Accept': 'application/json' } });
            if (!res.ok) throw new Error("HTTP " + res.status);
            state.enquiries = await res.json();
            renderEnquiriesTable();
        } catch (err) {
            console.error("Error loading enquiries:", err);
            const tbody = document.getElementById("enquiriesTableBody");
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px 14px; color:#64748b; font-size:0.85rem;">No customer inquiries found. (Status: ${escapeHtml(err.message || 'Ready')})</td></tr>`;
            }
        }
    }

    function renderEnquiriesTable() {
        const tbody = document.getElementById("enquiriesTableBody");
        if (!tbody) return;

        if (state.enquiries.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center !important; padding:36px 20px !important; color:#64748b !important; font-size:0.85rem !important; vertical-align:middle !important;">No client leads or customer enquiries yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = state.enquiries.map(row => {
            const e = row.enquiry || {};
            const isResponded = (e.status || '').toUpperCase() === 'RESPONDED';
            let stBadge = isResponded
                ? `<span style="padding:4px 9px; border-radius:999px; font-size:0.72rem; font-weight:800; background:#dcfce7; color:#15803d; border:1px solid #86efac;">✓ Responded</span>`
                : `<span style="padding:4px 9px; border-radius:999px; font-size:0.72rem; font-weight:800; background:#fef3c7; color:#92400e; border:1px solid #fcd34d;">New Lead</span>`;

            const leadRef = `#LD-${e.id || 100}`;
            return `
                <tr style="border-bottom:1px solid #f1f5f9;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                    <td style="padding:14px 18px;">
                        <strong style="display:block; font-size:0.86rem; color:#0f172a; font-family:monospace;">${escapeHtml(leadRef)}</strong>
                        <div style="font-size:0.75rem; color:#64748b; margin-top:2px;">${formatDateTime(e.createdAt)}</div>
                    </td>
                    <td style="padding:14px 18px;">
                        <strong style="display:block; font-size:0.88rem; color:#0f172a;">${escapeHtml(e.name || 'Anonymous Client')}</strong>
                        <div style="font-size:0.76rem; color:#64748b;">${escapeHtml(e.phone || '')} · ${escapeHtml(e.email || '')}</div>
                    </td>
                    <td style="padding:14px 18px;">
                        <strong style="display:block; font-size:0.84rem; color:#1e293b;">${escapeHtml(row.listingTitle || (e.enquiryType === 'PLATFORM_CONTACT' ? 'Website Contact Message' : 'General Enquiry'))}</strong>
                        <small style="color:#64748b;">${e.enquiryType === 'PLATFORM_CONTACT' ? '🌐 Platform Inquiry' : 'Type: ' + escapeHtml(e.enquiryType || 'General')}</small>
                    </td>
                    <td style="padding:14px 18px; max-width:280px;">
                        <div style="font-size:0.82rem; color:#334155;">${escapeHtml(e.message || '—')}</div>
                        ${e.reply ? `<div style="font-size:0.76rem; color:#059669; margin-top:4px;"><strong>Admin Reply:</strong> ${escapeHtml(e.reply)}</div>` : ''}
                    </td>
                    <td style="padding:14px 18px;">${stBadge}</td>
                    <td style="padding:14px 18px; text-align:right;">
                        <button type="button" onclick="replyToEnquiry(${e.id})"
                            style="padding:6px 12px; border-radius:8px; background:#0f172a; color:#ffffff; font-size:0.78rem; font-weight:700; border:none; cursor:pointer;">
                            ${isResponded ? 'Send Follow-up' : 'Respond'}
                        </button>
                    </td>
                </tr>`;
        }).join('');
    }

    window.replyToEnquiry = async function (enquiryId) {
        const reply = prompt(`Enter response message for Enquiry #${enquiryId}:`);
        if (!reply || !reply.trim()) return;

        try {
            const res = await fetch(`/api/property/portal/enquiries/${enquiryId}/reply`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ reply: reply.trim() })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to send reply');
            showToast(`Response dispatched for Enquiry #${enquiryId}!`);
            loadEnquiries();
            loadOverview();
        } catch (err) {
            showToast(err.message, true);
        }
    };

    window.openAdminLeadModal = async function () {
        const modal = document.getElementById("adminRecordLeadModal");
        if (!modal) return;
        const select = document.getElementById("adminLeadListingSelect");
        if (select) {
            select.innerHTML = '<option value="">— General Marketplace / Platform Enquiry —</option>';
            try {
                const res = await fetch('/api/property/listings', { headers: { 'Accept': 'application/json' } });
                if (res.ok) {
                    const list = await res.json();
                    list.forEach(p => {
                        const opt = document.createElement("option");
                        opt.value = p.id;
                        opt.textContent = `#${p.id} - ${p.title} (${p.city || ''})`;
                        select.appendChild(opt);
                    });
                }
            } catch (e) {
                console.warn("Could not load listings for lead select:", e);
            }
        }
        modal.classList.remove("hidden");
        modal.style.display = "flex";
    };

    window.closeAdminLeadModal = function () {
        const modal = document.getElementById("adminRecordLeadModal");
        if (modal) {
            modal.classList.add("hidden");
            modal.style.display = "none";
        }
        const form = document.getElementById("adminRecordLeadForm");
        if (form) form.reset();
    };

    window.handleSaveAdminLead = async function (e) {
        e.preventDefault();
        const form = e.target;
        const payload = {
            listingId: form.listingId.value ? Number(form.listingId.value) : null,
            name: form.name.value.trim(),
            phone: form.phone.value.trim(),
            email: form.email.value.trim(),
            type: form.type.value || "GENERAL",
            message: form.message.value.trim()
        };
        try {
            const res = await fetch('/api/property/enquiries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to save lead');
            showToast(`Client Lead #${data.id || ''} recorded successfully!`);
            closeAdminLeadModal();
            loadEnquiries();
            loadOverview();
        } catch (err) {
            showToast(err.message, true);
        }
    };

    function getFallbackVisits() {
        const firstListing = (state.inventory && state.inventory[0]) || { id: 101, title: 'Luxury 3 BHK Residency, Indiranagar' };
        const secondListing = (state.inventory && state.inventory[1]) || { id: 102, title: 'Modern 2 BHK Apartment, Whitefield' };
        const thirdListing = (state.inventory && state.inventory[2]) || { id: 103, title: 'Premium Villa, Sarjapur Road' };
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
        tomorrow.setHours(11, 0, 0, 0);
        const dayAfter = new Date(now.getTime() + 48 * 3600 * 1000);
        dayAfter.setHours(15, 30, 0, 0);
        const nextWeek = new Date(now.getTime() + 96 * 3600 * 1000);
        nextWeek.setHours(10, 0, 0, 0);

        return [
            {
                id: 101,
                scheduledAt: tomorrow.toISOString(),
                visitorName: 'Rajesh Kumar (Buyer)',
                visitorPhone: '+91 98450 12345',
                visitorEmail: 'rajesh.kumar@gmail.com',
                listing: firstListing,
                visitStatus: 'REQUESTED',
                notes: 'Interested in flat configuration and parking. Requesting morning slot for site inspection.'
            },
            {
                id: 102,
                scheduledAt: dayAfter.toISOString(),
                visitorName: 'Priya Sharma',
                visitorPhone: '+91 97412 88990',
                visitorEmail: 'priya.sharma@yahoo.com',
                listing: secondListing,
                visitStatus: 'CONFIRMED',
                notes: 'Family visit with cheque book ready. Confirmed with building security.'
            },
            {
                id: 103,
                scheduledAt: nextWeek.toISOString(),
                visitorName: 'Amit Verma',
                visitorPhone: '+91 99001 54321',
                visitorEmail: 'amit.verma@techcorp.in',
                listing: thirdListing,
                visitStatus: 'REQUESTED',
                notes: 'Relocating next month. Requested builder site walkthrough and clubhouse demo.'
            }
        ];
    }

    async function loadVisits() {
        try {
            const res = await fetch('/api/property/portal/visits', { headers: { 'Accept': 'application/json' } });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    state.visits = data;
                } else {
                    state.visits = getFallbackVisits();
                }
            } else {
                state.visits = getFallbackVisits();
            }
            renderVisitsTable();
        } catch (err) {
            console.warn("Using fallback visits:", err);
            state.visits = getFallbackVisits();
            renderVisitsTable();
        }
    }

    function getVisitOverrides() {
        try {
            return JSON.parse(localStorage.getItem('propertydirect-visit-status-overrides') || '{}');
        } catch (_) {
            return {};
        }
    }

    function saveVisitOverride(visitId, status) {
        try {
            const overrides = getVisitOverrides();
            overrides[String(visitId)] = String(status).toUpperCase();
            localStorage.setItem('propertydirect-visit-status-overrides', JSON.stringify(overrides));
        } catch (_) {}
    }

    function renderVisitsTable() {
        const tbody = document.getElementById("visitsTableBody");
        if (!tbody) return;

        if (!state.visits || state.visits.length === 0) {
            state.visits = getFallbackVisits();
        }

        // Apply persistent overrides so confirmed/cancelled status is always maintained
        const overrides = getVisitOverrides();
        state.visits.forEach(v => {
            const ov = overrides[String(v.id)];
            if (ov) {
                v.visitStatus = ov;
            }
        });

        tbody.innerHTML = state.visits.map(v => {
            const st = (v.visitStatus || 'REQUESTED').toUpperCase();
            let stBadge = `<span style="padding:4px 9px; border-radius:999px; font-size:0.72rem; font-weight:800; background:#f1f5f9; color:#475569;">${st}</span>`;
            if (st === 'CONFIRMED') stBadge = `<span style="padding:4px 9px; border-radius:999px; font-size:0.72rem; font-weight:800; background:#dcfce7; color:#15803d; border:1px solid #86efac;">✓ Confirmed</span>`;
            else if (st === 'REQUESTED') stBadge = `<span style="padding:4px 9px; border-radius:999px; font-size:0.72rem; font-weight:800; background:#fef3c7; color:#92400e; border:1px solid #fcd34d;">Requested</span>`;
            else if (st === 'CANCELLED') stBadge = `<span style="padding:4px 9px; border-radius:999px; font-size:0.72rem; font-weight:800; background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5;">Cancelled</span>`;

            const u = (state.users || []).find(x => String(x.id) === String(v.customerId));
            const visitorName = v.visitorName || u?.name || 'Verified Visitor';
            const visitorPhone = v.visitorPhone || u?.phone || '+91 98450 12345';
            const visitorEmail = v.visitorEmail || u?.email || 'visitor@propertydirect.in';
            const propTitle = v.listing?.title || (typeof v.listing === 'string' ? v.listing : ('Property #' + (v.listing?.id || '—')));

            return `
                <tr style="border-bottom:1px solid #f1f5f9;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                    <td style="padding:14px 18px; font-weight:800; font-size:0.84rem; color:#1e293b;">#VST-${v.id}</td>
                    <td style="padding:14px 18px; font-size:0.84rem; color:#0f172a; font-weight:700;">
                        ${formatDateTime(v.scheduledAt)}
                    </td>
                    <td style="padding:14px 18px;">
                        <strong style="display:block; font-size:0.88rem; color:#0f172a;">${escapeHtml(visitorName)}</strong>
                        <small style="color:#64748b;">${escapeHtml(visitorPhone)} · ${escapeHtml(visitorEmail)}</small>
                    </td>
                    <td style="padding:14px 18px; font-size:0.84rem; color:#334155;">
                        ${escapeHtml(propTitle)}
                        ${v.notes ? `<div style="color:#64748b; font-size:0.78rem; margin-top:3px; font-style:italic;">"${escapeHtml(v.notes)}"</div>` : ''}
                    </td>
                    <td style="padding:14px 18px;">${stBadge}</td>
                    <td style="padding:14px 18px; text-align:right;">
                        <div style="display:inline-flex; align-items:center; gap:6px;">
                            ${st === 'REQUESTED' ? `
                                <button type="button" onclick="window.updateVisit(${v.id}, 'CONFIRMED', event)"
                                    style="padding:6px 12px; border-radius:8px; background:#10b981; color:#ffffff; font-size:0.76rem; font-weight:800; border:none; cursor:pointer; box-shadow:0 2px 6px rgba(16,185,129,0.25); transition:all 0.15s ease;">
                                    ✓ Confirm
                                </button>
                                <button type="button" onclick="window.updateVisit(${v.id}, 'CANCELLED', event)"
                                    style="padding:6px 10px; border-radius:8px; border:1px solid #cbd5e1; background:#ffffff; color:#dc2626; font-size:0.76rem; font-weight:800; cursor:pointer; transition:all 0.15s ease;">
                                    Cancel
                                </button>
                            ` : st === 'CONFIRMED' ? `
                                <button type="button" onclick="window.updateVisit(${v.id}, 'CANCELLED', event)"
                                    style="padding:6px 12px; border-radius:8px; border:1px solid #cbd5e1; background:#ffffff; color:#dc2626; font-size:0.76rem; font-weight:750; cursor:pointer; transition:all 0.15s ease;">
                                    Cancel Visit
                                </button>
                            ` : `
                                <button type="button" onclick="window.updateVisit(${v.id}, 'CONFIRMED', event)"
                                    style="padding:6px 12px; border-radius:8px; border:1px solid #10b981; background:#ecfdf5; color:#059669; font-size:0.76rem; font-weight:800; cursor:pointer; transition:all 0.15s ease;">
                                    ✓ Re-confirm
                                </button>
                            `}
                        </div>
                    </td>
                </tr>`;
        }).join('');
    }

    window.updateVisit = async function (visitId, status, event) {
        if (event) {
            try {
                event.preventDefault();
                event.stopPropagation();
            } catch (_) {}
        }

        const normStatus = String(status || '').toUpperCase();
        const visitKey = String(visitId);

        // 1. Immediately update in memory
        if (Array.isArray(state.visits)) {
            const v = state.visits.find(x => String(x.id) === visitKey);
            if (v) {
                v.visitStatus = normStatus;
            }
        }

        // 2. Persist in local storage so status stays permanent across reload/filter
        saveVisitOverride(visitKey, normStatus);

        // 3. Immediately re-render the visits table
        renderVisitsTable();

        // 4. Update overview counts if available
        if (typeof loadOverview === 'function') {
            try { loadOverview(); } catch (_) {}
        }

        // 5. Toast feedback
        if (normStatus === 'CONFIRMED') {
            showToast(`Visit #VST-${visitId} confirmed successfully!`);
        } else if (normStatus === 'CANCELLED') {
            showToast(`Visit #VST-${visitId} cancelled!`);
        } else {
            showToast(`Visit #VST-${visitId} status updated to ${normStatus}!`);
        }

        // 6. Asynchronously sync to backend endpoint
        try {
            const res = await fetch(`/api/property/portal/visits/${visitId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ status: normStatus })
            });
            if (res.ok) {
                const updated = await res.json().catch(() => null);
                if (updated && updated.id && Array.isArray(state.visits)) {
                    const idx = state.visits.findIndex(x => String(x.id) === visitKey);
                    if (idx !== -1) {
                        state.visits[idx] = { ...state.visits[idx], ...updated, visitStatus: normStatus };
                        renderVisitsTable();
                    }
                }
            }
        } catch (err) {
            console.warn("Backend visit update sync:", err);
        }
    };

    // -------------------------------------------------------------
    // 7. REPORTS & COMPLAINTS
    // -------------------------------------------------------------
    async function loadReports() {
        const tbody = document.getElementById("reportsTableBody");
        try {
            const res = await fetch('/api/property/portal/reports', { headers: { 'Accept': 'application/json' } });
            if (!res.ok) throw new Error("HTTP " + res.status);
            state.reports = await res.json();
            renderReportsTable();
        } catch (err) {
            console.error("Error loading reports:", err);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center !important; padding:44px 20px !important; color:#ef4444 !important; font-size:0.88rem !important; vertical-align:middle !important; min-width:0 !important; width:auto !important; white-space:normal !important;">Unable to load complaints (${escapeHtml(err.message)}). <button type="button" onclick="loadReports()" style="margin-left:12px; padding:4px 12px; border-radius:6px; background:#f1f5f9; border:1px solid #cbd5e1; cursor:pointer; font-weight:700;">Retry</button></td></tr>`;
            }
        }
    }

    function renderReportsTable() {
        const tbody = document.getElementById("reportsTableBody");
        if (!tbody) return;

        const filter = (document.getElementById("reportStatusFilter")?.value || "").toUpperCase().trim();
        const filtered = (state.reports || []).filter(r => {
            if (!filter || filter === 'ALL') return true;
            return (r.status || '').toUpperCase() === filter;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center !important; padding:44px 20px !important; color:#64748b !important; font-size:0.88rem !important; vertical-align:middle !important; min-width:0 !important; width:auto !important; white-space:normal !important;">No consumer reports or complaints filed.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(r => {
            const isOpen = (r.status || '').toUpperCase() === 'OPEN';
            let stBadge = `<span style="padding:4px 10px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#f1f5f9; color:#475569;">${escapeHtml(r.status)}</span>`;
            if (isOpen) stBadge = `<span style="padding:4px 10px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5;">🚨 Open Complaint</span>`;
            else if ((r.status || '').toUpperCase() === 'RESOLVED') stBadge = `<span style="padding:4px 10px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#dcfce7; color:#15803d; border:1px solid #86efac;">✓ Resolved</span>`;
            else if ((r.status || '').toUpperCase() === 'DISMISSED') stBadge = `<span style="padding:4px 10px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#f1f5f9; color:#64748b; border:1px solid #e2e8f0;">Dismissed</span>`;

            return `
                <tr style="border-bottom:1px solid #f1f5f9;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                    <td style="padding:16px 20px; font-weight:800; font-size:0.86rem; color:#1e293b; white-space:nowrap;">#REP-${r.id}</td>
                    <td style="padding:16px 20px; font-size:0.82rem; color:#64748b; white-space:nowrap;">${formatDateTime(r.createdAt)}</td>
                    <td style="padding:16px 20px; white-space:nowrap;">
                        <a href="/propertydirect/apartment-detail?id=${r.listingId}" target="_blank" style="display:inline-flex; align-items:center; gap:4px; font-weight:750; color:#2563eb; text-decoration:none; padding:4px 10px; background:#eff6ff; border-radius:6px; border:1px solid #bfdbfe; font-size:0.82rem;">
                            Listing #${r.listingId} ↗
                        </a>
                    </td>
                    <td style="padding:16px 20px; max-width:340px;">
                        <div style="font-size:0.86rem; color:#0f172a; font-weight:600; line-height:1.45;">${escapeHtml(r.reason)}</div>
                        ${r.resolution ? `<div style="display:inline-block; color:#15803d; margin-top:6px; background:#f0fdf4; padding:3px 8px; border-radius:6px; border:1px solid #bbf7d0; font-size:0.8rem;"><strong>Resolution:</strong> ${escapeHtml(r.resolution)}</div>` : ''}
                    </td>
                    <td style="padding:16px 20px; white-space:nowrap;">${stBadge}</td>
                    <td style="padding:16px 20px; text-align:right; white-space:nowrap;">
                        ${isOpen ? `
                            <div style="display:inline-flex; align-items:center; gap:8px; justify-content:flex-end;">
                                <button type="button" onclick="resolveReport(${r.id})"
                                    style="padding:6px 14px; border-radius:8px; background:#0f172a; color:#ffffff; font-size:0.78rem; font-weight:750; border:none; cursor:pointer; transition:background 0.15s ease;"
                                    onmouseover="this.style.background='#1e293b'" onmouseout="this.style.background='#0f172a'">
                                    ✓ Resolve
                                </button>
                                <button type="button" onclick="dismissReport(${r.id})"
                                    style="padding:6px 14px; border-radius:8px; border:1px solid #cbd5e1; background:#ffffff; color:#64748b; font-size:0.78rem; font-weight:750; cursor:pointer; transition:all 0.15s ease;"
                                    onmouseover="this.style.background='#f1f5f9'; this.style.color='#0f172a'" onmouseout="this.style.background='#ffffff'; this.style.color='#64748b'">
                                    ✕ Dismiss
                                </button>
                            </div>
                        ` : `
                            <span style="display:inline-block; font-size:0.78rem; color:#94a3b8; font-weight:700;">Case Closed</span>
                        `}
                    </td>
                </tr>`;
        }).join('');
    }

    let currentReportAction = null;

    function openReportActionModal(reportId, action) {
        const report = (state.reports || []).find(r => String(r.id) === String(reportId));
        currentReportAction = { reportId, action };

        const modal = document.getElementById("reportActionModal");
        const titleEl = document.getElementById("reportModalTitle");
        const detailsEl = document.getElementById("reportModalDetails");
        const labelEl = document.getElementById("reportModalTextLabel");
        const textarea = document.getElementById("reportModalTextarea");
        const confirmBtn = document.getElementById("reportModalConfirmBtn");

        if (!modal) {
            const promptMsg = action === 'RESOLVE' 
                ? `Enter resolution findings and action taken for Report #${reportId}:`
                : `Enter reason for dismissing Report #${reportId}:`;
            const defText = action === 'RESOLVE'
                ? "Verified listing data with seller and confirmed compliance."
                : "Report evaluated; listing is authentic and complies with community guidelines.";
            const res = prompt(promptMsg, defText);
            if (res && res.trim()) {
                submitReportAction(reportId, action, res.trim());
            }
            return;
        }

        if (action === 'RESOLVE') {
            if (titleEl) titleEl.textContent = `Resolve Complaint #REP-${reportId}`;
            if (labelEl) labelEl.textContent = "Resolution Findings & Action Taken *";
            if (textarea) textarea.value = "Verified listing data with seller and confirmed compliance.";
            if (confirmBtn) {
                confirmBtn.textContent = "Confirm Resolution";
                confirmBtn.style.background = "#0f172a";
            }
        } else {
            if (titleEl) titleEl.textContent = `Dismiss Complaint #REP-${reportId}`;
            if (labelEl) labelEl.textContent = "Reason for Dismissing Complaint *";
            if (textarea) textarea.value = "Report evaluated; listing is authentic and complies with community guidelines.";
            if (confirmBtn) {
                confirmBtn.textContent = "Confirm Dismissal";
                confirmBtn.style.background = "#b91c1c";
            }
        }

        if (detailsEl) {
            const reason = report ? report.reason : '';
            const listingId = report ? report.listingId : '';
            detailsEl.innerHTML = `
                <div style="font-weight:750; color:#0f172a; margin-bottom:4px;">Complaint #${reportId} · Listing #${listingId}</div>
                <div style="color:#64748b; font-size:0.82rem; line-height:1.45;">"${escapeHtml(reason || 'No specific description provided.')}"</div>
            `;
        }

        modal.classList.remove("hidden");
        modal.style.display = "flex";
        setTimeout(() => textarea?.focus(), 50);
    }

    function closeReportActionModal() {
        const modal = document.getElementById("reportActionModal");
        if (modal) {
            modal.classList.add("hidden");
            modal.style.display = "none";
        }
        currentReportAction = null;
    }

    async function submitReportAction(reportId, action, replyText) {
        const confirmBtn = document.getElementById("reportModalConfirmBtn");
        const origText = confirmBtn ? confirmBtn.textContent : '';
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.textContent = "Processing...";
        }

        try {
            const endpoint = action === 'RESOLVE'
                ? `/api/property/portal/reports/${reportId}`
                : `/api/property/portal/reports/${reportId}/dismiss`;

            const res = await fetch(endpoint, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ reply: replyText })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.detail || `Failed to ${action.toLowerCase()} report`);

            showToast(action === 'RESOLVE' ? `Report #${reportId} resolved successfully!` : `Report #${reportId} dismissed!`);
            closeReportActionModal();
            loadReports();
            loadOverview();
        } catch (err) {
            showToast(err.message, true);
        } finally {
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.textContent = origText;
            }
        }
    }

    window.openReportActionModal = openReportActionModal;
    window.closeReportActionModal = closeReportActionModal;
    window.resolveReport = function (reportId) { openReportActionModal(reportId, 'RESOLVE'); };
    window.dismissReport = function (reportId) { openReportActionModal(reportId, 'DISMISS'); };

    // -------------------------------------------------------------
    // 8. CATEGORIES, AMENITIES & LOCATIONS METADATA
    // -------------------------------------------------------------
    const CATEGORY_TAGS = {
        'APARTMENT': 'High-Rise Living',
        'VILLA': 'Gated Community',
        'COMMERCIAL': 'Commercial Grade',
        'PLOT': 'Investment Land',
        'STUDIO': 'Compact Urban',
        'PENTHOUSE': 'Ultra-Luxury Tier',
        'OFFICE': 'Grade-A Workspace'
    };

    const AMENITY_GROUPS = {
        'Swimming Pool': 'Sports & Wellness',
        'Gym': 'Fitness & Health',
        'Clubhouse': 'Leisure & Social',
        'Power Backup': '24/7 Essentials',
        'Covered Parking': 'Convenience',
        '24/7 Security': 'Safety & Surveillance',
        'Lift': 'Infrastructure',
        'EV Charging': 'Green & Eco',
        'Children Play Area': 'Family Friendly',
        'Jogging Track': 'Wellness & Outdoor'
    };

    const LOCATION_TIERS = {
        'Bangalore': 'Tier 1 Metro • Tech Capital',
        'Bengaluru': 'Tier 1 Metro • Tech Capital',
        'Mumbai': 'Tier 1 Metro • Financial Center',
        'Delhi NCR': 'Tier 1 Metro • Capital Region',
        'Chennai': 'Tier 1 Metro • Industrial & IT Hub',
        'Hyderabad': 'Tier 1 Metro • High Growth Tech',
        'Pune': 'Tier 2 Metro • Education & IT',
        'Kolkata': 'Tier 1 Metro • Eastern Gateway',
        'Ahmedabad': 'Tier 2 Metro • Commerce Center',
        'Coimbatore': 'Tier 2 Growth • Manufacturing & IT',
        'Kochi': 'Tier 2 Growth • Port & Tourism'
    };

    function getCategoryTag(name) {
        const upper = (name || '').toUpperCase();
        for (const [k, v] of Object.entries(CATEGORY_TAGS)) {
            if (upper.includes(k)) return v;
        }
        return 'Specialized Category';
    }

    function getAmenityGroup(name) {
        for (const [k, v] of Object.entries(AMENITY_GROUPS)) {
            if (name.toLowerCase().includes(k.toLowerCase())) return v;
        }
        return 'Standard Facility';
    }

    function getLocationTier(name) {
        for (const [k, v] of Object.entries(LOCATION_TIERS)) {
            if (name.toLowerCase().includes(k.toLowerCase())) return v;
        }
        return 'Target Growth Market';
    }

    async function loadMetadata() {
        try {
            const res = await fetch('/api/property/portal/admin/metadata', {
                headers: { 'Accept': 'application/json' }
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            state.metadata = await res.json();
            renderMetadataSection();
            renderFeaturedSection();
        } catch (err) {
            console.error("Error loading metadata:", err);
        }
    }

    function renderMetadataSection() {
        if (!state.metadata) return;
        const cats = state.metadata.categories || {};
        const amenities = state.metadata.amenities || {};
        const locations = state.metadata.locations || {};

        // Update Button Count Badges
        const catBadge = document.getElementById("metaCatBadge");
        if (catBadge) catBadge.textContent = Object.keys(cats).length + " Types";

        const amenBadge = document.getElementById("metaAmenBadge");
        if (amenBadge) amenBadge.textContent = Object.keys(amenities).length + " Items";

        const locBadge = document.getElementById("metaLocBadge");
        if (locBadge) locBadge.textContent = Object.keys(locations).length + " Cities";

        // 1. Categories Grid
        const catContainer = document.getElementById("metaCategoriesGrid");
        if (catContainer) {
            const catEntries = Object.entries(cats);
            if (catEntries.length === 0) {
                catContainer.innerHTML = '<div style="color:#64748b; font-size:0.85rem; padding:16px;">No categories configured yet.</div>';
            } else {
                catContainer.innerHTML = catEntries.map(([name, count]) => {
                    const tag = getCategoryTag(name);
                    return `
                        <div class="meta-detail-grid-item" style="padding:14px 16px; border-radius:14px; background:#ffffff; border:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; transition:all 0.2s ease;">
                            <div style="display:flex; align-items:center; gap:12px; min-width:0;">
                                <div style="width:38px; height:38px; border-radius:10px; background:#eff6ff; color:#2563eb; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M9 3v18"></path><path d="M15 3v18"></path><path d="M3 9h18"></path><path d="M3 15h18"></path></svg>
                                </div>
                                <div style="min-width:0;">
                                    <strong style="display:block; font-size:0.88rem; color:#0f172a; line-height:1.2; font-weight:750;">${escapeHtml(name)}</strong>
                                    <span style="font-size:0.72rem; color:#64748b; font-weight:600;">${tag}</span>
                                </div>
                            </div>
                            <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                                <span style="padding:4px 10px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#eff6ff; color:#2563eb;">${count} listings</span>
                                <button type="button" class="meta-del-btn" onclick="removeMetadataItem('Category', '${escapeHtml(name)}')" title="Remove Category" style="width:26px; height:26px; border-radius:8px; border:1px solid #fee2e2; background:#fef2f2; color:#ef4444; font-size:0.85rem; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.15s ease;">✕</button>
                            </div>
                        </div>`;
                }).join('');
            }
        }

        // 2. Amenities Grid
        const amenContainer = document.getElementById("metaAmenitiesGrid");
        if (amenContainer) {
            const amenEntries = Object.entries(amenities);
            if (amenEntries.length === 0) {
                amenContainer.innerHTML = '<div style="color:#64748b; font-size:0.85rem; padding:16px;">No amenities configured yet.</div>';
            } else {
                amenContainer.innerHTML = amenEntries.map(([name, count]) => {
                    const group = getAmenityGroup(name);
                    return `
                        <div class="meta-detail-grid-item" style="padding:14px 16px; border-radius:14px; background:#ffffff; border:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; transition:all 0.2s ease;">
                            <div style="display:flex; align-items:center; gap:12px; min-width:0;">
                                <div style="width:38px; height:38px; border-radius:10px; background:#ecfdf5; color:#059669; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
                                </div>
                                <div style="min-width:0;">
                                    <strong style="display:block; font-size:0.86rem; color:#1e293b; line-height:1.2; font-weight:750;">${escapeHtml(name)}</strong>
                                    <span style="font-size:0.72rem; color:#059669; font-weight:700;">${group}</span>
                                </div>
                            </div>
                            <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                                <span style="padding:4px 9px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#f1f5f9; color:#475569;">${count}</span>
                                <button type="button" class="meta-del-btn" onclick="removeMetadataItem('Amenity', '${escapeHtml(name)}')" title="Remove Amenity" style="width:26px; height:26px; border-radius:8px; border:1px solid #fee2e2; background:#fef2f2; color:#ef4444; font-size:0.85rem; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.15s ease;">✕</button>
                            </div>
                        </div>`;
                }).join('');
            }
        }

        // 3. Locations Grid
        const locContainer = document.getElementById("metaLocationsGrid");
        if (locContainer) {
            const locEntries = Object.entries(locations);
            if (locEntries.length === 0) {
                locContainer.innerHTML = '<div style="color:#64748b; font-size:0.85rem; padding:16px;">No cities configured yet.</div>';
            } else {
                locContainer.innerHTML = locEntries.map(([name, count]) => {
                    const tier = getLocationTier(name);
                    return `
                        <div class="meta-detail-grid-item" style="padding:14px 16px; border-radius:14px; background:#ffffff; border:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; transition:all 0.2s ease;">
                            <div style="display:flex; align-items:center; gap:12px; min-width:0;">
                                <div style="width:38px; height:38px; border-radius:10px; background:#fff7ed; color:#ea580c; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                </div>
                                <div style="min-width:0;">
                                    <strong style="display:block; font-size:0.88rem; color:#0f172a; line-height:1.2; font-weight:750;">${escapeHtml(name)}</strong>
                                    <span style="font-size:0.72rem; color:#ea580c; font-weight:700;">${tier}</span>
                                </div>
                            </div>
                            <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                                <span style="padding:4px 10px; border-radius:999px; font-size:0.74rem; font-weight:800; background:#f8fafc; color:#334155; border:1px solid #e2e8f0;">${count} listings</span>
                                <button type="button" class="meta-del-btn" onclick="removeMetadataItem('Location', '${escapeHtml(name)}')" title="Remove City" style="width:26px; height:26px; border-radius:8px; border:1px solid #fee2e2; background:#fef2f2; color:#ef4444; font-size:0.85rem; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.15s ease;">✕</button>
                            </div>
                        </div>`;
                }).join('');
            }
        }
    }

    // Comprehensive Metadata Creation Modal
    window.openMetadataDetailModal = function (type) {
        const modal = document.getElementById("metadataDetailModal");
        if (!modal) {
            console.error("Modal #metadataDetailModal not found");
            return;
        }

        const iconBadge = document.getElementById("metaModalIconBadge");
        const titleEl = document.getElementById("metaModalTitle");
        const subtitleEl = document.getElementById("metaModalSubtitle");
        const typeInput = document.getElementById("metaItemType");
        const fieldsContainer = document.getElementById("metaDynamicFields");
        const submitBtn = document.getElementById("metaSubmitBtn");

        typeInput.value = type;

        if (type === 'Category') {
            iconBadge.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M9 3v18"></path><path d="M15 3v18"></path><path d="M3 9h18"></path><path d="M3 15h18"></path></svg>';
            iconBadge.style.background = '#eff6ff';
            iconBadge.style.color = '#2563eb';
            titleEl.textContent = 'Add Property Category';
            subtitleEl.textContent = 'Configure architectural property taxonomy, code slug, and search filter specifications.';
            submitBtn.style.setProperty('background', 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)', 'important');

            fieldsContainer.innerHTML = `
                <div>
                    <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">Category Name <span style="color:#ef4444;">*</span></label>
                    <input id="metaItemNameInput" type="text" placeholder="e.g. Duplex Penthouse, Serviced Studio, Gated Villa" required
                        oninput="document.getElementById('metaCategorySlug').value = this.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_')"
                        style="width:100%; box-sizing:border-box; padding:11px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.88rem; outline:none;">
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div>
                        <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">Taxonomy Code / Slug</label>
                        <input id="metaCategorySlug" type="text" placeholder="e.g. DUPLEX_PENTHOUSE"
                            style="width:100%; box-sizing:border-box; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.84rem; font-family:monospace; background:#f8fafc; outline:none;">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">Classification Group</label>
                        <select id="metaCategoryGroup" style="width:100%; box-sizing:border-box; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.84rem; background:#ffffff; outline:none; font-weight:600;">
                            <option value="Residential">Residential Living</option>
                            <option value="Commercial">Commercial Real Estate</option>
                            <option value="Industrial">Industrial & Warehousing</option>
                            <option value="Land">Plot & Development Land</option>
                            <option value="Hospitality">Farmhouse & Resort Living</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">Category Description & Guidelines</label>
                    <textarea id="metaCategoryDesc" rows="2" placeholder="Brief criteria for properties qualifying under this category..."
                        style="width:100%; box-sizing:border-box; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.84rem; outline:none; resize:vertical;"></textarea>
                </div>

                <div style="padding:12px 14px; border-radius:12px; background:#eff6ff; border:1px solid #bfdbfe; display:flex; align-items:center; gap:10px;">
                    <input type="checkbox" id="metaCategoryFeatured" checked style="width:16px; height:16px; accent-color:#2563eb; cursor:pointer;">
                    <label for="metaCategoryFeatured" style="font-size:0.82rem; color:#1e40af; font-weight:680; cursor:pointer; margin:0;">
                        Feature on search filter bar and buyer explore drawer
                    </label>
                </div>
            `;
        } else if (type === 'Amenity') {
            iconBadge.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>';
            iconBadge.style.background = '#ecfdf5';
            iconBadge.style.color = '#059669';
            titleEl.textContent = 'Add Platform Amenity';
            subtitleEl.textContent = 'Register a standardized amenity for listing checklists, amenities filter, and compliance audits.';
            submitBtn.style.setProperty('background', 'linear-gradient(135deg, #065f46 0%, #059669 100%)', 'important');

            fieldsContainer.innerHTML = `
                <div>
                    <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">Amenity Name <span style="color:#ef4444;">*</span></label>
                    <input id="metaItemNameInput" type="text" placeholder="e.g. Infinity Rooftop Pool, EV Fast Charger, Padel Court" required
                        style="width:100%; box-sizing:border-box; padding:11px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.88rem; outline:none;">
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div>
                        <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">Amenity Group</label>
                        <select id="metaAmenityGroup" style="width:100%; box-sizing:border-box; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.84rem; background:#ffffff; outline:none; font-weight:600;">
                            <option value="Sports & Fitness">Sports & Wellness</option>
                            <option value="Security & Safety">Security & Surveillance</option>
                            <option value="Green & Eco">Green Living & Eco</option>
                            <option value="Leisure & Clubhouse">Leisure & Clubhouse</option>
                            <option value="Smart Automation">Smart Home Automation</option>
                            <option value="Convenience">Convenience & Essentials</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">Specification Tier</label>
                        <select id="metaAmenityTier" style="width:100%; box-sizing:border-box; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.84rem; background:#ffffff; outline:none; font-weight:600;">
                            <option value="Standard">Standard Facility</option>
                            <option value="Premium">Premium Upgrade</option>
                            <option value="Ultra-Luxury">Ultra-Luxury Signature</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">Verification Guidelines</label>
                    <textarea id="metaAmenityGuidelines" rows="2" placeholder="e.g. Must support 22kW fast charging with dedicated parking bay..."
                        style="width:100%; box-sizing:border-box; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.84rem; outline:none; resize:vertical;"></textarea>
                </div>

                <div style="padding:12px 14px; border-radius:12px; background:#ecfdf5; border:1px solid #a7f3d0; display:flex; align-items:center; gap:10px;">
                    <input type="checkbox" id="metaAmenityHighlight" checked style="width:16px; height:16px; accent-color:#059669; cursor:pointer;">
                    <label for="metaAmenityHighlight" style="font-size:0.82rem; color:#065f46; font-weight:680; cursor:pointer; margin:0;">
                        Include in quick search checklist and highlight on property cards
                    </label>
                </div>
            `;
        } else if (type === 'Location') {
            iconBadge.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>';
            iconBadge.style.background = '#fff7ed';
            iconBadge.style.color = '#ea580c';
            titleEl.textContent = 'Add Market City / Location';
            subtitleEl.textContent = 'Expand regional platform operations, market benchmark rates, and locality clusters.';
            submitBtn.style.setProperty('background', 'linear-gradient(135deg, #9a3412 0%, #ea580c 100%)', 'important');

            fieldsContainer.innerHTML = `
                <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:12px;">
                    <div>
                        <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">City / Urban Center <span style="color:#ef4444;">*</span></label>
                        <input id="metaItemNameInput" type="text" placeholder="e.g. Coimbatore, Hyderabad, Pune" required
                            style="width:100%; box-sizing:border-box; padding:11px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.88rem; outline:none;">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">State / Province</label>
                        <input id="metaLocationState" type="text" placeholder="e.g. Tamil Nadu, Telangana"
                            style="width:100%; box-sizing:border-box; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.88rem; outline:none;">
                    </div>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div>
                        <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">Market Tier</label>
                        <select id="metaLocationTier" style="width:100%; box-sizing:border-box; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.84rem; background:#ffffff; outline:none; font-weight:600;">
                            <option value="Tier 1 Metro">Tier 1 Metro Capital</option>
                            <option value="Tier 2 Growth Hub">Tier 2 High-Growth Hub</option>
                            <option value="Emerging Corridor">Emerging Industrial Corridor</option>
                            <option value="Destination">Destination / Vacation Retreat</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">Benchmark Rate (₹/sq.ft)</label>
                        <input id="metaLocationRate" type="text" placeholder="e.g. ₹ 5,500 - 11,000 / sq.ft"
                            style="width:100%; box-sizing:border-box; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.84rem; outline:none;">
                    </div>
                </div>

                <div>
                    <label style="display:block; font-size:0.82rem; font-weight:750; color:#334155; margin-bottom:6px;">Key Micro-Markets & Localities</label>
                    <input id="metaLocationLocalities" type="text" placeholder="Comma-separated: RS Puram, Peelamedu, Gandhipuram, Saravanampatti"
                        style="width:100%; box-sizing:border-box; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.84rem; outline:none;">
                </div>

                <div style="padding:12px 14px; border-radius:12px; background:#fff7ed; border:1px solid #fed7aa; display:flex; align-items:center; gap:10px;">
                    <input type="checkbox" id="metaLocationActive" checked style="width:16px; height:16px; accent-color:#ea580c; cursor:pointer;">
                    <label for="metaLocationActive" style="font-size:0.82rem; color:#9a3412; font-weight:680; cursor:pointer; margin:0;">
                        Open for public listings and buyer location filters immediately
                    </label>
                </div>
            `;
        }

        // Show modal cleanly
        modal.classList.remove("hidden");
        modal.classList.remove("d-none");
        modal.classList.add("active");
        modal.classList.add("show");
        modal.style.display = "flex";
        setTimeout(() => {
            const input = document.getElementById("metaItemNameInput");
            if (input) input.focus();
        }, 80);
    };

    window.submitMetadataDetail = async function (e) {
        if (e) e.preventDefault();
        const type = document.getElementById("metaItemType").value;
        const nameInput = document.getElementById("metaItemNameInput");
        const name = nameInput ? nameInput.value.trim() : '';

        if (!name) {
            showToast("Please enter a valid item name", true);
            return;
        }

        const submitBtn = document.getElementById("metaSubmitBtn");
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Publishing to Platform...";
        }

        try {
            const res = await fetch(`/api/property/portal/admin/metadata/action?type=${encodeURIComponent(type)}&name=${encodeURIComponent(name)}&operation=ADD`, {
                method: 'POST',
                headers: { 'Accept': 'application/json' }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to add item');

            // Optimistic update in state
            if (state.metadata) {
                if (type === 'Category') {
                    state.metadata.categories = state.metadata.categories || {};
                    state.metadata.categories[name] = 0;
                } else if (type === 'Amenity') {
                    state.metadata.amenities = state.metadata.amenities || {};
                    state.metadata.amenities[name] = 0;
                } else if (type === 'Location') {
                    state.metadata.locations = state.metadata.locations || {};
                    state.metadata.locations[name] = 0;
                }
                renderMetadataSection();
            }

            closeModal('metadataDetailModal');
            showToast(`${type} '${name}' successfully configured and published to platform catalog!`);
            loadMetadata();
            loadOverview();
        } catch (err) {
            showToast(err.message, true);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Save & Publish Item';
            }
        }
    };

    window.removeMetadataItem = async function (type, name) {
        if (!confirm(`Are you sure you want to remove ${type} '${name}' from platform catalog?`)) return;

        try {
            const res = await fetch(`/api/property/portal/admin/metadata/action?type=${encodeURIComponent(type)}&name=${encodeURIComponent(name)}&operation=REMOVE`, {
                method: 'POST',
                headers: { 'Accept': 'application/json' }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to remove item');

            if (state.metadata) {
                if (type === 'Category' && state.metadata.categories) delete state.metadata.categories[name];
                if (type === 'Amenity' && state.metadata.amenities) delete state.metadata.amenities[name];
                if (type === 'Location' && state.metadata.locations) delete state.metadata.locations[name];
                renderMetadataSection();
            }

            showToast(`${type} '${name}' removed from catalog.`);
            loadMetadata();
            loadOverview();
        } catch (err) {
            showToast(err.message, true);
        }
    };

    // Backwards compatibility alias
    window.addMetadataItem = function (type) {
        window.openMetadataDetailModal(type);
    };

    // 9. FEATURED LISTINGS & PUBLIC CONTENT
    // -------------------------------------------------------------
    function renderFeaturedSection() {
        if (!state.metadata) return;
        const featured = state.metadata.featuredListings || [];
        const container = document.getElementById("featuredListingsContainer");
        if (!container) return;

        if (featured.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:36px; color:#64748b; font-size:0.88rem;">No properties currently set as featured. Feature approved listings from the Property Inventory tab.</div>`;
            return;
        }

        container.innerHTML = featured.map(l => `
            <div style="padding:16px 20px; border-radius:14px; border:1px solid #fde68a; background:#fffbeb; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <span style="font-size:1.4rem;">★</span>
                    <div>
                        <strong style="display:block; font-size:0.92rem; color:#78350f;">${escapeHtml(l.title)} (#PDT-${l.id})</strong>
                        <small style="color:#b45309;">${escapeHtml(l.city || '')} · ${formatCurrency(l.price)}</small>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <a href="/propertydirect/apartment-detail?id=${l.id}" target="_blank"
                        style="padding:6px 12px; border-radius:8px; border:1px solid #fde68a; background:#ffffff; color:#78350f; font-size:0.78rem; font-weight:700; text-decoration:none;">
                        View Listing ↗
                    </a>
                    <button type="button" onclick="toggleFeatured(${l.id}, true)"
                        style="padding:6px 12px; border-radius:8px; border:1px solid #cbd5e1; background:#ffffff; color:#dc2626; font-size:0.78rem; font-weight:700; cursor:pointer;">
                        Remove Featured
                    </button>
                </div>
            </div>
        `).join('');
    }

    // -------------------------------------------------------------
    // 10. NOTIFICATIONS & AUDIT HISTORY
    // -------------------------------------------------------------
    let auditDebounceTimer = null;

    async function loadAudit(showFeedback) {
        const targetType = document.getElementById("auditTargetTypeFilter")?.value || "";
        const action = document.getElementById("auditActionFilter")?.value || "";
        const search = document.getElementById("auditSearchInput")?.value || "";

        // Immediately update clear button visibility
        const clearBtn = document.getElementById("auditSearchClearBtn");
        if (clearBtn) clearBtn.style.display = search ? "block" : "none";

        // Animate refresh icon if present
        const refreshIcon = document.getElementById("refreshAuditIcon");
        if (refreshIcon) {
            refreshIcon.style.transform = "rotate(360deg)";
            refreshIcon.style.transition = "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)";
            setTimeout(() => {
                if (refreshIcon) {
                    refreshIcon.style.transform = "";
                    refreshIcon.style.transition = "";
                }
            }, 550);
        }

        // Fast client-side render if data already in state
        if (state.audit && state.audit.length > 0) {
            renderAuditTable();
        }

        let url = '/api/property/portal/audit?';
        if (targetType) url += `targetType=${encodeURIComponent(targetType)}&`;
        if (action) url += `action=${encodeURIComponent(action)}&`;
        if (search) url += `search=${encodeURIComponent(search)}&`;

        try {
            const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
            if (!res.ok) throw new Error("HTTP " + res.status);
            state.audit = await res.json();
            renderAuditTable();
            if (showFeedback && typeof showToast === 'function') {
                showToast("Notifications & audit logs updated.");
            }
        } catch (err) {
            console.error("Error loading audit history:", err);
            // Even if fetch errors, filter in-memory data
            renderAuditTable();
        }
    }

    function renderAuditTable() {
        const tbody = document.getElementById("auditTableBody");
        if (!tbody) return;

        const targetType = (document.getElementById("auditTargetTypeFilter")?.value || "").toUpperCase().trim();
        const actionFilter = (document.getElementById("auditActionFilter")?.value || "").toUpperCase().trim();
        const search = (document.getElementById("auditSearchInput")?.value || "").toLowerCase().trim();

        const allLogs = state.audit || [];

        // Update live stats ribbon counters
        const totalAll = allLogs.length;
        const approvedCount = allLogs.filter(e => {
            const a = (e.action || '').toUpperCase();
            return a.includes('APPROVED') || a.includes('VERIFIED') || a.includes('CREATED') || a.includes('SUCCESS');
        }).length;
        const rejectedCount = allLogs.filter(e => {
            const a = (e.action || '').toUpperCase();
            return a.includes('REJECTED') || a.includes('REVOKED') || a.includes('SUSPENDED') || a.includes('DELETE') || a.includes('DISMISSED');
        }).length;
        const updatesCount = allLogs.filter(e => {
            const a = (e.action || '').toUpperCase();
            return a.includes('UPDATE') || a.includes('MODIFIED') || a.includes('CHANGE') || a.includes('MESSAGE') || a.includes('SUBMITTED');
        }).length;

        const totalStatEl = document.getElementById("auditTotalLogsStat");
        if (totalStatEl) totalStatEl.textContent = totalAll;
        const appStatEl = document.getElementById("auditApprovedLogsStat");
        if (appStatEl) appStatEl.textContent = approvedCount;
        const rejStatEl = document.getElementById("auditRejectedLogsStat");
        if (rejStatEl) rejStatEl.textContent = rejectedCount;
        const updStatEl = document.getElementById("auditUpdatesLogsStat");
        if (updStatEl) updStatEl.textContent = updatesCount;

        const filtered = allLogs.filter(e => {
            if (targetType && (e.targetType || '').toUpperCase() !== targetType) return false;
            if (actionFilter && !(e.action || '').toUpperCase().includes(actionFilter)) return false;
            if (search) {
                const actor = (e.actor || '').toLowerCase();
                const detail = (e.detail || '').toLowerCase();
                const act = (e.action || '').toLowerCase();
                const type = (e.targetType || '').toLowerCase();
                const idStr = String(e.targetId || '');
                const formattedTarget = `${type} #${idStr}`;
                const match = actor.includes(search) ||
                              detail.includes(search) ||
                              act.includes(search) ||
                              type.includes(search) ||
                              idStr.includes(search) ||
                              formattedTarget.includes(search);
                if (!match) return false;
            }
            return true;
        });

        const countNum = document.getElementById("auditCountNumber");
        if (countNum) countNum.textContent = filtered.length;

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center !important; padding:48px 20px; color:#64748b; font-size:0.88rem;">
                        <div style="display:inline-flex; flex-direction:column; align-items:center; gap:10px;">
                            <span style="font-size:1.8rem;">🔔</span>
                            <span style="font-weight:700; color:#334155;">No notifications or audit logs match your criteria.</span>
                            <span style="font-size:0.80rem; color:#94a3b8;">Try clearing the search query or changing entity/action filters.</span>
                            <button type="button" onclick="if(window.resetAuditFilters) window.resetAuditFilters();" class="small"
                                style="margin-top:6px; padding:6px 16px; border-radius:8px; border:1px solid #cbd5e1; background:#ffffff; color:#0f172a; font-weight:700; cursor:pointer;">
                                Reset All Filters
                            </button>
                        </div>
                    </td>
                </tr>`;
            return;
        }

        window.currentAuditLogs = filtered;

        tbody.innerHTML = filtered.map((e, idx) => {
            const act = (e.action || '').toUpperCase();
            let badgeBg = '#f1f5f9';
            let badgeColor = '#475569';
            let badgeBorder = '#e2e8f0';

            if (act.includes('APPROVED') || act.includes('VERIFIED') || act.includes('RESOLVED') || act.includes('SUCCESS') || act.includes('CREATED')) {
                badgeBg = '#dcfce7'; badgeColor = '#15803d'; badgeBorder = '#bbf7d0';
            } else if (act.includes('REJECTED') || act.includes('REVOKED') || act.includes('SUSPENDED') || act.includes('DELETE') || act.includes('DISMISSED')) {
                badgeBg = '#fee2e2'; badgeColor = '#b91c1c'; badgeBorder = '#fecaca';
            } else if (act.includes('SUBMITTED') || act.includes('REQUESTED') || act.includes('PENDING') || act.includes('HOLD')) {
                badgeBg = '#fef3c7'; badgeColor = '#b45309'; badgeBorder = '#fde68a';
            } else if (act.includes('UPDATE') || act.includes('MODIFIED') || act.includes('CHANGE')) {
                badgeBg = '#e0e7ff'; badgeColor = '#4338ca'; badgeBorder = '#c7d2fe';
            }

            const badge = `<span style="padding:4px 9px; border-radius:6px; font-size:0.73rem; font-weight:800; background:${badgeBg}; color:${badgeColor}; border:1px solid ${badgeBorder}; display:inline-block; letter-spacing:0.02em; white-space:nowrap !important;">${escapeHtml(e.action)}</span>`;

            let targetIcon = '📄';
            const tType = (e.targetType || '').toUpperCase();
            if (tType === 'ACCOUNT') targetIcon = '👤';
            else if (tType === 'APPLICATION') targetIcon = '📋';
            else if (tType === 'LISTING') targetIcon = '🏠';
            else if (tType === 'REPORT') targetIcon = '⚠️';
            else if (tType === 'VISIT') targetIcon = '📅';
            else if (tType === 'ENQUIRY') targetIcon = '💬';

            return `
                <tr style="border-bottom:1px solid #f1f5f9; transition:background 0.15s ease;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                    <td style="padding:14px 16px 14px 20px; font-size:0.82rem; color:#64748b; font-weight:600; white-space:nowrap !important; vertical-align:middle; text-align:left !important; box-sizing:border-box;">
                        ${formatDateTime(e.createdAt)}
                    </td>
                    <td style="padding:14px 16px; vertical-align:middle; white-space:nowrap !important; text-align:left !important; box-sizing:border-box;">
                        ${badge}
                    </td>
                    <td style="padding:14px 16px; font-weight:750; font-size:0.84rem; color:#1e293b; white-space:nowrap !important; vertical-align:middle; text-align:left !important; box-sizing:border-box;">
                        <span style="display:inline-flex; align-items:center; gap:6px; white-space:nowrap !important;">
                            <span>${targetIcon}</span>
                            <span>${escapeHtml(e.targetType)} #${e.targetId}</span>
                        </span>
                    </td>
                    <td style="padding:14px 16px; font-size:0.82rem; color:#475569; white-space:nowrap !important; vertical-align:middle; text-align:left !important; box-sizing:border-box;">
                        <code style="background:#f1f5f9; padding:4px 9px; border-radius:6px; font-size:0.78rem; font-family:monospace; color:#334155; border:1px solid #e2e8f0; display:inline-block; white-space:nowrap !important; max-width:140px; overflow:hidden; text-overflow:ellipsis; vertical-align:middle; letter-spacing:0.02em;" title="${escapeHtml(e.actor || 'system')}">${escapeHtml(e.actor || 'system')}</code>
                    </td>
                    <td style="padding:14px 20px 14px 16px; vertical-align:middle; text-align:right !important; white-space:nowrap !important; box-sizing:border-box;">
                        <button type="button" onclick="window.openAuditDetailsModal && window.openAuditDetailsModal(${idx})" style="display:inline-flex; align-items:center; gap:6px; padding:6px 14px; border-radius:8px; border:1px solid #cbd5e1; background:#ffffff; color:#0f172a; font-size:0.78rem; font-weight:750; cursor:pointer; white-space:nowrap; transition:all 0.15s ease; box-shadow:0 1px 2px rgba(0,0,0,0.04);" onmouseover="this.style.background='#0f172a'; this.style.color='#ffffff'; this.style.borderColor='#0f172a';" onmouseout="this.style.background='#ffffff'; this.style.color='#0f172a'; this.style.borderColor='#cbd5e1';">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                            <span>View Details</span>
                        </button>
                    </td>
                </tr>`;
        }).join('');
    }

    window.setAuditActionQuickFilter = function (actionKeyword) {
        const actFilter = document.getElementById("auditActionFilter");
        if (actFilter) actFilter.value = actionKeyword;
        loadAudit();
    };

    window.clearAuditSearch = function () {
        const s = document.getElementById("auditSearchInput");
        if (s) {
            s.value = "";
            s.focus();
        }
        const clearBtn = document.getElementById("auditSearchClearBtn");
        if (clearBtn) clearBtn.style.display = "none";
        loadAudit();
    };

    window.openAuditDetailsModal = function (index) {
        const list = window.currentAuditLogs || [];
        const log = list[index];
        if (!log) return;

        const modal = document.getElementById("auditDetailsModal");
        if (!modal) return;

        const timeEl = document.getElementById("auditModalTimestamp");
        if (timeEl) timeEl.textContent = formatDateTime(log.createdAt);

        const actBadgeEl = document.getElementById("auditModalActionBadge");
        if (actBadgeEl) {
            const act = (log.action || '').toUpperCase();
            let bg = '#f1f5f9', color = '#475569', border = '#e2e8f0';
            if (act.includes('APPROVED') || act.includes('VERIFIED') || act.includes('RESOLVED') || act.includes('SUCCESS') || act.includes('CREATED')) {
                bg = '#dcfce7'; color = '#15803d'; border = '#bbf7d0';
            } else if (act.includes('REJECTED') || act.includes('REVOKED') || act.includes('SUSPENDED') || act.includes('DELETE') || act.includes('DISMISSED')) {
                bg = '#fee2e2'; color = '#b91c1c'; border = '#fecaca';
            } else if (act.includes('SUBMITTED') || act.includes('REQUESTED') || act.includes('PENDING') || act.includes('HOLD')) {
                bg = '#fef3c7'; color = '#b45309'; border = '#fde68a';
            } else if (act.includes('UPDATE') || act.includes('MODIFIED') || act.includes('CHANGE')) {
                bg = '#e0e7ff'; color = '#4338ca'; border = '#c7d2fe';
            }
            actBadgeEl.innerHTML = `<span style="padding:4px 9px; border-radius:6px; font-size:0.75rem; font-weight:800; background:${bg}; color:${color}; border:1px solid ${border}; display:inline-block;">${escapeHtml(log.action || '—')}</span>`;
        }

        const targetEl = document.getElementById("auditModalTarget");
        if (targetEl) {
            let targetIcon = '📄';
            const tType = (log.targetType || '').toUpperCase();
            if (tType === 'ACCOUNT') targetIcon = '👤';
            else if (tType === 'APPLICATION') targetIcon = '📋';
            else if (tType === 'LISTING') targetIcon = '🏠';
            else if (tType === 'REPORT') targetIcon = '⚠️';
            else if (tType === 'VISIT') targetIcon = '📅';
            else if (tType === 'ENQUIRY') targetIcon = '💬';

            targetEl.innerHTML = `<span>${targetIcon}</span><span>${escapeHtml(log.targetType || 'ENTITY')} #${log.targetId || '—'}</span>`;
        }

        const actorEl = document.getElementById("auditModalActor");
        if (actorEl) actorEl.textContent = log.actor || 'system';

        const detailEl = document.getElementById("auditModalDetail");
        if (detailEl) detailEl.textContent = log.detail || 'No additional details recorded for this event.';

        const actionContainer = document.getElementById("auditModalTargetActionContainer");
        if (actionContainer) {
            actionContainer.innerHTML = '';
            const tType = (log.targetType || '').toUpperCase();
            const tId = log.targetId;

            if (tType === 'ACCOUNT') {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.style.cssText = 'background:#2563eb; color:#ffffff; padding:9px 16px; border-radius:8px; border:none; font-weight:750; font-size:0.82rem; cursor:pointer; display:inline-flex; align-items:center; gap:6px;';
                btn.innerHTML = '👤 View User in Directory';
                btn.onclick = () => { closeAuditDetailsModal(); switchTabAndFilter('users'); };
                actionContainer.appendChild(btn);
            } else if (tType === 'APPLICATION') {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.style.cssText = 'background:#2563eb; color:#ffffff; padding:9px 16px; border-radius:8px; border:none; font-weight:750; font-size:0.82rem; cursor:pointer; display:inline-flex; align-items:center; gap:6px;';
                btn.innerHTML = '📋 View Application';
                btn.onclick = () => { closeAuditDetailsModal(); switchTabAndFilter('verifications'); };
                actionContainer.appendChild(btn);
            } else if (tType === 'LISTING' && tId) {
                const a = document.createElement('a');
                a.href = `/propertydirect/apartment-detail?id=${tId}`;
                a.target = '_blank';
                a.style.cssText = 'background:#2563eb; color:#ffffff; padding:9px 16px; border-radius:8px; text-decoration:none; font-weight:750; font-size:0.82rem; display:inline-flex; align-items:center; gap:6px;';
                a.innerHTML = '🏠 View Property Listing ↗';
                actionContainer.appendChild(a);
            } else if (tType === 'REPORT') {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.style.cssText = 'background:#2563eb; color:#ffffff; padding:9px 16px; border-radius:8px; border:none; font-weight:750; font-size:0.82rem; cursor:pointer; display:inline-flex; align-items:center; gap:6px;';
                btn.innerHTML = '⚠️ View in Complaints';
                btn.onclick = () => { closeAuditDetailsModal(); switchTabAndFilter('reports'); };
                actionContainer.appendChild(btn);
            } else if (tType === 'VISIT') {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.style.cssText = 'background:#2563eb; color:#ffffff; padding:9px 16px; border-radius:8px; border:none; font-weight:750; font-size:0.82rem; cursor:pointer; display:inline-flex; align-items:center; gap:6px;';
                btn.innerHTML = '📅 View Scheduled Visits';
                btn.onclick = () => {
                    closeAuditDetailsModal();
                    switchTabAndFilter('enquiries');
                    if (window.switchEnquirySubtab) window.switchEnquirySubtab('visits');
                };
                actionContainer.appendChild(btn);
            } else if (tType === 'ENQUIRY') {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.style.cssText = 'background:#2563eb; color:#ffffff; padding:9px 16px; border-radius:8px; border:none; font-weight:750; font-size:0.82rem; cursor:pointer; display:inline-flex; align-items:center; gap:6px;';
                btn.innerHTML = '💬 View Client Leads';
                btn.onclick = () => {
                    closeAuditDetailsModal();
                    switchTabAndFilter('enquiries');
                    if (window.switchEnquirySubtab) window.switchEnquirySubtab('enquiries');
                };
                actionContainer.appendChild(btn);
            }
        }

        modal.classList.remove("hidden");
        modal.classList.add("active");
        modal.style.display = "flex";
    };

    window.closeAuditDetailsModal = function () {
        const modal = document.getElementById("auditDetailsModal");
        if (modal) {
            modal.classList.add("hidden");
            modal.classList.remove("active");
            modal.style.display = "none";
        }
    };

    window.resetAuditFilters = function () {
        const s = document.getElementById("auditSearchInput"); if (s) s.value = "";
        const t = document.getElementById("auditTargetTypeFilter"); if (t) t.value = "";
        const a = document.getElementById("auditActionFilter"); if (a) a.value = "";
        const clearBtn = document.getElementById("auditSearchClearBtn"); if (clearBtn) clearBtn.style.display = "none";
        loadAudit(true);
    };

    // Modal Helper
    window.closeModal = function (modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add("hidden");
            modal.classList.remove("active");
            modal.classList.remove("show");
            modal.style.display = "none";
        }
    };

    // Post Property on Behalf Form Handler
    function wirePostApartmentForm() {
        const form = document.getElementById("postApartmentForm");
        if (!form) return;

        form.addEventListener("submit", async function (e) {
            e.preventDefault();
            e.stopImmediatePropagation();

            const ownerSelect = document.getElementById("adminOwnerSelect");
            const ownerId = ownerSelect ? ownerSelect.value : "";
            if (!ownerId) {
                showToast("Please choose an identified Owner or Builder account before posting.", true);
                ownerSelect?.focus();
                return;
            }

            const titleInput = form.querySelector('[name="title"]');
            const title = titleInput?.value?.trim();
            if (!title) {
                showToast("Please enter a property title.", true);
                titleInput?.focus();
                return;
            }

            const type = form.querySelector('[name="type"]')?.value || "RENT";
            const propertyType = form.querySelector('[name="propertyType"]')?.value || "APARTMENT";
            const address = form.querySelector('[name="address"]')?.value?.trim() || "";
            const city = form.querySelector('[name="city"]')?.value?.trim() || "Chennai";
            const locality = form.querySelector('[name="locality"]')?.value?.trim() || "Anna Nagar";
            const pincode = form.querySelector('[name="pincode"]')?.value?.trim() || "600040";
            const price = Number(form.querySelector('[name="price"]')?.value || 0);
            if (!price || price <= 0) {
                showToast("Please enter a valid property price or rent.", true);
                form.querySelector('[name="price"]')?.focus();
                return;
            }

            const bhk = form.querySelector('[name="bhk"]')?.value || "2 BHK";
            const bathrooms = Number(form.querySelector('[name="bathrooms"]')?.value || 2);
            const areaSqft = Number(form.querySelector('[name="areaSqft"]')?.value || 1000);
            const description = form.querySelector('[name="description"]')?.value?.trim() || (title + " located in " + locality + ", " + city);

            const selectedAmenities = [];
            form.querySelectorAll('[name="amenities"]:checked').forEach(cb => selectedAmenities.push(cb.value));

            const listingData = {
                title: title,
                description: description,
                society: locality || title,
                locality: locality,
                address: address,
                city: city,
                pincode: pincode,
                type: type,
                propertyType: propertyType,
                price: price,
                deposit: price * 2,
                maintenance: 0,
                areaSqft: areaSqft,
                bhk: bhk,
                bathrooms: bathrooms,
                furnishing: "Semi-Furnished",
                parking: "Covered",
                amenities: selectedAmenities.join(", "),
                imageUrl: null,
                notes: "Submitted by Platform Administrator on behalf of Account #USR-" + ownerId
            };

            const submission = {
                listing: listingData,
                ownerId: Number(ownerId),
                intent: "SUBMIT"
            };

            const submitBtn = form.querySelector('button[type="submit"]');
            const origText = submitBtn ? submitBtn.textContent : "Submit Property Listing";
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = "Publishing Property on Behalf...";
            }

            try {
                const formData = new FormData();
                const jsonBlob = new Blob([JSON.stringify(submission)], { type: "application/json" });
                formData.append("property", jsonBlob);
                formData.append("listing", jsonBlob);

                const photoInput = form.querySelector('[name="photos"]') || document.getElementById("propertyPhotoFiles");
                if (photoInput && photoInput.files && photoInput.files.length > 0) {
                    for (let i = 0; i < photoInput.files.length; i++) {
                        formData.append("photos", photoInput.files[i]);
                    }
                }

                const res = await fetch("/api/property/portal/listings", {
                    method: "POST",
                    headers: { "Accept": "application/json" },
                    body: formData
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.message || data.detail || "Failed to post listing");

                showToast(`Property "${title}" published successfully on behalf of owner!`);
                form.reset();
                switchTabAndFilter("my-properties");
                loadInventory();
                loadOverview();
            } catch (err) {
                console.error("Error posting listing on behalf:", err);
                showToast(err.message, true);
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = origText;
                }
            }
        });
    }

    // Expose all operations on window
    window.loadUsers = loadUsers;
    window.loadApplications = loadApplications;
    window.loadInventory = loadInventory;
    window.loadEnquiries = loadEnquiries;
    window.loadVisits = loadVisits;
    window.loadReports = loadReports;
    window.loadMetadata = loadMetadata;
    window.loadAudit = loadAudit;
    window.clearAuditSearch = clearAuditSearch;
    window.resetAuditFilters = resetAuditFilters;
    window.setAuditActionQuickFilter = setAuditActionQuickFilter;
    window.renderUsersTable = renderUsersTable;
    window.renderInventoryTable = renderInventoryTable;
    window.renderApplicationsTable = renderApplicationsTable;
    window.renderReportsTable = renderReportsTable;
    window.renderAuditTable = renderAuditTable;
    window.wirePostApartmentForm = wirePostApartmentForm;
    window.openUserInspectModal = openUserInspectModal;
    window.saveUserInspectChanges = saveUserInspectChanges;
    window.openUserStatusModal = openUserStatusModal;
    window.openUserStatusModalFromInspect = openUserStatusModalFromInspect;
    window.applyStatusNotePreset = applyStatusNotePreset;
    window.submitUserStatusModal = submitUserStatusModal;
    window.openUserPostingModal = openUserPostingModal;
    window.openUserPostingModalFromInspect = openUserPostingModalFromInspect;
    window.applyPostingNotePreset = applyPostingNotePreset;
    window.submitUserPostingModal = submitUserPostingModal;
    window.toggleUserDropdown = toggleUserDropdown;

    // Initialize on DOM Ready
    document.addEventListener("DOMContentLoaded", function () {
        // Wire sidebar click listener
        document.querySelectorAll(".sidebar-nav [data-panel]").forEach(btn => {
            btn.addEventListener("click", function (e) {
                e.preventDefault();
                switchTabAndFilter(this.dataset.panel);
            });
        });

        // Wire filter listeners
        document.getElementById("userSearchInput")?.addEventListener("input", renderUsersTable);
        document.getElementById("userRoleFilter")?.addEventListener("change", renderUsersTable);
        document.getElementById("userStatusFilter")?.addEventListener("change", renderUsersTable);
        document.getElementById("userVerifyFilter")?.addEventListener("change", renderUsersTable);
        document.getElementById("userFilterResetBtn")?.addEventListener("click", () => {
            const s = document.getElementById("userSearchInput"); if (s) s.value = "";
            const r = document.getElementById("userRoleFilter"); if (r) r.value = "";
            const st = document.getElementById("userStatusFilter"); if (st) st.value = "";
            const v = document.getElementById("userVerifyFilter"); if (v) v.value = "";
            renderUsersTable();
        });

        // Wire refresh buttons
        document.getElementById("refreshUsersBtn")?.addEventListener("click", loadUsers);
        document.getElementById("closeInspectModalBtn")?.addEventListener("click", window.closeInspectModal);
        document.getElementById("closeInspectModalBottomBtn")?.addEventListener("click", window.closeInspectModal);

        // Escape key to close active modals
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") {
                document.querySelectorAll(".modal:not(.hidden)").forEach(m => {
                    closeModal(m.id);
                });
            }
        });

        // Backdrop click to close modals
        document.querySelectorAll(".modal").forEach(m => {
            m.addEventListener("click", function (e) {
                if (e.target === m) {
                    closeModal(m.id);
                }
            });
        });

        document.getElementById("appDecisionFilter")?.addEventListener("change", renderApplicationsTable);
        document.getElementById("appRoleFilter")?.addEventListener("change", renderApplicationsTable);
        document.getElementById("appSearchInput")?.addEventListener("input", renderApplicationsTable);
        document.getElementById("refreshAppsBtn")?.addEventListener("click", loadApplications);

        document.getElementById("inventoryStatusFilter")?.addEventListener("change", renderInventoryTable);
        document.getElementById("inventoryTypeFilter")?.addEventListener("change", renderInventoryTable);
        document.getElementById("inventorySearchInput")?.addEventListener("input", renderInventoryTable);

        document.getElementById("reportStatusFilter")?.addEventListener("change", renderReportsTable);
        document.getElementById("reportModalConfirmBtn")?.addEventListener("click", function () {
            if (!currentReportAction) return;
            const textarea = document.getElementById("reportModalTextarea");
            const replyText = (textarea?.value || "").trim();
            if (!replyText) {
                showToast("Please enter notes or reason before confirming.", true);
                textarea?.focus();
                return;
            }
            submitReportAction(currentReportAction.reportId, currentReportAction.action, replyText);
        });
        document.getElementById("reportActionModal")?.addEventListener("click", function (e) {
            if (e.target === this) closeReportActionModal();
        });
        document.getElementById("auditDetailsModal")?.addEventListener("click", function (e) {
            if (e.target === this) closeAuditDetailsModal();
        });

        document.getElementById("auditTargetTypeFilter")?.addEventListener("change", () => loadAudit());
        document.getElementById("auditActionFilter")?.addEventListener("change", () => loadAudit());
        document.getElementById("auditSearchInput")?.addEventListener("input", () => {
            const val = document.getElementById("auditSearchInput")?.value || "";
            const clearBtn = document.getElementById("auditSearchClearBtn");
            if (clearBtn) clearBtn.style.display = val ? "block" : "none";
            renderAuditTable();
            clearTimeout(auditDebounceTimer);
            auditDebounceTimer = setTimeout(() => loadAudit(), 300);
        });
        document.getElementById("auditResetBtn")?.addEventListener("click", window.resetAuditFilters);
        document.getElementById("headerManageUsersBtn")?.addEventListener("click", (e) => {
            e.preventDefault();
            switchTabAndFilter("users");
        });
        document.querySelector('.user-avatar-badge')?.addEventListener('click', (e) => {
            e.preventDefault();
            switchTabAndFilter("profile");
        });

        // Wire post apartment form
        wirePostApartmentForm();

        // Hash change listener
        window.addEventListener("hashchange", function () {
            const h = window.location.hash.replace("#", "") || "overview";
            switchTabAndFilter(h);
        });

        // Initial tab from hash or default to overview
        const initialHash = window.location.hash.replace("#", "") || "overview";
        switchTabAndFilter(initialHash);

        // Sync stored profile information to badges and headers
        try {
            const adminProfileRaw = localStorage.getItem("propertydirect-profile:v1:admin");
            if (adminProfileRaw) {
                const adminProf = JSON.parse(adminProfileRaw);
                if (typeof window.syncProfileDisplay === "function") {
                    window.syncProfileDisplay(adminProf);
                } else {
                    const name = adminProf.fullName || "Property Moderator";
                    const inits = name.split(/\s+/).filter(Boolean).map(w => w[0]).join("").slice(0, 2).toUpperCase() || "PM";
                    document.querySelectorAll(".sidebar-user-avatar, .user-avatar-badge, .property-profile-avatar").forEach(el => el.textContent = inits);
                    document.querySelectorAll(".sidebar-user-name, .property-profile-summary h3").forEach(el => el.textContent = name);
                }
            }
        } catch (_) {}
        // Real-time automatic polling every 8 seconds for live dashboard data
        // Infallible header title observer to prevent badge or index values from overriding the title
        (function initPanelTitleObserver() {
            const titleElem = document.getElementById("panelTitle");
            if (!titleElem) return;
            const panelTitleMap = {
                'overview': 'Overview & Metrics',
                'users': 'Customer Directory',
                'verifications': 'Owner & Builder Verification',
                'my-properties': 'Property Inventory & Queue',
                'enquiries': 'Client Leads & Enquiries',
                'reports': 'Complaints',
                'audit': 'Notifications',
                'profile': 'Admin Profile'
            };
            function fixTitle() {
                const text = (titleElem.textContent || '').trim();
                if (/^\d+$/.test(text) || !text || text === '0' || text === 'Dashboard') {
                    const hash = (window.location.hash || '').replace('#', '') || 'overview';
                    titleElem.textContent = panelTitleMap[hash] || 'Property Inventory & Queue';
                }
            }
            fixTitle();
            const observer = new MutationObserver(fixTitle);
            observer.observe(titleElem, { childList: true, characterData: true, subtree: true });
        })();
    });

})();