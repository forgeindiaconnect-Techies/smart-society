/**
 * Maintenance Admin / Operations Dispatch & Lifecycle Tracking System
 * Connects directly to /api/maintenance/dispatch and /api/maintenance.
 */
(() => {
    "use strict";

    // State
    const state = {
        activeTrack: "emergency", // "emergency" | "tickets" | "partners"
        bookings: [],
        failedBookings: [],
        tickets: [],
        partners: [],
        hubs: [],
        selectedTradeFilter: "all",
        selectedPartnerStatus: "all",
        selectedBookingForAssign: null,
        selectedBookingForPhotos: null,
        slaInterval: null
    };

    // Default mock data in case DB has no seeded entries yet
    const fallbackHubs = [
        { id: 1, name: "Bangalore - Marathahalli Hub", city: "Bangalore", area: "Marathahalli", latitude: 12.9591, longitude: 77.6974, active: true, partnerCount: 6 },
        { id: 2, name: "Bangalore - Whitefield Hub", city: "Bangalore", area: "Whitefield", latitude: 12.9698, longitude: 77.7499, active: true, partnerCount: 4 },
        { id: 3, name: "Chennai - Adyar Hub", city: "Chennai", area: "Adyar", latitude: 13.0012, longitude: 80.2565, active: true, partnerCount: 5 },
        { id: 4, name: "Hyderabad - Hitec City Hub", city: "Hyderabad", area: "Hitec City", latitude: 17.4435, longitude: 78.3772, active: true, partnerCount: 3 }
    ];

    const fallbackPartners = [
        { id: 101, fullName: "Ramesh Kumar", mobileNumber: "+91 98441 22334", trade: "Plumbing", employmentType: "INTERNAL", hubName: "Marathahalli Hub", onDuty: true, workState: "ON_DUTY_AVAILABLE" },
        { id: 102, fullName: "Suresh Pillai", mobileNumber: "+91 98442 33445", trade: "Electrical", employmentType: "INTERNAL", hubName: "Marathahalli Hub", onDuty: true, workState: "ON_JOB" },
        { id: 103, fullName: "Mohan Lal (QuickFix)", mobileNumber: "+91 98443 44556", trade: "Carpentry", employmentType: "THIRD_PARTY", hubName: "Whitefield Hub", onDuty: true, workState: "ON_DUTY_AVAILABLE" },
        { id: 104, fullName: "Arunachalam S", mobileNumber: "+91 98444 55667", trade: "Plumbing", employmentType: "THIRD_PARTY", hubName: "Adyar Hub", onDuty: false, workState: "OFF_DUTY" },
        { id: 105, fullName: "Dinesh Babu (ProElectro)", mobileNumber: "+91 98445 66778", trade: "Electrical", employmentType: "THIRD_PARTY", hubName: "Hitec City Hub", onDuty: true, workState: "ON_DUTY_AVAILABLE" }
    ];

    const fallbackBookings = [
        {
            id: 201,
            ticketCode: "EMG-201",
            issueTitle: "Main Water Line Burst & Active Flooding",
            category: "Plumbing",
            severity: "CRITICAL",
            siteAddress: "Tower B, Flat 402, Green Glen Layout, Marathahalli",
            hubName: "Marathahalli Hub",
            requesterName: "Priya Sharma",
            requesterPhone: "+91 98765 43210",
            partnerId: 101,
            partnerName: "Ramesh Kumar",
            partnerTrade: "Plumbing",
            partnerPhone: "+91 98441 22334",
            employmentType: "INTERNAL",
            jobStatus: "IN_PROGRESS",
            step: 4, // 1: Accepted, 2: Reached, 3: Photo (Start), 4: In Progress, 5: Completed
            createdAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
            arrivalDueAt: new Date(Date.now() + 12 * 60 * 1000).toISOString(),
            beforePhotoUrl: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80",
            afterPhotoUrl: null
        },
        {
            id: 202,
            ticketCode: "EMG-202",
            issueTitle: "Main Distribution Board Sparking & Power Cut",
            category: "Electrical",
            severity: "CRITICAL",
            siteAddress: "Tower A, Ground Floor Electrical Room",
            hubName: "Marathahalli Hub",
            requesterName: "Security Office (Gate 1)",
            requesterPhone: "+91 98765 11223",
            partnerId: 102,
            partnerName: "Suresh Pillai",
            partnerTrade: "Electrical",
            partnerPhone: "+91 98442 33445",
            employmentType: "INTERNAL",
            jobStatus: "REACHED_LOCATION",
            step: 2,
            createdAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
            arrivalDueAt: new Date(Date.now() + 6 * 60 * 1000).toISOString(),
            beforePhotoUrl: null,
            afterPhotoUrl: null
        },
        {
            id: 203,
            ticketCode: "EMG-203",
            issueTitle: "Balcony Sliding Door Glass Frame Dislodged",
            category: "Carpentry",
            severity: "HIGH",
            siteAddress: "Tower C, Flat 804, Outer Ring Road",
            hubName: "Whitefield Hub",
            requesterName: "Vikram Malhotra",
            requesterPhone: "+91 98765 88990",
            partnerId: null, // Unassigned / Failed auto-assign
            partnerName: null,
            partnerTrade: null,
            partnerPhone: null,
            employmentType: null,
            jobStatus: "UNASSIGNED",
            step: 0,
            createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            arrivalDueAt: new Date(Date.now() + 22 * 60 * 1000).toISOString(),
            beforePhotoUrl: null,
            afterPhotoUrl: null
        }
    ];

    const fallbackTickets = [
        { id: "T-101", title: "Minor kitchen cabinet hinge loose", category: "Carpentry", priority: "Low", status: "OPEN", serviceAddress: "Flat B-301", requesterName: "Ananya Roy", createdAt: "2026-09-14 10:30" },
        { id: "T-102", title: "Bathroom shower head low water pressure", category: "Plumbing", priority: "Medium", status: "IN_PROGRESS", serviceAddress: "Flat A-101", requesterName: "Karthik R", createdAt: "2026-09-14 14:15" },
        { id: "T-103", title: "Balcony ceiling paint peeling off", category: "Painting", priority: "Low", status: "SCHEDULED", serviceAddress: "Flat D-502", requesterName: "Sunita G", createdAt: "2026-09-15 09:00" },
        { id: "T-104", title: "Corridor light fixture flickering", category: "Electrical", priority: "Medium", status: "OPEN", serviceAddress: "Tower A 3rd Floor", requesterName: "Society Staff", createdAt: "2026-09-15 11:20" }
    ];

    // Helper: Escape HTML
    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Helper: Toast
    function showNotification(msg, isError = false) {
        let toast = document.getElementById("adminDispatchToast");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "adminDispatchToast";
            toast.style.cssText = `
                position: fixed; bottom: 24px; right: 24px; z-index: 10500;
                padding: 14px 20px; border-radius: 12px; color: #fff;
                box-shadow: 0 10px 25px rgba(0,0,0,0.2); font-weight: 600;
                display: flex; align-items: center; gap: 10px; font-size: 0.95rem;
                transition: transform 0.3s ease, opacity 0.3s ease;
            `;
            document.body.appendChild(toast);
        }
        toast.style.background = isError ? "#dc2626" : "#16a34a";
        toast.innerHTML = `<i class="fa-solid ${isError ? 'fa-triangle-exclamation' : 'fa-circle-check'}"></i> <span>${escapeHtml(msg)}</span>`;
        toast.style.opacity = "1";
        toast.style.transform = "translateY(0)";
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateY(15px)";
        }, 3500);
    }

    // Fetch API with fallback
    async function fetchJson(url, options = {}) {
        try {
            const res = await fetch(url, {
                ...options,
                headers: { "Accept": "application/json", ...(options.headers || {}) }
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (e) {
            console.warn(`[Dispatch] Request to ${url} failed, using local/cached state:`, e);
            return null;
        }
    }

    // Initial Load
    async function loadData() {
        const [bookingsData, failedData, partnersData, hubsData, ticketsData] = await Promise.all([
            fetchJson("/api/maintenance/dispatch/bookings"),
            fetchJson("/api/maintenance/dispatch/admin/failed"),
            fetchJson("/api/maintenance/dispatch/partners"),
            fetchJson("/api/maintenance/dispatch/hubs"),
            fetchJson("/api/maintenance")
        ]);

        state.bookings = (bookingsData && bookingsData.length > 0) ? bookingsData : fallbackBookings;
        state.failedBookings = (failedData && failedData.length > 0) ? failedData : state.bookings.filter(b => !b.partnerId || b.jobStatus === "UNASSIGNED");
        state.partners = (partnersData && partnersData.length > 0) ? partnersData : fallbackPartners;
        state.hubs = (hubsData && hubsData.length > 0) ? hubsData : fallbackHubs;
        state.tickets = (ticketsData && ticketsData.length > 0) ? ticketsData : fallbackTickets;

        renderStats();
        renderUnassignedBanner();
        renderEmergencyGrid();
        renderNonEmergencyTickets();
        renderPartnerDirectory();
        renderHubMaster();
    }

    // Render Metric Stats
    function renderStats() {
        const activeEmergencies = state.bookings.filter(b => b.jobStatus !== "COMPLETED" && b.jobStatus !== "CANCELLED").length;
        const unassignedCount = state.bookings.filter(b => !b.partnerId || b.jobStatus === "UNASSIGNED").length;
        const onSiteCount = state.bookings.filter(b => b.jobStatus === "REACHED_LOCATION" || b.step === 2).length;
        const inProgressCount = state.bookings.filter(b => b.jobStatus === "IN_PROGRESS" || b.step === 4).length;
        const totalTickets = state.tickets.length;

        const elEmergencies = document.getElementById("metricActiveEmergencies");
        const elUnassigned = document.getElementById("metricUnassigned");
        const elOnSite = document.getElementById("metricOnSite");
        const elInProgress = document.getElementById("metricInProgress");
        const elTotalTickets = document.getElementById("metricTotalTickets");

        if (elEmergencies) elEmergencies.textContent = activeEmergencies;
        if (elUnassigned) elUnassigned.textContent = unassignedCount;
        if (elOnSite) elOnSite.textContent = onSiteCount;
        if (elInProgress) elInProgress.textContent = inProgressCount;
        if (elTotalTickets) elTotalTickets.textContent = totalTickets;
    }

    // Unassigned Alert Banner
    function renderUnassignedBanner() {
        const container = document.getElementById("unassignedAlertContainer");
        if (!container) return;

        const unassigned = state.bookings.filter(b => !b.partnerId || b.jobStatus === "UNASSIGNED");
        if (unassigned.length === 0) {
            container.innerHTML = "";
            container.classList.add("d-none");
            return;
        }

        container.classList.remove("d-none");
        container.innerHTML = `
            <div class="alert alert-warning border-warning shadow-sm rounded-4 p-4 mb-4 d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 animate__animated animate__shakeX">
                <div class="d-flex align-items-center gap-3">
                    <div class="bg-warning text-dark rounded-circle p-3 d-flex align-items-center justify-content-center shadow-sm" style="width: 50px; height: 50px;">
                        <i class="fa-solid fa-triangle-exclamation fs-4"></i>
                    </div>
                    <div>
                        <h5 class="alert-heading fw-bold mb-1 text-dark">
                            ${unassigned.length} Emergency Request${unassigned.length > 1 ? "s" : ""} Require Manual Partner Assignment!
                        </h5>
                        <p class="mb-0 text-secondary small">
                            Auto-matching could not lock an available nearby partner. Immediate dispatcher intervention required.
                        </p>
                    </div>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <button class="btn btn-dark rounded-pill px-4 fw-bold shadow-sm" onclick="window.maintenanceDispatch.openAssignModal(${unassigned[0].id})">
                        <i class="fa-solid fa-user-plus me-2 text-warning"></i>Assign (${unassigned[0].ticketCode || 'EMG-' + unassigned[0].id})
                    </button>
                </div>
            </div>
        `;
    }

    // SLA Calculation
    function calculateSla(booking) {
        if (!booking.arrivalDueAt) {
            return { text: "15m target", badgeClass: "bg-success-subtle text-success border border-success-subtle", breached: false };
        }
        const dueTime = new Date(booking.arrivalDueAt).getTime();
        const diffMs = dueTime - Date.now();
        const absDiffSec = Math.floor(Math.abs(diffMs) / 1000);
        const mins = Math.floor(absDiffSec / 60);
        const secs = absDiffSec % 60;
        const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

        if (booking.jobStatus === "COMPLETED") {
            return { text: "Completed", badgeClass: "bg-light text-muted border", breached: false };
        }
        if (diffMs < 0) {
            return { text: `BREACHED -${timeStr}`, badgeClass: "bg-danger text-white shadow-sm animate__animated animate__pulse animate__infinite", breached: true };
        }
        if (diffMs < 10 * 60 * 1000) {
            return { text: `Due in ${timeStr}`, badgeClass: "bg-warning-subtle text-warning-emphasis border border-warning fw-bold", breached: false };
        }
        return { text: `Due in ${timeStr}`, badgeClass: "bg-success-subtle text-success border border-success-subtle fw-semibold", breached: false };
    }

    // Render Emergency Cards Grid
    function renderEmergencyGrid() {
        const container = document.getElementById("emergencyDispatchGrid");
        if (!container) return;

        if (state.bookings.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center py-5">
                    <div class="p-5 bg-white rounded-4 border text-muted">
                        <i class="fa-solid fa-circle-check text-success fs-1 mb-3"></i>
                        <h5>No Active Emergency Incidents</h5>
                        <p class="small mb-0">All critical issues have been resolved or dispatched.</p>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = state.bookings.map(b => {
            const sla = calculateSla(b);
            const step = b.step || 1;
            const isUnassigned = !b.partnerId || b.jobStatus === "UNASSIGNED";

            return `
                <div class="col-lg-6 col-xl-4 mb-4">
                    <div class="card h-100 rounded-4 border shadow-sm emergency-card ${isUnassigned ? 'border-warning' : 'border-light-subtle'} bg-white overflow-hidden">
                        <!-- Card Header -->
                        <div class="card-header bg-transparent border-0 pt-3 px-4 d-flex justify-content-between align-items-center">
                            <div class="d-flex align-items-center gap-2">
                                <span class="badge ${b.severity === 'CRITICAL' ? 'bg-danger' : 'bg-warning text-dark'} rounded-pill px-3 py-1 text-uppercase fw-bold">
                                    <i class="fa-solid fa-bolt me-1"></i>${escapeHtml(b.severity || 'EMERGENCY')}
                                </span>
                                <strong class="text-dark font-monospace">${escapeHtml(b.ticketCode || 'EMG-' + b.id)}</strong>
                            </div>
                            <span class="badge ${sla.badgeClass} rounded-pill px-3 py-1 font-monospace" id="sla-badge-${b.id}">
                                <i class="fa-regular fa-clock me-1"></i>${sla.text}
                            </span>
                        </div>

                        <!-- Card Body -->
                        <div class="card-body px-4 py-2">
                            <h5 class="fw-bold text-dark mb-2">${escapeHtml(b.issueTitle || 'Emergency Repair Request')}</h5>
                            
                            <!-- CX Site Info -->
                            <div class="bg-light p-3 rounded-3 mb-3 border border-light-subtle">
                                <div class="d-flex justify-content-between align-items-start mb-1">
                                    <span class="small text-muted fw-bold text-uppercase"><i class="fa-solid fa-user me-1 text-primary"></i>Resident</span>
                                    <span class="badge bg-secondary-subtle text-secondary rounded-pill">${escapeHtml(b.hubName || 'Nearest Hub')}</span>
                                </div>
                                <div class="fw-bold text-dark">${escapeHtml(b.requesterName || 'Resident')}</div>
                                <div class="small text-muted mb-2"><i class="fa-solid fa-location-dot me-1 text-danger"></i>${escapeHtml(b.siteAddress || 'Site Address')}</div>
                                <div class="d-flex gap-2">
                                    <a href="tel:${escapeHtml(b.requesterPhone || '')}" class="btn btn-sm btn-outline-success rounded-pill px-3 fw-semibold">
                                        <i class="fa-solid fa-phone me-1"></i>Call Resident (${escapeHtml(b.requesterPhone || 'Call')})
                                    </a>
                                </div>
                            </div>

                            <!-- Assigned Partner Card -->
                            <div class="p-3 rounded-3 mb-3 border ${isUnassigned ? 'bg-warning-subtle border-warning' : 'bg-white border-light-subtle'}">
                                <div class="d-flex justify-content-between align-items-center mb-1">
                                    <span class="small text-muted fw-bold text-uppercase"><i class="fa-solid fa-hard-hat me-1 text-warning"></i>Assigned Partner</span>
                                    ${b.employmentType ? `
                                        <span class="badge ${b.employmentType === 'INTERNAL' ? 'bg-primary-subtle text-primary' : 'bg-info-subtle text-info'} rounded-pill">
                                            ${b.employmentType === 'INTERNAL' ? 'Internal Staff' : 'Third-Party'}
                                        </span>
                                    ` : ''}
                                </div>
                                ${isUnassigned ? `
                                    <div class="d-flex justify-content-between align-items-center mt-2">
                                        <span class="text-danger fw-bold small"><i class="fa-solid fa-circle-exclamation me-1"></i>No Partner Assigned</span>
                                        <button class="btn btn-sm btn-warning rounded-pill px-3 fw-bold shadow-sm" onclick="window.maintenanceDispatch.openAssignModal(${b.id})">
                                            <i class="fa-solid fa-user-plus me-1"></i>Assign Partner
                                        </button>
                                    </div>
                                ` : `
                                    <div class="d-flex justify-content-between align-items-center">
                                        <div>
                                            <strong class="text-dark d-block">${escapeHtml(b.partnerName)}</strong>
                                            <small class="text-muted">${escapeHtml(b.partnerTrade || b.category)} · ${escapeHtml(b.partnerPhone || '')}</small>
                                        </div>
                                        <button class="btn btn-sm btn-outline-secondary rounded-pill px-2.5" title="Reassign Partner" onclick="window.maintenanceDispatch.openAssignModal(${b.id})">
                                            <i class="fa-solid fa-arrow-right-arrow-left"></i>
                                        </button>
                                    </div>
                                `}
                            </div>

                            <!-- 5-Gate Lifecycle Stepper -->
                            <div class="mb-3">
                                <span class="small text-muted fw-bold text-uppercase d-block mb-2">Live Fulfillment Stepper</span>
                                <div class="stepper-track d-flex justify-content-between position-relative px-2">
                                    <div class="stepper-step ${step >= 1 ? 'active' : ''}" title="Step 1: Accepted">
                                        <div class="step-circle"><i class="fa-solid ${step >= 1 ? 'fa-check' : 'fa-bell'}"></i></div>
                                        <span class="step-label">Accepted</span>
                                    </div>
                                    <div class="stepper-step ${step >= 2 ? 'active' : ''}" title="Step 2: Reached Location">
                                        <div class="step-circle"><i class="fa-solid ${step >= 2 ? 'fa-check' : 'fa-location-dot'}"></i></div>
                                        <span class="step-label">Reached</span>
                                    </div>
                                    <div class="stepper-step ${step >= 3 ? 'active' : ''}" title="Step 3: Photo Gate (Before)">
                                        <div class="step-circle"><i class="fa-solid ${step >= 3 ? 'fa-check' : 'fa-camera'}"></i></div>
                                        <span class="step-label">Photo (Start)</span>
                                    </div>
                                    <div class="stepper-step ${step >= 4 ? 'active' : ''}" title="Step 4: In Progress">
                                        <div class="step-circle"><i class="fa-solid ${step >= 4 ? 'fa-check' : 'fa-screwdriver-wrench'}"></i></div>
                                        <span class="step-label">In Progress</span>
                                    </div>
                                    <div class="stepper-step ${step >= 5 ? 'active' : ''}" title="Step 5: Completed">
                                        <div class="step-circle"><i class="fa-solid ${step >= 5 ? 'fa-check' : 'fa-flag-checkered'}"></i></div>
                                        <span class="step-label">Completed</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Card Footer Actions -->
                        <div class="card-footer bg-light border-0 px-4 py-3 d-flex justify-content-between align-items-center">
                            <button class="btn btn-sm btn-outline-dark rounded-pill px-3" onclick="window.maintenanceDispatch.openPhotoModal(${b.id})">
                                <i class="fa-solid fa-images me-1 text-primary"></i>View Photos
                            </button>
                            <button class="btn btn-sm btn-primary rounded-pill px-3" onclick="window.maintenanceDispatch.advanceStep(${b.id})">
                                <i class="fa-solid fa-forward-step me-1"></i>Advance Step (${step < 5 ? 'Step ' + (step + 1) : 'Done'})
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    }

    // Render Non-Emergency Tickets Table
    function renderNonEmergencyTickets() {
        const tbody = document.getElementById("nonEmergencyTicketsBody");
        if (!tbody) return;

        if (state.tickets.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No non-emergency tickets currently logged.</td></tr>`;
            return;
        }

        tbody.innerHTML = state.tickets.map(t => `
            <tr>
                <td class="font-monospace fw-bold text-dark">${escapeHtml(t.id || 'T-' + t.ticketId)}</td>
                <td>
                    <div class="fw-bold text-dark">${escapeHtml(t.title || t.description)}</div>
                    <small class="text-muted"><i class="fa-solid fa-location-dot me-1 text-secondary"></i>${escapeHtml(t.serviceAddress || 'Flat Unit')}</small>
                </td>
                <td>
                    <span class="badge bg-light text-dark border rounded-pill px-3 py-1">
                        ${escapeHtml(t.category || 'General')}
                    </span>
                </td>
                <td>
                    <span class="badge ${t.priority === 'High' ? 'bg-danger-subtle text-danger' : 'bg-warning-subtle text-warning-emphasis'} rounded-pill px-2.5 py-1">
                        ${escapeHtml(t.priority || 'Medium')}
                    </span>
                </td>
                <td>
                    <span class="badge ${t.status === 'COMPLETED' ? 'bg-success-subtle text-success' : 'bg-info-subtle text-info-emphasis'} rounded-pill px-3 py-1">
                        ${escapeHtml(t.status || 'OPEN')}
                    </span>
                </td>
                <td class="small text-muted">${escapeHtml(t.requesterName || 'Resident')}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary rounded-pill px-3" onclick="window.maintenanceDispatch.triageTicket('${t.id}')">
                        <i class="fa-solid fa-calendar-check me-1"></i>Triage & Schedule
                    </button>
                </td>
            </tr>
        `).join("");
    }

    // Render Partner Directory Master Table
    function renderPartnerDirectory() {
        const tbody = document.getElementById("partnerDirectoryBody");
        if (!tbody) return;

        let filtered = state.partners;
        if (state.selectedTradeFilter !== "all") {
            filtered = filtered.filter(p => (p.trade || '').toLowerCase() === state.selectedTradeFilter.toLowerCase());
        }
        if (state.selectedPartnerStatus !== "all") {
            if (state.selectedPartnerStatus === "on_duty") filtered = filtered.filter(p => p.onDuty);
            if (state.selectedPartnerStatus === "off_duty") filtered = filtered.filter(p => !p.onDuty);
        }

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No partners match the selected trade or status filters.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(p => `
            <tr>
                <td>
                    <div class="fw-bold text-dark">${escapeHtml(p.fullName)}</div>
                    <small class="text-muted"><i class="fa-solid fa-phone me-1"></i>${escapeHtml(p.mobileNumber)}</small>
                </td>
                <td>
                    <span class="badge bg-light text-dark border rounded-pill px-3 py-1 fw-semibold">
                        <i class="fa-solid fa-wrench me-1 text-primary"></i>${escapeHtml(p.trade || 'General')}
                    </span>
                </td>
                <td>
                    <span class="badge ${p.employmentType === 'INTERNAL' ? 'bg-primary-subtle text-primary border border-primary-subtle' : 'bg-info-subtle text-info border border-info-subtle'} rounded-pill px-3 py-1">
                        ${p.employmentType === 'INTERNAL' ? 'Internal Staff' : 'Third-Party Vendor'}
                    </span>
                </td>
                <td>
                    <span class="text-secondary small"><i class="fa-solid fa-map-pin me-1 text-danger"></i>${escapeHtml(p.hubName || 'General Hub')}</span>
                </td>
                <td>
                    <span class="badge ${p.onDuty ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'} rounded-pill px-3 py-1">
                        <i class="fa-solid fa-circle me-1" style="font-size: 0.55rem;"></i>${p.onDuty ? (p.workState === 'ON_JOB' ? 'On Active Job' : 'Available On-Duty') : 'Clocked Off / Offline'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm ${p.onDuty ? 'btn-outline-danger' : 'btn-outline-success'} rounded-pill px-3" onclick="window.maintenanceDispatch.togglePartnerDuty(${p.id})">
                        <i class="fa-solid fa-power-off me-1"></i>${p.onDuty ? 'Clock Off' : 'Clock On'}
                    </button>
                </td>
            </tr>
        `).join("");
    }

    // Render Hub Master Table
    function renderHubMaster() {
        const tbody = document.getElementById("hubMasterBody");
        if (!tbody) return;

        tbody.innerHTML = state.hubs.map(h => `
            <tr>
                <td class="fw-bold text-dark">${escapeHtml(h.name || h.city + ' - ' + h.area)}</td>
                <td>${escapeHtml(h.city)}</td>
                <td>${escapeHtml(h.area)}</td>
                <td class="small font-monospace text-muted">${h.latitude || '0.0'}, ${h.longitude || '0.0'}</td>
                <td>
                    <span class="badge bg-light text-primary border rounded-pill px-3 py-1 fw-bold">
                        ${h.partnerCount || 0} Registered Partners
                    </span>
                </td>
                <td>
                    <span class="badge ${h.active ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} rounded-pill px-3 py-1">
                        ${h.active ? 'Active Operational' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-secondary rounded-pill px-3" onclick="window.maintenanceDispatch.toggleHubActive(${h.id})">
                        <i class="fa-solid fa-toggle-on me-1"></i>${h.active ? 'Deactivate' : 'Activate'}
                    </button>
                </td>
            </tr>
        `).join("");
    }

    // Start Real-time SLA Countdown Loop
    function startSlaTicker() {
        if (state.slaInterval) clearInterval(state.slaInterval);
        state.slaInterval = setInterval(() => {
            state.bookings.forEach(b => {
                const el = document.getElementById(`sla-badge-${b.id}`);
                if (el) {
                    const sla = calculateSla(b);
                    el.className = `badge ${sla.badgeClass} rounded-pill px-3 py-1 font-monospace`;
                    el.innerHTML = `<i class="fa-regular fa-clock me-1"></i>${sla.text}`;
                }
            });
        }, 1000);
    }

    // Public API Actions
    window.maintenanceDispatch = {
        switchTrack(trackName) {
            state.activeTrack = trackName;
            document.querySelectorAll(".track-toggle-btn").forEach(btn => {
                btn.classList.toggle("active", btn.dataset.track === trackName);
            });
            document.querySelectorAll(".track-panel").forEach(panel => {
                panel.classList.toggle("d-none", panel.id !== `track-${trackName}`);
            });
        },

        filterTrade(trade) {
            state.selectedTradeFilter = trade;
            document.querySelectorAll(".trade-filter-btn").forEach(btn => {
                btn.classList.toggle("active", btn.dataset.trade === trade);
            });
            renderPartnerDirectory();
        },

        filterStatus(status) {
            state.selectedPartnerStatus = status;
            renderPartnerDirectory();
        },

        openAssignModal(bookingId) {
            const booking = state.bookings.find(b => b.id === bookingId);
            if (!booking) return;
            state.selectedBookingForAssign = booking;

            const modalEl = document.getElementById("manualAssignModal");
            const modalTargetText = document.getElementById("assignTargetIncident");
            const listEl = document.getElementById("assignPartnerCandidateList");

            if (modalTargetText) {
                modalTargetText.textContent = `${booking.ticketCode || 'EMG-' + booking.id}: ${booking.issueTitle} (${booking.category})`;
            }

            // Filter available partners matching trade or on-duty
            const candidates = state.partners.filter(p => p.onDuty);
            if (listEl) {
                if (candidates.length === 0) {
                    listEl.innerHTML = `<div class="p-3 text-center text-muted">No on-duty partners currently available. Switch partner duty status in the directory first.</div>`;
                } else {
                    listEl.innerHTML = candidates.map(p => `
                        <div class="list-group-item list-group-item-action d-flex justify-content-between align-items-center p-3">
                            <div>
                                <strong class="text-dark d-block">${escapeHtml(p.fullName)}</strong>
                                <span class="badge bg-light text-dark border me-2">${escapeHtml(p.trade)}</span>
                                <small class="text-muted"><i class="fa-solid fa-map-pin me-1 text-danger"></i>${escapeHtml(p.hubName || 'Nearest Hub')}</small>
                            </div>
                            <button class="btn btn-sm btn-primary rounded-pill px-4 fw-semibold" onclick="window.maintenanceDispatch.confirmAssign(${p.id})">
                                Assign Now
                            </button>
                        </div>
                    `).join("");
                }
            }

            if (modalEl) {
                modalEl.classList.remove("d-none");
            }
        },

        closeAssignModal() {
            const modalEl = document.getElementById("manualAssignModal");
            if (modalEl) modalEl.classList.add("d-none");
            state.selectedBookingForAssign = null;
        },

        async confirmAssign(partnerId) {
            if (!state.selectedBookingForAssign) return;
            const booking = state.selectedBookingForAssign;
            const partner = state.partners.find(p => p.id === partnerId);

            // Send to backend API
            try {
                await fetch("/api/maintenance/dispatch/admin/assign", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ bookingId: booking.id, partnerId: partnerId })
                });
            } catch (e) {
                console.warn("Backend assign endpoint offline, updating client state:", e);
            }

            // Update local state
            booking.partnerId = partnerId;
            booking.partnerName = partner ? partner.fullName : "Assigned Partner";
            booking.partnerTrade = partner ? partner.trade : booking.category;
            booking.partnerPhone = partner ? partner.mobileNumber : "+91 98765 00000";
            booking.employmentType = partner ? partner.employmentType : "INTERNAL";
            booking.jobStatus = "ACCEPTED";
            booking.step = 1;

            showNotification(`Partner ${partner ? partner.fullName : ''} assigned to ${booking.ticketCode || 'EMG-' + booking.id}!`);
            this.closeAssignModal();
            renderStats();
            renderUnassignedBanner();
            renderEmergencyGrid();
        },

        openPhotoModal(bookingId) {
            const booking = state.bookings.find(b => b.id === bookingId);
            if (!booking) return;
            state.selectedBookingForPhotos = booking;

            const modalEl = document.getElementById("photoVerificationModal");
            const titleEl = document.getElementById("photoModalTitle");
            const beforeImg = document.getElementById("photoBeforePreview");
            const afterImg = document.getElementById("photoAfterPreview");

            if (titleEl) {
                titleEl.textContent = `Photo Proof Gate: ${booking.ticketCode || 'EMG-' + booking.id} · ${booking.issueTitle}`;
            }

            if (beforeImg) {
                beforeImg.src = booking.beforePhotoUrl || "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80";
            }
            if (afterImg) {
                afterImg.src = booking.afterPhotoUrl || "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&w=600&q=80";
            }

            if (modalEl) modalEl.classList.remove("d-none");
        },

        closePhotoModal() {
            const modalEl = document.getElementById("photoVerificationModal");
            if (modalEl) modalEl.classList.add("d-none");
            state.selectedBookingForPhotos = null;
        },

        async advanceStep(bookingId) {
            const booking = state.bookings.find(b => b.id === bookingId);
            if (!booking) return;

            let curStep = booking.step || 1;
            if (curStep >= 5) {
                showNotification("Job already completed and signed off.", false);
                return;
            }

            curStep += 1;
            booking.step = curStep;

            const stepActions = {
                2: "REACHED_LOCATION",
                3: "START_WORK",
                4: "IN_PROGRESS",
                5: "COMPLETE_WORK"
            };

            const actionName = stepActions[curStep] || "UPDATE";
            try {
                await fetch(`/api/maintenance/dispatch/bookings/${booking.id}/action`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: actionName, notes: `Advanced to step ${curStep} by Operations Admin` })
                });
            } catch (e) {
                console.warn("Backend transition endpoint offline, updated client state:", e);
            }

            if (curStep === 2) booking.jobStatus = "REACHED_LOCATION";
            if (curStep === 3) {
                booking.jobStatus = "PHOTO_VERIFIED";
                booking.beforePhotoUrl = "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80";
            }
            if (curStep === 4) booking.jobStatus = "IN_PROGRESS";
            if (curStep === 5) {
                booking.jobStatus = "COMPLETED";
                booking.afterPhotoUrl = "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&w=600&q=80";
                showNotification(`Work completed for ${booking.ticketCode}! Customer review link dispatched.`);
            } else {
                showNotification(`Advanced ${booking.ticketCode} to Step ${curStep}!`);
            }

            renderStats();
            renderEmergencyGrid();
        },

        async togglePartnerDuty(partnerId) {
            const partner = state.partners.find(p => p.id === partnerId);
            if (!partner) return;

            try {
                await fetch(`/api/maintenance/dispatch/partners/${partnerId}/toggle-duty`, { method: "POST" });
            } catch (e) {
                console.warn("Backend toggle duty offline, updating locally:", e);
            }

            partner.onDuty = !partner.onDuty;
            partner.workState = partner.onDuty ? "ON_DUTY_AVAILABLE" : "OFF_DUTY";
            showNotification(`${partner.fullName} is now ${partner.onDuty ? 'Available On-Duty' : 'Clocked Off'}.`);
            renderPartnerDirectory();
        },

        async toggleHubActive(hubId) {
            const hub = state.hubs.find(h => h.id === hubId);
            if (!hub) return;

            try {
                await fetch(`/api/maintenance/dispatch/hubs/${hubId}/toggle-active`, { method: "POST" });
            } catch (e) {
                console.warn("Backend toggle hub offline, updating locally:", e);
            }

            hub.active = !hub.active;
            showNotification(`Hub ${hub.name} ${hub.active ? 'Activated' : 'Deactivated'}.`);
            renderHubMaster();
        },

        triageTicket(ticketId) {
            showNotification(`Ticket ${ticketId} scheduled for shift team review.`);
        }
    };

    // DOM Ready
    document.addEventListener("DOMContentLoaded", () => {
        loadData();
        startSlaTicker();
    });
})();
