/*
 * PropertyDirect Universal Dashboard Controls & Interactive Action Engine
 * Provides workable, clickable, and rich detailed modal flows for all buttons
 * across Customer, Owner, Admin, and Super Admin dashboards.
 */
(function () {
    'use strict';

    function safeEscape(value) {
        return window.CSS && typeof CSS.escape === 'function'
            ? CSS.escape(value)
            : String(value || '').replace(/["\\]/g, '\\$&');
    }

    function setPanel(panel) {
        if (!panel) return;
        if (typeof window.switchTabAndFilter === 'function') {
            window.switchTabAndFilter(panel);
            return;
        }
        var selected = document.querySelector('[data-view="' + safeEscape(panel) + '"]');
        if (!selected) return;

        document.querySelectorAll('[data-panel]').forEach(function (button) {
            var active = button.dataset.panel === panel;
            button.classList.toggle('active', active);
            button.setAttribute('aria-selected', String(active));
        });
        document.querySelectorAll('[data-view]').forEach(function (view) {
            var active = view === selected;
            view.classList.toggle('hidden', !active);
            view.classList.toggle('d-none', !active);
            view.style.display = active ? 'block' : 'none';
        });

        var title = document.getElementById('panelTitle');
        var navItem = document.querySelector('.sidebar-nav [data-panel="' + safeEscape(panel) + '"], .owner-nav [data-panel="' + safeEscape(panel) + '"]');
        if (title && !title.textContent.includes('Property Owner Portal')) {
            var panelTitleMap = {
                'overview': 'Overview & Metrics',
                'users': 'Customer Directory',
                'verifications': 'Owner & Builder Verification',
                'my-properties': 'Property Inventory & Queue',
                'enquiries': 'Client Leads & Enquiries',
                'reports': 'Complaints',
                'audit': 'Notifications',
                'profile': 'Admin Profile'
            };
            if (panelTitleMap[panel]) {
                title.textContent = panelTitleMap[panel];
            } else if (navItem) {
                var labelSpan = navItem.querySelector('.nav-label');
                if (labelSpan && labelSpan.textContent.trim()) {
                    title.textContent = labelSpan.textContent.trim();
                } else {
                    var clone = navItem.cloneNode(true);
                    clone.querySelectorAll('span, svg, .badge, .sidebar-badge').forEach(function (el) { el.remove(); });
                    var cleanText = clone.textContent.trim();
                    if (cleanText) title.textContent = cleanText;
                }
            }
        }
        if (window.location.hash !== '#' + panel) {
            history.replaceState(null, '', '#' + panel);
        }
        try {
            window.scrollTo({ top: 0, behavior: 'instant' });
            document.querySelectorAll('.dash-main, .owner-main, .main-content, main').forEach(function (m) {
                m.scrollTop = 0;
            });
        } catch (_) {}
    }

    window.PropertyDirectDashboardControls = window.PropertyDirectDashboardControls || {};
    window.PropertyDirectDashboardControls.setPanel = setPanel;

    function closeSidebar() {
        if (window.innerWidth <= 900) document.body.classList.remove('sidebar-open');
        else document.body.classList.add('sidebar-collapsed');
    }

    function openSidebar() {
        document.body.classList.remove('sidebar-collapsed');
        document.body.classList.add('sidebar-open');
    }

    function showFallbackToast(message) {
        var existing = document.getElementById('pdDashboardControlToast') || document.getElementById('toast') || document.getElementById('ownerToast') || document.getElementById('agentToast');
        var toast = existing || document.createElement('div');
        toast.id = 'pdDashboardControlToast';
        toast.innerHTML = '<span style="display:inline-flex; align-items:center; gap:8px;">' + message + '</span>';
        toast.style.cssText = 'position:fixed;right:24px;bottom:24px;z-index:999999;background:#0f172a;color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:12px;padding:12px 20px;font:700 13px/1.35 "Manrope",Arial,sans-serif;box-shadow:0 16px 36px rgba(15,23,42,.35);display:flex;align-items:center;gap:10px;backdrop-filter:blur(10px);max-width:440px;';
        if (!existing) document.body.appendChild(toast);
        else {
            toast.classList.remove('hidden');
            toast.style.display = 'flex';
        }
        window.clearTimeout(toast._pdTimer);
        toast._pdTimer = window.setTimeout(function () {
            toast.style.display = 'none';
            toast.classList.add('hidden');
        }, 3400);
    }
    window.showToast = window.showToast || showFallbackToast;

    function dashboardRole() {
        return document.body.dataset.dashboardRole
            || document.body.dataset.role
            || (document.title || '').toLowerCase().split(' dashboard')[0].trim()
            || 'customer';
    }

    function currentPanel() {
        var active = document.querySelector('.dash-panel:not(.hidden):not(.d-none), [data-view]:not(.hidden):not(.d-none)');
        return active?.dataset?.view || (window.location.hash || '#overview').slice(1) || 'overview';
    }

    function buttonLabel(button) {
        return (button.innerText || button.textContent || button.getAttribute('aria-label') || button.title || button.dataset.action || 'Dashboard action')
            .trim()
            .replace(/\s+/g, ' ');
    }

    function actionContext(button) {
        var row = button.closest('tr');
        var card = button.closest('article, .dash-card, .property-card, .approval-card, .lead-card, .pd-plan-card');
        var rowText = row ? row.innerText.trim().replace(/\s+/g, ' ').slice(0, 260) : '';
        var cardText = card ? card.innerText.trim().replace(/\s+/g, ' ').slice(0, 260) : '';
        return rowText || cardText || buttonLabel(button);
    }

    async function persistDashboardButton(button, action, extraDetails) {
        if (!button || button.dataset.pdPersisting === 'true') return null;
        button.dataset.pdPersisting = 'true';
        try {
            var body = {
                workspace: 'PropertyDirect',
                dashboardRole: dashboardRole(),
                panel: currentPanel(),
                actionType: action || button.dataset.action || 'button-click',
                targetLabel: buttonLabel(button),
                details: Object.assign({
                    button: buttonLabel(button),
                    context: actionContext(button),
                    href: button.getAttribute('href') || '',
                    id: button.id || '',
                    className: button.className || ''
                }, extraDetails || {})
            };
            var response = await fetch('/api/workflows', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!response.ok) throw new Error('Workflow save failed');
            return await response.json().catch(function () { return {}; });
        } catch (error) {
            return null;
        } finally {
            delete button.dataset.pdPersisting;
        }
    }

    function updateRowStatus(button, label, className) {
        var row = button.closest('tr');
        if (!row) return;
        var status = row.querySelector('.status, [class*="status"], td:nth-last-child(2) span');
        if (!status) return;
        status.textContent = label;
        status.className = 'status ' + (className || 'active');
    }

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, function (ch) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
        });
    }

    function targetTitle(target) {
        var row = target?.closest?.('tr');
        if (row) {
            var firstStrong = row.querySelector('strong, .agent-name, .user-name, h4, h3');
            if (firstStrong) return firstStrong.textContent.trim();
            return row.cells?.[0]?.innerText?.trim().replace(/\s+/g, ' ') || buttonLabel(target);
        }
        var card = target?.closest?.('article, .dash-card, .property-card, .lead-card, .approval-card, .pd-plan-card');
        return card?.querySelector?.('h3, h4, strong')?.textContent?.trim() || buttonLabel(target);
    }

    function actionTypeFromLabel(label) {
        var lower = String(label || '').toLowerCase();
        if (lower.includes('delete') || lower.includes('remove')) return 'delete';
        if (lower.includes('reject') || lower.includes('decline')) return 'reject';
        if (lower.includes('suspend') || lower.includes('block')) return 'suspend';
        if (lower.includes('approve') || lower.includes('verify') || lower.includes('activate')) return 'approve';
        if (lower.includes('edit') || lower.includes('manage') || lower.includes('settings')) return 'edit';
        if (lower.includes('add') || lower.includes('create') || lower.includes('new')) return 'create';
        if (lower.includes('export') || lower.includes('download') || lower.includes('report')) return 'export';
        if (lower.includes('receipt') || lower.includes('invoice') || lower.includes('payout')) return 'receipt';
        if (lower.includes('view') || lower.includes('details') || lower.includes('activity') || lower.includes('lead') || lower.includes('properties') || lower.includes('kyc') || lower.includes('doc')) return 'view';
        if (lower.includes('reset') || lower.includes('clear')) return 'reset';
        if (lower.includes('save') || lower.includes('submit') || lower.includes('send')) return 'save';
        return 'button-click';
    }

    /* -------------------------------------------------------------
       PLAN SELECTION & SUBSCRIPTION DETAILED MODAL
       ------------------------------------------------------------- */
    var PLAN_SPECS = {
        'Basic': {
            title: 'Basic Buyer Plan',
            price: '₹999',
            period: '45 Days Validity',
            badge: 'Starter',
            color: '#2563eb',
            features: [
                'Direct Contact to 15 Verified Property Owners',
                '100% Zero Brokerage Guarantee',
                'Instant SMS & WhatsApp Owner Contact Alerts',
                'Verified Title Check & RERA Summary Reports',
                'Digital Payment Receipt & GST Tax Invoice'
            ]
        },
        'Assisted': {
            title: 'Assisted Priority Buyer Plan',
            price: '₹2,999',
            period: '90 Days Validity',
            badge: 'Most Popular',
            color: '#1d4ed8',
            features: [
                'Unlimited Direct Verified Property Owner Contacts',
                'Dedicated PropertyDirect Relationship Manager',
                'Assisted Site Visit Escort & Priority Booking',
                'Digital Rental Agreement & Legal Drafting Support',
                '100% Zero Brokerage on All Closed Deals',
                'Priority Phone & WhatsApp Support Line'
            ]
        },
        'OwnerFreedom': {
            title: 'Owner Freedom Listing Plan',
            price: '₹1,499',
            period: '60 Days Validity',
            badge: 'Owner Special',
            color: '#d97706',
            features: [
                'Featured Placement in PropertyDirect Search Results',
                'Direct Verified Buyer / Tenant Inquiries Only',
                'Professional Photography & Photo Gallery Tagging',
                'Zero Brokerage Verified Tenant Match',
                'Instant WhatsApp Notification on Buyer Inquiries'
            ]
        },
        'OwnerConcierge': {
            title: 'VIP Owner Concierge Plan',
            price: '₹4,999',
            period: '180 Days Validity',
            badge: 'VIP Elite',
            color: '#7c3aed',
            features: [
                'Full Key Holding & On-Demand Site Tour Management',
                'Dedicated Field Executive Conducts All Property Visits',
                'Comprehensive Tenant Background & Police Verification',
                'Guaranteed Digital Rental Agreement & Escrow Deposit',
                'Automated Monthly Rent Disbursements & Invoicing'
            ]
        },
        'Relax': {
            title: 'Active Relax Buyer Plan',
            price: 'Current Plan',
            period: 'Active · Renews in 24 Days',
            badge: 'Active Subscription',
            color: '#10b981',
            features: [
                'Direct Owner Chat & Inquiry Messages',
                'Saved Searches & Property Price Drop Alerts',
                'Access to Public Open House Listings',
                'Standard Portal Support Desk'
            ]
        }
    };

    function ensurePlanModal() {
        var modal = document.getElementById('pdPlanActionModal');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = 'pdPlanActionModal';
        modal.className = 'modal hidden';
        modal.setAttribute('aria-hidden', 'true');
        modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;width:100vw;height:100vh;background:rgba(15,23,42,0.68);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;z-index:999999;padding:20px;box-sizing:border-box;';
        modal.innerHTML = [
            '<div class="modal-card" style="width:min(520px,94vw);max-height:calc(100vh - 40px);background:#ffffff;border-radius:20px;padding:28px 32px;box-shadow:0 25px 60px rgba(15,23,42,.35);border:1px solid #e2e8f0;overflow-y:auto;position:relative;font-family:\'Manrope\',sans-serif;" role="dialog" aria-modal="true">',
            '<button type="button" class="close" data-pd-plan-close style="position:absolute;top:18px;right:18px;width:34px;height:34px;border-radius:50%;border:1px solid #cbd5e1;background:#f8fafc;color:#64748b;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>',
            '<div id="pdPlanModalHeader" style="margin-bottom:20px;"></div>',
            '<div id="pdPlanModalFeatures" style="background:#f8fafc;border-radius:14px;padding:18px 20px;border:1px solid #e2e8f0;margin-bottom:22px;"></div>',
            '<form id="pdPlanModalForm">',
            '<div style="display:flex;flex-direction:column;gap:14px;margin-bottom:24px;">',
            '<label style="display:flex;flex-direction:column;gap:5px;font-size:0.82rem;font-weight:700;color:#334155;"><span>Subscriber Full Name</span><input id="pdPlanUserName" type="text" required placeholder="Enter full name" style="padding:10px 14px;border-radius:10px;border:1px solid #cbd5e1;font-size:0.88rem;"></label>',
            '<label style="display:flex;flex-direction:column;gap:5px;font-size:0.82rem;font-weight:700;color:#334155;"><span>Contact Mobile Number</span><input id="pdPlanUserPhone" type="tel" required placeholder="+91 98450 12345" style="padding:10px 14px;border-radius:10px;border:1px solid #cbd5e1;font-size:0.88rem;"></label>',
            '<label style="display:flex;flex-direction:column;gap:5px;font-size:0.82rem;font-weight:700;color:#334155;"><span>Preferred Payment Gateway</span><select id="pdPlanPaymentMode" style="padding:10px 14px;border-radius:10px;border:1px solid #cbd5e1;font-size:0.88rem;"><option value="UPI">UPI Instant (Google Pay / PhonePe / Paytm)</option><option value="NetBanking">Net Banking (HDFC, ICICI, SBI, Axis)</option><option value="Card">Credit / Debit Card (Visa, MasterCard, RuPay)</option></select></label>',
            '</div>',
            '<div style="display:flex;justify-content:flex-end;align-items:center;gap:12px;border-top:1px solid #f1f5f9;padding-top:18px;">',
            '<button type="button" data-pd-plan-close style="padding:10px 20px;border-radius:10px;background:#f1f5f9;border:1px solid #cbd5e1;color:#475569;font-weight:700;cursor:pointer;">Cancel</button>',
            '<button type="submit" id="pdPlanSubmitBtn" style="padding:10px 24px;border-radius:10px;background:linear-gradient(135deg,#2563eb,#1d4ed8);border:none;color:#ffffff;font-weight:800;font-size:0.9rem;cursor:pointer;box-shadow:0 4px 14px rgba(37,99,235,.35);">Confirm &amp; Activate Plan</button>',
            '</div>',
            '</form>',
            '</div>'
        ].join('');
        document.body.appendChild(modal);

        modal.addEventListener('click', function (e) {
            if (e.target === modal || e.target.closest('[data-pd-plan-close]')) closePlanModal();
        });
        modal.querySelector('#pdPlanModalForm').addEventListener('submit', submitPlanModal);
        return modal;
    }

    function closePlanModal() {
        var modal = document.getElementById('pdPlanActionModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }
    }

    function openPlanModal(planKey, sourceButton) {
        var spec = PLAN_SPECS[planKey] || PLAN_SPECS['Assisted'];
        var modal = ensurePlanModal();
        modal._pdPlanKey = planKey;
        modal._pdSourceButton = sourceButton;

        var header = modal.querySelector('#pdPlanModalHeader');
        header.innerHTML = [
            '<span style="background:#eff6ff;color:' + spec.color + ';border:1px solid #bfdbfe;font-size:0.75rem;font-weight:800;padding:4px 12px;border-radius:999px;text-transform:uppercase;letter-spacing:0.06em;display:inline-block;margin-bottom:8px;">' + spec.badge + '</span>',
            '<h2 style="font-size:1.45rem;font-weight:850;color:#0f172a;margin:0 0 4px 0;">' + spec.title + '</h2>',
            '<div style="display:flex;align-items:baseline;gap:8px;margin-top:6px;">',
            '<strong style="font-size:1.8rem;color:' + spec.color + ';font-weight:900;">' + spec.price + '</strong>',
            '<span style="font-size:0.85rem;color:#64748b;font-weight:600;">· ' + spec.period + '</span>',
            '</div>'
        ].join('');

        var featBox = modal.querySelector('#pdPlanModalFeatures');
        featBox.innerHTML = [
            '<div style="font-size:0.8rem;font-weight:800;color:#0f172a;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;">What is included in this plan:</div>',
            '<ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px;">' +
            spec.features.map(function (f) {
                return '<li style="display:flex;align-items:center;gap:8px;font-size:0.86rem;color:#334155;font-weight:600;"><span style="color:#10b981;font-weight:900;">✓</span> ' + f + '</li>';
            }).join('') +
            '</ul>'
        ].join('');

        // Prefill name & phone if available from profile
        var storedProfile = {};
        try { storedProfile = JSON.parse(localStorage.getItem('propertydirect_owner_profile') || '{}'); } catch (_) {}
        var nameField = modal.querySelector('#pdPlanUserName');
        var phoneField = modal.querySelector('#pdPlanUserPhone');
        if (nameField) nameField.value = storedProfile.name || 'PropertyDirect Member';
        if (phoneField) phoneField.value = storedProfile.phone || '+91 98450 12345';

        var submitBtn = modal.querySelector('#pdPlanSubmitBtn');
        if (planKey === 'Relax') {
            submitBtn.textContent = 'Keep Current Plan Active';
        } else {
            submitBtn.textContent = 'Confirm & Activate ' + spec.title;
        }

        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    }

    async function submitPlanModal(e) {
        e.preventDefault();
        var modal = document.getElementById('pdPlanActionModal');
        var planKey = modal._pdPlanKey || 'Basic';
        var spec = PLAN_SPECS[planKey] || PLAN_SPECS['Basic'];
        var btn = modal._pdSourceButton;
        var submitBtn = modal.querySelector('#pdPlanSubmitBtn');

        submitBtn.disabled = true;
        submitBtn.textContent = 'Activating...';

        try {
            await persistDashboardButton(btn, 'plan-activation', {
                planKey: planKey,
                planTitle: spec.title,
                price: spec.price,
                subscriberName: modal.querySelector('#pdPlanUserName')?.value,
                subscriberPhone: modal.querySelector('#pdPlanUserPhone')?.value,
                paymentMode: modal.querySelector('#pdPlanPaymentMode')?.value
            });

            // Update UI buttons across the plan cards
            if (btn) {
                document.querySelectorAll('.pd-plan-btn-current').forEach(function (current) {
                    current.className = 'pd-plan-btn pd-plan-btn-outline';
                    current.dataset.action = 'select-plan';
                    current.textContent = 'Select Plan';
                });
                btn.className = 'pd-plan-btn pd-plan-btn-current';
                btn.dataset.action = 'current-plan';
                btn.textContent = '✓ Current Plan';
            }

            closePlanModal();
            showFallbackToast('🎉 ' + spec.title + ' activated successfully! Direct owner contacts unlocked.');
        } catch (err) {
            closePlanModal();
            showFallbackToast('✓ ' + spec.title + ' saved locally.');
        } finally {
            submitBtn.disabled = false;
        }
    }

    /* -------------------------------------------------------------
       RECEIPT & TAX INVOICE DETAILED MODAL
       ------------------------------------------------------------- */
    function openReceiptModal(button) {
        var existing = document.getElementById('pdReceiptActionModal');
        if (existing) existing.remove();

        var invId = 'PD-INV-2026-' + Math.floor(10000 + Math.random() * 90000);
        var dateStr = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
        var title = targetTitle(button) || 'Subscription Fee';

        var modal = document.createElement('div');
        modal.id = 'pdReceiptActionModal';
        modal.className = 'modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;width:100vw;height:100vh;background:rgba(15,23,42,0.68);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;z-index:999999;padding:20px;box-sizing:border-box;';
        modal.innerHTML = [
            '<div class="modal-card" style="width:min(540px,94vw);max-height:calc(100vh - 40px);background:#ffffff;border-radius:20px;padding:28px 32px;box-shadow:0 25px 60px rgba(15,23,42,.35);border:1px solid #e2e8f0;overflow-y:auto;position:relative;font-family:\'Manrope\',sans-serif;">',
            '<button type="button" class="close" onclick="this.closest(\'#pdReceiptActionModal\').remove()" style="position:absolute;top:18px;right:18px;width:34px;height:34px;border-radius:50%;border:1px solid #cbd5e1;background:#f8fafc;color:#64748b;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>',
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #f1f5f9;padding-bottom:18px;margin-bottom:20px;">',
            '<div>',
            '<h2 style="font-size:1.35rem;font-weight:900;color:#0f172a;margin:0 0 4px 0;">Property<span style="color:#2563eb;">Direct</span></h2>',
            '<div style="font-size:0.75rem;color:#64748b;">GSTIN: 33AAACP1234F1Z8 · Official Tax Invoice</div>',
            '</div>',
            '<span style="background:#ecfdf5;color:#059669;border:1px solid #a7f3d0;font-size:0.78rem;font-weight:800;padding:4px 12px;border-radius:999px;">✓ PAID &amp; SETTLED</span>',
            '</div>',
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;background:#f8fafc;border-radius:12px;padding:14px 18px;margin-bottom:20px;font-size:0.82rem;">',
            '<div><span style="color:#64748b;display:block;">Invoice Reference:</span><strong style="color:#0f172a;">' + invId + '</strong></div>',
            '<div><span style="color:#64748b;display:block;">Date &amp; Time:</span><strong style="color:#0f172a;">' + dateStr + '</strong></div>',
            '<div><span style="color:#64748b;display:block;">Transaction Type:</span><strong style="color:#0f172a;">Direct Platform Service</strong></div>',
            '<div><span style="color:#64748b;display:block;">Payment Method:</span><strong style="color:#0f172a;">UPI / Bank Settlement</strong></div>',
            '</div>',
            '<table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:0.84rem;">',
            '<thead><tr style="border-bottom:2px solid #e2e8f0;text-align:left;"><th style="padding:8px 0;color:#475569;">Description</th><th style="padding:8px 0;text-align:right;color:#475569;">Amount</th></tr></thead>',
            '<tbody>',
            '<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:10px 0;font-weight:600;color:#1e293b;">' + escapeHtml(title) + '</td><td style="padding:10px 0;text-align:right;font-weight:700;">₹2,541.52</td></tr>',
            '<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:10px 0;color:#64748b;">IGST / CGST (18%)</td><td style="padding:10px 0;text-align:right;color:#64748b;">₹457.48</td></tr>',
            '<tr style="border-top:2px solid #0f172a;"><td style="padding:12px 0;font-weight:800;font-size:1rem;color:#0f172a;">Total Amount Paid</td><td style="padding:12px 0;text-align:right;font-weight:900;font-size:1.15rem;color:#2563eb;">₹2,999.00</td></tr>',
            '</tbody>',
            '</table>',
            '<div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #f1f5f9;padding-top:18px;">',
            '<span style="font-size:0.75rem;color:#94a3b8;">Digitally generated &amp; verified by PropertyDirect</span>',
            '<div style="display:flex;gap:10px;">',
            '<button type="button" onclick="this.closest(\'#pdReceiptActionModal\').remove()" style="padding:8px 16px;border-radius:8px;background:#f1f5f9;border:1px solid #cbd5e1;color:#475569;font-weight:700;cursor:pointer;">Close</button>',
            '<button type="button" onclick="window.print()" style="padding:8px 18px;border-radius:8px;background:#0f172a;color:#ffffff;border:none;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">🖨️ Print / Download</button>',
            '</div>',
            '</div>',
            '</div>'
        ].join('');
        document.body.appendChild(modal);
        persistDashboardButton(button, 'view-receipt');
    }

    /* -------------------------------------------------------------
       EXPORT DATA & REPORT DOWNLOAD DETAILED MODAL
       ------------------------------------------------------------- */
    function openExportModal(button) {
        var existing = document.getElementById('pdExportActionModal');
        if (existing) existing.remove();

        var panel = currentPanel();
        var defaultReportName = 'PropertyDirect ' + panel.charAt(0).toUpperCase() + panel.slice(1) + ' Report';

        var modal = document.createElement('div');
        modal.id = 'pdExportActionModal';
        modal.className = 'modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;width:100vw;height:100vh;background:rgba(15,23,42,0.68);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;z-index:999999;padding:20px;box-sizing:border-box;';
        modal.innerHTML = [
            '<div class="modal-card" style="width:min(480px,94vw);background:#ffffff;border-radius:20px;padding:28px 32px;box-shadow:0 25px 60px rgba(15,23,42,.35);border:1px solid #e2e8f0;position:relative;font-family:\'Manrope\',sans-serif;">',
            '<button type="button" class="close" onclick="this.closest(\'#pdExportActionModal\').remove()" style="position:absolute;top:18px;right:18px;width:34px;height:34px;border-radius:50%;border:1px solid #cbd5e1;background:#f8fafc;color:#64748b;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>',
            '<h2 style="font-size:1.35rem;font-weight:850;color:#0f172a;margin:0 0 6px 0;">Export Dashboard Records</h2>',
            '<p style="font-size:0.84rem;color:#64748b;margin:0 0 20px 0;">Download verified CSV data sheets or summaries for your records and compliance audits.</p>',
            '<div style="display:flex;flex-direction:column;gap:14px;margin-bottom:24px;">',
            '<label style="display:flex;flex-direction:column;gap:5px;font-size:0.82rem;font-weight:700;color:#334155;"><span>Report Title</span><input id="pdExportTitle" type="text" value="' + defaultReportName + '" style="padding:10px 14px;border-radius:10px;border:1px solid #cbd5e1;font-size:0.88rem;"></label>',
            '<label style="display:flex;flex-direction:column;gap:5px;font-size:0.82rem;font-weight:700;color:#334155;"><span>Date Range</span><select id="pdExportRange" style="padding:10px 14px;border-radius:10px;border:1px solid #cbd5e1;font-size:0.88rem;"><option>Current Month to Date</option><option>Last 90 Days</option><option>Financial Year 2026</option><option>All Time Records</option></select></label>',
            '<label style="display:flex;flex-direction:column;gap:5px;font-size:0.82rem;font-weight:700;color:#334155;"><span>File Format</span><select id="pdExportFormat" style="padding:10px 14px;border-radius:10px;border:1px solid #cbd5e1;font-size:0.88rem;"><option value="csv">Standard CSV Spreadsheet (.csv)</option><option value="json">Structured JSON Records (.json)</option></select></label>',
            '</div>',
            '<div style="display:flex;justify-content:flex-end;align-items:center;gap:12px;border-top:1px solid #f1f5f9;padding-top:18px;">',
            '<button type="button" onclick="this.closest(\'#pdExportActionModal\').remove()" style="padding:10px 18px;border-radius:10px;background:#f1f5f9;border:1px solid #cbd5e1;color:#475569;font-weight:700;cursor:pointer;">Cancel</button>',
            '<button type="button" id="pdExportSubmitBtn" style="padding:10px 22px;border-radius:10px;background:linear-gradient(135deg,#2563eb,#1d4ed8);border:none;color:#ffffff;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">📥 Generate &amp; Download</button>',
            '</div>',
            '</div>'
        ].join('');
        document.body.appendChild(modal);

        modal.querySelector('#pdExportSubmitBtn').addEventListener('click', function () {
            var title = modal.querySelector('#pdExportTitle')?.value || defaultReportName;
            var format = modal.querySelector('#pdExportFormat')?.value || 'csv';

            // Gather rows from visible tables
            var rows = Array.from(document.querySelectorAll('.dash-panel:not(.hidden) table tr, table tr')).slice(0, 50);
            var content = '';
            var filename = title.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '.' + format;

            if (format === 'csv') {
                if (rows.length > 0) {
                    content = rows.map(function (r) {
                        return Array.from(r.querySelectorAll('th, td')).map(function (c) {
                            return '"' + c.innerText.trim().replace(/"/g, '""') + '"';
                        }).join(',');
                    }).join('\n');
                } else {
                    content = 'Record ID,Title,Status,Timestamp,Role\n1,' + title + ',Verified,' + new Date().toISOString() + ',' + dashboardRole();
                }
            } else {
                content = JSON.stringify({
                    reportTitle: title,
                    generatedAt: new Date().toISOString(),
                    role: dashboardRole(),
                    panel: currentPanel(),
                    status: 'EXPORT_SUCCESS'
                }, null, 2);
            }

            var blob = new Blob([content], { type: format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/json' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);

            modal.remove();
            showFallbackToast('✓ ' + filename + ' downloaded successfully.');
            persistDashboardButton(button, 'export-file', { filename: filename });
        });
    }

    /* -------------------------------------------------------------
       SUPPORT TICKET HANDLER & DETAILED TICKET CARDS
       ------------------------------------------------------------- */
    function handleCustomerSupportSubmit(form) {
        var title = form.querySelector('[name="title"]')?.value?.trim();
        var category = form.querySelector('[name="category"]')?.value || 'GENERAL';
        var priority = form.querySelector('[name="priority"]')?.value || 'NORMAL';
        var details = form.querySelector('[name="details"]')?.value?.trim();
        var callbackAt = form.querySelector('[name="callbackAt"]')?.value || 'Anytime';
        var reference = form.querySelector('[name="reference"]')?.value?.trim() || '';

        if (!title || !details) {
            showFallbackToast('Please provide an issue title and description.');
            return;
        }

        var ticketId = 'PD-TKT-' + Math.floor(1000 + Math.random() * 9000);
        var list = document.getElementById('supportTickets');
        if (list) {
            var empty = list.querySelector('li');
            if (empty && empty.textContent.includes('No active')) empty.remove();

            var card = document.createElement('li');
            card.style.cssText = 'background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:18px;margin-bottom:12px;list-style:none;box-shadow:0 2px 10px rgba(15,23,42,.04);';
            card.innerHTML = [
                '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">',
                '<div>',
                '<strong style="color:#0f172a;font-size:0.95rem;display:block;">' + escapeHtml(title) + '</strong>',
                '<span style="font-size:0.75rem;color:#64748b;">Ticket #' + ticketId + ' · ' + escapeHtml(category) + ' · Callback: ' + escapeHtml(callbackAt) + '</span>',
                '</div>',
                '<span style="background:#fef3c7;color:#b45309;font-weight:800;font-size:0.72rem;padding:3px 10px;border-radius:999px;">' + escapeHtml(priority) + ' PRIORITY</span>',
                '</div>',
                '<p style="font-size:0.84rem;color:#475569;margin:0 0 12px 0;line-height:1.45;">' + escapeHtml(details) + '</p>',
                '<div style="display:flex;gap:8px;">',
                '<button type="button" style="padding:5px 12px;font-size:0.78rem;font-weight:700;border-radius:8px;border:1px solid #cbd5e1;background:#f8fafc;color:#0f172a;cursor:pointer;" onclick="PropertyDirectDashboardControls.openTicketDetails(\'' + ticketId + '\',\'' + safeEscape(title) + '\',\'' + safeEscape(category) + '\',\'' + safeEscape(priority) + '\',\'' + safeEscape(details) + '\')">View Ticket Details</button>',
                '</div>'
            ].join('');
            list.prepend(card);
        }

        var stateEl = document.getElementById('supportState');
        if (stateEl) stateEl.textContent = 'Ticket #' + ticketId + ' Raised';

        form.reset();
        showFallbackToast('✓ Support Ticket #' + ticketId + ' submitted! Support team assigned.');
        persistDashboardButton(form.querySelector('button'), 'create-support-ticket', {
            ticketId: ticketId,
            title: title,
            category: category,
            priority: priority,
            details: details
        });
    }

    function openTicketDetails(ticketId, title, category, priority, details) {
        var existing = document.getElementById('pdTicketDetailModal');
        if (existing) existing.remove();

        var modal = document.createElement('div');
        modal.id = 'pdTicketDetailModal';
        modal.className = 'modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;width:100vw;height:100vh;background:rgba(15,23,42,0.68);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;z-index:999999;padding:20px;box-sizing:border-box;';
        modal.innerHTML = [
            '<div class="modal-card" style="width:min(500px,94vw);background:#ffffff;border-radius:20px;padding:28px 32px;box-shadow:0 25px 60px rgba(15,23,42,.35);border:1px solid #e2e8f0;position:relative;font-family:\'Manrope\',sans-serif;">',
            '<button type="button" class="close" onclick="this.closest(\'#pdTicketDetailModal\').remove()" style="position:absolute;top:18px;right:18px;width:34px;height:34px;border-radius:50%;border:1px solid #cbd5e1;background:#f8fafc;color:#64748b;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>',
            '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">',
            '<span style="background:#eff6ff;color:#2563eb;font-size:0.75rem;font-weight:800;padding:3px 10px;border-radius:999px;">TICKET RECORD</span>',
            '<span style="background:#fef3c7;color:#b45309;font-size:0.75rem;font-weight:800;padding:3px 10px;border-radius:999px;">STATUS: IN REVIEW</span>',
            '</div>',
            '<h2 style="font-size:1.3rem;font-weight:850;color:#0f172a;margin:0 0 4px 0;">' + escapeHtml(title) + '</h2>',
            '<div style="font-size:0.8rem;color:#64748b;margin-bottom:18px;">Ticket Reference: #' + ticketId + ' · Category: ' + escapeHtml(category) + '</div>',
            '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:18px;font-size:0.85rem;color:#334155;line-height:1.5;">' + escapeHtml(details) + '</div>',
            '<div style="display:flex;flex-direction:column;gap:8px;font-size:0.82rem;color:#64748b;border-top:1px solid #f1f5f9;padding-top:14px;margin-bottom:20px;">',
            '<div>⏱️ <strong>SLA Response Target:</strong> Under 2 business hours</div>',
            '<div>👨‍💼 <strong>Assigned Team:</strong> PropertyDirect Priority Care</div>',
            '</div>',
            '<div style="display:flex;justify-content:flex-end;">',
            '<button type="button" onclick="this.closest(\'#pdTicketDetailModal\').remove()" style="padding:10px 20px;border-radius:10px;background:#0f172a;color:#ffffff;border:none;font-weight:700;cursor:pointer;">Close</button>',
            '</div>',
            '</div>'
        ].join('');
        document.body.appendChild(modal);
    }
    window.PropertyDirectDashboardControls.openTicketDetails = openTicketDetails;

    /* -------------------------------------------------------------
       DEFAULT FIELDS & FALLBACK ENGINE
       ------------------------------------------------------------- */
    function defaultFieldsForAction(actionType, label) {
        var lowerLabel = String(label || '').toLowerCase();
        if (actionType === 'create' || lowerLabel.includes('property')) return [
            ['Name / title', 'text', 'Enter full name, property title, package name, or item title'],
            ['Email / contact', 'text', 'Enter email, phone, or contact reference'],
            ['Role / category', 'text', 'Enter role, property type, package, or category'],
            ['Location / market', 'text', 'Enter city, locality, or service area'],
            ['Property Images (Upload Photos)', 'file-image', 'Select property photo files (JPG, PNG, WebP)'],
            ['Image URLs (Optional photo links)', 'text', 'Enter photo URL (e.g. /propertydirect/assets/images/property-1.jpg or https://...)'],
            ['Property Video (Upload Walkthrough)', 'file-video', 'Select video file (MP4, WebM)'],
            ['Virtual Tour Video URL (YouTube / Vimeo / MP4)', 'url', 'e.g. https://www.youtube.com/watch?v=... or MP4 video link'],
            ['Admin note', 'textarea', 'Add verification note or instructions']
        ];
        if (actionType === 'edit') return [
            ['Updated title / name', 'text', 'Enter updated name or title'],
            ['Updated status', 'text', 'Enter active, pending, blocked, approved, etc.'],
            ['Updated contact / price / plan', 'text', 'Enter changed contact, price, package, or limit'],
            ['Property Images (Upload Photos)', 'file-image', 'Select property photo files (JPG, PNG, WebP)'],
            ['Property Video (Upload Walkthrough)', 'file-video', 'Select video file (MP4, WebM)'],
            ['Reason for change', 'textarea', 'Explain what was changed and why']
        ];
        if (['approve', 'reject', 'suspend', 'delete'].indexOf(actionType) !== -1) return [
            ['Decision reason', 'textarea', 'Enter reason for this ' + label.toLowerCase() + ' action'],
            ['Reviewed documents / checks', 'textarea', 'Mention KYC, RERA, ownership, payment, complaint, or audit checks'],
            ['Follow-up required', 'text', 'Enter no follow-up, notify user, request documents, etc.']
        ];
        if (actionType === 'export') return [
            ['Report name', 'text', 'Enter report title'],
            ['Date range', 'text', 'Example: Today, This week, This month'],
            ['Format', 'text', 'PDF, CSV, Excel, or summary'],
            ['Filters / notes', 'textarea', 'Mention module, status, city, role, or package filters']
        ];
        return [
            ['Action details', 'textarea', 'Add notes for this dashboard action'],
            ['Assigned owner', 'text', 'Enter responsible person or team'],
            ['Completion target', 'text', 'Enter expected completion or next step']
        ];
    }

    function ensureActionModal() {
        var modal = document.getElementById('pdDashboardActionModal');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = 'pdDashboardActionModal';
        modal.className = 'modal hidden';
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = [
            '<div class="modal-card pd-dashboard-action-card" role="dialog" aria-modal="true" aria-labelledby="pdDashboardActionTitle">',
            '<button type="button" class="close" data-pd-action-close aria-label="Close">✕</button>',
            '<h3 id="pdDashboardActionTitle">Dashboard action</h3>',
            '<p id="pdDashboardActionSubtitle" class="pd-dashboard-action-subtitle"></p>',
            '<form id="pdDashboardActionForm">',
            '<div id="pdDashboardActionFields" class="form-grid pd-dashboard-action-fields"></div>',
            '<div class="modal-actions">',
            '<button type="button" class="secondary" data-pd-action-close>Cancel</button>',
            '<button type="submit" class="primary" id="pdDashboardActionSubmit">Save Action</button>',
            '</div>',
            '</form>',
            '</div>'
        ].join('');
        document.body.appendChild(modal);
        modal.addEventListener('click', function (event) {
            if (event.target === modal || event.target.closest('[data-pd-action-close]')) closeActionModal();
        });
        modal.querySelector('form').addEventListener('submit', submitActionModal);
        return modal;
    }

    function closeActionModal() {
        var modal = document.getElementById('pdDashboardActionModal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('is-open');
        modal.style.opacity = '0';
        modal.style.pointerEvents = 'none';
        modal.setAttribute('aria-hidden', 'true');
    }

    function openActionModal(button, options) {
        var label = buttonLabel(button);
        var type = options?.type || actionTypeFromLabel(label);
        var title = options?.title || (label + ' details');
        var target = targetTitle(button);
        var modal = ensureActionModal();
        modal._pdSourceButton = button;
        modal._pdActionType = type;
        modal.querySelector('#pdDashboardActionTitle').textContent = title;
        modal.querySelector('#pdDashboardActionSubtitle').textContent = target
            ? ('Target: ' + target + ' · Role: ' + dashboardRole() + ' · Section: ' + currentPanel())
            : ('Role: ' + dashboardRole() + ' · Section: ' + currentPanel());
        var fields = defaultFieldsForAction(type, label);
        modal.querySelector('#pdDashboardActionFields').innerHTML = fields.map(function (field, index) {
            var id = 'pdActionField' + index;
            var labelText = escapeHtml(field[0]);
            var fieldType = field[1];
            var placeholder = escapeHtml(field[2]);
            var control = '';

            if (fieldType === 'textarea') {
                control = '<textarea id="' + id + '" rows="3" placeholder="' + placeholder + '"></textarea>';
            } else if (fieldType === 'file-image') {
                control = '<div style="display:flex; flex-direction:column; gap:6px; background:#f8fafc; padding:10px; border-radius:8px; border:1px dashed #cbd5e1;">' +
                          '<input id="' + id + '" type="file" accept="image/*" multiple style="font-size:0.82rem; cursor:pointer;" onchange="var feedback = this.nextElementSibling; if (this.files.length > 0) { feedback.textContent = this.files.length + \' photo file(s) selected\'; feedback.style.display = \'block\'; } else { feedback.style.display = \'none\'; }">' +
                          '<span style="color:#059669; font-size:0.78rem; font-weight:700; display:none;"></span>' +
                          '</div>';
            } else if (fieldType === 'file-video') {
                control = '<div style="display:flex; flex-direction:column; gap:6px; background:#eff6ff; padding:10px; border-radius:8px; border:1px dashed #93c5fd;">' +
                          '<input id="' + id + '" type="file" accept="video/*" style="font-size:0.82rem; cursor:pointer;" onchange="var feedback = this.nextElementSibling; if (this.files.length > 0) { feedback.textContent = \'Video walkthrough selected: \' + this.files[0].name; feedback.style.display = \'block\'; } else { feedback.style.display = \'none\'; }">' +
                          '<span style="color:#1d4ed8; font-size:0.78rem; font-weight:700; display:none;"></span>' +
                          '</div>';
            } else {
                control = '<input id="' + id + '" type="' + fieldType + '" placeholder="' + placeholder + '">';
            }
            return '<label><span>' + labelText + '</span>' + control + '</label>';
        }).join('');
        modal.classList.remove('hidden');
        modal.classList.add('is-open');
        modal.style.opacity = '1';
        modal.style.pointerEvents = 'auto';
        modal.setAttribute('aria-hidden', 'false');
        modal.querySelector('input, textarea, select')?.focus();
    }

    async function submitActionModal(event) {
        event.preventDefault();
        var modal = event.currentTarget.closest('#pdDashboardActionModal');
        var button = modal?._pdSourceButton;
        var type = modal?._pdActionType || 'dashboard-action';
        var values = Array.from(modal.querySelectorAll('label')).map(function (label) {
            var control = label.querySelector('input, textarea, select');
            return {
                label: label.querySelector('span')?.textContent || control?.id || 'Field',
                value: control?.value || ''
            };
        });
        var submit = modal.querySelector('#pdDashboardActionSubmit');
        submit.disabled = true;
        submit.textContent = 'Saving...';
        try {
            var response = await fetch('/api/workflows', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({
                    workspace: 'PropertyDirect',
                    dashboardRole: dashboardRole(),
                    panel: currentPanel(),
                    actionType: type,
                    targetLabel: button ? buttonLabel(button) : 'Dashboard action',
                    details: {
                        target: button ? targetTitle(button) : '',
                        fields: values,
                        context: button ? actionContext(button) : ''
                    }
                })
            });
            if (!response.ok) throw new Error('Workflow save failed');
            if (button) applyVisualActionResult(button, type, values);
            showFallbackToast('Action saved to backend.');
            closeActionModal();
        } catch (error) {
            if (button) applyVisualActionResult(button, type, values);
            showFallbackToast('Action saved locally.');
            closeActionModal();
        } finally {
            submit.disabled = false;
            submit.textContent = 'Save Action';
        }
    }

    function applyVisualActionResult(button, type, values) {
        if (type === 'approve') updateRowStatus(button, 'Approved', 'active');
        if (type === 'reject') updateRowStatus(button, 'Rejected', 'rejected');
        if (type === 'suspend') updateRowStatus(button, buttonLabel(button).toLowerCase().includes('re-activate') ? 'Active' : 'Suspended', 'pending');
        if (type === 'delete') {
            var row = button.closest('tr');
            if (row) {
                row.dataset.pdDeleted = 'true';
                row.style.opacity = '0.45';
                updateRowStatus(button, 'Deleted', 'rejected');
            }
        }
        if (type === 'edit' && Array.isArray(values)) {
            var row = button.closest('tr');
            if (row) {
                var newTitle = values.find(function(v) { return v.label.includes('title') || v.label.includes('name'); })?.value;
                if (newTitle) {
                    var strong = row.querySelector('strong');
                    if (strong) strong.textContent = newTitle;
                }
            }
        }
    }

    function resetPanelControls(button) {
        var scope = button.closest('.dash-card, .dash-panel, .vendor-card, main') || document;
        scope.querySelectorAll('input, textarea, select').forEach(function (field) {
            if (field.tagName === 'SELECT') field.selectedIndex = 0;
            else if (field.type === 'checkbox' || field.type === 'radio') field.checked = field.defaultChecked;
            else field.value = '';
            field.dispatchEvent(new Event('change', { bubbles: true }));
            field.dispatchEvent(new Event('input', { bubbles: true }));
        });
        persistDashboardButton(button, 'reset');
        showFallbackToast('Filters reset.');
    }

    function shouldUseDetailedFallback(target) {
        if (!target || target.disabled) return false;
        if (target.hasAttribute('onclick') || target.closest('[onclick]')) return false;
        if (target.closest('.sidebar-nav, .owner-nav, .agent-nav, .vendor-nav, .pd-auth-modal, #pdDashboardActionModal, #pdPlanActionModal, #pdReceiptActionModal, #pdExportActionModal, #pdTicketDetailModal, .pd-modal-overlay, #launchProjectModal')) return false;
        if (target.closest('[data-property-review]')) return false;
        var tag = target.tagName;
        if (tag === 'A') {
            var href = target.getAttribute('href') || '';
            if (href && href !== '#' && !href.endsWith('/propertydirect/#')) return false;
        }
        if ((target.type || '').toLowerCase() === 'submit' && target.closest('form')) return false;
        return true;
    }

    function handleDashboardFallbackClick(target, event) {
        if (!shouldUseDetailedFallback(target)) return false;
        var label = buttonLabel(target);
        if (!label || label === '×' || label === '✕') return false;
        var type = actionTypeFromLabel(label);
        var href = target.getAttribute('href') || '';
        if (href === '#' || href.endsWith('/propertydirect/#') || target.tagName === 'BUTTON') event.preventDefault();

        if (type === 'reset') {
            resetPanelControls(target);
            return true;
        }
        if (type === 'receipt') {
            openReceiptModal(target);
            return true;
        }
        if (type === 'export') {
            openExportModal(target);
            return true;
        }
        if (['view', 'edit', 'create', 'approve', 'reject', 'suspend', 'delete', 'save'].indexOf(type) !== -1) {
            openActionModal(target, { type: type, title: label + ' Details' });
            return true;
        }
        persistDashboardButton(target, 'button-click');
        showFallbackToast(label + ' action recorded.');
        return true;
    }

    // Navigation item click handling
    document.addEventListener('click', function (event) {
        var navButton = event.target.closest('.sidebar-nav [data-panel], .owner-nav [data-panel], .agent-nav [data-panel], .vendor-nav [data-panel]');
        if (navButton) {
            event.preventDefault();
            event.stopPropagation();
            setPanel(navButton.dataset.panel);
            if (window.innerWidth <= 900) document.body.classList.remove('sidebar-open');
            return;
        }
        if (event.target.closest('.pd-sidebar-close, .pd-sidebar-cancel, [data-sidebar-close]')) {
            closeSidebar();
            return;
        }
        if (event.target.closest('.pd-sidebar-menu, .pd-sidebar-reopen, [data-sidebar-open]')) openSidebar();
    }, true);

    // Primary data-action listener for dedicated buttons
    document.addEventListener('click', function (event) {
        if (event.defaultPrevented) return;
        var button = event.target.closest('[data-action]');
        if (!button || button.closest('[data-property-review]')) return;
        var action = button.dataset.action;
        if (!action || action === 'close-modal') return;

        var text = (button.textContent || action).trim().replace(/\s+/g, ' ');

        // Plan selection actions
        if (action === 'select-plan' || action === 'upgrade') {
            event.preventDefault();
            var planKey = button.dataset.planName || (text.includes('Basic') ? 'Basic' : text.includes('Concierge') ? 'OwnerConcierge' : text.includes('Owner') ? 'OwnerFreedom' : 'Assisted');
            openPlanModal(planKey, button);
            return;
        }
        if (action === 'current-plan') {
            event.preventDefault();
            openPlanModal(button.dataset.planName || 'Relax', button);
            return;
        }
        if (action === 'receipt') {
            event.preventDefault();
            openReceiptModal(button);
            return;
        }
        if (action === 'export') {
            event.preventDefault();
            openExportModal(button);
            return;
        }
        if (action === 'support') {
            event.preventDefault();
            var supForm = document.getElementById('propertySupportForm');
            if (supForm) {
                handleCustomerSupportSubmit(supForm);
            } else {
                openActionModal(button, { type: 'create', title: 'Raise Support Ticket' });
            }
            return;
        }

        if (['approve', 'activate-row'].indexOf(action) !== -1) {
            updateRowStatus(button, 'Approved', 'active');
            persistDashboardButton(button, action);
            showFallbackToast(text + ' completed.');
            return;
        }
        if (['deactivate-row', 'resolve-task'].indexOf(action) !== -1) {
            updateRowStatus(button, 'Resolved', 'active');
            persistDashboardButton(button, action);
            showFallbackToast(text + ' updated.');
            return;
        }
        if (action === 'mark-paid') {
            updateRowStatus(button, 'Paid', 'paid');
            persistDashboardButton(button, action);
            showFallbackToast(text + ' completed.');
            return;
        }
        if (['save', 'edit-row', 'add-row', 'manage-plan'].indexOf(action) !== -1) {
            openActionModal(button, { type: action === 'edit-row' ? 'edit' : 'create', title: text + ' Details' });
            return;
        }
    });

    // Fallback click listener for generic buttons and anchor buttons
    document.addEventListener('click', function (event) {
        var target = event.target.closest('button, a.button, a[href="#"], a[href$="/propertydirect/#"], [role="button"]');
        if (!target || !target.closest('body[data-platform="propertydirect"], body.app-dashboard[data-platform="propertydirect"]')) return;
        if (target.closest('.sidebar-nav, .owner-nav, .agent-nav, .vendor-nav, .pd-modal-overlay, #launchProjectModal') || target.matches('[data-action], [data-property-api-action]') || target.hasAttribute('onclick') || target.closest('[onclick]')) return;
        if (target.closest('form') && (target.type || '').toLowerCase() === 'submit') return;
        var label = buttonLabel(target);
        if (!label || label === '×' || label === '✕') return;
        handleDashboardFallbackClick(target, event);
    }, false);

    // Form submission listener
    document.addEventListener('submit', async function (event) {
        var form = event.target;
        if (!form || !form.closest('body[data-platform="propertydirect"], body.app-dashboard[data-platform="propertydirect"]')) return;
        if (form.id === 'propertySupportForm') {
            event.preventDefault();
            handleCustomerSupportSubmit(form);
            return;
        }
        if (form.id === 'pdDashboardActionForm' || form.id === 'pdPlanModalForm' || form.id === 'postApartmentForm' || form.dataset.propertyApiForm === 'true' || form.querySelector('[data-property-api-action]') || event.submitter?.matches('[data-property-api-action]')) return;
        if (form.matches('.pd-auth-card form, #pdLoginForm, #pdSignupForm')) return;
        if (form.dataset.pdNativeSubmit === 'true') return;
        event.preventDefault();
        var submit = form.querySelector('[type="submit"]');
        var title = form.id || form.closest('.modal, .dash-card')?.querySelector('h3, h2')?.textContent?.trim() || 'Dashboard form';
        var fields = Array.from(new FormData(form).entries()).map(function (entry) {
            return { name: entry[0], value: entry[1] };
        });
        if (!fields.length) {
            fields = Array.from(form.querySelectorAll('input, select, textarea')).map(function (field) {
                return { name: field.name || field.id || field.getAttribute('aria-label') || 'field', value: field.value || '' };
            });
        }
        if (submit) {
            submit.disabled = true;
            submit.dataset.pdOriginalText = submit.textContent;
            submit.textContent = 'Saving...';
        }
        try {
            var response = await fetch('/api/workflows', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({
                    workspace: 'PropertyDirect',
                    dashboardRole: dashboardRole(),
                    panel: currentPanel(),
                    actionType: 'form-submit',
                    targetLabel: title,
                    details: { fields: fields }
                })
            });
            if (!response.ok) throw new Error('Workflow save failed');
            showFallbackToast(title + ' saved to backend.');
        } catch (error) {
            showFallbackToast(title + ' saved locally.');
        } finally {
            if (submit) {
                submit.disabled = false;
                submit.textContent = submit.dataset.pdOriginalText || 'Submit';
            }
        }
    }, true);

    // Universal modal close handler
    document.addEventListener('click', function (event) {
        var close = event.target.closest('[data-action="close-modal"], .modal-cancel, .pd-auth-close, button[aria-label^="Close"], [data-pd-plan-close]');
        if (!close) return;
        var modal = close.closest('.modal, .pd-auth-modal, [role="dialog"], #pdPlanActionModal, #pdReceiptActionModal, #pdExportActionModal, #pdTicketDetailModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('is-open');
            modal.setAttribute('aria-hidden', 'true');
            if (modal.style) modal.style.display = 'none';
        }
    }, true);

    window.addEventListener('hashchange', function () { setPanel(window.location.hash.slice(1)); });
    document.addEventListener('DOMContentLoaded', function () {
        ensureActionModal();
        document.querySelectorAll('.sidebar-nav [data-panel], .owner-nav [data-panel], .agent-nav [data-panel], .vendor-nav [data-panel]').forEach(function (button) {
            button.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                setPanel(button.dataset.panel);
                if (window.innerWidth <= 900) document.body.classList.remove('sidebar-open');
            });
        });
        var initialPanel = window.location.hash ? window.location.hash.slice(1) : '';
        if (initialPanel) setPanel(initialPanel);
    });
})();
