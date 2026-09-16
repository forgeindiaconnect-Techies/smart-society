# Multi-Gate Apartment Entry Implementation

Implemented on top of the existing SmartSociety project without replacing unrelated modules.

## Added
- Persistent dynamic `Gate` model (`society_gates`)
- Persistent guard-to-gate assignment model (`security_gate_assignments`)
- Separate visitor entry and exit gate references
- Entry/exit security guard references and server-side exit timestamp
- Unique gate pass number alongside the existing QR token
- Resident approval/rejection flow for security-created visitors
- Gate-specific security access validation
- Active visitor lookup and search by visitor/mobile/vehicle/pass/flat
- Duplicate active vehicle protection
- Gate dashboard metrics
- Gate audit logging using the existing `AuditLog` model
- Society Admin Gate Management UI
- Resident pending gate-approval UI
- Security dashboard switched from hardcoded gate choices to persistent gates
- Exit action records the security dashboard's currently selected gate, allowing entry and exit through different gates

## Main endpoints
- `GET /api/society/gates`
- `POST /api/society/gates`
- `PUT /api/society/gates/{id}`
- `DELETE /api/society/gates/{id}`
- `GET /api/society/security/{securityId}/gates`
- `POST /api/society/security/{securityId}/gates`
- `DELETE /api/society/security/{securityId}/gates/{gateId}`
- `GET /api/society/gate-entries`
- `GET /api/society/gate-entries/active`
- `GET /api/society/gate-entries/search?query=...`
- `POST /api/society/gate-entries`
- `PATCH /api/society/gate-entries/{id}/approve`
- `PATCH /api/society/gate-entries/{id}/reject`
- `PATCH /api/society/gate-entries/{id}/entry`
- `PATCH /api/society/gate-entries/{id}/exit`
- `GET /api/society/gate-entries/dashboard`

## Database
The project already uses `spring.jpa.hibernate.ddl-auto=update` by default, so the two new tables and visitor columns are created automatically in the existing development setup. For production, use your normal reviewed migration process before deployment.

## Validation note
JavaScript syntax checks passed for the added/updated gate scripts. A full Maven compile/test could not run in the execution environment because Maven Central DNS/network resolution was unavailable and the Spring Boot parent POM was not already cached locally.
