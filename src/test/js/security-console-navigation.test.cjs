const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname,'../../main/resources/static/smartapartment/js/security-console.js'),'utf8');
const nodes = {};
const buttons = ['GUEST','PARCEL','FOOD_DELIVERY','CAB','CONTRACTOR'].map(category => ({dataset:{arrival:category}}));
function node(id) {
    return nodes[id] ||= {hidden:false,value:'all',dataset:{},classList:{remove(){}},setAttribute(){},querySelectorAll:()=>buttons};
}
const context = vm.createContext({
    document:{body:{dataset:{}},querySelectorAll:()=>[]},location:{hash:'#overview'},
    $:node,renderQueue(){},media:null,stopCamera(){},today:()=>true
});
const declarations = [' const state = ', ' const titles=', ' const descriptions='].map(prefix => {
    const start=source.indexOf(prefix); return source.slice(start,source.indexOf('\n',start));
}).join('\n');
const route = source.slice(source.indexOf(' function route()'),source.indexOf(' function categoryMatch'));
const filters = source.slice(source.indexOf(' function categoryMatch'),source.indexOf(' function renderQueue'));
vm.runInContext(declarations+'\n'+route+'\n'+filters,context);
const screens = {
    overview:['overviewMetrics','overviewActions','arrivalShortcuts','deskSection','activitySection'],
    verify:['deskSection','verificationTerminal'],
    entries:['queueSection','queueFilters','newPassButton'],
    visitors:['queueSection'],
    deliveries:['arrivalShortcuts','queueSection','queueFilters','newPassButton'],
    staff:['arrivalShortcuts','queueSection','queueFilters','newPassButton'],
    incidents:['incidentSection'],
    gates:['gatesSection']
};
const ids = [...new Set(Object.values(screens).flat())];
for (const [view,visible] of Object.entries(screens)) {
    context.location.hash='#'+view;
    vm.runInContext('route()',context);
    for (const id of ids) assert.equal(node(id).hidden,!visible.includes(id),`${view}: ${id}`);
    assert.equal(context.document.body.dataset.securityView,view);
    if(view==='visitors')assert.equal(vm.runInContext('state.queue',context),'inside');
    if(view==='deliveries')assert.deepEqual(buttons.filter(b=>!b.hidden).map(b=>b.dataset.arrival),['PARCEL','FOOD_DELIVERY']);
    if(view==='staff')assert.deepEqual(buttons.filter(b=>!b.hidden).map(b=>b.dataset.arrival),['CONTRACTOR']);
}
context.location.hash='#unknown';vm.runInContext('route()',context);
assert.equal(context.document.body.dataset.securityView,'overview');
context.location.hash='#deliveries';vm.runInContext('route()',context);
assert.equal(vm.runInContext("categoryMatch({category:'GUEST'})",context),false);
assert.equal(vm.runInContext("categoryMatch({category:'PARCEL'})",context),true);
context.location.hash='#staff';vm.runInContext('route()',context);
assert.equal(vm.runInContext("categoryMatch({category:'PARCEL'})",context),false);
assert.equal(vm.runInContext("categoryMatch({category:'DOMESTIC_STAFF'})",context),true);
const page=fs.readFileSync(path.resolve(__dirname,'../../main/resources/templates/dashboards/security.html'),'utf8');
assert.doesNotMatch(page,/id="lockdownButton"/);
assert.doesNotMatch(source,/lockdownButton|function lockdown\(/);
console.log('Security navigation: 8 screens, fallback, category filters and lockdown removal passed.');

// Exercise actual startup so removing a control cannot break all subsequent handlers.
const idsInPage = new Set([...page.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
const startupNodes = {};
const startupNode = id => {
    assert.ok(idsInPage.has(id), `Startup references missing element ${id}`);
    return startupNodes[id] ||= {innerHTML:'',value:'all',hidden:false,style:{},open:false,
        classList:{remove(){},toggle(){}},setAttribute(){},addEventListener(){},
        querySelectorAll:()=>[],querySelector:()=>null};
};
const snapshot={guard:'Test Guard',gates:[],visitors:[],events:[],watchlist:[],inside:0,hourly:0,overstays:0,lockdown:false};
const startupContext = vm.createContext({
    document:{body:{dataset:{}},getElementById:startupNode,querySelectorAll:()=>[],addEventListener(){}},
    location:{hash:'#verify'},window:{addEventListener(){}},navigator:{},
    setInterval(){},setTimeout,clearTimeout,AbortSignal,Date,
    fetch:async url=>({ok:true,json:async()=>url.endsWith('/snapshot')?snapshot:[]})
});
vm.runInContext(source,startupContext);
setImmediate(()=>{
    try {
        assert.ok(startupNodes.refreshAll.onclick, 'Global refresh should be wired');
        assert.equal(startupNodes.verificationTerminal.hidden,false);
        assert.equal(startupNodes.overviewMetrics.hidden,true);
        assert.equal(startupNodes.guardName.textContent,'Test Guard');
        assert.notEqual(startupNodes.connection.textContent,'Connection lost');
        console.log('Security console startup and snapshot rendering passed.');
    } catch(error) {console.error(error);process.exitCode=1;}
});
