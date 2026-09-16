// Isolated UI fixture server. Never used by Spring Boot or the production dashboard.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const at = minutes => new Date(Date.now() - minutes * 60000).toISOString();
const people = [
 {id:1001,name:'Alex Morgan',phone:'9000000001',vehicle:'KA 01 AB 1234',purpose:'Guest visit',category:'GUEST',status:'EXPECTED',approval:'APPROVED',passNumber:'SEC-1001',photo:'',unit:'A-204',resident:'Taylor Reed',entryGateId:1,entryGate:'Gate 1',exitGateId:null,exitGate:'',entryAt:null,exitAt:null,expectedAt:at(20),inside:false,flagged:false,overstay:false,allGates:false,validUntil:at(-180)},
 {id:1002,name:'Jordan Lee',phone:'9000000002',vehicle:'',purpose:'Family visit',category:'GUEST',status:'CHECKED_IN',approval:'APPROVED',passNumber:'SEC-1002',photo:'',unit:'B-102',resident:'Casey Ellis',entryGateId:1,entryGate:'Gate 1',exitGateId:null,exitGate:'',entryAt:at(50),exitAt:null,expectedAt:at(60),inside:true,flagged:false,overstay:false,allGates:false,validUntil:at(-180)},
 {id:1003,name:'Sam Parker',phone:'9000000003',vehicle:'KA 02 CD 5678',purpose:'Parcel delivery',category:'DELIVERY',status:'PENDING_APPROVAL',approval:'PENDING',passNumber:'SEC-1003',photo:'',unit:'C-306',resident:'Jamie Blake',entryGateId:3,entryGate:'Gate 3',exitGateId:null,exitGate:'',entryAt:null,exitAt:null,expectedAt:at(5),inside:false,flagged:false,overstay:false,allGates:false,validUntil:at(-60)}
];
const gates = [
 {id:1,number:'Gate 1',name:'South entrance',type:'VEHICULAR_MAIN',status:'OPEN',barrierStatus:'NOT_CONNECTED',allowed:true,guard:'Demo Guard',throughput:18,lastVehicle:'KA 01 AB 1234'},
 {id:2,number:'Gate 2',name:'North walkway',type:'PEDESTRIAN_ONLY',status:'OPEN',barrierStatus:'NOT_CONNECTED',allowed:true,guard:'Demo Guard',throughput:8,lastVehicle:'No vehicle recorded'},
 {id:3,number:'Gate 3',name:'Service & delivery',type:'SERVICE_DELIVERY',status:'OPEN',barrierStatus:'NOT_CONNECTED',allowed:true,guard:'Demo Guard',throughput:12,lastVehicle:'KA 02 CD 5678'},
 {id:4,number:'Gate 4',name:'Emergency exit',type:'EMERGENCY_EXIT_ONLY',status:'OPEN',barrierStatus:'NOT_CONNECTED',allowed:true,guard:'No active assignment',throughput:0,lastVehicle:'No vehicle recorded'}
];
const events = [
 {id:5,gateId:1,gate:'Gate 1',visitor:'Jordan Lee',type:'ENTRY',severity:'INFO',details:'Entry recorded after resident approval.',at:at(2),guard:'Demo Guard',hasPhoto:false},
 {id:4,gateId:3,gate:'Gate 3',visitor:'Sam Parker',type:'RESIDENT_ALERT',severity:'INFO',details:'Resident confirmation requested for parcel delivery.',at:at(4),guard:'Demo Guard',hasPhoto:false},
 {id:3,gateId:2,gate:'Gate 2',visitor:'Test vehicle',type:'DENIED',severity:'HIGH',details:'PEDESTRIAN_ONLY: Vehicles must use a vehicular gate.',at:at(7),guard:'Demo Guard',hasPhoto:false},
 {id:2,gateId:1,gate:'Gate 1',visitor:'Alex Morgan',type:'PASS_CREATED',severity:'INFO',details:'Pass assigned to Gate 1.',at:at(12),guard:'Demo Guard',hasPhoto:false}
];
let activeGate=1;
const files={
 '/dashboards/security':['src/main/resources/templates/dashboards/security.html','text/html'],
 '/smartapartment/css/security-console.css':['src/main/resources/static/smartapartment/css/security-console.css','text/css'],
 '/smartapartment/js/security-console.js':['src/main/resources/static/smartapartment/js/security-console.js','application/javascript']
};
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
 if(files[url.pathname]) {const [file,type]=files[url.pathname];let content=fs.readFileSync(path.join(root,file));if(type==='text/html')content=content.toString().replace('YOUR COMMUNITY. UNDER WATCH.','ISOLATED PREVIEW · SYNTHETIC TEST DATA');res.writeHead(200,{'Content-Type':type});return res.end(content);}
 if(url.pathname==='/api/society/gates')return send(200,gates);
 if(url.pathname.endsWith('/snapshot'))return send(200,{gates,visitors:people,events,watchlist:[],guard:'Demo Guard',role:'SECURITY_STAFF',lockdown:false,serverTime:at(0),inside:people.filter(p=>p.inside).length,overstays:0,hourly:38,residents:[{id:1,name:'Taylor Reed',unit:'A-204'}]});
 let raw='';for await(const chunk of req)raw+=chunk;let body={};try{body=raw?JSON.parse(raw):{};}catch{return send(400,{message:'Invalid test request'});}
 if(url.pathname.endsWith('/session')){activeGate=body.gateId;return send(200,{gateId:activeGate,token:'fixture-session',startedAt:at(0)});}
 if(url.pathname.endsWith('/verify')){const p=people.find(p=>p.passNumber===body.query);if(!p)return send(409,{message:'No matching fixture pass. Use SEC-1001.'});if(p.entryGateId!==activeGate)return send(409,{message:'GATE_MISMATCH_ERROR: Re-route to '+p.entryGate,visitor:p});return send(200,p);}
 if(url.pathname.endsWith('/resident-alert'))return send(200,{message:'Preview only: simulated resident notification.'});
 if(url.pathname.endsWith('/action')){const p=people.find(p=>p.id===body.visitorId);if(!p)return send(404,{message:'Fixture visitor missing'});p.inside=body.action==='ENTRY';p.status=body.action==='ENTRY'?'CHECKED_IN':'CHECKED_OUT';if(p.inside)p.entryAt=at(0);else {p.exitAt=at(0);p.exitGateId=activeGate;p.exitGate=gates.find(g=>g.id===activeGate).number;}return send(200,p);}
 return send(400,{message:'This write is disabled in the isolated visual preview. Backend behavior is tested separately.'});
});
server.listen(0,'127.0.0.1',()=>console.log('SECURITY_PREVIEW_URL=http://127.0.0.1:'+server.address().port+'/dashboards/security'));
