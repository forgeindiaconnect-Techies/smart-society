# Security dashboard implementation

Scope: `dashboards/security.html`, its dedicated CSS/JavaScript, and new security-console API, persistence and tests. Shared dashboard assets and other dashboard templates are not modified by this implementation.

## Runtime

- `/dashboards/security` uses only `security-console.css` and `security-console.js`; the old shared click handlers do not run on this page.
- The console reads existing society gates, guard assignments, residents and visitors. Its gate-list bootstrap uses the existing `/api/society/gates` initialization behavior.
- `/api/society/security-console/**` requires an authenticated security guard or society administrator. Policies and lockdown release require society administrator authority.
- Gate selection starts a random gate-bound token in the authenticated HTTP session, with a 12-hour maximum lifetime. Existing assignment status and shift windows are rechecked for actions; switching gates invalidates the previous token. Where a society has no assignments for a guard, the existing application's all-gates access convention is retained.
- Snapshot refresh is every 10 seconds while the page is visible. Decisions are revalidated against current server data, including lockdown, at submission. Offline data never enables a new decision.

## Workflow

Register arrival → receive a six-digit PIN and five-minute signed QR → request resident approval → verify at the assigned gate → approve entry → record exit at any exit-capable gate. A completed pass cannot be reused; create a fresh visit. Vehicle lookup requires an exact normalized plate and refuses ambiguous matches.

Resident requests are persisted in the existing resident notification system and use existing visitor approval endpoints. They are not SMS or telephone calls. Security staff cannot grant their own resident approval. A manual entry requires a permitted reason and a captured JPEG, and cannot bypass routing, watchlist, expiry, anti-passback or lockdown rules.

PINs are stored as tenant-specific keyed digests. JWTs have an issuer, tenant, pass ID, token ID, direction and expiry. PIN failures are throttled after five failed lookups in one authenticated session. Visitor changes use a tenant serialization lock plus a pessimistic visitor lock and the existing optimistic version column. Security staff are prevented from using superseded visitor/gate-entry mutation endpoints to bypass the new console; other roles retain their existing routes.

The sidebar provides working views for verification, entry register, people on site, deliveries, staff/contractors, incidents/watchlist and gate overview. Staff attendance uses visitor journeys categorized as domestic staff or contractor. Enter verifies a focused lookup; with the visitor result reviewed and focus outside a form, Enter approves. Escape clears the result. F2 opens the QR camera. Unsupported cameras/scanners provide a PIN/token fallback; overrides require a camera photo.

## Persistence

Four additive tables are managed through the project's existing JPA schema configuration:

- `security_console_gates`: designated gate taxonomy, operating status and restricted opening hours.
- `security_console_passes`: visitor, assigned gate or all-gates flag, PIN digest, token identifier, direction and expiry.
- `security_console_events`: append-only application audit rows, including actor, gate, visitor, denial reason and override evidence. Hibernate marks these immutable and the repository exposes no update/delete methods. Database administrators still have database-level control; this is not an external tamper-proof ledger.
- `security_console_watchlist`: tenant-specific normalized phone/vehicle restrictions and reasons.

Example Gate, EntryPass and SecurityIncident payloads are in `src/test/resources/security-console-contract-examples.json`. They are illustrative and are never seeded into a live dashboard.

## Integration boundaries

Physical barriers, external ANPR hardware, push delivery and emergency-service dispatch are not connected in this repository. The UI explicitly identifies missing barrier telemetry; lockdown restricts console entry decisions and preserves exits. Personnel must coordinate physical barriers and emergency response. The existing resident/admin APIs continue to have their original behavior; console-specific policy is enforced for security-desk decisions.

QR scanning uses the browser BarcodeDetector API on HTTPS or localhost. PIN and pasted signed-token verification work without camera support. Photo evidence is private to the audit storage and is not exposed in the general stream.

## Verification

The project normally skips test compilation. Run the focused suite explicitly:

```powershell
.\maven\apache-maven-3.9.16\bin\mvn.cmd -o '-Dmaven.test.skip=false' '-Dtest=SecurityConsoleTests' test
node --check src/main/resources/static/smartapartment/js/security-console.js
```

The suite uses an isolated in-memory H2 database and covers routing denials with durable audit events, duplicate entry, cross-gate exit, consumed passes, lockdown, permission checks, watchlist matching, mandatory evidence, tenant/session isolation, signed QR/PIN expiry and legacy-route bypass protection.
