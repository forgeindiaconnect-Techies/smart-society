const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname, '../../main/resources/static/smartapartment/js/resident-worker-chat.js'), 'utf8');
const page = fs.readFileSync(path.resolve(__dirname, '../../main/resources/templates/dashboards/resident.html'), 'utf8');
const pagePlatform = page.match(/<body[^>]*data-platform="([^"]+)"/)[1];

async function tracking(requests, reference, tickets = [], platform = pagePlatform, fetchError = null) {
    const root = {textContent: '', innerHTML: ''}, modal = {style: {}};
    const context = {
        window: {}, document: {body: {dataset: {platform, dashboardRole: 'resident'}},
            getElementById: id => id === 'trackWorkerModal' ? modal : root},
        fetch: async url => { if (fetchError) throw fetchError; return {ok:true, status:200, json:async () => url.startsWith('/api/maintenance/requests') ? requests : tickets}; },
        Date, String, Number, Error, AbortSignal
    };
    vm.runInNewContext(source, context);
    await context.window.showTrackWorkerModal('Kumar', reference);
    return root;
}

(async () => {
    let root = await tracking([{requestNumber:'MR-1', status:'WAITING_FOR_WORKER', title:'Cleaning'}], 'MR-1');
    assert.match(root.innerHTML, /WAITING FOR WORKER/);
    assert.match(root.innerHTML, /Not assigned/);
    assert.doesNotMatch(root.innerHTML, /Kumar|En Route|15 mins/);
    root = await tracking([{requestNumber:'MR-1', status:'TRAVELLING', assignedWorkerName:'Actual Worker', assignedWorkerId:42}], 'MR-1');
    assert.match(root.innerHTML, /TRAVELLING/);
    assert.match(root.innerHTML, /Actual Worker/);
    assert.match(root.innerHTML, /data-chat-worker="42"/);
    assert.doesNotMatch(root.innerHTML, /WAITING FOR WORKER/);
    root = await tracking([{requestNumber:'MR-2', status:'TRAVELLING'}], 'MR-1');
    assert.match(root.textContent, /No saved maintenance request/);
    root = await tracking([], 'DIRECT-1-2');
    assert.match(root.textContent, /direct worker conversation/);
    root = await tracking([], 'MR-3', [{ticketCode:'MR-3', ticketStatus:'DISPATCHED', vendorName:'Saved Vendor'}]);
    assert.match(root.innerHTML, /DISPATCHED/);
    assert.match(root.innerHTML, /Saved Vendor/);
    root = await tracking([{requestNumber:'MR-1', status:'ASSIGNED'}], 'MR-1', [], 'smartsociety');
    assert.match(root.innerHTML, /ASSIGNED/);
    const timeout = new Error('timeout'); timeout.name = 'TimeoutError';
    root = await tracking([], null, [], pagePlatform, timeout);
    assert.match(root.textContent, /took too long/);
    const blocked = {window:{},document:{body:{dataset:{platform:'propertydirect',dashboardRole:'resident'}}}};
    vm.runInNewContext(source,blocked);
    assert.equal(blocked.window.showTrackWorkerModal,undefined);
    console.log('Resident tracking: 8 scenarios passed, including the actual page platform.');
})().catch(error => { console.error(error); process.exitCode = 1; });
