(() => {
    'use strict';
    if (!['smartapartment', 'smartsociety'].includes(document.body.dataset.platform) || document.body.dataset.dashboardRole !== 'resident') return;
    const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    async function api(path, options = {}) {
        const response = await fetch(path, {credentials:'same-origin', signal:AbortSignal.timeout(15000), ...options, headers:{Accept:'application/json', ...options.headers}});
        if (response.redirected || [401,403].includes(response.status)) throw new Error('Sign in with your resident account to continue.');
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || data.detail || 'Unable to load maintenance information. Please retry.');
        return data;
    }
    window.openMaintenanceWorkerPicker = async () => {
        document.getElementById('maintenanceWorkerPicker')?.remove();
        const dialog = document.createElement('dialog');
        dialog.id = 'maintenanceWorkerPicker';
        dialog.style.cssText = 'width:min(560px,94vw);max-height:80vh;overflow:auto;border:1px solid #dbe3ef;border-radius:20px;padding:24px;';
        dialog.innerHTML = '<div class="d-flex justify-content-between align-items-center mb-3"><h5>Chat with a maintenance worker</h5><button type="button" class="btn-close" aria-label="Close worker list"></button></div><input type="search" class="form-control mb-3" aria-label="Search maintenance workers" placeholder="Search name or trade"><p role="status">Loading workers…</p><div data-workers></div>';
        document.body.appendChild(dialog);
        dialog.querySelector('.btn-close').onclick = () => dialog.close();
        dialog.addEventListener('close', () => dialog.remove());
        dialog.showModal();
        const status = dialog.querySelector('[role=status]'), list = dialog.querySelector('[data-workers]');
        try {
            const workers = await api('/api/resident/maintenance-chat/workers');
            status.textContent = workers.length ? 'Select a worker to start or reopen your conversation.' : 'No maintenance workers are available in your society.';
            function render(query = '') {
                const matches = workers.filter(w => `${w.name || ''} ${w.designation || ''}`.toLowerCase().includes(query.toLowerCase()));
                list.innerHTML = matches.map(w => `<div class="d-flex justify-content-between align-items-center gap-3 border-bottom py-3"><div><strong>${escape(w.name)}</strong><div class="small text-muted">${escape(w.designation || 'Maintenance worker')}</div></div><button type="button" class="btn btn-primary" data-worker="${Number(w.id)}">Chat</button></div>`).join('') || (workers.length ? '<p>No workers match your search.</p>' : '');
            }
            render();
            dialog.querySelector('input').oninput = event => render(event.target.value);
            list.onclick = async event => {
                const button = event.target.closest('[data-worker]');
                if (!button) return;
                button.disabled = true;
                try {
                    const conversation = await api(`/api/resident/maintenance-chat/workers/${button.dataset.worker}/conversation`, {method:'POST'});
                    // Load without auto-selecting another thread before opening the chosen worker.
                    await window.loadResidentChatThreads(true);
                    if (!window.__residentThreadsCache?.[conversation.conversationKey]) throw new Error('Conversation was saved, but could not be loaded. Refresh messages and retry.');
                    dialog.close();
                    window.openResidentChatByKey(conversation.conversationKey);
                } catch (error) { status.textContent = error.message; button.disabled = false; }
            };
        } catch (error) { status.textContent = error.message; }
    };

    window.showTrackWorkerModal = async (_workerName, ticketNumber) => {
        const modal = document.getElementById('trackWorkerModal'), root = document.getElementById('residentTrackingDetails');
        if (!modal || !root) return;
        const activeKey = typeof activeResidentChat !== 'undefined' ? activeResidentChat.conversationId : null;
        const thread = window.__residentThreadsCache?.[activeKey];
        const reference = ticketNumber || thread?.ticketNumber || (typeof activeResidentChat !== 'undefined' ? activeResidentChat.ticketNumber : null);
        modal.style.display = 'flex';
        root.textContent = 'Loading saved request status…';
        if (reference?.startsWith('DIRECT-')) {
            root.textContent = 'This is a direct worker conversation. Select a service request to view its saved progress.';
            return;
        }
        try {
            const requests = await api('/api/maintenance/requests?filter=all');
            let matches = reference ? requests.filter(r => r.requestNumber === reference) : requests;
            if (!matches.length) {
                const tickets = await api('/api/maintenance?sourcePlatform=smartsociety');
                matches = tickets.filter(t => !reference || t.ticketId === reference || t.ticketCode === reference || t.externalReference === reference).map(t => ({
                    requestNumber: t.ticketId || t.ticketCode, title: t.title || t.serviceType,
                    assignedWorkerName: t.vendorName,
                    status: t.ticketStatus
                }));
            }
            if (!matches.length) { root.textContent = 'No saved maintenance request is linked to this conversation. No worker status or ETA is available.'; return; }
            root.innerHTML = matches.map(r => `<article class="border rounded-3 p-3 mb-3"><strong>${escape(r.requestNumber)} · ${escape(r.title || r.serviceType)}</strong><p class="mt-2 mb-1">Worker: ${escape(r.assignedWorkerName || 'Not assigned')}</p><p class="mb-1">Status: <strong>${escape(String(r.status || 'REQUESTED').replaceAll('_',' '))}</strong></p><p class="mb-0 text-muted">${r.estimatedStartTime ? `Estimated start: ${escape(new Date(r.estimatedStartTime).toLocaleString('en-IN'))}` : 'Arrival estimate not provided'}</p>${r.assignedWorkerId ? `<button type="button" class="btn btn-primary mt-3" data-chat-worker="${Number(r.assignedWorkerId)}">Chat with worker</button>` : ''}</article>`).join('');
            root.onclick = async event => {
                const button = event.target.closest('[data-chat-worker]');
                if (!button) return;
                button.disabled = true;
                try {
                    const c = await api(`/api/resident/maintenance-chat/workers/${button.dataset.chatWorker}/conversation`, {method:'POST'});
                    await window.loadResidentChatThreads(true);
                    if (!window.__residentThreadsCache?.[c.conversationKey]) throw new Error('Unable to load the saved conversation. Please retry.');
                    window.closeTrackWorkerModal(); window.openResidentChatByKey(c.conversationKey);
                } catch(error) { button.disabled = false; const message = document.createElement('p'); message.textContent = error.message; root.appendChild(message); }
            };
        } catch(error) { root.textContent = error.name === 'TimeoutError' ? 'Tracking took too long to load. Close this window and try again.' : error.message || 'Worker tracking could not load. Please try again.'; }
    };
})();
