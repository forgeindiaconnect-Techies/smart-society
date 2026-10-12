const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const page = fs.readFileSync(path.resolve(__dirname, '../../main/resources/templates/dashboards/maintenance.html'), 'utf8');
const helper = page.slice(page.indexOf('        let maintenanceChatIdentity = null;'), page.indexOf('        let activeMaintCustomerChat = {'));
const context = vm.createContext({fetch: async () => ({ok:true, json: async () => ({id:12, email:'selvak@example.com', name:'Selvakumar Chinnaraj'})})});
(async () => {
    vm.runInContext(helper, context);
    await vm.runInContext('loadMaintenanceChatIdentity()', context);
    assert.equal(vm.runInContext("maintenanceSenderLabel({senderId:'selvak@example.com',senderName:'Kumar'})",context), 'You (Selvakumar Chinnaraj)');
    assert.equal(vm.runInContext("maintenanceSenderLabel({senderId:'other@example.com',senderName:'Another worker'})",context), 'Another worker');
    assert.equal(vm.runInContext("maintenanceSenderLabel({senderName:'Historical sender'})",context), 'Historical sender');
    assert.equal(vm.runInContext("maintenanceSenderLabel({senderId:'12',senderName:'Old name'})",context), 'You (Selvakumar Chinnaraj)');
    console.log('Maintenance chat identity: 4 scenarios passed.');
})().catch(error => {console.error(error); process.exitCode=1;});
