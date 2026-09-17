# Maintenance Booking & Progress Fix

## What was broken

The maintenance admin page contained a JavaScript runtime error in the `defaultTickets` declaration. It referenced an undeclared variable named `ticket` before any live API calls were executed. That stopped the rest of the dashboard script, including the routine maintenance fetch, which made valid customer/resident service bookings appear missing.

The project also intentionally has two maintenance pipelines:

- Routine service booking -> `CommonMaintenanceTicket`
- Emergency live dispatch -> `EmergencyMaintenanceBooking`

The maintenance dashboard now continues loading both workflows instead of failing before the routine ticket pipeline starts.

## Fixed end-to-end routine workflow

1. Resident/customer creates a service request through `/api/maintenance`.
2. The request is persisted in `common_maintenance_tickets` with the authenticated requester ID and source platform.
3. Maintenance Admin loads the same persisted tickets from `/api/maintenance/dispatch/tickets`.
4. An unassigned request is visible in the Open Ticket Pool.
5. Admin claims it -> status `ASSIGNED` -> UI label `Started`.
6. Admin chooses ETA and starts work -> status `IN_PROGRESS`, `workStartedAt` and `estimatedCompletionAt` are persisted -> UI label `Processing`.
7. Resident/customer dashboard refreshes from the backend and displays the same work status plus the remaining completion time.
8. Admin marks completed -> status `RESOLVED`, `resolvedAt` is persisted -> UI label `Completed`.
9. The completed record remains visible in the requesting resident/customer dashboard.
10. Ticket list APIs filter non-admin users by `requesterId` and platform, so service details are shown only to the requester.

## Emergency workflow ETA enhancement

`EmergencyMaintenanceBooking` now stores:

- `estimatedDurationMinutes`
- `estimatedCompletionAt`

When emergency work starts, a category-based default estimate is persisted and exposed as:

- `workProgress`
- `remainingWorkMinutes`
- `remainingWorkText`
- `estimatedCompletionAt`

`resident-maintenance.html` displays Started / Processing / Completed together with the remaining work time and refreshes every 30 seconds even when SSE is connected.

## Files changed

- `src/main/resources/templates/dashboards/maintenance.html`
- `src/main/resources/templates/dashboards/resident-maintenance.html`
- `src/main/java/com/smartapartment/entity/EmergencyMaintenanceBooking.java`
- `src/main/java/com/smartapartment/service/EmergencyMaintenanceService.java`

## Validation performed

- Inline JavaScript in both maintenance templates was checked with `node --check` and has no syntax errors.
- Maven compilation could not be executed in this environment because the `mvn` executable / Maven wrapper is not installed. The source changes were statically inspected for Java syntax and method compatibility.
