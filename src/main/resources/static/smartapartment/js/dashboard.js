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
    tasks: "Maintenance Tasks",
    "billing-rules": "Recurring Charge Rules",
    staff: "Domestic Staff",
    deliveries: "Delivery Management",
    polls: "Community Polls",
    assets: "Assets and Preventive Maintenance",
    "audit-logs": "Granular Audit Trail"
};

const toast = document.getElementById("toast");
const dashboardRole = document.body.dataset.dashboardRole || "admin";
const dashboardStorageKey = `smartapartment-dashboard-state:v12:${dashboardRole}`;
const residentProfileStorageKey = "smartapartment-resident-profile:v1";
const residentAdminInboxKey = "smartapartment-resident-admin-inbox:v1";
const residentPaymentProofsKey = "smartapartment-resident-payment-proofs:v1";
const rolePanelRoutes = {
    superadmin: ["monitoring", "audit-logs", "societies", "subscriptions", "analytics"],
    admin: ["control", "billing", "visitors", "complaints"],
    resident: ["billing", "complaints", "amenities", "announcements"],
    security: ["entries", "pass", "visitors", "entries"],
    maintenance: ["tasks", "complaints", "tasks", "profile"]
};
let activeAction = null;
let activePaymentProof = null;
let latestPlatformAuditStream = [];

function auditStatusClass(status) {
    return ["SUCCESS", "APPROVED", "PAID_VERIFIED", "BROADCASTED", "AUTHENTICATED"].includes(status)
        ? "bg-success" : status === "ESCALATED" ? "bg-danger" : "bg-warning text-dark";
}

function renderPlatformAuditStream() {
    const body = document.getElementById("minuteAuditStreamBody");
    if (!body) return;
    const society = document.getElementById("auditSocietyFilter")?.value || "ALL";
    const module = document.getElementById("auditModuleFilter")?.value || "ALL";
    const visibleItems = latestPlatformAuditStream.filter(item =>
        (society === "ALL" || item.society === society) &&
        (module === "ALL" || item.module === module)
    );
    body.replaceChildren(...visibleItems.map(item => {
        const row = document.createElement("tr");
        [item.time, item.society, item.module, item.actor, item.detail, item.ip].forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value || "";
            row.appendChild(cell);
        });
        const statusCell = document.createElement("td");
        const badge = document.createElement("span");
        badge.className = `badge ${auditStatusClass(item.status)}`;
        badge.textContent = item.status || "UNKNOWN";
        statusCell.appendChild(badge);
        row.appendChild(statusCell);
        return row;
    }));
    if (!visibleItems.length) {
        const empty = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 7;
        cell.className = "text-center text-muted py-4";
        cell.textContent = "No audit events match the selected filters.";
        empty.appendChild(cell);
        body.appendChild(empty);
    }
}

function wirePlatformAuditControls() {
    const societyFilter = document.getElementById("auditSocietyFilter");
    const moduleFilter = document.getElementById("auditModuleFilter");
    const exportButton = document.getElementById("auditLogExportButton");
    [societyFilter, moduleFilter].filter(Boolean).forEach(filter => {
        if (filter.dataset.auditBound) return;
        filter.dataset.auditBound = "true";
        filter.addEventListener("change", renderPlatformAuditStream);
    });
    if (exportButton && !exportButton.dataset.auditBound) {
        exportButton.dataset.auditBound = "true";
        exportButton.addEventListener("click", event => {
            event.preventDefault();
            event.stopImmediatePropagation();
            const society = societyFilter?.selectedOptions[0]?.textContent.trim() || "All Societies";
            const module = moduleFilter?.selectedOptions[0]?.textContent.trim() || "All Modules";
            const rows = latestPlatformAuditStream.filter(item =>
                (societyFilter?.value === "ALL" || item.society === societyFilter?.value) &&
                (moduleFilter?.value === "ALL" || item.module === moduleFilter?.value)
            );
            const quote = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
            const csv = [
                `SmartSociety Audit Log Stream - ${society} - ${module}`,
                `Generated,${quote(new Date().toLocaleString())}`,
                "",
                "Time,Society,Module,Actor,Detail,IP,Status",
                ...rows.map(item => [item.time, item.society, item.module, item.actor, item.detail, item.ip, item.status].map(quote).join(","))
            ].join("\n");
            downloadText(`smartsociety-audit-log-${new Date().toISOString().slice(0, 10)}.csv`, csv);
            showToast(`✓ Exported ${rows.length} audit log ${rows.length === 1 ? "entry" : "entries"}.`);
        });
    }
}

function dashboardContentRoot() {
    return document.querySelector(".main");
}

// Persistent backend hydration. The existing dashboard interactions remain as
// progressive UI enhancements; authoritative records always come from the API.
async function loadSocietyBackendData() {
    if (dashboardRole === "superadmin") return loadPlatformBackendData();
    const request = async (path) => {
        const response = await fetch(`/api/society/${path}`, { headers: { Accept: "application/json" } });
        if (response.status === 401) {
            window.location.href = "/?loginRequired=true";
            throw new Error("Authentication required");
        }
        if (response.status === 403) throw new Error(`The ${path} dataset is not available to this role`);
        if (!response.ok) throw new Error(`Unable to load ${path}`);
        return response.json();
    };
    const cell = (row, value) => { const td = document.createElement("td"); td.textContent = value ?? ""; row.appendChild(td); };
    const statusCell = (row, value) => { const td = document.createElement("td"); const span = document.createElement("span"); span.className = `status ${statusClass(value)}`; span.textContent = value; td.appendChild(span); row.appendChild(td); };
    const fill = (selector, items, render) => {
        document.querySelectorAll(selector).forEach(table => {
            const body = table.tBodies[0]; if (!body) return; body.replaceChildren();
            items.forEach(item => body.appendChild(render(item, cell, statusCell, table)));
        });
    };

    try {
        const optional = path => request(path).catch(() => []);
        const [overview, apartments, residents, complaints, visitors, bills, amenityItems, bookingItems, noticeItems, me, expenseItems, paymentItems] = await Promise.all([
            request("overview"), optional("apartments"), optional("residents"),
            optional("complaints"), optional("visitors"), optional("bills"), optional("amenities"), optional("bookings"), optional("announcements"), request("me"), optional("finance/expenses"), optional("finance/payments")
        ]);
        const overviewByLabel = {"total flats":overview.totalApartments,"residents":overview.totalResidents,
            "unpaid bills":overview.unpaidBills,"open complaints":overview.pendingComplaints,
            "open requests":overview.pendingComplaints,"inside visitors":overview.visitorCount};
        document.querySelectorAll('[data-view="overview"] .stats article').forEach((card) => {
            const label=card.querySelector("span")?.textContent.trim().toLowerCase(); const node=card.querySelector("strong");
            if (node && overviewByLabel[label] !== undefined) node.textContent = overviewByLabel[label];
        });
        fill('table[data-table="flats"]', apartments, (a,c,s) => { const r=document.createElement("tr");r.dataset.recordId=a.id;r.dataset.block=a.block||"Block A";r.dataset.floor=a.floor||0;r.dataset.unitType=a.type||"2BHK";c(r,a.unitNo);c(r,a.ownerName);c(r,a.block||"Block A");c(r,a.floor||0);c(r,a.type);s(r,a.occupancy);const td=document.createElement("td");const button=document.createElement("button");button.type="button";button.className="btn btn-sm btn-outline-primary";button.dataset.action="save";button.textContent="Edit";td.appendChild(button);r.appendChild(td);return r; });
        fill('table[data-table="residents"]', residents, (x,c,s) => { const r=document.createElement("tr");c(r,x.name);c(r,x.unitNo);c(r,x.residentType);s(r,"ACTIVE");const td=document.createElement("td");const button=document.createElement("button");button.type="button";button.className="btn btn-sm btn-outline-primary";button.dataset.action="notify";button.textContent="Notify";td.appendChild(button);r.appendChild(td);return r; });
        fill('table[data-table="billing"]', bills, (b,c,s) => { const r=document.createElement("tr");r.dataset.recordId=b.id;if(dashboardRole==="resident"){c(r,b.month);c(r,"Maintenance");}else{c(r,b.unitNo);c(r,b.month);}c(r,`Rs. ${b.totalAmount}`);s(r,b.paymentStatus);const td=document.createElement("td");if(b.paymentStatus==="PAID")td.textContent="Paid";else{const button=document.createElement("button");button.type="button";button.className="btn btn-sm btn-success";button.dataset.action="pay";button.textContent="Mark Paid";td.appendChild(button);}r.appendChild(td);return r; });
        fill('table[data-table="complaints"],table[data-table="maintenance-complaints"]', complaints, (x,c,s,table) => { const r=document.createElement("tr");r.dataset.recordId=x.id;c(r,x.title);if(dashboardRole==="resident"){c(r,x.category);s(r,x.status);}else if(dashboardRole==="maintenance"){c(r,x.unitNo);s(r,x.status);}else{c(r,x.unitNo);c(r,x.assignedTo||x.category);s(r,x.status);}const td=document.createElement("td");const closed=["RESOLVED","CLOSED"].includes(x.status);if(dashboardRole==="resident")td.textContent="Admin controlled";else if(closed){const badge=document.createElement("span");badge.className="badge bg-success-subtle text-success-emphasis";badge.textContent="Closed";td.appendChild(badge);}else if(dashboardRole==="maintenance"){const b=document.createElement("button");b.type="button";b.className="btn btn-sm btn-primary";b.dataset.backendAction=x.status==="IN_PROGRESS"?"complaint-resolve":"complaint-start";b.textContent=x.status==="IN_PROGRESS"?"Mark Fixed":"Start Work";td.appendChild(b);}else{const b=document.createElement("button");b.type="button";b.className="btn btn-sm btn-outline-danger";b.dataset.backendAction="complaint-close";b.textContent="Close Ticket";td.appendChild(b);}r.appendChild(td);return r; });
        fill('table[data-table="visitors"],table[data-table="entries"]', visitors, (v,c,s,table) => { const r=document.createElement("tr");r.dataset.recordId=v.id;c(r,v.name);if(dashboardRole==="admin"){c(r,v.unitNo);c(r,v.purpose);c(r,v.expectedAt);}else{c(r,v.phone);c(r,v.unitNo);if(table.dataset.table==="entries"){c(r,v.purpose);c(r,v.resident);}else{c(r,v.checkInAt||v.expectedAt);}}s(r,v.status);const td=document.createElement("td");if(v.status==="CHECKED_OUT")td.textContent="Checked out";else{const b=document.createElement("button");b.dataset.backendAction=v.status==="CHECKED_IN"?"visitor-checkout":"visitor-checkin";b.textContent=v.status==="CHECKED_IN"?"Check Out":"Check In";td.appendChild(b);}r.appendChild(td);return r; });
        fill('table[data-table="expenses"]',expenseItems,(x,c,s)=>{const r=document.createElement("tr");r.dataset.recordId=x.id;c(r,`${x.title || x.category}${x.invoiceNumber ? ` · Invoice: ${x.invoiceNumber}` : ""}${x.description ? ` · ${x.description}` : ""}`);c(r,`${x.vendor || "—"}${x.vendorPhone ? ` · ${x.vendorPhone}` : ""}`);c(r,`Rs. ${Number(x.amount || 0).toLocaleString("en-IN")}${Number(x.taxAmount || 0) ? ` + tax Rs. ${Number(x.taxAmount).toLocaleString("en-IN")}` : ""}`);c(r,`Expense: ${x.date || "—"}${x.dueDate ? ` · Due: ${x.dueDate}` : ""}${x.paidDate ? ` · Paid: ${x.paidDate}` : ""}`);s(r,x.approvalStatus);const td=document.createElement("td");if(x.approvalStatus==="PENDING"){[["expense-edit","Edit","btn-outline-primary"],["expense-approve","Approve","btn-primary"],["expense-reject","Reject","btn-outline-danger"],["expense-delete","Remove","btn-outline-secondary"]].forEach(([action,label,style])=>{const b=document.createElement("button");b.type="button";b.className=`btn btn-sm ${style} me-2 mb-1`;b.dataset.backendAction=action;b.textContent=label;if(action==="expense-edit")b.dataset.expense=JSON.stringify(x);td.appendChild(b);});}else if(x.approvalStatus==="APPROVED"){const b=document.createElement("button");b.type="button";b.className="btn btn-sm btn-success";b.dataset.backendAction="expense-pay";b.textContent="Record payment";td.appendChild(b);}else td.textContent=x.approvalStatus==="PAID" ? `${x.paymentMode || "Paid"}${x.paymentReference ? ` · ${x.paymentReference}` : ""}` : (x.approvalNote || "Closed");r.appendChild(td);return r;});
        window.societyPaymentRecords = paymentItems;
        window.societyBillRecords = bills;
        renderPaymentRegister();
        window.societyAmenities = amenityItems;
        window.societyResidents = residents;
        renderAmenityBookingDesk(amenityItems, bookingItems, residents);
        renderAnnouncements(noticeItems);
        const nameField=document.querySelector('[data-profile-field="name"]');const emailField=document.querySelector('[data-profile-field="email"]');if(nameField)nameField.value=me.name;if(emailField)emailField.value=me.email;
        document.documentElement.dataset.backendConnected = "true";
    } catch (error) {
        console.error("Dashboard backend hydration failed", error);
    }
}

async function loadPlatformBackendData(){
    try{
        const get=async p=>{const r=await fetch(`/api/${p}`,{headers:{Accept:"application/json"}});if(!r.ok)throw new Error("Platform data unavailable");return r.json();};
        const [overview,tenants,users, plans, integrations, roles, privacyReqs, gateways, comms, monitoring, audit, subscriptions, analytics]=await Promise.all([
            get("platform/overview"),get("platform/tenants"),get("platform/users"),get("platform/plans"),
            get("superadmin/security/integrations").catch(()=>[]),
            get("superadmin/roles/list").catch(()=>[]),
            get("superadmin/data/privacy/requests").catch(()=>[]),
            get("superadmin/finance/payment-gateways").catch(()=>[]),
            get("superadmin/communication/templates").catch(()=>[]),
            get("superadmin/monitoring/data").catch(()=>({stats:{}, watchlist:[]})),
            get("superadmin/audit/data").catch(()=>({stats:{}, stream:[]})),
            get("superadmin/subscriptions/data").catch(()=>({mapping:[], admins:[], rules:[]})),
            get("superadmin/analytics/data").catch(()=>({}))
        ]);
        const byLabel={"active societies":overview.tenants,"platform users":overview.users,"pending approvals":overview.pendingTenants,
                       "gate entries today": monitoring.stats.gateEntriesToday, "bills pending": monitoring.stats.billsPending, "admin approvals": monitoring.stats.adminApprovals, "open risks": monitoring.stats.openRisks,
                       "audit events logged": audit.stats.auditEventsLogged, "minute actions today": audit.stats.minuteActionsToday, "security overrides": audit.stats.securityOverrides, "system health": audit.stats.systemHealth};
        
        document.querySelectorAll('.stats article').forEach(card=>{const key=card.querySelector("span")?.textContent.trim().toLowerCase();const value=card.querySelector("strong");if(value&&byLabel[key]!==undefined)value.textContent=byLabel[key];});
        const fill=(selector,items,rowBuilder)=>document.querySelectorAll(selector).forEach(table=>{const body=table;if(table.tagName==="TABLE") { const tb=table.tBodies[0]; if(tb) tb.replaceChildren(...items.map(rowBuilder)); } else { table.replaceChildren(...items.map(rowBuilder)); }});
        const td=(row,value)=>{const cell=document.createElement("td");cell.textContent=value??"";row.appendChild(cell);};
        fill('table[data-table="societies"]',tenants,t=>{const r=document.createElement("tr");r.dataset.recordId=t.id;td(r,t.societyName);td(r,t.city);td(r,"Unassigned");td(r,t.approved?"Approved":"Pending");const c=document.createElement("td");c.innerHTML=`<button class="btn btn-sm btn-outline-primary me-1" data-backend-action="edit-society">Edit</button><button class="btn btn-sm ${t.approved?'btn-outline-danger':'btn-outline-success'}" data-backend-action="${t.approved?'suspend-society':'approve-society'}">${t.approved?'Suspend':'Approve'}</button>`;r.appendChild(c);return r;});
        fill('table[data-table="users"]',users,u=>{const r=document.createElement("tr");r.dataset.userId=u.id;td(r,u.name);td(r,u.role);td(r,u.tenantId);td(r,u.locked?"Locked":"Active");const c=document.createElement("td");c.innerHTML=`<button type="button" class="btn btn-sm btn-outline-primary" data-platform-user-edit>Edit User</button>`;r.appendChild(c);return r;});
        window.platformPlans = plans;
        fill('#subscriptionPlansTable', plans, plan=>{const r=document.createElement("tr");r.dataset.planId=plan.id;td(r,plan.name);td(r,`Rs. ${plan.monthlyPrice}`);td(r,plan.maxApartments);td(r,plan.maxResidents);td(r,[plan.visitorManagement&&"Visitors",plan.amenityBooking&&"Amenities",plan.analytics&&"Analytics"].filter(Boolean).join(" · ") || "Core");const c=document.createElement("td");c.innerHTML="<button type='button' class='btn btn-sm btn-outline-primary' data-plan-action='edit'>Edit Plan</button>";r.appendChild(c);return r;});
        
        fill('#apiIntegrationsTable', integrations, i=>{const r=document.createElement("tr");r.dataset.integrationId=i.id;td(r,i.serviceName);td(r,i.description || "—");const status=document.createElement("td");status.innerHTML=`<span class="badge ${i.active?'bg-success':'bg-secondary'}">${i.active?'Active':'Disabled'}</span>`;r.appendChild(status);td(r,i.updatedAt ? new Date(i.updatedAt).toLocaleString() : "Just now");const c=document.createElement("td");c.innerHTML=`<button type="button" class="btn btn-sm btn-outline-primary" data-integration-edit>Configure</button>`;r.appendChild(c);return r;});
        fill('#accessRolesTable', roles, ro=>{const r=document.createElement("tr");r.dataset.rolePolicyId=ro.id;td(r,ro.role);td(r,ro.permissions);const status=document.createElement("td");status.innerHTML=`<span class="badge ${ro.status==='Active'?'bg-success':'bg-secondary'}">${ro.status}</span>`;r.appendChild(status);const c=document.createElement("td");c.innerHTML="<button type='button' class='btn btn-sm btn-outline-primary' data-role-policy-edit>Edit</button>";r.appendChild(c);return r;});
        fill('#privacyRequestsTable', privacyReqs, p=>{const r=document.createElement("tr");r.dataset.privacyRequestId=p.id;td(r,`PRQ-${p.id}`);td(r,p.details);td(r,p.requestType);const status=document.createElement("td");status.innerHTML=`<span class="badge ${p.status==='Pending'?'bg-warning text-dark':p.status==='Processed'?'bg-success':'bg-secondary'}">${p.status}</span>`;r.appendChild(status);const c=document.createElement("td");c.innerHTML=p.status==='Pending'?"<button type='button' class='btn btn-sm btn-outline-danger' data-privacy-review>Review</button>":"<span class='small text-muted'>Completed</span>";r.appendChild(c);return r;});
        fill('#paymentGatewaysTable', gateways, g=>{const r=document.createElement("tr");r.dataset.gatewayId=g.id;td(r,g.providerName);td(r,g.environment || "Sandbox");const status=document.createElement("td");status.innerHTML=`<span class="badge ${g.active?'bg-success':'bg-secondary'}">${g.active?'Active':'Disabled'}</span>`;r.appendChild(status);td(r,g.transactionFee || "—");const c=document.createElement("td");c.innerHTML=`<button type="button" class="btn btn-sm btn-outline-primary" data-gateway-config>Configure</button>`;r.appendChild(c);return r;});
        fill('#communicationsTable', comms, c=>{const r=document.createElement("tr");r.dataset.templateId=c.id;r.dataset.templateBody=c.bodyContent||"";td(r,c.templateName);td(r,c.channel);td(r,c.subject);const status=document.createElement("td");status.innerHTML=`<span class="badge ${c.active?'bg-success':'bg-secondary'}">${c.active?'Active':'Disabled'}</span>`;r.appendChild(status);const btn=document.createElement("td");btn.innerHTML=`<button type="button" class="btn btn-sm btn-outline-primary" data-template-edit>Edit</button>`;r.appendChild(btn);return r;});
        
        fill('#liveSocietyWatchlistTable', monitoring.watchlist, m=>{const r=document.createElement("tr");td(r,m.society);td(r,m.module);td(r,m.currentSignal);td(r,m.owner);td(r,m.accessRule);return r;});
        if(monitoring.commandWatch) {
            fill('#commandWatchGrid', monitoring.commandWatch, c=>{
                const r=document.createElement("tr");
                td(r,c.module);
                td(r,c.metrics);
                const btnTd = document.createElement("td");
                btnTd.innerHTML = `<button class="btn btn-sm btn-outline-primary" data-backend-action="${c.actionType}">${c.actionLabel}</button>`;
                r.appendChild(btnTd);
                return r;
            });
        }
        latestPlatformAuditStream = Array.isArray(audit.stream) ? audit.stream : [];
        wirePlatformAuditControls();
        renderPlatformAuditStream();
        fill('#subscriptionMappingTable', subscriptions.mapping, m=>{const r=document.createElement("tr");td(r,m.society);td(r,m.plan);td(r,m.flats);td(r,m.renewal);td(r,m.adminOwner);const s=document.createElement("td");s.innerHTML=`<span class="badge ${m.status==='Current'?'bg-success':m.status==='Renewal Due'?'bg-warning text-dark':'bg-danger'}">${m.status}</span>`;r.appendChild(s);const c=document.createElement("td");c.innerHTML="<button type='button' class='btn btn-sm btn-outline-primary' data-plan-action='review'>Review Plan</button>";r.appendChild(c);return r;});
        fill('#subscriptionAdminsTable', subscriptions.admins, a=>{const r=document.createElement("tr");td(r,a.admin);td(r,a.society);td(r,a.role);td(r,a.lastLogin);td(r,a.mfa);const s=document.createElement("td");s.innerHTML=`<span class="badge ${a.status==='Active'?'bg-success':a.status==='MFA Pending'?'bg-warning text-dark':'bg-danger'}">${a.status}</span>`;r.appendChild(s);const c=document.createElement("td");c.innerHTML="<button type='button' class='btn btn-sm btn-outline-primary' data-access-audit>Audit Access</button>";r.appendChild(c);return r;});
        fill('#billingRulesTable', subscriptions.rules, u=>{const r=document.createElement("tr");r.dataset.ruleId=u.id;td(r,u.rule);td(r,u.plan);td(r,u.amount);td(r,u.cycle);td(r,u.grace);const s=document.createElement("td");s.innerHTML=`<span class="badge ${u.status==='Active'||u.status==='Live'?'bg-success':'bg-secondary'}">${u.status}</span>`;r.appendChild(s);const c=document.createElement("td");c.innerHTML="<button type='button' class='btn btn-sm btn-outline-primary' data-billing-rule-edit>Edit Rule</button>";r.appendChild(c);return r;});
        
        if (analytics.mrr) {
            document.getElementById('analyticsMrr').textContent = analytics.mrr;
            document.getElementById('analyticsVisitors').textContent = analytics.visitors;
            document.getElementById('analyticsPayments').textContent = analytics.payments;
            document.getElementById('analyticsSla').textContent = analytics.sla;
        }
        const chart=document.getElementById("analyticsRevenueChart");
        if(chart){const data=[[52,48],[57,51],[61,58],[66,61],[70,67],[76,73]];chart.replaceChildren(...data.map(([revenue,collection])=>{const group=document.createElement("div");group.className="d-flex align-items-end gap-1 h-100";group.innerHTML=`<span class="rounded-top bg-primary" style="width:15px;height:${revenue}%" title="Revenue Rs. ${revenue}K"></span><span class="rounded-top bg-info" style="width:15px;height:${collection}%" title="Collections Rs. ${collection}K"></span>`;return group;}));}
        const societyTable=document.getElementById("analyticsSocietyTable");
        if(societyTable){const performance=[
            ["Green Nest Apartments","Premium","1,840","96%","4","8h","Excellent","success"],
            ["Lakeview Residency","Standard","920","89%","9","14h","Good","primary"],
            ["Urban Heights","Free","310","74%","15","22h","Needs attention","warning text-dark"]
        ]; societyTable.replaceChildren(...performance.map(item=>{const tr=document.createElement("tr");tr.innerHTML=`<td class="fw-semibold">${item[0]}</td><td>${item[1]}</td><td>${item[2]}</td><td><div class="d-flex align-items-center gap-2"><div class="progress flex-grow-1" style="height:7px"><div class="progress-bar bg-success" style="width:${item[3]}"></div></div><span class="small">${item[3]}</span></div></td><td>${item[4]}</td><td>${item[5]}</td><td><span class="badge bg-${item[7]}">${item[6]}</span></td>`;return tr;}));}
        const mix=document.getElementById("analyticsSubscriptionMix");
        if(mix){const total=Math.max(tenants.length,1),counts={Premium:1,Standard:1,Free:Math.max(tenants.length-2,1)};mix.replaceChildren(...Object.entries(counts).map(([plan,count])=>{const width=Math.round(count/total*100);const item=document.createElement("div");item.className="mb-3";item.innerHTML=`<div class="d-flex justify-content-between small mb-1"><span class="fw-semibold">${plan}</span><span>${count} societ${count===1?"y":"ies"}</span></div><div class="progress" style="height:9px"><div class="progress-bar ${plan==="Premium"?"bg-primary":plan==="Standard"?"bg-info":"bg-secondary"}" style="width:${width}%"></div></div>`;return item;}));}

    }catch(error){console.error("Platform hydration failed",error);}
}

async function mutateSociety(path, method, body) {
    const response = await fetch(`/api/${path}`, {method, headers:{"Content-Type":"application/json",Accept:"application/json"}, body:body===undefined?undefined:JSON.stringify(body)});
    const result = await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(result.message || "The operation could not be completed");
    return result;
}

function renderAnnouncements(noticeItems = []) {
    if (dashboardRole === "admin") {
        document.querySelectorAll('table[data-table="announcements"] tbody').forEach(body => {
            body.replaceChildren();
            if (!noticeItems.length) {
                const row = document.createElement("tr"); row.innerHTML = '<td colspan="4" class="text-muted text-center py-4">No announcements published yet.</td>'; body.appendChild(row); return;
            }
            noticeItems.forEach(notice => {
                const row = document.createElement("tr");
                const noticeCell = document.createElement("td");
                const title = document.createElement("div"); title.className = "fw-semibold"; title.textContent = notice.title;
                const message = document.createElement("div"); message.className = "small text-muted text-truncate"; message.style.maxWidth = "520px"; message.textContent = notice.message;
                noticeCell.append(title, message); row.appendChild(noticeCell);
                [notice.audience || "ALL", notice.emergency ? "Urgent" : "Standard", notice.createdAt ? new Date(notice.createdAt).toLocaleString([], {dateStyle:"medium", timeStyle:"short"}) : "Just now"].forEach((value, index) => {
                    const cell = document.createElement("td");
                    if (index === 1) { const badge = document.createElement("span"); badge.className = notice.emergency ? "badge text-bg-danger" : "badge text-bg-primary"; badge.textContent = value; cell.appendChild(badge); } else cell.textContent = value.replaceAll("_", " ");
                    row.appendChild(cell);
                });
                body.appendChild(row);
            });
        });
        const message = document.getElementById("announcementMessage");
        const counter = document.getElementById("announcementCharacterCount");
        const titleInput = document.getElementById("announcementTitle");
        const audienceInput = document.getElementById("announcementAudience");
        const urgentInput = document.getElementById("announcementEmergency");
        const state = document.getElementById("announcementState");
        const updateCount = () => { if (counter && message) counter.textContent = `${message.value.length} / 3000 characters`; };
        if (message && !message.dataset.counterBound) { message.dataset.counterBound = "true"; message.addEventListener("input", updateCount); }
        const markDraftChanged = () => {
            if (!state) return;
            state.textContent = "Draft changed";
            state.className = "badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-3 py-2";
        };
        [titleInput, message, audienceInput, urgentInput].filter(Boolean).forEach(input => {
            if (input.dataset.draftBound) return;
            input.dataset.draftBound = "true";
            input.addEventListener(input.matches("input, textarea") ? "input" : "change", markDraftChanged);
        });
        updateCount();
        return;
    }
    document.querySelectorAll('[data-view="announcements"] .card').forEach(card=>{if(dashboardRole!=="resident")return;const heading=card.querySelector("h2");card.replaceChildren();if(heading)card.appendChild(heading);noticeItems.forEach(n=>{const h=document.createElement("h3");h.textContent=n.title;const p=document.createElement("p");p.textContent=n.message;card.append(h,p);});});
}

function renderAmenityBookingDesk(amenityItems = [], bookingItems = [], residents = []) {
    if (dashboardRole !== "admin") return;
    const formatDateTime = value => value ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—";
    const paymentLabel = booking => {
        const method = booking.paymentMethod || "Not recorded";
        const status = booking.paymentStatus ? ` · ${booking.paymentStatus.replaceAll("_", " ")}` : "";
        return `${method}${status}`;
    };
    document.querySelectorAll('table[data-table="amenity-bookings"] tbody').forEach(body => {
        body.replaceChildren();
        if (!bookingItems.length) {
            const row = document.createElement("tr");
            row.innerHTML = '<td colspan="8" class="text-muted text-center py-4">No amenity bookings yet. Use Add Booking to record one.</td>';
            body.appendChild(row);
            return;
        }
        bookingItems.forEach(booking => {
            const row = document.createElement("tr");
            row.dataset.recordId = booking.id;
            const add = value => { const td = document.createElement("td"); td.textContent = value; row.appendChild(td); };
            add(booking.amenity || "—");
            add(booking.resident || "—");
            add(booking.unitNo || "—");
            add(`${formatDateTime(booking.startTime)} – ${formatDateTime(booking.endTime)}`);
            add(paymentLabel(booking));
            add(`Rs. ${booking.amount ?? 0}`);
            const approval = document.createElement("td");
            const badge = document.createElement("span");
            badge.className = `status ${statusClass(booking.approvalStatus)}`;
            badge.textContent = booking.approvalStatus || "PENDING";
            approval.appendChild(badge); row.appendChild(approval);
            const action = document.createElement("td");
            if (booking.approvalStatus === "PENDING") {
                ["APPROVED", "REJECTED"].forEach(status => {
                    const button = document.createElement("button");
                    button.type = "button";
                    button.className = `btn btn-sm ${status === "APPROVED" ? "btn-primary me-2" : "btn-outline-danger"}`;
                    button.dataset.backendAction = status === "APPROVED" ? "booking-approve" : "booking-reject";
                    button.textContent = status === "APPROVED" ? "Approve" : "Reject";
                    action.appendChild(button);
                });
            } else action.textContent = "Reviewed";
            row.appendChild(action);
            body.appendChild(row);
        });
    });
    document.querySelectorAll('table[data-table="amenity-prices"] tbody').forEach(body => {
        body.replaceChildren();
        if (!amenityItems.length) {
            const row = document.createElement("tr");
            row.innerHTML = '<td colspan="5" class="text-muted text-center py-4">No amenities are configured yet.</td>';
            body.appendChild(row);
            return;
        }
        amenityItems.forEach(amenity => {
            const row = document.createElement("tr");
            [amenity.name, amenity.capacity, `Rs. ${amenity.bookingFee ?? 0}`, amenity.approvalRequired ? "Required" : "Not required"].forEach(value => {
                const td = document.createElement("td"); td.textContent = value; row.appendChild(td);
            });
            const action = document.createElement("td");
            const button = document.createElement("button");
            button.type = "button"; button.className = "btn btn-sm btn-outline-primary";
            button.dataset.action = "amenity-price-edit";
            button.dataset.amenityId = amenity.id;
            button.dataset.amenityName = amenity.name;
            button.dataset.amenityCapacity = amenity.capacity;
            button.dataset.amenityPrice = amenity.bookingFee ?? 0;
            button.dataset.amenityApproval = amenity.approvalRequired ? "Yes" : "No";
            button.textContent = "Edit price";
            action.appendChild(button); row.appendChild(action); body.appendChild(row);
        });
    });
}

async function syncSocietyWorkspace(note = "") {
    const state = document.getElementById("societySyncState");
    if (state) state.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i>Syncing live records';
    try {
        await loadSocietyBackendData();
        const timestamp = new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
        if (state) state.innerHTML = `<i class="fa-solid fa-circle-check me-1"></i>Synced ${timestamp}`;
        appendDashboardActivity(`Society data synced${note ? `: ${note}` : ""}`);
        showToast("✓ Society records refreshed");
        return true;
    } catch (error) {
        if (state) state.innerHTML = '<i class="fa-solid fa-triangle-exclamation me-1"></i>Sync needs retry';
        showToast(error.message || "Unable to sync society records");
        return false;
    }
}

function wireSocietySyncDialog() {
    const trigger = document.getElementById("societySyncButton");
    const modal = document.getElementById("societySyncModal");
    const note = document.getElementById("societySyncNote");
    const close = () => {
        modal?.classList.add("hidden");
        modal?.setAttribute("aria-hidden", "true");
    };
    if (!trigger || !modal || trigger.dataset.syncReady) return;
    trigger.dataset.syncReady = "true";
    trigger.addEventListener("click", event => {
        // The dashboard also has delegated click handlers. Stop this click here so
        // they cannot immediately close or redirect away from the sync form.
        event.preventDefault();
        event.stopImmediatePropagation();
        event.stopPropagation();
        if (note) note.value = "";
        modal.classList.remove("hidden");
        modal.setAttribute("aria-hidden", "false");
        note?.focus();
    }, true);
    ["closeSocietySyncModal", "cancelSocietySync"].forEach(id => document.getElementById(id)?.addEventListener("click", close));
    modal.addEventListener("click", event => { if (event.target === modal) close(); });
    document.getElementById("confirmSocietySync")?.addEventListener("click", async event => {
        const button = event.currentTarget;
        button.disabled = true;
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i>Syncing…';
        const completed = await syncSocietyWorkspace(document.getElementById("societySyncNote")?.value.trim() || "");
        button.disabled = false;
        button.innerHTML = '<i class="fa-solid fa-rotate me-2"></i>Sync now';
        if (completed) close();
    });
}

function moneyLabel(value) { return `Rs. ${Number(value || 0).toLocaleString("en-IN", {maximumFractionDigits: 2})}`; }

function renderPaymentRegister() {
    const records = window.societyPaymentRecords || [];
    const bills = window.societyBillRecords || [];
    const search = document.getElementById("paymentSearch")?.value.trim().toLowerCase() || "";
    const mode = document.getElementById("paymentModeFilter")?.value || "";
    const month = document.getElementById("paymentMonthFilter")?.value || "";
    const filtered = records.filter(payment => {
        const searchable = `${payment.unitNo || ""} ${payment.transactionId || ""} ${payment.billMonth || ""}`.toLowerCase();
        return (!search || searchable.includes(search)) && (!mode || payment.mode === mode) && (!month || String(payment.billMonth || "").startsWith(month));
    });
    const body = document.querySelector('table[data-table="payments"] tbody');
    if (body) {
        body.replaceChildren(...filtered.map(payment => {
            const row = document.createElement("tr");
            const values = [`${payment.unitNo || "—"} · ${payment.billMonth || "Maintenance bill"}`, moneyLabel(payment.amount), payment.mode || "—", payment.transactionId || "—", payment.paidAt ? new Date(payment.paidAt).toLocaleString("en-IN", {dateStyle:"medium", timeStyle:"short"}) : "—"];
            values.forEach(value => { const cell = document.createElement("td"); cell.textContent = value; row.appendChild(cell); });
            const status = document.createElement("td"); const badge = document.createElement("span"); badge.className = `status ${statusClass(payment.status)}`; badge.textContent = payment.status || "SUCCESS"; status.appendChild(badge); row.appendChild(status);
            const receipt = document.createElement("td"); const button = document.createElement("button"); button.type = "button"; button.className = "btn btn-sm btn-outline-primary"; button.dataset.paymentReceipt = JSON.stringify(payment); button.textContent = "View receipt"; receipt.appendChild(button); row.appendChild(receipt); return row;
        }));
        if (!filtered.length) body.innerHTML = '<tr><td colspan="7" class="text-muted text-center py-4">No payments match the selected filters.</td></tr>';
    }
    const collected = records.filter(item => String(item.status || "").toUpperCase() === "SUCCESS").reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const outstandingBills = bills.filter(item => String(item.paymentStatus || "").toUpperCase() !== "PAID");
    const outstanding = outstandingBills.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const currentCollected = records.filter(item => String(item.paidAt || "").startsWith(currentMonth)).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const digital = records.filter(item => ["UPI", "BANK_TRANSFER", "CARD", "ONLINE"].includes(String(item.mode || "").toUpperCase())).length;
    const set = (id, value) => { const node = document.getElementById(id); if (node) node.textContent = value; };
    set("paymentsCollected", moneyLabel(collected)); set("paymentsCount", `${records.length} successful payment${records.length === 1 ? "" : "s"}`); set("paymentsOutstanding", moneyLabel(outstanding)); set("paymentsDueCount", `${outstandingBills.length} pending bill${outstandingBills.length === 1 ? "" : "s"}`); set("paymentsThisMonth", moneyLabel(currentCollected)); set("paymentsDigitalRate", records.length ? `${Math.round((digital / records.length) * 100)}%` : "0%");
}

function exportPaymentRegister() {
    const records = window.societyPaymentRecords || [];
    const header = ["Flat", "Billing month", "Amount", "Method", "Transaction reference", "Paid at", "Status"];
    const rows = records.map(item => [item.unitNo, item.billMonth, item.amount, item.mode, item.transactionId, item.paidAt, item.status]);
    const csv = [header, ...rows].map(row => row.map(value => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], {type:"text/csv"})); link.download = `payment-register-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(link.href); showToast("Payment register exported.");
}

function resetExpenseForm() {
    const form = document.getElementById("expenseForm"); if (!form) return;
    form.reset(); form.dataset.editingId = "";
    form.elements.date.value = new Date().toISOString().slice(0, 10);
    const save = document.getElementById("saveExpense"); if (save) save.innerHTML = '<i class="fa-solid fa-plus me-2"></i>Record Expense';
    document.getElementById("cancelExpenseEdit")?.classList.add("d-none");
    const state = document.getElementById("expenseFormState"); if (state) { state.textContent = "New expense"; state.className = "badge bg-primary-subtle text-primary-emphasis border border-primary-subtle px-3 py-2"; }
}

function editExpense(button) {
    const form = document.getElementById("expenseForm"); if (!form) return;
    const expense = JSON.parse(button.dataset.expense || "{}"); form.dataset.editingId = expense.id || "";
    ["title", "category", "vendor", "vendorPhone", "invoiceNumber", "invoiceDate", "dueDate", "amount", "taxAmount", "date", "description"].forEach(field => { if (form.elements[field]) form.elements[field].value = expense[field] ?? ""; });
    const save = document.getElementById("saveExpense"); if (save) save.innerHTML = '<i class="fa-solid fa-floppy-disk me-2"></i>Save Expense';
    document.getElementById("cancelExpenseEdit")?.classList.remove("d-none");
    const state = document.getElementById("expenseFormState"); if (state) { state.textContent = `Editing ${expense.title || expense.category}`; state.className = "badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-3 py-2"; }
    form.scrollIntoView({behavior:"smooth",block:"center"}); form.elements.title.focus();
}

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("expenseForm");
    if (!form) return;
    resetExpenseForm();
    form.addEventListener("submit", event => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        const values = Object.fromEntries(new FormData(form).entries());
        const payload = {...values, amount:Number(values.amount), taxAmount:values.taxAmount ? Number(values.taxAmount) : null};
        ["invoiceDate", "dueDate"].forEach(field => payload[field] = values[field] || null);
        const id = form.dataset.editingId;
        mutateSociety(`society/finance/expenses${id ? `/${id}` : ""}`, id ? "PATCH" : "POST", payload)
            .then(() => { showToast(id ? "Expense details updated." : "Expense recorded for approval."); resetExpenseForm(); return loadSocietyBackendData(); })
            .catch(error => showToast(error.message || "Expense could not be saved."));
    });
    document.getElementById("cancelExpenseEdit")?.addEventListener("click", resetExpenseForm);
    ["paymentSearch", "paymentModeFilter", "paymentMonthFilter"].forEach(id => document.getElementById(id)?.addEventListener("input", renderPaymentRegister));
    document.getElementById("paymentModeFilter")?.addEventListener("change", renderPaymentRegister);
    document.getElementById("clearPaymentFilters")?.addEventListener("click", () => { ["paymentSearch", "paymentModeFilter", "paymentMonthFilter"].forEach(id => { const field = document.getElementById(id); if (field) field.value = ""; }); renderPaymentRegister(); });
    document.getElementById("exportPayments")?.addEventListener("click", exportPaymentRegister);
});

document.addEventListener("click", event => {
    const button = event.target.closest("[data-payment-receipt]"); if (!button) return;
    const payment = JSON.parse(button.dataset.paymentReceipt || "{}");
    window.alert(`Payment Receipt\n\nFlat: ${payment.unitNo || "—"}\nBilling cycle: ${payment.billMonth || "—"}\nAmount: ${moneyLabel(payment.amount)}\nMethod: ${payment.mode || "—"}\nReference: ${payment.transactionId || "—"}\nPaid at: ${payment.paidAt ? new Date(payment.paidAt).toLocaleString("en-IN") : "—"}\nStatus: ${payment.status || "SUCCESS"}`);
});

document.addEventListener("click", event => {
    const button = event.target.closest("[data-subscription-action]"); if (!button) return;
    const action = button.dataset.subscriptionAction;
    if (action === "support") {
        window.location.href = "mailto:support@smartapartment.local?subject=" + encodeURIComponent("Society subscription support request");
        return;
    }
    const rows = [...document.querySelectorAll("#saasInvoiceTable tbody tr")].map(row => [...row.children].slice(0, 6).map(cell => cell.textContent.trim()));
    if (action === "export") {
        const csv = [["Invoice number", "Plan", "Billing cycle", "Amount", "Payment status", "Invoice date"], ...rows].map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(",")).join("\n");
        const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], {type:"text/csv"})); link.download = "saas-invoice-history.csv"; link.click(); URL.revokeObjectURL(link.href); showToast("Invoice history exported.");
        return;
    }
    if (action === "invoice") {
        const row = button.closest("tr"); const values = row ? [...row.children].slice(0, 6).map(cell => cell.textContent.trim()) : [button.dataset.invoice || "Invoice"];
        const content = `SmartApartment SaaS Invoice\n\nInvoice number: ${values[0]}\nPlan: ${values[1]}\nBilling cycle: ${values[2]}\nAmount: ${values[3]}\nPayment status: ${values[4]}\nInvoice date: ${values[5]}\n\nThis is a subscription invoice record generated from the SmartApartment society dashboard.`;
        const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([content], {type:"text/plain"})); link.download = `${values[0] || "subscription-invoice"}.txt`; link.click(); URL.revokeObjectURL(link.href); showToast("Invoice record downloaded.");
    }
});

document.addEventListener("click", event => {
    const button = event.target.closest("[data-society-report]");
    if (!button) return;
    const action = button.dataset.societyReport;
    const period = document.getElementById("reportPeriod")?.value || "Current month";
    const focus = document.getElementById("reportFocus")?.value || "All operational areas";
    const prepared = document.getElementById("reportPreparedAt");

    if (action === "refresh") {
        if (prepared) prepared.innerHTML = `<i class="fa-solid fa-check text-success me-1"></i>Insights refreshed for <strong>${period}</strong> · ${focus} · ${new Date().toLocaleString()}.`;
        showToast("Report insights refreshed.");
        return;
    }

    const reports = {
        billing: [["Metric", "Value"], ["Period", period], ["Total billed", "Rs. 5,00,000"], ["Collected", "Rs. 4,30,000"], ["Collection rate", "86%"], ["Pending bills", "46"]],
        visitors: [["Metric", "Value"], ["Period", period], ["Visitor entries", "1,248"], ["Approved visitors", "1,180"], ["Delayed exits", "42"], ["Staff entries", "120"]],
        complaints: [["Metric", "Value"], ["Period", period], ["Open complaints", "12"], ["Resolved within SLA", "92%"], ["Average resolution time", "14 hours"], ["Priority cases", "3"]],
        expenses: [["Metric", "Value"], ["Period", period], ["Approved expenses", "Rs. 1,84,000"], ["Pending approvals", "3"], ["Vendors paid", "8"], ["Budget utilization", "74%"]]
    };
    const keys = action === "all" ? Object.keys(reports) : [action];
    const rows = keys.flatMap((key, index) => (index ? [[""]] : []).concat([[key.toUpperCase()]], reports[key] || []));
    const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = action === "all" ? "society-reporting-pack.csv" : `society-${action}-report.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    if (prepared) prepared.innerHTML = `<i class="fa-solid fa-download text-primary me-1"></i>${action === "all" ? "Reporting pack" : `${action[0].toUpperCase()}${action.slice(1)} report`} exported for <strong>${period}</strong>.`;
    showToast("Report download started.");
});

document.addEventListener("DOMContentLoaded", loadSocietyBackendData);
document.addEventListener("DOMContentLoaded", wireSocietySyncDialog);
if (document.readyState !== "loading") wireSocietySyncDialog();
document.addEventListener("click", event => {
    const button = event.target.closest("[data-access-audit]");
    if (!button) return;
    const row = button.closest("tr");
    const admin = row?.children[0]?.textContent.trim() || "this administrator";
    const society = row?.children[1]?.textContent.trim() || "the society";
    if (!window.confirm(`Complete access audit for ${admin} at ${society}?`)) return;
    const statusCell = row?.children[5];
    if (statusCell) statusCell.innerHTML = '<span class="badge bg-success">Audited</span>';
    if (row?.children[3]) row.children[3].textContent = `Audited ${new Date().toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}`;
    button.textContent = "Audited";
    button.disabled = true;
    showToast(`✓ Access audit completed for ${admin}.`);
});
document.addEventListener("click",event=>{
    const button=event.target.closest("[data-backend-action]");if(!button)return;
    event.preventDefault();event.stopImmediatePropagation();const row=button.closest("tr");const id=row?.dataset.recordId;
    const action=button.dataset.backendAction;button.disabled=true;
    const monitoringActions=["trigger-reminder", "audit-gate", "sync-kyc", "escalate-complaints", "review-damages", "audit-expenses", "global-broadcast", "force-reports"];
    if(monitoringActions.includes(action) && "Notification" in window && Notification.permission === "default") Notification.requestPermission();
    let operation;
    if(action === "add-society") {
        const societyName = window.prompt("Society name", "");
        if (!societyName?.trim()) { button.disabled = false; return; }
        const city = window.prompt("City", "");
        if (!city?.trim()) { showToast("Please enter the city for the society."); button.disabled = false; return; }
        const contactEmail = window.prompt("Contact email (optional)", "") || "";
        operation = mutateSociety("platform/tenants", "POST", {societyName: societyName.trim(), city: city.trim(), contactEmail});
    }
    else if(action === "edit-society") {
        const societyName = window.prompt("Society name", row?.children[0]?.textContent.trim() || "");
        if (!societyName?.trim()) { button.disabled = false; return; }
        const city = window.prompt("City", row?.children[1]?.textContent.trim() || "");
        if (!city?.trim()) { showToast("Please enter the city for the society."); button.disabled = false; return; }
        operation = mutateSociety(`platform/tenants/${id}`, "PUT", {societyName: societyName.trim(), city: city.trim()});
    }
    else if(action==="announcement-publish"){
        const panel = button.closest('[data-view="announcements"]');
        const title = panel?.querySelector("#announcementTitle")?.value.trim() || "";
        const message = panel?.querySelector("#announcementMessage")?.value.trim() || "";
        const audience = panel?.querySelector("#announcementAudience")?.value || "ALL";
        const emergency = Boolean(panel?.querySelector("#announcementEmergency")?.checked);
        if (!title || !message) { showToast("Enter both an announcement title and message."); button.disabled = false; return; }
        operation=mutateSociety("society/announcements","POST",{title,message,audience,emergency});
    }
    else if(action==="amenity-book"){const start=new Date(Date.now()+86400000);start.setMinutes(0,0,0);const end=new Date(start.getTime()+3600000);operation=mutateSociety("society/bookings","POST",{amenityId:Number(button.dataset.amenityId),startTime:start.toISOString().slice(0,19),endTime:end.toISOString().slice(0,19)});}
    else if(action.startsWith("visitor-"))operation=mutateSociety(`society/visitors/${id}/${action.endsWith("checkout")?"checkout":"checkin"}`,"PATCH");
    else if(action==="complaint-close")operation=mutateSociety(`society/complaints/${id}`,"PATCH",{status:"CLOSED",assignedTo:"",resolutionNotes:"Closed from dashboard"});
    else if(action==="complaint-start")operation=mutateSociety(`society/complaints/${id}`,"PATCH",{status:"IN_PROGRESS",assignedTo:"Maintenance team",resolutionNotes:"Work started",sparePartsUsed:"",repairCost:null});
    else if(action==="complaint-resolve")operation=mutateSociety(`society/complaints/${id}`,"PATCH",{status:"RESOLVED",assignedTo:"Maintenance team",resolutionNotes:"Repair completed",sparePartsUsed:"",repairCost:null});
    else if(action==="expense-edit"){editExpense(button);button.disabled=false;return;}
    else if(action==="expense-approve")operation=mutateSociety(`society/finance/expenses/${id}/approve`,"PATCH");
    else if(action==="expense-reject"){const note=window.prompt("Reason for rejecting this expense (optional):","");if(note===null){button.disabled=false;return;}operation=mutateSociety(`society/finance/expenses/${id}/reject?note=${encodeURIComponent(note)}`,"PATCH");}
    else if(action==="expense-delete"){if(!window.confirm("Remove this pending expense?")){button.disabled=false;return;}operation=mutateSociety(`society/finance/expenses/${id}`,"DELETE");}
    else if(action==="expense-pay"){const mode=window.prompt("Payment mode (CASH, UPI, BANK_TRANSFER, CHEQUE):","BANK_TRANSFER");if(!mode?.trim()){button.disabled=false;return;}const reference=window.prompt("Payment reference / cheque number (optional):","");if(reference===null){button.disabled=false;return;}operation=mutateSociety(`society/finance/expenses/${id}/pay?mode=${encodeURIComponent(mode)}&reference=${encodeURIComponent(reference)}`,"PATCH");}
    else if(action==="booking-approve" || action==="booking-reject")operation=mutateSociety(`society/bookings/${id}/approval`,"PATCH",{approvalStatus:action==="booking-approve"?"APPROVED":"REJECTED"});
    // Super Admin Actions
    else if(action==="suspend-society")operation=mutateSociety(`platform/tenants/${id}/approval?approved=false`,"PATCH");
    else if(action==="approve-society")operation=mutateSociety(`platform/tenants/${id}/approval?approved=true`,"PATCH");
    else if(action==="process-privacy")operation=mutateSociety(`superadmin/data/privacy/process-deletion?requestId=${id}`,"POST");
    else if(action==="update-billing-rule")operation=mutateSociety(`superadmin/subscriptions/rules?ruleName=TestRule`,"POST");
    else if(monitoringActions.includes(action)) {
        operation = mutateSociety("superadmin/monitoring/action", "POST", {action: action});
    }
    else operation=Promise.resolve({message:"Success"});
    
    operation.then(result=>{
        if (action === "add-society") showToast(`✓ ${result.societyName || "Society"} added and ready for approval.`);
        if (action === "edit-society") showToast(`✓ ${result.societyName || "Society"} updated.`);
        if (action === "announcement-publish") {
            const panel = button.closest('[data-view="announcements"]');
            const state = panel?.querySelector("#announcementState");
            if (state) { state.textContent = "Published successfully"; state.className = "badge bg-success-subtle text-success-emphasis border border-success-subtle px-3 py-2"; }
            const message = panel?.querySelector("#announcementMessage");
            if (message) message.value = "";
            panel?.querySelector("#announcementEmergency") && (panel.querySelector("#announcementEmergency").checked = false);
            showToast("✓ Announcement published to the selected audience.");
        }
        if (action === "suspend-society") showToast("✓ Society suspended. Platform access has been paused.");
        if (action === "approve-society") showToast("✓ Society approved and activated.");
        if(monitoringActions.includes(action)) {
            const message=result.message || "Platform action completed.";
            showToast("✓ " + message);
            if("Notification" in window && Notification.permission === "granted") new Notification("SmartSociety alert sent", {body: message, icon: "/favicon.svg"});
        }
        return loadSocietyBackendData();
    }).catch(error=>showToast(error.message)).finally(()=>button.disabled=false);
},true);

function persistDashboardState() {
    // Server APIs are authoritative. DOM state is intentionally not persisted.
}

function restoreDashboardState() {
    localStorage.removeItem(dashboardStorageKey);
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
        const shouldHide = view !== selectedView;
        view.classList.toggle("hidden", shouldHide);
        view.classList.toggle("d-none", shouldHide);
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
        const shouldHide = section.dataset.subpanel !== name;
        section.classList.toggle("hidden", shouldHide);
        section.classList.toggle("d-none", shouldHide);
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
    // This queue is a dashboard-wide work area, not a narrow grid tile.
    card.style.cssText = "width:100%;max-width:none;box-sizing:border-box;align-self:stretch;grid-column:1 / -1;";
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
    const panel = anchor.closest("[data-view]");
    if (panel) {
        panel.appendChild(card);
    } else {
        anchor.insertAdjacentElement("afterend", card);
    }
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
            paymentRef: data.status.toLowerCase().includes("paid") ? (data.paymentRef || `SA-${data.flat}-${data.month}`.replace(/\s+/g, "-")) : data.paymentRef,
            paidAt: data.status.toLowerCase().includes("paid") ? (data.paidAt || new Date().toLocaleDateString("en-IN")) : data.paidAt
        });
    });
}

function billingReceiptText(row) {
    const data = billingRowData(row);
    const receiptNo = `SA-${data.flat}-${data.month}-${data.paymentRef || "REC"}`.replace(/\s+/g, "-").toUpperCase();
    return [
        "SmartApartment Maintenance Receipt",
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
    downloadText(`SmartApartment-${data.flat}-${data.month}-receipt.txt`.replace(/\s+/g, "-"), text);
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
    const review = document.getElementById("paymentProofReviewQueue");
    if (!review || review.dataset.rendered) return;
    const proofs = residentPaymentProofs();
    review.dataset.rendered = "true";
    if (!proofs.length) {
        review.innerHTML = `
            <div class="payment-proof-head"><h4>Payment Proof Review</h4><span class="inline-state">0 proofs</span></div>
            <div class="billing-proof-empty"><i class="fa-solid fa-receipt"></i><span>No resident payment proofs are waiting for review.</span></div>`;
        return;
    }
    review.innerHTML = `
        <div class="card-head payment-proof-head">
            <h4>Payment Proof Review</h4>
            <span class="inline-state">${proofs.length} proof${proofs.length === 1 ? "" : "s"}</span>
        </div>
        <table data-table="payment-proofs">
            <thead><tr><th>Resident</th><th>Bill</th><th>Screenshot</th><th>Status</th><th>Admin Review</th></tr></thead>
            <tbody>${proofs.length ? proofs.map(proof => `
                <tr data-proof-id="${escapeAttribute(proof.id)}">
                    <td>${escapeAttribute(proof.resident || "Resident")}<br><small>${escapeAttribute(proof.flat || "")}</small></td>
                    <td>${escapeAttribute(proof.month || "")} ${escapeAttribute(proof.type || "")}<br><small>${escapeAttribute(proof.amount || "")} | ${escapeAttribute(proof.method || "")}</small></td>
                    <td>${proof.proofImage ? `<a href="${proof.proofImage}" target="_blank" rel="noopener"><img src="${proof.proofImage}" alt="Payment screenshot" style="width:72px;height:72px;object-fit:cover;border-radius:8px;border:1px solid rgba(49,127,196,.25);"></a>` : escapeAttribute(proof.proofName || "No screenshot")}<br><small>${escapeAttribute(proof.proofName || "")}</small></td>
                    <td><span class="status ${proof.status === "Approved" ? "paid" : proof.status === "Rejected" ? "open" : "pending"}">${escapeAttribute(proof.status || "Pending Review")}</span><br><small>${escapeAttribute(proof.submittedAt || "")}</small></td>
                    <td><button data-action="approve-payment-proof">Approve Payment</button> <button data-action="reject-payment-proof">Reject Proof</button></td>
                </tr>`).join("") : '<tr><td colspan="5">No resident payment proofs yet</td></tr>'}</tbody>
        </table>`;
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
        "SmartApartment Admin Action Queue",
        `Society: Green Nest Apartments`,
        `Period: ${period}`,
        `Prepared by: ${owner}`,
        `Note: ${note}`,
        `Generated: ${new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`,
        "",
        ...rows.map((row, index) => `${index + 1}. ${row.request} | ${row.module} | ${row.detail} | Status: ${row.status} | Action: ${row.action}`)
    ].join("\n");
    downloadText("SmartApartment-admin-action-queue.txt", text);
    appendDashboardActivity(`Action queue exported for ${period}`);
    return {
        title: "Action queue exported",
        lines: [
            `<strong>Period:</strong> ${period}`,
            `<strong>Prepared by:</strong> ${owner}`,
            `<strong>Items:</strong> ${rows.length}`,
            `<strong>Pending:</strong> ${rows.filter(row => /pending|open|waiting|unpaid/i.test(row.status)).length}`,
            `<strong>File:</strong> SmartApartment-admin-action-queue.txt`
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
    return `upi://pay?pa=smartapartment@upi&pn=SmartApartment&am=${encodeURIComponent(amount)}&cu=INR&tn=${encodeURIComponent(note)}&mode=02&purpose=00&mc=0000&tr=SA${Date.now()}`;
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
        <span class="receipt-line"><strong>Payee:</strong><span>SmartApartment - Flat A-101</span></span>`;
    modal.querySelector("#dashboardActionFields").innerHTML = `
        <div class="payment-qr-panel">
            <img src="${qrUrl}" alt="${methodName} QR code for ${escapeAttribute(bill.amount)}">
            <div>
                <strong>Scan with ${methodName}</strong>
                <span>UPI ID: smartapartment@upi</span>
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
        paymentRef: `SA-A-101-${bill.month}-${Date.now()}`.replace(/\s+/g, "-")
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
            `<strong>UPI:</strong> smartapartment@upi`,
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
    // Do not use Bootstrap's generic .modal class here. Bootstrap hides it until
    // its own controller is invoked, while this dashboard uses a lightweight
    // native dialog controller.
    modal.className = "dashboard-action-dialog hidden";
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
    
    const saveBtn = modal.querySelector("#dashboardActionSave");
    saveBtn.removeEventListener("click", submitActionModal);
    saveBtn.addEventListener("click", submitActionModal);
    return modal;
}

function actionConfig(action, button) {
    const panel = button.closest("[data-view]")?.dataset.view || "overview";
    const context = getContext(button);
    const table = button.dataset.table;
    const label = buttonLabel(button).toLowerCase();
    const queue = dashboardRole === "admin" ? controlQueueRowData(button) : null;
    if (dashboardRole === "admin" && action === "amenity-booking") {
        return ["Add Amenity Booking", "Record who booked the amenity, their flat, required date and time, payment method, and booking charge.", ["Amenity", "Booked by / flat", "Start date & time", "End date & time", "Payment method|select:ONLINE,CASH", "Payment reference (optional)"]];
    }
    if (dashboardRole === "admin" && action === "amenity-price-edit") {
        return ["Edit Amenity Price", `Update the price and approval setting for ${button.dataset.amenityName || "this amenity"}.`, ["Amenity name", "Capacity|number", "Booking price (Rs.)|number", "Approval required|select:Yes,No"]];
    }
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
    if (dashboardRole === "maintenance" && action === "service-log") {
        const row = button.closest("tr");
        const asset = row?.children[0]?.textContent.trim() || "Asset";
        return ["Log Preventive Service", `Record the inspection, readings and service outcome for ${asset}.`, ["Service date|date", "Technician / vendor", "Service type|select:Inspection,Preventive service,Repair", "Meter or runtime reading", "Parts used", "Condition after service|select:Operational,Needs follow-up,Out of service", "Next service date|date", "Work notes"]];
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
            flats: ["Flat", "Owner", "Occupancy", "Block", "Floor", "Unit Type"],
            residents: ["Name", "Flat", "Role", "Email", "Temporary Password"],
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
        return ["Add Flat", "Create a live flat record with ownership, block and occupancy details.", ["Flat number", "Owner name", "Occupancy|select:VACANT,OCCUPIED,UNDER_MAINTENANCE", "Block", "Floor|number", "Unit type|select:1BHK,2BHK,3BHK,PENTHOUSE"]];
    }
    if (action === "add" && table === "residents") {
        return ["Invite Resident", "Invite a resident and connect them to a flat.", ["Resident name", "Flat / unit", "Owner or tenant", "Mobile / email"]];
    }
    if (action === "add" && table === "complaints") {
        if (dashboardRole === "resident") {
            return ["Raise Complaint", "Send a detailed complaint to the society admin and maintenance team.", ["Issue", "Category", "Location / flat", "Urgency", "Description"]];
        }
        return ["Create Complaint", "Create a tracked ticket with the right category, priority, and details for the maintenance team.", ["Issue", "Flat / unit", "Category|select:Plumbing,Electrical,Security,Cleaning,Other", "Priority|select:LOW,NORMAL,HIGH,URGENT", "Description|textarea"]];
    }
    if (action === "add" && table === "expenses") {
        return ["Add Expense", "Record an expense for approval.", ["Expense title", "Vendor", "Amount"]];
    }
    if (action === "update-plan") {
        const plan = button.dataset.plan || context.target || "Selected plan";
        return [`Subscribe to ${plan}`, "Confirm the society and billing details for this subscription.", ["Society name", "Admin email", "Billing cycle", "Start date", "Subscription note"]];
    }
    if (action === "edit-plan") {
        const plan = button.dataset.plan || context.target || "Subscription plan";
        return [`Edit ${plan}`, "Update the features and pricing for this subscription plan.", ["Plan Name", "Price|number", "Limit Flats|number", "Limit Admins|number"]];
    }
    if (dashboardRole === "superadmin" && action === "notify" && label.toLowerCase().includes("platform notice")) {
        return ["Send Platform Notice", "Send an official notice to society administrators.", ["Target|select:All Registered Societies,Specific Society", "Message|textarea"]];
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
        generate: ["Generate Detailed Monthly Bills", "Create itemized maintenance bills per flat with base rates, water meters, sinking funds, reserve funds, parking fees, and GST tax breakdowns.", ["Billing month", "Base rate (per sq.ft)", "Water sub-meter rate (per unit)", "Common power backup fee", "Sinking fund contribution", "Building repair reserve", "Covered parking fee", "GST tax rate (%)", "Payment due date"]],
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
    return configs[action] || [`Action: ${action}`, `Proceed with the ${action} action?`, []];
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
    const tableName = button.closest("table")?.dataset.table || "";
    const row = button.closest("tr");
    const existingValues = action === "amenity-price-edit"
        ? [button.dataset.amenityName || "", button.dataset.amenityCapacity || "", button.dataset.amenityPrice || "0", button.dataset.amenityApproval || "Yes"]
        : action === "save" && buttonLabel(button).toLowerCase().includes("edit")
        ? (tableName === "flats" && row ? [row.children[0]?.textContent.trim() || "", row.children[1]?.textContent.trim() || "", row.querySelector(".status")?.textContent.trim() || "VACANT", row.dataset.block || row.children[2]?.textContent.trim() || "Block A", row.dataset.floor || row.children[3]?.textContent.trim() || "0", row.dataset.unitType || row.children[4]?.textContent.trim() || "2BHK"] : rowValues(button))
        : [];
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
    let labelText = field;
    let inputHtml = `<input data-action-input="${index}" placeholder="${field}" value="${escapeAttribute(value)}">`;

    if (action === "amenity-booking" && index === 0) {
        const options = (window.societyAmenities || []).map(amenity => `<option value="${escapeAttribute(amenity.id)}">${escapeAttribute(amenity.name)} · Rs. ${escapeAttribute(amenity.bookingFee ?? 0)}</option>`).join("");
        inputHtml = `<select data-action-input="${index}"><option value="">Select amenity</option>${options}</select>`;
    } else if (action === "amenity-booking" && index === 1) {
        const options = (window.societyResidents || []).map(resident => `<option value="${escapeAttribute(resident.id)}">${escapeAttribute(resident.name)} — Flat ${escapeAttribute(resident.unitNo)}</option>`).join("");
        inputHtml = `<select data-action-input="${index}"><option value="">Select resident and flat</option>${options}</select>`;
    } else if (action === "amenity-booking" && (index === 2 || index === 3)) {
        const when = new Date(Date.now() + (index === 2 ? 86400000 : 90000000));
        when.setMinutes(0, 0, 0);
        inputHtml = `<input type="datetime-local" data-action-input="${index}" value="${escapeAttribute(value || when.toISOString().slice(0, 16))}">`;
    } else if (field.includes("|")) {
        const parts = field.split("|");
        labelText = parts[0];
        const typeInfo = parts[1];
        if (typeInfo.startsWith("select:")) {
            const options = typeInfo.substring(7).split(",").map(opt => `<option value="${escapeAttribute(opt)}">${escapeAttribute(opt)}</option>`).join("");
            inputHtml = `<select data-action-input="${index}">${options}</select>`;
        } else if (typeInfo === "textarea") {
            inputHtml = `<textarea data-action-input="${index}" placeholder="${labelText}">${escapeAttribute(value)}</textarea>`;
        } else {
            inputHtml = `<input type="${typeInfo}" data-action-input="${index}" placeholder="${labelText}" value="${escapeAttribute(value)}">`;
        }
    } else if (action === "generate") {
        const defaults = [
            currentMonthName(), "1.35", "3.50", "253.00", "150.00", "100.00", "100.00", "18", "15-Aug-2026"
        ];
        const val = value || defaults[index] || "";
        inputHtml = `<input data-action-input="${index}" value="${escapeAttribute(val)}">`;
    } else if (action === "add" && field.toLowerCase().includes("expected time")) {
        const defaultTime = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16);
        inputHtml = `<input type="datetime-local" data-action-input="${index}" value="${escapeAttribute(value || defaultTime)}">`;
    }

    return `<label>${labelText}${inputHtml}</label>`;
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

    if (dashboardRole === "admin" && action === "amenity-booking") {
        const [amenityId, residentId, startTime, endTime, paymentMethod, paymentReference] = values;
        if (!amenityId || !residentId || !startTime || !endTime || !paymentMethod) return { title: "Booking details required", lines: ["Select the amenity and resident, then enter the requested date, time and payment method."] };
        mutateSociety("society/bookings/admin", "POST", { amenityId: Number(amenityId), residentId: Number(residentId), startTime, endTime, paymentMethod, paymentReference: paymentReference || "" })
            .then(() => { loadSocietyBackendData(); showToast("Amenity booking recorded"); })
            .catch(error => showToast(error.message || "Amenity booking could not be recorded"));
        return { title: "Amenity booking recorded", lines: ["The booking has been added with its resident, flat, payment method and current amenity price."] };
    }

    if (dashboardRole === "admin" && action === "amenity-price-edit") {
        const [name, capacity, bookingFee, approvalRequired] = values;
        if (!name || !capacity || bookingFee === "") return { title: "Amenity details required", lines: ["Enter the amenity name, capacity and booking price."] };
        mutateSociety(`society/amenities/${button.dataset.amenityId}`, "PATCH", { name, capacity: Number(capacity), bookingFee: Number(bookingFee), approvalRequired: approvalRequired === "Yes" })
            .then(() => { loadSocietyBackendData(); showToast("Amenity price updated"); })
            .catch(error => showToast(error.message || "Amenity price could not be updated"));
        return { title: "Amenity price updated", lines: [`<strong>${name}</strong> is now Rs. ${bookingFee} per booking.`] };
    }

    if (dashboardRole === "admin" && action === "save" && button.closest('table[data-table="flats"]')) {
        const row = button.closest("tr");
        const payload = { unitNo: values[0] || row?.children[0]?.textContent.trim(), ownerName: values[1] || row?.children[1]?.textContent.trim(), occupancy: values[2] || row?.querySelector(".status")?.textContent.trim() || "VACANT", block: values[3] || row?.dataset.block || "Block A", floor: Number(values[4] || row?.dataset.floor || 0), unitType: values[5] || row?.dataset.unitType || row?.children[2]?.textContent.trim() || "2BHK" };
        if (!payload.unitNo || !payload.ownerName) return { title: "Flat details required", lines: ["Enter a flat number and owner name before saving."] };
        if (row?.dataset.recordId) mutateSociety(`society/apartments/${row.dataset.recordId}`, "PATCH", payload).then(() => loadSocietyBackendData()).catch(error => showToast(error.message || "Flat could not be updated"));
        if (row) { row.children[0].textContent = payload.unitNo; row.children[1].textContent = payload.ownerName; row.children[2].textContent = payload.block; row.children[3].textContent = payload.floor; row.children[4].textContent = payload.unitType; row.dataset.block = payload.block; row.dataset.floor = payload.floor; row.dataset.unitType = payload.unitType; setStatus(button, payload.occupancy, "active"); }
        appendDashboardActivity(`Flat updated: ${payload.unitNo}`);
        persistDashboardState();
        return { title: "Flat updated", lines: [`<strong>Flat:</strong> ${payload.unitNo}`, `<strong>Owner:</strong> ${payload.ownerName}`, `<strong>Block:</strong> ${payload.block} · Floor ${payload.floor}`, `<strong>Type:</strong> ${payload.unitType}`, `<strong>Occupancy:</strong> ${payload.occupancy}`] };
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
    if (dashboardRole === "maintenance" && action === "service-log") {
        const row = button.closest("tr");
        const asset = row?.children[0]?.textContent.trim() || "Asset";
        const serviceDate = values[0] || new Date().toLocaleDateString("en-CA");
        const technician = values[1] || "Maintenance team";
        const serviceType = values[2] || "Preventive service";
        const condition = values[5] || "Operational";
        const nextService = values[6] || row?.children[4]?.textContent.trim() || "To be scheduled";
        if (row?.children[3]) row.children[3].textContent = serviceDate;
        if (row?.children[4]) row.children[4].innerHTML = `<strong class="${condition === "Operational" ? "text-success" : "text-warning"}">${escapeAttribute(nextService)}</strong>`;
        updateRowAction(button, "Service logged", "service-log", true);
        appendDashboardActivity(`${serviceType} logged for ${asset} by ${technician}; condition: ${condition}`);
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
            "SmartApartment Subscription Ledger",
            `Generated: ${now}`,
            `Section: ${context.panelTitle}`,
            "",
            ...rows
        ].join("\n");
        downloadText("SmartApartment-subscription-ledger.txt", text);
        appendPlatformActivity("Subscription ledger exported");
        return {
            title: "Subscription ledger exported",
            lines: [
                `<strong>Rows:</strong> ${rows.length}`,
                `<strong>File:</strong> SmartApartment-subscription-ledger.txt`,
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
        downloadText("SmartApartment-invoice-dry-run.txt", [
            "SmartApartment Invoice Dry Run",
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
                `<strong>File:</strong> SmartApartment-invoice-dry-run.txt`
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
            const ref = values[1] || `SA-${data.flat}-${data.month}`.replace(/\s+/g, "-");
            const proof = values[3] || "Admin verified";
            if (row?.dataset.recordId) {
                mutateSociety(`society/finance/bills/${row.dataset.recordId}/pay`, "POST", {
                    mode: method,
                    transactionId: ref
                }).then(() => loadSocietyBackendData()).catch(error => showToast(error.message || "Payment could not be recorded"));
            }
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
        downloadText("smartapartment-billing-receipt.txt", `SmartApartment Billing Receipt\n${context.detail}\nGenerated: ${now}`);
    }
    if (action === "save" && label.includes("edit")) {
        updateRowFromValues(button, values);
    }
    if (action === "notify" && label.includes("receipt")) {
        downloadText("smartapartment-receipt.txt", `SmartApartment Receipt\n${context.detail}\nGenerated: ${now}`);
    }
    if (action === "notify" && label.includes("export")) {
        downloadText("smartapartment-report.txt", `SmartApartment Report\nSection: ${context.panelTitle}\nTarget: ${context.target}\nGenerated: ${now}`);
    }
    if (action === "notify" && label.includes("publish")) {
        setInlineState("announcementState", `Published ${now}${note ? ` · ${note}` : ""}`);
    }
    if (action === "save" && label.includes("sync")) syncSocietyWorkspace(note);
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
        const society = values[0] || "Current society";
        const adminEmail = values[1] || "Existing admin";
        const billingCycle = values[2] || "Monthly";
        const startDate = values[3] || "Immediate";
        const subscriptionNote = values[4] || "Subscription confirmed";
        if (status) {
            status.textContent = "Selected";
            status.className = "status approved";
        }
        updateRowAction(button, "Subscribed", "update-plan");
        appendPlatformActivity(`Subscription confirmed: ${society} selected ${plan} (${billingCycle})`);
        if (dashboardRole === "superadmin") {
            persistDashboardState();
            return {
                title: "Subscription confirmed",
                lines: [
                    `<strong>Plan:</strong> ${plan}`,
                    `<strong>Society:</strong> ${society}`,
                    `<strong>Admin:</strong> ${adminEmail}`,
                    `<strong>Billing cycle:</strong> ${billingCycle}`,
                    `<strong>Starts:</strong> ${startDate}`,
                    `<strong>Note:</strong> ${subscriptionNote}`
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
            mutateSociety("society/complaints","POST",{title:values[0]||"Resident complaint",category:values[1]||"General",priority:values[3]||"NORMAL",description:values[4]||values[2]||"No extra details"})
                .then(()=>loadSocietyBackendData()).catch(error=>showToast(error.message));
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
            if(table==="expenses")mutateSociety("society/finance/expenses","POST",{category:values[0]||"General",vendor:values[1]||"Vendor",amount:Math.max(1,moneyNumber(values[2]||"1")),date:new Date().toISOString().slice(0,10)}).then(()=>loadSocietyBackendData()).catch(e=>showToast(e.message));
            if(table==="flats")mutateSociety("society/apartments","POST",{unitNo:values[0],ownerName:values[1],occupancy:values[2]||"VACANT",block:values[3]||"Block A",floor:Number(values[4]||0),unitType:values[5]||"2BHK"}).then(()=>loadSocietyBackendData()).catch(e=>showToast(e.message));
            if(table==="residents")mutateSociety("society/residents","POST",{name:values[0],unitNo:values[1],residentType:values[2]||"TENANT",email:values[3],temporaryPassword:values[4]}).then(()=>loadSocietyBackendData()).catch(e=>showToast(e.message));
            if(table==="visitors"||table==="complaints")fetch("/api/society/residents").then(r=>r.json()).then(list=>{const resident=list.find(x=>x.unitNo===(values[1]||""))||list[0];if(!resident)throw new Error("Add a resident before creating this record");return table==="visitors"?mutateSociety("society/visitors","POST",{name:values[0]||"Visitor",phone:"0000000000",purpose:values[2]||"Guest",expectedAt:(values[3]||new Date(Date.now()+3600000).toISOString().slice(0,19)),residentId:resident.id}):mutateSociety("society/complaints","POST",{title:values[0]||"Complaint",category:values[2]||"General",priority:values[3]||"NORMAL",description:values[4]||"Created by society administrator",residentId:resident.id});}).then(()=>loadSocietyBackendData()).catch(e=>showToast(e.message));
        }
    }
    if (action === "generate") {
        const month = values[0] || "Current Month";
        const baseRate = values[1] || "1.35";
        const waterRate = values[2] || "3.50";
        const powerFee = values[3] || "253.00";
        const sinkingFee = values[4] || "150.00";
        const repairFee = values[5] || "100.00";
        const parkingFee = values[6] || "100.00";
        const gstRate = values[7] || "18";
        const dueDate = values[8] || "15-Aug-2026";
        const amount = "Rs. 3,600";
        if (["admin", "accountant"].includes(dashboardRole)) {
            const backendAmount = 3600;
            fetch(`/api/billing/generate?amount=${encodeURIComponent(backendAmount)}`, {method:"POST", headers:{Accept:"application/json"}})
                .then(response => response.ok ? response.json() : response.json().then(error => Promise.reject(error)))
                .then(() => loadSocietyBackendData())
                .catch(error => showToast(error.message || "Unable to generate bills"));
            const result = generateMonthlyBillingRows({ month, amount, dueDate, note: `Base:${baseRate}|Water:${waterRate}|GST:${gstRate}%` });
            persistDashboardState();
            return {
                title: "Itemized monthly bills generated",
                lines: [
                    `<strong>Month:</strong> ${month}`,
                    `<strong>Base Rate:</strong> Rs. ${baseRate} / sq.ft`,
                    `<strong>Water Sub-meter:</strong> Rs. ${waterRate} / unit`,
                    `<strong>Power & DG:</strong> Rs. ${powerFee}`,
                    `<strong>Sinking Fund:</strong> Rs. ${sinkingFee}`,
                    `<strong>Repair Fund:</strong> Rs. ${repairFee}`,
                    `<strong>Covered Parking:</strong> Rs. ${parkingFee}`,
                    `<strong>GST Rate:</strong> ${gstRate}%`,
                    `<strong>Due Date:</strong> ${dueDate}`
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

document.addEventListener("click", event => {
    const btn = event.target.closest('[data-action="edit-plan-modal"]');
    if (!btn) return;
    const modal = document.getElementById("editPlanModal");
    if (!modal) return;
    document.getElementById("editPlanId").value = btn.dataset.planId || "1";
    document.getElementById("editPlanName").value = btn.dataset.planName || "";
    document.getElementById("editPlanPrice").value = btn.dataset.planPrice || "0";
    document.getElementById("editPlanMaxFlats").value = btn.dataset.planFlats || "50";
    document.getElementById("editPlanMaxResidents").value = btn.dataset.planResidents || "150";
    modal.classList.remove("hidden");
});

document.getElementById("closeEditPlanModal")?.addEventListener("click", () => {
    document.getElementById("editPlanModal")?.classList.add("hidden");
});

document.getElementById("savePlanBtn")?.addEventListener("click", async () => {
    const id = document.getElementById("editPlanId").value;
    const name = document.getElementById("editPlanName").value;
    const monthlyPrice = Number(document.getElementById("editPlanPrice").value);
    const maxApartments = Number(document.getElementById("editPlanMaxFlats").value);
    const maxResidents = Number(document.getElementById("editPlanMaxResidents").value);
    const visitorManagement = document.getElementById("editPlanVisitors").checked;
    const amenityBooking = document.getElementById("editPlanAmenities").checked;
    const analytics = document.getElementById("editPlanAnalytics").checked;

    try {
        const response = await fetch(`/api/platform/plans/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name, monthlyPrice, maxApartments, maxResidents,
                visitorManagement, amenityBooking, analytics
            })
        });
        if (!response.ok) throw new Error("Failed to save plan changes");
        showToast(`Plan ${name} updated successfully!`);
        document.getElementById("editPlanModal")?.classList.add("hidden");
        if (typeof loadPlatformBackendData === "function") loadPlatformBackendData();
    } catch (err) {
        showToast(err.message || "Error updating plan");
    }
});

const initialPanel = location.hash.replace("#", "");
openPanel(document.querySelector(`[data-view="${initialPanel}"]`) ? initialPanel : "overview", false);
animateStats();

document.addEventListener("DOMContentLoaded", () => {
    if (dashboardRole === "superadmin") {
        fetch('/api/platform/overview')
            .then(res => res.json())
            .then(data => {
                const el1 = document.getElementById("overviewActiveSocieties");
                if (el1) el1.textContent = data.activeSocieties || 0;
                
                const el2 = document.getElementById("overviewMonthlyRevenue");
                if (el2) el2.textContent = 'Rs. ' + (data.monthlyRevenue || 0).toLocaleString();
                
                const el3 = document.getElementById("overviewTrialAccounts");
                if (el3) el3.textContent = data.trialAccounts || 0;
                
                const el4 = document.getElementById("overviewOpenTickets");
                if (el4) el4.textContent = data.openTickets || 0;
            })
            .catch(err => console.error("Error fetching overview stats:", err));
    }

    const btnSendPlatformNotice = document.getElementById("btnSendPlatformNotice");
    if (btnSendPlatformNotice && !btnSendPlatformNotice.dataset.bound) {
        btnSendPlatformNotice.dataset.bound = "true";
        btnSendPlatformNotice.addEventListener("click", async () => {
            const target = document.getElementById("noticeTarget")?.value || "";
            const specificSocietyId = document.getElementById("specificSociety")?.value || "";
            const title = document.getElementById("noticeTitle")?.value || "";
            const category = document.getElementById("noticeCategory")?.value || "General Announcement";
            const priority = document.getElementById("noticePriority")?.value || "NORMAL";
            const message = document.getElementById("noticeMessage")?.value || "";
            
            if (target === "Specific Society" && !specificSocietyId) {
                showToast("Please select a specific target society");
                return;
            }

            if (!message.trim()) {
                showToast("Message content is required");
                return;
            }
            
            try {
                btnSendPlatformNotice.disabled = true;
                const response = await fetch('/api/superadmin/notices', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        target, 
                        specificSocietyId, 
                        title, 
                        message, 
                        category, 
                        priority 
                    })
                });
                
                if (!response.ok) throw new Error("Failed to send notice");
                
                showToast("Platform notice sent successfully!");
                const form = document.getElementById("platformNoticeForm");
                if (form) form.reset();
                const specDiv = document.getElementById("specificSocietyDiv");
                if (specDiv) specDiv.classList.add("d-none");
                
                const modalEl = document.getElementById('platformNoticeModal');
                if (modalEl && typeof bootstrap !== "undefined") {
                    const modal = bootstrap.Modal.getInstance(modalEl);
                    if (modal) modal.hide();
                }
            } catch (err) {
                showToast(err.message || "Error sending notice");
            } finally {
                btnSendPlatformNotice.disabled = false;
            }
        });
    }
});
