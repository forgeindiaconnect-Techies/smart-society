# SmartSociety and PropertyDirect Product Benchmark

Research date: 21 July 2026. This document uses public product information for feature benchmarking only. SmartSociety and PropertyDirect retain their own design, naming, data model and implementation.

## SmartSociety benchmark

Official sources reviewed:

- [MyGate apartment management](https://mygate.com/apartment-management-system/)
- [MyGate feature guide](https://mygate.com/society-management-system/features/)
- [NoBrokerHood society management](https://www.nobrokerhood.com/solutions/society-management-system)
- [ADDA platform](https://sg.adda.io/)
- [ApnaComplex platform](https://www.apnacomplex.com/home/)

Market-standard capability groups:

| Core | Required workflow in SmartSociety |
|---|---|
| Tenant SaaS | Platform approval, plans, isolated society data and role-scoped portals |
| Billing | Recurring charge rules, invoice generation, late fees, payments, receipts and reconciliation |
| Gate security | Visitor pre-approval, QR/pass code, delivery/service entry, check-in/out and inside/overstay view |
| Residents | Apartments, owners/tenants, household members, vehicles and move-in/out status |
| Helpdesk | Categorised tickets, assignment, SLA deadline, escalation, work notes and closure |
| Facilities | Amenity configuration, collision-free slot booking, approval and fee tracking |
| Workforce | Staff/vendor directory, attendance and service categories |
| Communication | Notices, emergency alerts, polls and voting |
| Facilities ERP | Assets, AMC/service dates, vendors, expenses, documents and events |
| Governance | Audit history, role controls, operational and financial summaries |

## PropertyDirect benchmark

Official sources reviewed:

- [NoBroker property marketplace](https://www.nobroker.in/)
- [NoBroker tenant workflow](https://www.nobroker.in/about/tenants)
- [Housing search guide](https://support.housing.com/support/solutions/articles/4000200975-how-to-find-a-property-on-housing-com-)
- [Housing search filters](https://support.housing.com/support/solutions/articles/4000200978-how-filters-work-in-property-search-)
- [Magicbricks owner dashboard](https://www.magicbricks.com/ownerdashboard/owners-home)

Market-standard capability groups:

| Core | Required workflow in PropertyDirect |
|---|---|
| Discovery | Buy/rent mode, city/locality/landmark query, budget, BHK, furnishing and availability filters |
| Trust | Owner identity state, listing review state, freshness and clear price/deposit/maintenance fields |
| Decision support | Detailed facts, amenities, nearby information, photos and shortlist |
| Conversion | Direct enquiry, contact request and visit scheduling |
| Retention | Saved searches and customer dashboard history |
| Supply | Persistent owner listing creation, editing, deactivation and enquiry tracking |
| Services | Assisted search and service-request tracking without pretending to process real payments |

## Product boundaries

- Payment records represent verified/manual or gateway-confirmed results; the application never fabricates a successful payment.
- Listing verification is an explicit admin workflow and never inferred merely because a listing exists.
- Uploaded files are stored as metadata URLs until an object-storage provider is configured.
- SMS, push notifications, maps, biometrics, QR scanners and payment gateways require external providers; internal state and integration-ready APIs are implemented without fake third-party success responses.
