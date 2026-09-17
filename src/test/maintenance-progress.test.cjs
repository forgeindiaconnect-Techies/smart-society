const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'src/main/resources/static/shared/js/common-maintenance.js'), 'utf8');
function renderer() {
    const context = {window:{}, document:{body:{dataset:{platform:'propertydirect',dashboardRole:'customer'}},getElementById:()=>({}),addEventListener:()=>{}}};
    vm.runInNewContext(source, context);
    return context.window.renderMaintenanceProgressRows;
}
test('saved work stages and actual estimates appear without customer completion controls', () => {
    const render = renderer();
    const row = render([{id:1,workProgress:'Processing',ticketStatus:'IN_PROGRESS',estimatedCompletionAt:new Date(Date.now()+3600000).toISOString(),vendorNotes:'Replacing washer'}]);
    assert.match(row,/Processing/); assert.match(row,/60 min remaining/); assert.match(row,/Replacing washer/);
    assert.doesNotMatch(row,/button|Mark Resolved/);
    assert.match(render([{id:1,ticketStatus:'RESOLVED',workProgress:'Completed',resolvedAt:'2026-09-17T10:00:00'}]),/Completed/);
});
test('unknown and elapsed estimates are honest and user content is escaped', () => {
    const render = renderer();
    assert.match(render([{id:2,serviceType:'<img src=x onerror=alert(1)>'}]),/&lt;img/);
    assert.match(render([{id:2}]),/Completion estimate pending/);
    assert.match(render([{id:2,estimatedCompletionAt:'2020-01-01T00:00:00'}]),/Estimate elapsed/);
    assert.match(render([]),/No service bookings yet/);
});
test('edited dashboard inline scripts parse', () => {
    for (const file of ['dashboards/maintenance.html','dashboards/resident.html','propertydirect/dashboards/customer.html']) {
        const html = fs.readFileSync(path.join(root,'src/main/resources/templates',file),'utf8');
        for (const [,attributes,script] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
            if (/\bsrc=|application\/ld\+json/.test(attributes) || !script.trim()) continue;
            new vm.Script(script,{filename:file});
        }
    }
});
