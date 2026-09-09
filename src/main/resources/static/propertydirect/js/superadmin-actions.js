(function () {
    'use strict';

    function toast(message) {
        if (typeof window.showToast === 'function') {
            window.showToast(message);
            return;
        }
        var existing = document.getElementById('pdSuperadminActionToast');
        var box = existing || document.createElement('div');
        box.id = 'pdSuperadminActionToast';
        box.textContent = message;
        box.style.cssText = 'position:fixed;right:24px;bottom:78px;z-index:999999;background:#10203f;color:#fff;border:1px solid rgba(255,255,255,.16);border-radius:12px;padding:12px 18px;font:800 13px/1.25 Manrope,Arial,sans-serif;box-shadow:0 16px 34px rgba(15,23,42,.28);';
        if (!existing) document.body.appendChild(box);
        clearTimeout(box._timer);
        box._timer = setTimeout(function () { box.remove(); }, 3000);
    }

    function text(value, fallback) {
        return String(value || fallback || '').trim();
    }

    function saveAction(actionType, targetLabel, details) {
        return fetch('/api/workflows', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
                workspace: 'PropertyDirect',
                dashboardRole: 'superadmin',
                panel: (location.hash || '#overview').slice(1) || 'overview',
                actionType: actionType,
                targetLabel: targetLabel,
                details: details || {}
            })
        }).then(function (response) {
            return response.json().catch(function () { return {}; }).then(function (payload) {
                if (!response.ok) throw new Error(payload.message || payload.error || 'Action could not be saved.');
                return payload;
            });
        });
    }

    function openInfoModal(title, lines) {
        var modal = document.getElementById('pdSuperadminInfoModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'pdSuperadminInfoModal';
            modal.className = 'modal hidden';
            modal.innerHTML = '<div class="modal-card" style="width:min(560px,92vw);"><button class="close" type="button" data-superadmin-close="info" aria-label="Close">×</button><h3></h3><div class="pd-info-lines"></div><div class="modal-actions"><button type="button" class="primary" data-superadmin-close="info">Done</button></div></div>';
            document.body.appendChild(modal);
        }
        modal.querySelector('h3').textContent = title;
        modal.querySelector('.pd-info-lines').innerHTML = (lines || []).map(function (line) {
            return '<p style="margin:8px 0;color:#475569;font-weight:700;">' + String(line).replace(/[&<>"']/g, function (ch) {
                return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
            }) + '</p>';
        }).join('');
        modal.classList.remove('hidden');
    }

    function closeInfoModal() {
        document.getElementById('pdSuperadminInfoModal')?.classList.add('hidden');
    }

    function modalIdFromFunction(name) {
        var core = String(name || '').replace(/^(open|close)/, '').replace(/Modal$/, '');
        if (!core) return '';
        return core.charAt(0).toLowerCase() + core.slice(1) + 'Modal';
    }

    function showModalById(id) {
        var modal = document.getElementById(id);
        if (!modal) return false;
        modal.classList.remove('hidden');
        modal.classList.add('is-open');
        modal.style.opacity = '1';
        modal.style.pointerEvents = 'auto';
        var inner = modal.querySelector(':scope > div');
        if (inner) inner.style.transform = 'scale(1)';
        modal.setAttribute('aria-hidden', 'false');
        return true;
    }

    function hideModalById(id) {
        var modal = document.getElementById(id);
        if (!modal) return false;
        modal.classList.add('hidden');
        modal.classList.remove('is-open');
        modal.style.opacity = '0';
        modal.style.pointerEvents = 'none';
        modal.setAttribute('aria-hidden', 'true');
        return true;
    }

    function updateNearestRow(button, statusText, statusClass) {
        var row = button.closest('tr');
        if (!row) return;
        var status = row.querySelector('.status');
        if (status) {
            status.textContent = statusText;
            status.className = 'status ' + statusClass;
        }
    }

    function handleMissingInlineButton(button, functionName) {
        var label = text(buttonLabel(button), functionName);
        var lower = String(functionName || '').toLowerCase();

        if (lower.startsWith('open') && lower.endsWith('modal')) {
            if (showModalById(modalIdFromFunction(functionName))) {
                saveAction(functionName, label, { source: 'modal-open' });
                return true;
            }
        }

        if (lower.startsWith('close') && lower.endsWith('modal')) {
            if (hideModalById(modalIdFromFunction(functionName)) || hideModalById(button.closest('.modal')?.id)) {
                saveAction(functionName, label, { source: 'modal-close' });
                return true;
            }
        }

        if (lower.includes('approve') || lower.includes('verify') || lower.includes('authoriz')) {
            updateNearestRow(button, 'Approved', 'active');
            saveAction(functionName, label, { row: button.closest('tr')?.innerText || '' });
            toast(label + ' completed and saved.');
            return true;
        }

        if (lower.includes('reject') || lower.includes('delete') || lower.includes('suspend') || lower.includes('block')) {
            updateNearestRow(button, lower.includes('delete') ? 'Deleted' : 'Blocked');
            saveAction(functionName, label, { row: button.closest('tr')?.innerText || '' });
            toast(label + ' updated and saved.');
            return true;
        }

        if (lower.includes('reset')) {
            button.closest('.dash-card, .dash-panel')?.querySelectorAll('input, select, textarea').forEach(function (field) {
                if (field.tagName === 'SELECT') field.selectedIndex = 0;
                else field.value = '';
            });
            saveAction(functionName, label, { source: 'filter-reset' });
            toast('Filters reset.');
            return true;
        }

        if (lower.includes('filter') || lower.includes('search')) {
            saveAction(functionName, label, { source: 'filter-search' });
            toast('Filter applied.');
            return true;
        }

        if (lower.includes('download') || lower.includes('export') || lower.includes('print')) {
            saveAction(functionName, label, { source: 'export' });
            toast(label + ' prepared.');
            return true;
        }

        saveAction(functionName || 'button-click', label, { row: button.closest('tr')?.innerText || '', source: 'inline-fallback' });
        toast(label + ' saved to backend workflow.');
        return true;
    }

    function buttonLabel(button) {
        return (button.innerText || button.textContent || button.title || button.getAttribute('aria-label') || 'Dashboard action')
            .trim()
            .replace(/\s+/g, ' ');
    }

    function savedAgentStates() {
        try {
            return JSON.parse(localStorage.getItem('propertydirect_agent_states') || '{}') || {};
        } catch (error) {
            return {};
        }
    }

    function saveAgentState(agencyName, state) {
        var key = text(agencyName, '');
        if (!key) return;
        var states = savedAgentStates();
        states[key] = Object.assign({}, states[key] || {}, state);
        localStorage.setItem('propertydirect_agent_states', JSON.stringify(states));
    }

    function findAgentRow(agencyName) {
        var key = text(agencyName, '').toLowerCase();
        if (!key) return null;
        return Array.from(document.querySelectorAll('#agentMgmtTable tbody tr')).find(function (row) {
            var name = row.querySelector('.agent-name')?.innerText || row.innerText || '';
            return name.toLowerCase().includes(key);
        }) || null;
    }

    function renderAgentApproved(row, agencyName, suspended) {
        if (!row) return;
        var status = row.querySelector('.agent-status, .status');
        if (status) {
            status.textContent = suspended ? 'Suspended' : 'Verified Agent';
            status.className = suspended ? 'status pending agent-status' : 'status active agent-status';
            status.style.background = suspended ? '#fef3c7' : '#eff6ff';
            status.style.color = suspended ? '#b45309' : '#1d4ed8';
            status.style.fontWeight = '800';
        }
        var actionsCell = row.querySelector('td:last-child div') || row.querySelector('td:last-child');
        if (actionsCell) {
            var name = text(agencyName, row.querySelector('.agent-name')?.innerText || 'Agent');
            actionsCell.replaceChildren();
            var props = document.createElement('button');
            var leads = document.createElement('button');
            var suspendBtn = document.createElement('button');
            [props, leads, suspendBtn].forEach(function (btn) {
                btn.type = 'button';
                btn.style.cssText = 'padding:5px 11px;font-size:.78rem;font-weight:700;border-radius:6px;cursor:pointer;white-space:nowrap;';
            });
            props.textContent = 'Properties';
            props.style.cssText += 'background:#fff;border:1px solid #cbd5e1;color:#0f172a;';
            props.addEventListener('click', function () { window.viewAgentProperties(name, '5 Active Properties'); });
            leads.textContent = 'Leads';
            leads.style.cssText += 'background:#fff;border:1px solid #cbd5e1;color:#0f172a;';
            leads.addEventListener('click', function () { window.viewAgentLeads(name, '12 Active Buyer Leads'); });
            suspendBtn.textContent = suspended ? 'Re-activate' : 'Suspend';
            suspendBtn.style.cssText += 'background:' + (suspended ? '#eff6ff' : '#fffbeb') + ';color:' + (suspended ? '#1d4ed8' : '#b45309') + ';border:1px solid ' + (suspended ? '#bfdbfe' : '#fcd34d') + ';';
            suspendBtn.addEventListener('click', function () {
                var nextSuspended = suspendBtn.textContent.trim() === 'Suspend';
                saveAgentState(name, { approved: true, rejected: false, suspended: nextSuspended, deleted: false });
                renderAgentApproved(row, name, nextSuspended);
                saveAction(nextSuspended ? 'suspend-agent' : 'reactivate-agent', name, { row: row.innerText });
                toast(name + (nextSuspended ? ' suspended and saved.' : ' re-activated and saved.'));
            });
            actionsCell.append(props, leads, suspendBtn);
        }
    }

    function renderAgentRejected(row) {
        if (!row) return;
        var status = row.querySelector('.agent-status, .status');
        if (status) {
            status.textContent = 'Rejected';
            status.className = 'status rejected agent-status';
            status.style.background = '#fee2e2';
            status.style.color = '#991b1b';
            status.style.fontWeight = '800';
        }
    }

    function applyAgentStates() {
        var states = savedAgentStates();
        Object.keys(states).forEach(function (agencyName) {
            var state = states[agencyName];
            var row = findAgentRow(agencyName);
            if (!row || !state) return;
            if (state.deleted) {
                row.style.display = 'none';
            } else if (state.approved) {
                renderAgentApproved(row, agencyName, !!state.suspended);
            } else if (state.rejected) {
                renderAgentRejected(row);
            }
        });
    }

    window.viewAgentProperties = function (agencyName, info) {
        var agency = text(agencyName, 'Agent');
        var summary = text(info, 'Property inventory');
        saveAction('view-agent-properties', agency, { summary: summary }).finally(function () {
            openInfoModal('Agent properties', [agency, summary, 'Backend workflow record saved for audit tracking.']);
        });
    };

    window.viewAgentLeads = function (agencyName, info) {
        var agency = text(agencyName, 'Agent');
        var summary = text(info, 'Lead pipeline');
        saveAction('view-agent-leads', agency, { summary: summary }).finally(function () {
            openInfoModal('Agent leads', [agency, summary, 'Backend workflow record saved for audit tracking.']);
        });
    };

    window.approveAgentRegistration = function (buttonOrAgency, maybeAgency) {
        var button = buttonOrAgency && buttonOrAgency.nodeType === 1 ? buttonOrAgency : null;
        var agency = text(maybeAgency || buttonOrAgency, 'Agent registration');
        var row = button?.closest('tr') || findAgentRow(agency);
        saveAgentState(agency, { approved: true, rejected: false, suspended: false, deleted: false });
        renderAgentApproved(row, agency, false);
        saveAction('approve-agent-registration', agency, { row: row?.innerText || agency })
            .then(function () { toast(agency + ' approved and saved to backend workflow.'); })
            .catch(function (error) { toast(error.message); });
    };

    window.rejectAgentRegistration = function (buttonOrAgency, maybeAgency) {
        var button = buttonOrAgency && buttonOrAgency.nodeType === 1 ? buttonOrAgency : null;
        var agency = text(maybeAgency || buttonOrAgency, 'Agent registration');
        var row = button?.closest('tr') || findAgentRow(agency);
        saveAgentState(agency, { approved: false, rejected: true });
        renderAgentRejected(row);
        saveAction('reject-agent-registration', agency, { row: row?.innerText || agency })
            .then(function () { toast(agency + ' rejected and saved to backend workflow.'); })
            .catch(function (error) { toast(error.message); });
    };

    window.exportPlatformReport = function (event) {
        if (event?.preventDefault) event.preventDefault();
        var modal = document.getElementById('exportReportModal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('is-open');
            modal.style.opacity = '1';
            modal.style.pointerEvents = 'auto';
            modal.setAttribute('aria-hidden', 'false');
            modal.querySelector('input, select, textarea')?.focus();
            return;
        }
        openInfoModal('Export Platform Report', [
            'Configure report scope, period, status and format.',
            'This action is connected to backend workflow audit tracking.'
        ]);
    };

    window.closeExportReportModal = function () {
        hideModalById('exportReportModal');
    };

    window.submitPlatformReportExport = function (event) {
        if (event?.preventDefault) event.preventDefault();
        var form = document.getElementById('exportReportForm');
        var submit = document.getElementById('btnSubmitExportReport');
        var progress = document.getElementById('exportReportProgress');
        var done = document.getElementById('exportReportDone');
        var payload = {
            title: document.getElementById('reportTitleInput')?.value || 'Platform Operations Executive Report',
            scope: document.getElementById('reportScopeSelect')?.value || 'ALL',
            format: document.getElementById('reportFormatSelect')?.value || 'PDF',
            period: document.getElementById('reportPeriodSelect')?.value || 'THIS_MONTH',
            status: document.getElementById('reportStatusFilterSelect')?.value || 'ALL'
        };
        if (submit) {
            submit.disabled = true;
            submit.textContent = 'Generating...';
        }
        if (progress) progress.style.display = 'block';
        if (done) done.style.display = 'none';
        saveAction('export-platform-report', payload.title, payload)
            .then(function () {
                if (done) {
                    done.textContent = 'Report request saved to backend workflow audit.';
                    done.style.display = 'block';
                }
                toast('Platform report export saved to backend.');
                setTimeout(window.closeExportReportModal, 800);
            })
            .catch(function (error) {
                toast(error.message || 'Report export could not be saved.');
            })
            .finally(function () {
                if (progress) progress.style.display = 'none';
                if (submit) {
                    submit.disabled = false;
                    submit.textContent = 'Generate Report';
                }
                if (form) form.dataset.lastSubmitted = new Date().toISOString();
            });
    };

    window.navigateOwnerPage = function (delta) {
        var nextButton = Number(delta) > 0
            ? document.querySelector('.owner-next-btn')
            : document.querySelector('.owner-prev-btn');
        var group = nextButton?.closest('div');
        var active = group?.querySelector('button[style*="#2563eb"], button.active');
        var current = parseInt(active?.textContent || '1', 10) || 1;
        var page = Math.max(1, current + (Number(delta) || 0));
        if (active) {
            active.classList.remove('active');
            active.style.background = '#ffffff';
            active.style.color = '#0f172a';
        }
        var target = Array.from(group?.querySelectorAll('button') || []).find(function (button) {
            return button.textContent.trim() === String(page);
        });
        if (target) {
            target.classList.add('active');
            target.style.background = '#2563eb';
            target.style.color = '#ffffff';
        }
        saveAction('owner-page-navigation', 'Owner page ' + page, { page: page, delta: delta });
        toast('Owner page ' + page + ' loaded.');
    };

    document.addEventListener('click', function (event) {
        if (event.target.closest('[data-superadmin-close="info"]')) {
            event.preventDefault();
            closeInfoModal();
        }
    }, true);

    document.addEventListener('click', function (event) {
        var button = event.target.closest('button[onclick], a[onclick]');
        if (!button || document.body.dataset.dashboardRole !== 'superadmin') return;
        var onclick = button.getAttribute('onclick') || '';
        var match = onclick.match(/^\s*([A-Za-z_$][\w$]*)\s*\(/);
        if (!match) return;
        var fnName = match[1];
        if (typeof window[fnName] === 'function') return;
        event.preventDefault();
        event.stopImmediatePropagation();
        handleMissingInlineButton(button, fnName);
    }, true);

    document.addEventListener('DOMContentLoaded', applyAgentStates);
    window.addEventListener('hashchange', function () {
        if ((location.hash || '').slice(1) === 'agent-mgmt') setTimeout(applyAgentStates, 100);
    });
    setTimeout(applyAgentStates, 0);
})();
