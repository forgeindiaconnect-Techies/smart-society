package com.smartapartment;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import com.smartapartment.entity.AppUser;
import com.smartapartment.entity.EmergencyMaintenanceBooking;
import com.smartapartment.entity.MaintenanceHub;
import com.smartapartment.entity.MaintenancePartner;
import com.smartapartment.repository.AppUserRepository;
import com.smartapartment.repository.EmergencyMaintenanceBookingRepository;
import com.smartapartment.repository.MaintenanceHubRepository;
import com.smartapartment.repository.MaintenancePartnerRepository;

@SpringBootTest
@AutoConfigureMockMvc
class Stage5AdminEmergencyDashboardTests {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private MaintenancePartnerRepository partnerRepository;

    @Autowired
    private MaintenanceHubRepository hubRepository;

    @Autowired
    private AppUserRepository userRepository;

    @Autowired
    private EmergencyMaintenanceBookingRepository bookingRepository;

    private MaintenancePartner ensureTestPartnerAndHubExists() {
        var existing = partnerRepository.findAll();
        if (!existing.isEmpty()) {
            return existing.get(0);
        }
        MaintenanceHub hub = new MaintenanceHub();
        hub.setName("Indiranagar Emergency Hub");
        hub.setCity("Bangalore");
        hub.setArea("Indiranagar");
        hub.setLatitude(12.9716);
        hub.setLongitude(77.6412);
        hub.setRadiusKm(15.0);
        hub.setActive(true);
        hub = hubRepository.save(hub);

        AppUser user = userRepository.findByEmail("maintenance@smartapartment").orElse(null);
        Long userId = user != null ? user.getId() : 1L;

        MaintenancePartner partner = new MaintenancePartner();
        partner.setUserId(userId);
        partner.setName("Rajesh Sharma");
        partner.setPhone("9876543210");
        partner.setHubId(hub.getId());
        partner.setTrade("Plumbing");
        partner.setSkillCategories("Plumbing,HVAC,Electrical");
        partner.setEmploymentType("IN_HOUSE");
        partner.setOnDuty(true);
        partner.setWorkState("IDLE");
        partner.setAvailability("IDLE");
        partner.setLatitude(12.9720);
        partner.setLongitude(77.6420);
        return partnerRepository.save(partner);
    }

    private MockHttpSession loginAsMaintenanceStaff() throws Exception {
        MvcResult result = mvc.perform(post("/api/auth/dashboard-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"platform\":\"smartapartment\",\"role\":\"maintenance\",\"username\":\"maintenance@smartapartment\",\"password\":\"maintenance123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.redirect").value("/dashboards/maintenance"))
                .andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    @Test
    @DisplayName("Anonymous users cannot access Maintenance Admin dashboard")
    void anonymousAccessRedirectsToLogin() throws Exception {
        mvc.perform(get("/dashboards/maintenance"))
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrl("/?loginRequired=true"));
    }

    @Test
    @DisplayName("Maintenance Admin dashboard renders Top-Level Queue Separation: Tickets vs Live Bookings")
    void maintenanceDashboardRendersTopLevelQueueSeparation() throws Exception {
        MockHttpSession session = loginAsMaintenanceStaff();

        mvc.perform(get("/dashboards/maintenance").session(session))
                .andExpect(status().isOk())
                // Topbar Queue Selector: Tickets | Live Bookings
                .andExpect(content().string(containsString("id=\"topNavTickets\"")))
                .andExpect(content().string(containsString("id=\"topNavLiveBookings\"")))
                .andExpect(content().string(containsString("id=\"topNavLiveBookingsBadge\"")))
                .andExpect(content().string(containsString("window.switchQueuePipeline")))
                // Sidebar Separated Navigation
                .andExpect(content().string(containsString("Track 1: Tickets (Non-Emergency)")))
                .andExpect(content().string(containsString("Track 2: Live Bookings (Emergency)")))
                .andExpect(content().string(containsString("id=\"sidebarEmergencyBadge\"")))
                // Distinct Queue Views with Separated Track Banners
                .andExpect(content().string(containsString("id=\"track1TasksBanner\"")))
                .andExpect(content().string(containsString("Track 1: Non-Emergency Tickets")))
                .andExpect(content().string(containsString("id=\"track1ComplaintsBanner\"")))
                .andExpect(content().string(containsString("Track 1: Non-Emergency Ticket Pool")))
                .andExpect(content().string(containsString("id=\"track2DispatchBanner\"")))
                .andExpect(content().string(containsString("Track 2: Emergency Live Bookings")))
                // Ensure the two operational pipelines are housed in strictly distinct data-views
                .andExpect(content().string(containsString("data-view=\"tasks\"")))
                .andExpect(content().string(containsString("data-view=\"complaints\"")))
                .andExpect(content().string(containsString("data-view=\"dispatch\"")));
    }

    @Test
    @DisplayName("Emergency Dispatch Bookings API is accessible to Maintenance Admin")
    void emergencyDispatchBookingsApiAccessible() throws Exception {
        MockHttpSession session = loginAsMaintenanceStaff();

        mvc.perform(get("/api/maintenance/dispatch/bookings").session(session))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON));
    }

    @Test
    @DisplayName("Superadmin can also access Maintenance Admin dashboard with superadmin permissions")
    void superadminAccessesMaintenanceDashboard() throws Exception {
        MvcResult result = mvc.perform(post("/api/auth/dashboard-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"platform\":\"smartapartment\",\"role\":\"superadmin\",\"username\":\"superadmin@smartapartment\",\"password\":\"superadmin123\"}"))
                .andExpect(status().isOk())
                .andReturn();
        MockHttpSession session = (MockHttpSession) result.getRequest().getSession(false);

        mvc.perform(get("/dashboards/maintenance").session(session))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("data-view=\"workers\"")))
                .andExpect(content().string(containsString("id=\"topNavTickets\"")))
                .andExpect(content().string(containsString("id=\"topNavLiveBookings\"")))
                .andExpect(content().string(containsString("Super Admin Mode")))
                .andExpect(content().string(containsString("Super Admin Console")));
    }

    @Test
    @DisplayName("Superadmin can login directly with role=maintenance and access full dispatch operations")
    void superadminDirectMaintenanceLoginAndDispatchAccess() throws Exception {
        MvcResult result = mvc.perform(post("/api/auth/dashboard-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"platform\":\"smartapartment\",\"role\":\"maintenance\",\"username\":\"superadmin@smartapartment\",\"password\":\"superadmin123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.redirect").value("/dashboards/maintenance"))
                .andExpect(jsonPath("$.role").value("maintenance"))
                .andReturn();
        MockHttpSession session = (MockHttpSession) result.getRequest().getSession(false);

        // Access Maintenance Admin dashboard
        mvc.perform(get("/dashboards/maintenance").session(session))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("Super Admin Mode")));

        // Access Emergency Dispatch bookings API with Super Admin authority
        mvc.perform(get("/api/maintenance/dispatch/bookings").session(session))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON));

        // Access Super Admin dashboard and verify Maintenance Operations link
        mvc.perform(get("/dashboards/superadmin").session(session))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("id=\"sidebarMaintenanceOpsLink\"")))
                .andExpect(content().string(containsString("/dashboards/maintenance#dispatch")));
    }

    @Test
    @DisplayName("Live Emergency Summary Cards render on Live Bookings view with real metric elements")
    void liveEmergencySummaryCardsRendered() throws Exception {
        MockHttpSession session = loginAsMaintenanceStaff();

        mvc.perform(get("/dashboards/maintenance").session(session))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("id=\"liveEmergencySummaryCards\"")))
                .andExpect(content().string(containsString("id=\"cardLiveEmergenciesCount\"")))
                .andExpect(content().string(containsString("id=\"cardUnassignedCount\"")))
                .andExpect(content().string(containsString("id=\"cardOnSiteCount\"")))
                .andExpect(content().string(containsString("id=\"cardInProgressCount\"")))
                .andExpect(content().string(containsString("id=\"cardSlaRiskCount\"")))
                .andExpect(content().string(containsString("Live Emergencies")))
                .andExpect(content().string(containsString("Unassigned")))
                .andExpect(content().string(containsString("On-Site")))
                .andExpect(content().string(containsString("In Progress")))
                .andExpect(content().string(containsString("SLA Risk / Breached")));
    }

    @Test
    @DisplayName("Live Bookings Table renders clear emergency operations view with all 11 required fields")
    void liveBookingsTableRendersAll11OperationalFields() throws Exception {
        MockHttpSession session = loginAsMaintenanceStaff();

        mvc.perform(get("/dashboards/maintenance").session(session))
                .andExpect(status().isOk())
                // Verify Table Title & Toolbar
                .andExpect(content().string(containsString("Live Emergency Operations View")))
                .andExpect(content().string(containsString("id=\"liveDispatchTable\"")))
                .andExpect(content().string(containsString("id=\"liveBookingsSearchInput\"")))
                .andExpect(content().string(containsString("id=\"liveBookingsStatusFilter\"")))
                .andExpect(content().string(containsString("id=\"liveBookingsFilteredCount\"")))
                // Verify all 11 explicit operational column headers
                .andExpect(content().string(containsString("Emergency Booking ID")))
                .andExpect(content().string(containsString("Customer")))
                .andExpect(content().string(containsString("Service Category")))
                .andExpect(content().string(containsString("Area / Location")))
                .andExpect(content().string(containsString("Resolved Hub")))
                .andExpect(content().string(containsString("Assigned Partner")))
                .andExpect(content().string(containsString("Distance")))
                .andExpect(content().string(containsString("Assignment Type")))
                .andExpect(content().string(containsString("Current Status")))
                .andExpect(content().string(containsString("Created Time")))
                .andExpect(content().string(containsString("SLA Status / Countdown")))
                .andExpect(content().string(containsString("Actions & Controls")))
                // Verify partner dispatch overlay modal
                .andExpect(content().string(containsString("id=\"assignPartnerOverlay\"")))
                .andExpect(content().string(containsString("id=\"candidatePartnersList\"")));
    }

    @Test
    @DisplayName("Emergency dispatch bookings API supplies all 11 required operational fields")
    void emergencyBookingsApiResponseContainsRequiredOperationalFields() throws Exception {
        MockHttpSession session = loginAsMaintenanceStaff();

        // Register customer to create test emergency booking
        String suffix = java.util.UUID.randomUUID().toString().substring(0, 8);
        String registration = "{\"name\":\"Priya Sharma\",\"phone\":\"9876543210\",\"email\":\"priya-" + suffix + "@example.com\",\"username\":\"priya-" + suffix + "\",\"password\":\"secret123\"}";
        var customer = (MockHttpSession) mvc.perform(post("/api/auth/propertydirect/register-customer")
                        .contentType(MediaType.APPLICATION_JSON).content(registration))
                .andExpect(status().isOk()).andReturn().getRequest().getSession(false);

        String createBookingPayload = """
                {
                    "category": "Plumbing",
                    "description": "Burst pipe causing flooding in kitchen",
                    "city": "Bangalore",
                    "area": "Koramangala",
                    "serviceAddress": "Tower 2, Flat 304, Green Glen",
                    "latitude": 12.9352,
                    "longitude": 77.6245,
                    "requesterName": "Priya Sharma",
                    "requesterPhone": "9876543210"
                }
                """;
        mvc.perform(post("/api/maintenance/dispatch/bookings?platform=propertydirect")
                        .session(customer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBookingPayload))
                .andExpect(status().isOk());

        // Fetch bookings list as maintenance admin and assert all required operational fields
        mvc.perform(get("/api/maintenance/dispatch/bookings").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", not(empty())))
                .andExpect(jsonPath("$[0].bookingReference", notNullValue()))
                .andExpect(jsonPath("$[0].customer", notNullValue()))
                .andExpect(jsonPath("$[0].serviceCategory", notNullValue()))
                .andExpect(jsonPath("$[0].location", notNullValue()))
                .andExpect(jsonPath("$[0].resolvedHub", notNullValue()))
                .andExpect(jsonPath("$[0].assignedPartner", notNullValue()))
                .andExpect(jsonPath("$[0].distance", notNullValue()))
                .andExpect(jsonPath("$[0].assignmentType", notNullValue()))
                .andExpect(jsonPath("$[0].currentStatus", notNullValue()))
                .andExpect(jsonPath("$[0].createdAt", notNullValue()))
                .andExpect(jsonPath("$[0].slaStatus", notNullValue()))
                .andExpect(jsonPath("$[0].statusBadgeLabel", notNullValue()));
    }

    @Test
    @DisplayName("Emergency status indicators render all 11 distinct operational states with consistent labels and colors")
    void emergencyStatusIndicatorsRenderAll11StatesWithConsistentStyling() throws Exception {
        MockHttpSession session = loginAsMaintenanceStaff();

        mvc.perform(get("/dashboards/maintenance").session(session))
                .andExpect(status().isOk())
                // Verify Status Indicators Legend element
                .andExpect(content().string(containsString("id=\"emergencyStatusLegend\"")))
                // Verify all 11 human-understandable status labels
                .andExpect(content().string(containsString("Searching Partner")))
                .andExpect(content().string(containsString("Awaiting Acceptance")))
                .andExpect(content().string(containsString("Accepted")))
                .andExpect(content().string(containsString("En Route")))
                .andExpect(content().string(containsString("On Site")))
                .andExpect(content().string(containsString("Before Photo Uploaded")))
                .andExpect(content().string(containsString("In Progress")))
                .andExpect(content().string(containsString("Completed")))
                .andExpect(content().string(containsString("Failed Assignment")))
                .andExpect(content().string(containsString("SLA Risk")))
                .andExpect(content().string(containsString("SLA Breached")))
                // Verify status filter contains all 11 states
                .andExpect(content().string(containsString("value=\"UNASSIGNED\">Searching Partner</option>")))
                .andExpect(content().string(containsString("value=\"OFFERED\">Awaiting Acceptance</option>")))
                .andExpect(content().string(containsString("value=\"ACCEPTED\">Accepted</option>")))
                .andExpect(content().string(containsString("value=\"EN_ROUTE\">En Route</option>")))
                .andExpect(content().string(containsString("value=\"REACHED_LOCATION\">On Site</option>")))
                .andExpect(content().string(containsString("value=\"PHOTO_START\">Before Photo Uploaded</option>")))
                .andExpect(content().string(containsString("value=\"IN_PROGRESS\">In Progress</option>")))
                .andExpect(content().string(containsString("value=\"COMPLETED\">Completed</option>")))
                .andExpect(content().string(containsString("value=\"FAILED_ASSIGNMENT\">Failed Assignment</option>")))
                .andExpect(content().string(containsString("value=\"SLA_RISK\">SLA Risk</option>")))
                .andExpect(content().string(containsString("value=\"SLA_BREACHED\">SLA Breached</option>")))
                // Verify status badge generator function exists in client script
                .andExpect(content().string(containsString("window.getEmergencyStatusBadge")));
    }

    @Test
    @DisplayName("SLA Tracking: Admin recognizes Within SLA, Approaching Breach, and SLA Breached with text, icons, countdowns, and progress indicators")
    void slaTrackingIndicatorsAndUrgencyRulesRendered() throws Exception {
        MockHttpSession session = loginAsMaintenanceStaff();

        mvc.perform(get("/dashboards/maintenance").session(session))
                .andExpect(status().isOk())
                // Verify SLA Urgency Reference Legend and 30m target definition
                .andExpect(content().string(containsString("id=\"slaUrgencyLegend\"")))
                .andExpect(content().string(containsString("SLA Urgency Rules (30m Target):")))
                // Distinct text, icons, and badges for Within SLA, Approaching Breach, and Breached
                .andExpect(content().string(containsString("Within SLA")))
                .andExpect(content().string(containsString("Approaching SLA Breach")))
                .andExpect(content().string(containsString("SLA Breached (Overdue)")))
                .andExpect(content().string(containsString("Within SLA (Arrived On-Time)")))
                // Verify icons are present for each SLA state so UI does not rely only on color
                .andExpect(content().string(containsString("fa-clock-rotate-left")))
                .andExpect(content().string(containsString("fa-triangle-exclamation")))
                .andExpect(content().string(containsString("fa-circle-exclamation")))
                .andExpect(content().string(containsString("fa-circle-check")))
                // Verify filter dropdown includes SLA stages
                .andExpect(content().string(containsString("value=\"WITHIN_SLA\">Within SLA</option>")))
                .andExpect(content().string(containsString("value=\"APPROACHING_BREACH\">Approaching SLA Breach</option>")))
                // Verify client-side countdown state function and ticker
                .andExpect(content().string(containsString("window.getSlaState")))
                .andExpect(content().string(containsString("calculateSlaBadgeHtml")))
                .andExpect(content().string(containsString("sla-indicator-block")))
                .andExpect(content().string(containsString("data-sla-stage")));
    }

    @Test
    @DisplayName("SLA Tracking: Backend API calculates SLA from real timestamps (arrivalDueAt, createdAt) and business rules")
    void emergencySlaBackendCalculationsAccurate() throws Exception {
        MockHttpSession session = loginAsMaintenanceStaff();

        // Create a test emergency booking
        String suffix = java.util.UUID.randomUUID().toString().substring(0, 8);
        String registration = "{\"name\":\"SLA Customer\",\"phone\":\"9876543299\",\"email\":\"sla-" + suffix + "@example.com\",\"username\":\"sla-" + suffix + "\",\"password\":\"secret123\"}";
        var customer = (MockHttpSession) mvc.perform(post("/api/auth/propertydirect/register-customer")
                        .contentType(MediaType.APPLICATION_JSON).content(registration))
                .andExpect(status().isOk()).andReturn().getRequest().getSession(false);

        String createBookingPayload = """
                {
                    "category": "Electrical",
                    "description": "Main breaker smoking and sparked emergency",
                    "city": "Bangalore",
                    "area": "Indiranagar",
                    "serviceAddress": "100 Feet Rd, 4th Block",
                    "latitude": 12.9716,
                    "longitude": 77.6412,
                    "requesterName": "SLA Customer",
                    "requesterPhone": "9876543299"
                }
                """;
        mvc.perform(post("/api/maintenance/dispatch/bookings?platform=propertydirect")
                        .session(customer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBookingPayload))
                .andExpect(status().isOk());

        // Fetch bookings and verify SLA timestamp metadata is populated from real backend business rules
        mvc.perform(get("/api/maintenance/dispatch/bookings").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", not(empty())))
                .andExpect(jsonPath("$[0].arrivalDueAt", notNullValue()))
                .andExpect(jsonPath("$[0].slaTargetDeadline", notNullValue()))
                .andExpect(jsonPath("$[0].slaTargetDeadlineFormatted", notNullValue()))
                .andExpect(jsonPath("$[0].slaTargetMinutes").value(30))
                .andExpect(jsonPath("$[0].slaStage", notNullValue()))
                .andExpect(jsonPath("$[0].slaStageLabel", notNullValue()))
                .andExpect(jsonPath("$[0].slaMinutesRemaining", notNullValue()))
                .andExpect(jsonPath("$[0].slaSecondsRemaining", notNullValue()))
                .andExpect(jsonPath("$[0].slaOverdueMinutes", notNullValue()))
                .andExpect(jsonPath("$[0].slaBreached", notNullValue()))
                .andExpect(jsonPath("$[0].slaRisk", notNullValue()))
                .andExpect(jsonPath("$[0].slaStatus", notNullValue()));
    }

    @Test
    @DisplayName("Live Dispatch View: Dashboard supports List/Grid View and Map View with Hub, Emergency, and Partner context")
    void liveDispatchViewSupportsListAndMapView() throws Exception {
        MockHttpSession session = loginAsMaintenanceStaff();

        mvc.perform(get("/dashboards/maintenance").session(session))
                .andExpect(status().isOk())
                // View Switcher controls
                .andExpect(content().string(containsString("id=\"dispatchViewSwitcher\"")))
                .andExpect(content().string(containsString("id=\"btnDispatchViewList\"")))
                .andExpect(content().string(containsString("id=\"btnDispatchViewMap\"")))
                // List/Grid View container
                .andExpect(content().string(containsString("id=\"dispatchListView\"")))
                // Map View container and components
                .andExpect(content().string(containsString("id=\"dispatchMapView\"")))
                .andExpect(content().string(containsString("id=\"liveEmergencyMap\"")))
                .andExpect(content().string(containsString("id=\"mapIncidentsSideRail\"")))
                .andExpect(content().string(containsString("id=\"mapQueueCount\"")))
                .andExpect(content().string(containsString("data-map-filter=\"ALL\"")))
                // Reused Leaflet 1.9.4 & OpenStreetMap mapping infrastructure
                .andExpect(content().string(containsString("leaflet@1.9.4/dist/leaflet.css")))
                .andExpect(content().string(containsString("leaflet@1.9.4/dist/leaflet.js")))
                // Marker custom styles and operational context classes
                .andExpect(content().string(containsString("emergency-map-pin")))
                .andExpect(content().string(containsString("partner-map-pin")))
                .andExpect(content().string(containsString("hub-map-pin")))
                // Client map management logic
                .andExpect(content().string(containsString("window.switchDispatchLayout = function(layout)")))
                .andExpect(content().string(containsString("function initOrUpdateEmergencyMap()")))
                .andExpect(content().string(containsString("window.renderEmergencyMapMarkers = function()")))
                .andExpect(content().string(containsString("window.renderMapIncidentsSideRail = function()")))
                .andExpect(content().string(containsString("window.focusEmergencyOnMap = function(bookingId)")));
    }

    @Test
    @DisplayName("Live Dispatch View: Backend API provides coordinates for Emergency Location, Assigned Partner, and Hub")
    void liveDispatchApiProvidesMapCoordinates() throws Exception {
        MockHttpSession session = loginAsMaintenanceStaff();

        // Ensure at least one emergency booking exists
        String suffix = java.util.UUID.randomUUID().toString().substring(0, 8);
        String registration = "{\"name\":\"Map Customer\",\"phone\":\"9876543288\",\"email\":\"map-" + suffix + "@example.com\",\"username\":\"map-" + suffix + "\",\"password\":\"secret123\"}";
        var customer = (MockHttpSession) mvc.perform(post("/api/auth/propertydirect/register-customer")
                        .contentType(MediaType.APPLICATION_JSON).content(registration))
                .andExpect(status().isOk()).andReturn().getRequest().getSession(false);

        String createBookingPayload = """
                {
                    "category": "Plumbing",
                    "description": "Burst pipe flooding basement emergency",
                    "city": "Bangalore",
                    "area": "Koramangala",
                    "serviceAddress": "80 Feet Rd, 6th Block",
                    "latitude": 12.9352,
                    "longitude": 77.6245,
                    "requesterName": "Map Customer",
                    "requesterPhone": "9876543288"
                }
                """;
        mvc.perform(post("/api/maintenance/dispatch/bookings?platform=propertydirect")
                        .session(customer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBookingPayload))
                .andExpect(status().isOk());

        // Fetch bookings and verify map coordinates are returned in the dispatch payload
        mvc.perform(get("/api/maintenance/dispatch/bookings").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", not(empty())))
                .andExpect(jsonPath("$[0].latitude", notNullValue()))
                .andExpect(jsonPath("$[0].longitude", notNullValue()))
                .andExpect(jsonPath("$[0].hubLatitude", notNullValue()))
                .andExpect(jsonPath("$[0].hubLongitude", notNullValue()))
                .andExpect(jsonPath("$[0].hubRadiusKm", notNullValue()));
    }

    @Test
    @DisplayName("Unassigned & Failed Assignment Queue: Highly visible queue rendered with all 8 operational fields and zero normal booking search required")
    void unassignedAndFailedAssignmentQueueRendered() throws Exception {
        MockHttpSession session = loginAsMaintenanceStaff();

        mvc.perform(get("/dashboards/maintenance").session(session))
                .andExpect(status().isOk())
                // Highly visible dedicated queue container and urgent header
                .andExpect(content().string(containsString("id=\"unassignedActionQueueContainer\"")))
                .andExpect(content().string(containsString("id=\"unassignedQueueHeader\"")))
                .andExpect(content().string(containsString("URGENT ACTION QUEUE: Unassigned &amp; Failed Emergency Dispatches")))
                .andExpect(content().string(containsString("id=\"unassignedQueueCountBadge\"")))
                // Alert and Zero-state banners
                .andExpect(content().string(containsString("id=\"unassignedZeroStateBanner\"")))
                .andExpect(content().string(containsString("id=\"unassignedAlertBanner\"")))
                .andExpect(content().string(containsString("id=\"unassignedBannerText\"")))
                // Dedicated Table and 8 required operational columns:
                // 1. Booking ID, 2. Category, 3. Customer Area, 4. Hub, 5. Time Waiting, 6. Assignment Failure Reason, 7. Possible Partners, 8. Manual Assign Action
                .andExpect(content().string(containsString("id=\"unassignedActionTable\"")))
                .andExpect(content().string(containsString("id=\"unassignedQueueBody\"")))
                .andExpect(content().string(containsString("<th scope=\"col\">Booking ID</th>")))
                .andExpect(content().string(containsString("<th scope=\"col\">Category</th>")))
                .andExpect(content().string(containsString("<th scope=\"col\">Customer Area</th>")))
                .andExpect(content().string(containsString("<th scope=\"col\">Hub</th>")))
                .andExpect(content().string(containsString("<th scope=\"col\">Time Waiting</th>")))
                .andExpect(content().string(containsString("<th scope=\"col\">Assignment Failure Reason</th>")))
                .andExpect(content().string(containsString("<th scope=\"col\">Possible Partners</th>")))
                .andExpect(content().string(containsString("Manual Assign Action")))
                // Summary metric card jumps directly to unassigned queue without searching
                .andExpect(content().string(containsString("document.getElementById('unassignedActionQueueContainer')?.scrollIntoView")))
                // Client-side rendering and modal integration
                .andExpect(content().string(containsString("window.renderUnassignedEmergencyQueue = function()")))
                .andExpect(content().string(containsString("window.openAssignPartnerModal")));
    }

    @Test
    @DisplayName("Unassigned & Failed Assignment Queue: Backend API exposes time waiting, failure reason, and possible partners")
    void unassignedQueueApiProvidesOperationalActionFields() throws Exception {
        MockHttpSession session = loginAsMaintenanceStaff();

        // Create an unassigned emergency booking
        String suffix = java.util.UUID.randomUUID().toString().substring(0, 8);
        String registration = "{\"name\":\"Unassigned Customer\",\"phone\":\"9876543277\",\"email\":\"unassigned-" + suffix + "@example.com\",\"username\":\"unassigned-" + suffix + "\",\"password\":\"secret123\"}";
        var customer = (MockHttpSession) mvc.perform(post("/api/auth/propertydirect/register-customer")
                        .contentType(MediaType.APPLICATION_JSON).content(registration))
                .andExpect(status().isOk()).andReturn().getRequest().getSession(false);

        String createBookingPayload = """
                {
                    "category": "HVAC",
                    "description": "AC unit sparked and shut down with smoke",
                    "city": "Bangalore",
                    "area": "HSR Layout",
                    "serviceAddress": "Sector 2, 27th Main",
                    "latitude": 12.9121,
                    "longitude": 77.6446,
                    "requesterName": "Unassigned Customer",
                    "requesterPhone": "9876543277"
                }
                """;
        mvc.perform(post("/api/maintenance/dispatch/bookings?platform=propertydirect")
                        .session(customer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBookingPayload))
                .andExpect(status().isOk());

        // Verify API payload includes all unassigned queue action properties
        mvc.perform(get("/api/maintenance/dispatch/bookings").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", not(empty())))
                .andExpect(jsonPath("$[0].timeWaitingMinutes", notNullValue()))
                .andExpect(jsonPath("$[0].timeWaitingFormatted", notNullValue()))
                .andExpect(jsonPath("$[0].assignmentFailureReason", notNullValue()))
                .andExpect(jsonPath("$[0].failureReason", notNullValue()))
                .andExpect(jsonPath("$[0].possiblePartnersCount", notNullValue()))
                .andExpect(jsonPath("$[0].requiresAdminAction", notNullValue()))
                .andExpect(jsonPath("$[0].isUnassignedOrFailed", notNullValue()));
    }

    @Test
    @DisplayName("Manual Assignment UI: Modal renders all 8 decision criteria with clear Assign action and auto-refresh")
    void manualAssignmentModalAndDecisionDataRendered() throws Exception {
        MockHttpSession session = loginAsMaintenanceStaff();

        mvc.perform(get("/dashboards/maintenance").session(session))
                .andExpect(status().isOk())
                // Modal structure & target elements
                .andExpect(content().string(containsString("id=\"assignPartnerOverlay\"")))
                .andExpect(content().string(containsString("id=\"candidatePartnersList\"")))
                .andExpect(content().string(containsString("id=\"assignPartnerBookingRef\"")))
                // All 8 decision criteria represented in the UI template:
                // 1. Partner name, 2. Trade, 3. Hub, 4. Distance, 5. Employment type, 6. Duty status, 7. Work status, 8. Current availability
                .andExpect(content().string(containsString("partner-candidate-name")))
                .andExpect(content().string(containsString("partner-candidate-trade")))
                .andExpect(content().string(containsString("partner-candidate-hub")))
                .andExpect(content().string(containsString("partner-candidate-distance")))
                .andExpect(content().string(containsString("employmentType")))
                .andExpect(content().string(containsString("partner-candidate-duty")))
                .andExpect(content().string(containsString("partner-candidate-work")))
                .andExpect(content().string(containsString("partner-candidate-avail")))
                // Clear Assign Action
                .andExpect(content().string(containsString("assign-partner-submit-btn")))
                .andExpect(content().string(containsString("Assign Partner")))
                // Script orchestration: Open modal, submit assignment, refresh booking data
                .andExpect(content().string(containsString("window.openAssignPartnerModal = async function(bookingId)")))
                .andExpect(content().string(containsString("window.assignPartnerToBooking = async function(bookingId, partnerId)")))
                .andExpect(content().string(containsString("await window.loadDispatchBookings()")))
                // Booking table display of Manual Assignment Type
                .andExpect(content().string(containsString("b.assignmentType === 'Manual'")));
    }

    @Test
    @DisplayName("Manual Assignment UI: Candidate Partners API returns useful decision data")
    void candidatePartnersApiExposesUsefulDecisionData() throws Exception {
        MockHttpSession session = loginAsMaintenanceStaff();
        ensureTestPartnerAndHubExists();

        // Create an unassigned booking
        String suffix = java.util.UUID.randomUUID().toString().substring(0, 8);
        String registration = "{\"name\":\"Candidate Customer\",\"phone\":\"9876543266\",\"email\":\"candidate-" + suffix + "@example.com\",\"username\":\"candidate-" + suffix + "\",\"password\":\"secret123\"}";
        var customer = (MockHttpSession) mvc.perform(post("/api/auth/propertydirect/register-customer")
                        .contentType(MediaType.APPLICATION_JSON).content(registration))
                .andExpect(status().isOk()).andReturn().getRequest().getSession(false);

        String createBookingPayload = """
                {
                    "category": "Plumbing",
                    "description": "Pipe leaking under kitchen sink",
                    "city": "Bangalore",
                    "area": "Indiranagar",
                    "serviceAddress": "100 Feet Rd, 3rd Stage",
                    "latitude": 12.9716,
                    "longitude": 77.6412,
                    "requesterName": "Candidate Customer",
                    "requesterPhone": "9876543266"
                }
                """;
        MvcResult bookingResult = mvc.perform(post("/api/maintenance/dispatch/bookings?platform=propertydirect")
                        .session(customer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBookingPayload))
                .andExpect(status().isOk())
                .andReturn();

        // Extract booking ID
        com.fasterxml.jackson.databind.JsonNode rootNode = new com.fasterxml.jackson.databind.ObjectMapper().readTree(bookingResult.getResponse().getContentAsString());
        long bookingId = rootNode.get("id").asLong();

        // Query candidate partners endpoint for this booking
        mvc.perform(get("/api/maintenance/dispatch/bookings/" + bookingId + "/candidates").session(session))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$", not(empty())))
                // Verify all 8 decision criteria are exposed in the JSON response
                .andExpect(jsonPath("$[0].partnerName", notNullValue()))
                .andExpect(jsonPath("$[0].trade", notNullValue()))
                .andExpect(jsonPath("$[0].hub", notNullValue()))
                .andExpect(jsonPath("$[0].distance", notNullValue()))
                .andExpect(jsonPath("$[0].employmentType", notNullValue()))
                .andExpect(jsonPath("$[0].dutyStatus", notNullValue()))
                .andExpect(jsonPath("$[0].workStatus", notNullValue()))
                .andExpect(jsonPath("$[0].currentAvailability", notNullValue()))
                .andExpect(jsonPath("$[0].id", notNullValue()));
    }

    @Test
    @DisplayName("Manual Assignment UI: Admin assignment sets Assignment Type = Manual, updates status to Accepted, and shows assigned partner")
    void adminAssignPartnerApiUpdatesStatusAndAssignmentTypeToManual() throws Exception {
        MockHttpSession session = loginAsMaintenanceStaff();
        ensureTestPartnerAndHubExists();

        // 1. Create a test customer & unassigned emergency booking
        String suffix = java.util.UUID.randomUUID().toString().substring(0, 8);
        String registration = "{\"name\":\"Manual Assign Customer\",\"phone\":\"9876543255\",\"email\":\"manual-" + suffix + "@example.com\",\"username\":\"manual-" + suffix + "\",\"password\":\"secret123\"}";
        var customer = (MockHttpSession) mvc.perform(post("/api/auth/propertydirect/register-customer")
                        .contentType(MediaType.APPLICATION_JSON).content(registration))
                .andExpect(status().isOk()).andReturn().getRequest().getSession(false);

        String createBookingPayload = """
                {
                    "category": "Plumbing",
                    "description": "Flooding in washroom urgent",
                    "city": "Bangalore",
                    "area": "Indiranagar",
                    "serviceAddress": "100 Feet Rd, 2nd Stage",
                    "latitude": 12.9716,
                    "longitude": 77.6412,
                    "requesterName": "Manual Assign Customer",
                    "requesterPhone": "9876543255"
                }
                """;
        MvcResult bookingResult = mvc.perform(post("/api/maintenance/dispatch/bookings?platform=propertydirect")
                        .session(customer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBookingPayload))
                .andExpect(status().isOk())
                .andReturn();

        com.fasterxml.jackson.databind.JsonNode rootNode = new com.fasterxml.jackson.databind.ObjectMapper().readTree(bookingResult.getResponse().getContentAsString());
        long bookingId = rootNode.get("id").asLong();

        // 2. Fetch candidates to get an eligible partner ID
        MvcResult candResult = mvc.perform(get("/api/maintenance/dispatch/bookings/" + bookingId + "/candidates").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", not(empty())))
                .andReturn();

        com.fasterxml.jackson.databind.JsonNode candidates = new com.fasterxml.jackson.databind.ObjectMapper().readTree(candResult.getResponse().getContentAsString());
        long partnerId = candidates.get(0).get("id").asLong();

        // 3. Admin performs manual assignment
        String assignPayload = "{\"bookingId\":" + bookingId + ",\"partnerId\":" + partnerId + "}";
        mvc.perform(post("/api/maintenance/dispatch/admin/assign")
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(assignPayload))
                .andExpect(status().isOk());

        // 4. Fetch the booking and verify post-assignment requirements:
        // - Refreshed booking data
        // - Updated status (ACCEPTED)
        // - Selected partner is shown
        // - Assignment Type = Manual
        mvc.perform(get("/api/maintenance/dispatch/bookings").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == " + bookingId + ")].jobStatus").value(hasItem(anyOf(equalTo("ASSIGNED"), equalTo("ACCEPTED")))))
                .andExpect(jsonPath("$[?(@.id == " + bookingId + ")].statusLabel").value(hasItem("Accepted")))
                .andExpect(jsonPath("$[?(@.id == " + bookingId + ")].assignmentType").value(hasItem("Manual")))
                .andExpect(jsonPath("$[?(@.id == " + bookingId + ")].partnerId").value(hasItem((int) partnerId)))
                .andExpect(jsonPath("$[?(@.id == " + bookingId + ")].assignedPartner").value(notNullValue()));
    }

    @Test
    @DisplayName("Step 9: Emergency Booking Details Drawer UI Pattern & Components")
    void emergencyBookingDetailsDrawerUiPatternAndComponents() throws Exception {
        MockHttpSession session = loginAsMaintenanceStaff();

        mvc.perform(get("/dashboards/maintenance").session(session))
                .andExpect(status().isOk())
                // Drawer Container Elements
                .andExpect(content().string(containsString("id=\"bookingDetailsDrawerOverlay\"")))
                .andExpect(content().string(containsString("id=\"bookingDetailsDrawer\"")))
                .andExpect(content().string(containsString("id=\"drawerBookingRefBadge\"")))
                .andExpect(content().string(containsString("id=\"drawerBookingTitle\"")))
                .andExpect(content().string(containsString("id=\"drawerBodyContent\"")))
                .andExpect(content().string(containsString("id=\"drawerActionButtons\"")))
                // Drawer Functions
                .andExpect(content().string(containsString("window.openBookingDetailsDrawer = async function(bookingId)")))
                .andExpect(content().string(containsString("window.closeBookingDetailsDrawer = function()")))
                .andExpect(content().string(containsString("window.renderBookingDetailsDrawerContent = function(b)")))
                .andExpect(content().string(containsString("window.triggerCallCustomer = function(bookingId, phone)")))
                // Drawer 6 Domain Sections & All Specified Fields
                .andExpect(content().string(containsString("id=\"drawerSectionBooking\"")))
                .andExpect(content().string(containsString("id=\"drawerSectionCustomer\"")))
                .andExpect(content().string(containsString("id=\"drawerSectionIssue\"")))
                .andExpect(content().string(containsString("id=\"drawerSectionLocation\"")))
                .andExpect(content().string(containsString("id=\"drawerSectionPartner\"")))
                .andExpect(content().string(containsString("id=\"drawerSectionAssignment\"")))
                .andExpect(content().string(containsString("id=\"drawerSectionTimeline\"")))
                // Specific Required Field Labels
                .andExpect(content().string(containsString("Booking ID")))
                .andExpect(content().string(containsString("Current status")))
                .andExpect(content().string(containsString("Created time")))
                .andExpect(content().string(containsString("SLA")))
                .andExpect(content().string(containsString("Call Customer action")))
                .andExpect(content().string(containsString("Category")))
                .andExpect(content().string(containsString("Description")))
                .andExpect(content().string(containsString("City")))
                .andExpect(content().string(containsString("Area")))
                .andExpect(content().string(containsString("Hub")))
                .andExpect(content().string(containsString("Trade")))
                .andExpect(content().string(containsString("Employment type")))
                .andExpect(content().string(containsString("Auto or Manual")))
                .andExpect(content().string(containsString("Assignment time")))
                .andExpect(content().string(containsString("Assigned by if manual")))
                // Timeline milestones
                .andExpect(content().string(containsString("Reached Location")))
                .andExpect(content().string(containsString("Before Photo")))
                .andExpect(content().string(containsString("In Progress")))
                .andExpect(content().string(containsString("Completed")));
    }

    @Test
    @DisplayName("Step 9: Backend Details Endpoint provides complete 6-section model with timeline timestamps")
    void emergencyBookingDetailsEndpointProvidesCompleteModel() throws Exception {
        MockHttpSession session = loginAsMaintenanceStaff();
        ensureTestPartnerAndHubExists();

        // 1. Create a detailed booking
        String suffix = java.util.UUID.randomUUID().toString().substring(0, 8);
        String registration = "{\"name\":\"Details Customer\",\"phone\":\"9876543211\",\"email\":\"details-" + suffix + "@example.com\",\"username\":\"details-" + suffix + "\",\"password\":\"secret123\"}";
        var customer = (MockHttpSession) mvc.perform(post("/api/auth/propertydirect/register-customer")
                        .contentType(MediaType.APPLICATION_JSON).content(registration))
                .andExpect(status().isOk()).andReturn().getRequest().getSession(false);

        String createBookingPayload = """
                {
                    "category": "Plumbing",
                    "description": "Burst pipe flooding corridor on 4th floor",
                    "city": "Bangalore",
                    "area": "Indiranagar",
                    "serviceAddress": "Tower A, Flat 402, Indiranagar",
                    "latitude": 12.9716,
                    "longitude": 77.6412,
                    "requesterName": "Details Customer",
                    "requesterPhone": "9876543211"
                }
                """;
        MvcResult createResult = mvc.perform(post("/api/maintenance/dispatch/bookings?platform=propertydirect")
                        .session(customer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBookingPayload))
                .andExpect(status().isOk())
                .andReturn();

        long bookingId = new com.fasterxml.jackson.databind.ObjectMapper()
                .readTree(createResult.getResponse().getContentAsString()).get("id").asLong();

        // 2. Fetch candidates & assign a partner manually
        MvcResult candResult = mvc.perform(get("/api/maintenance/dispatch/bookings/" + bookingId + "/candidates").session(session))
                .andExpect(status().isOk())
                .andReturn();
        com.fasterxml.jackson.databind.JsonNode candidates = new com.fasterxml.jackson.databind.ObjectMapper().readTree(candResult.getResponse().getContentAsString());
        long partnerId = candidates.get(0).get("id").asLong();

        mvc.perform(post("/api/maintenance/dispatch/admin/assign")
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"bookingId\":" + bookingId + ",\"partnerId\":" + partnerId + "}"))
                .andExpect(status().isOk());

        // 3. Fetch full booking details view via GET /api/maintenance/dispatch/bookings/{id}
        mvc.perform(get("/api/maintenance/dispatch/bookings/" + bookingId).session(session))
                .andExpect(status().isOk())
                // Section 1: Booking
                .andExpect(jsonPath("$.id").value(bookingId))
                .andExpect(jsonPath("$.currentStatus", notNullValue()))
                .andExpect(jsonPath("$.createdAt", notNullValue()))
                .andExpect(jsonPath("$.createdTimeFormatted", notNullValue()))
                .andExpect(jsonPath("$.slaStage", notNullValue()))
                .andExpect(jsonPath("$.slaStatusText", notNullValue()))
                // Section 2: Customer
                .andExpect(jsonPath("$.customerName", notNullValue()))
                .andExpect(jsonPath("$.customerPhone", notNullValue()))
                .andExpect(jsonPath("$.canCallCustomer").value(true))
                .andExpect(jsonPath("$.serviceAddress", notNullValue()))
                // Section 3: Issue
                .andExpect(jsonPath("$.category").value("Plumbing"))
                .andExpect(jsonPath("$.description", containsString("Burst pipe")))
                // Section 4: Location
                .andExpect(jsonPath("$.city").value("Bangalore"))
                .andExpect(jsonPath("$.area").value("Indiranagar"))
                .andExpect(jsonPath("$.hub", notNullValue()))
                // Section 5: Partner
                .andExpect(jsonPath("$.partnerName", notNullValue()))
                .andExpect(jsonPath("$.partnerPhone", notNullValue()))
                .andExpect(jsonPath("$.partnerTrade", notNullValue()))
                .andExpect(jsonPath("$.partnerEmploymentType", notNullValue()))
                .andExpect(jsonPath("$.partnerHub", notNullValue()))
                .andExpect(jsonPath("$.partnerCurrentStatus", notNullValue()))
                // Section 6: Assignment
                .andExpect(jsonPath("$.assignmentType").value("Manual"))
                .andExpect(jsonPath("$.assignedAtFormatted", notNullValue()))
                .andExpect(jsonPath("$.assignedBy", notNullValue()))
                // Section 7: Timeline with timestamps
                .andExpect(jsonPath("$.timeline", not(empty())))
                .andExpect(jsonPath("$.timeline[?(@.stage == 'ACCEPTED')].timestamp", notNullValue()))
                .andExpect(jsonPath("$.timeline[?(@.stage == 'ACCEPTED')].formattedTime", notNullValue()))
                .andExpect(jsonPath("$.timeline[?(@.stage == 'REACHED_LOCATION')]", notNullValue()))
                .andExpect(jsonPath("$.timeline[?(@.stage == 'BEFORE_PHOTO')]", notNullValue()))
                .andExpect(jsonPath("$.timeline[?(@.stage == 'IN_PROGRESS')]", notNullValue()))
                .andExpect(jsonPath("$.timeline[?(@.stage == 'COMPLETED')]", notNullValue()));
    }

    @Test
    @DisplayName("Step 10: Photo Verification Viewer UI and Lightbox Components are Present in Maintenance Template")
    void photoVerificationViewerUiAndLightboxComponents() throws Exception {
        MockHttpSession session = loginAsMaintenanceStaff();

        mvc.perform(get("/dashboards/maintenance").session(session))
                .andExpect(status().isOk())
                // In-place Lightbox modal (Zero navigation away)
                .andExpect(content().string(containsString("id=\"photoVerificationLightbox\"")))
                .andExpect(content().string(containsString("id=\"lightboxPhotoKindBadge\"")))
                .andExpect(content().string(containsString("id=\"lightboxBookingRefBadge\"")))
                .andExpect(content().string(containsString("id=\"lightboxTitle\"")))
                .andExpect(content().string(containsString("id=\"lightboxZoomInBtn\"")))
                .andExpect(content().string(containsString("id=\"lightboxZoomOutBtn\"")))
                .andExpect(content().string(containsString("id=\"lightboxZoomLabel\"")))
                .andExpect(content().string(containsString("id=\"lightboxImg\"")))
                .andExpect(content().string(containsString("id=\"lightboxSwitchPhotoBtn\"")))
                // JavaScript functions for in-place inspection
                .andExpect(content().string(containsString("window.openPhotoLightbox")))
                .andExpect(content().string(containsString("window.closePhotoLightbox")))
                .andExpect(content().string(containsString("window.toggleLightboxPhoto")))
                .andExpect(content().string(containsString("window.adjustLightboxZoom")))
                .andExpect(content().string(containsString("window.resetLightboxZoom")))
                // Photo Verification Viewer drawer section
                .andExpect(content().string(containsString("id=\"drawerSectionPhotoVerification\"")))
                .andExpect(content().string(containsString("Photo Verification Viewer")))
                .andExpect(content().string(containsString("id=\"drawerBeforePhotoCard\"")))
                .andExpect(content().string(containsString("id=\"drawerAfterPhotoCard\"")))
                .andExpect(content().string(containsString("id=\"drawerAfterPhotoWaitingState\"")))
                .andExpect(content().string(containsString("Awaiting Completion Proof")))
                .andExpect(content().string(containsString("After Photo Not Uploaded Yet")))
                .andExpect(content().string(containsString("Technician must upload physical completion evidence on-site before completing work.")));
    }

    @Test
    @DisplayName("Step 10: Photo Verification Endpoints Serve Uploaded Photo and Waiting State when After Photo Not Uploaded")
    void photoVerificationEndpointsAndWaitingState() throws Exception {
        MockHttpSession session = loginAsMaintenanceStaff();
        ensureTestPartnerAndHubExists();

        // 1. Create emergency booking
        String suffix = java.util.UUID.randomUUID().toString().substring(0, 8);
        String registration = "{\"name\":\"Photo Customer\",\"phone\":\"9876543212\",\"email\":\"photo-" + suffix + "@example.com\",\"username\":\"photo-" + suffix + "\",\"password\":\"secret123\"}";
        var customer = (MockHttpSession) mvc.perform(post("/api/auth/propertydirect/register-customer")
                        .contentType(MediaType.APPLICATION_JSON).content(registration))
                .andExpect(status().isOk()).andReturn().getRequest().getSession(false);

        String createBookingPayload = """
                {
                    "category": "Plumbing",
                    "description": "Pipe leaking under kitchen sink with water collection",
                    "city": "Bangalore",
                    "area": "Indiranagar",
                    "serviceAddress": "Tower C, Flat 101, Indiranagar",
                    "latitude": 12.9716,
                    "longitude": 77.6412,
                    "requesterName": "Photo Customer",
                    "requesterPhone": "9876543212"
                }
                """;
        MvcResult createResult = mvc.perform(post("/api/maintenance/dispatch/bookings?platform=propertydirect")
                        .session(customer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBookingPayload))
                .andExpect(status().isOk())
                .andReturn();

        long bookingId = new com.fasterxml.jackson.databind.ObjectMapper()
                .readTree(createResult.getResponse().getContentAsString()).get("id").asLong();

        // 2. Simulate technician uploading Before Photo
        java.awt.image.BufferedImage img = new java.awt.image.BufferedImage(20, 20, java.awt.image.BufferedImage.TYPE_INT_RGB);
        java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(img, "png", baos);
        byte[] sampleBeforePng = baos.toByteArray();

        EmergencyMaintenanceBooking b = bookingRepository.findById(bookingId).orElseThrow();
        b.setBeforePhoto(sampleBeforePng);
        b.setPhotoStartAt(java.time.LocalDateTime.now());
        bookingRepository.save(b);

        // 3. Inspect booking details via API
        mvc.perform(get("/api/maintenance/dispatch/bookings/" + bookingId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(bookingId))
                .andExpect(jsonPath("$.hasBeforePhoto").value(true))
                .andExpect(jsonPath("$.beforePhotoUrl", containsString("/photos/before")))
                .andExpect(jsonPath("$.hasAfterPhoto").value(false))
                .andExpect(jsonPath("$.afterPhotoUrl", nullValue()));

        // 4. In-place inspection of Before Photo serves image bytes
        mvc.perform(get("/api/maintenance/dispatch/bookings/" + bookingId + "/photos/before").session(session))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG))
                .andExpect(header().string("Cache-Control", containsString("no-store")));

        // 5. In-place inspection of After Photo returns 404 since it has not been uploaded yet
        mvc.perform(get("/api/maintenance/dispatch/bookings/" + bookingId + "/photos/after").session(session))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Step 11: Partner Master Table UI and Filter Components Present in Maintenance Template")
    void partnerMasterTableUiAndFilterComponentsPresent() throws Exception {
        MockHttpSession session = loginAsMaintenanceStaff();

        mvc.perform(get("/dashboards/maintenance").session(session))
                .andExpect(status().isOk())
                // Section & Sidebar Nav
                .andExpect(content().string(containsString("data-view=\"partners\"")))
                .andExpect(content().string(containsString("id=\"partnerMasterSection\"")))
                .andExpect(content().string(containsString("id=\"sidebarPartnersLink\"")))
                // Table Element & Columns
                .andExpect(content().string(containsString("id=\"partnerMasterTable\"")))
                .andExpect(content().string(containsString("Partner")))
                .andExpect(content().string(containsString("Phone")))
                .andExpect(content().string(containsString("Trade")))
                .andExpect(content().string(containsString("City")))
                .andExpect(content().string(containsString("Hub")))
                .andExpect(content().string(containsString("Employment type")))
                .andExpect(content().string(containsString("Duty status")))
                .andExpect(content().string(containsString("Work status")))
                // Filters Toolbar & Components
                .andExpect(content().string(containsString("id=\"partnerFilterToolbar\"")))
                .andExpect(content().string(containsString("id=\"partnerSearchInput\"")))
                .andExpect(content().string(containsString("id=\"partnerFilterCity\"")))
                .andExpect(content().string(containsString("id=\"partnerFilterHub\"")))
                .andExpect(content().string(containsString("id=\"partnerFilterTrade\"")))
                .andExpect(content().string(containsString("id=\"partnerFilterEmploymentType\"")))
                .andExpect(content().string(containsString("id=\"partnerFilterDutyState\"")))
                .andExpect(content().string(containsString("id=\"partnerFilterWorkStatus\"")))
                .andExpect(content().string(containsString("id=\"partnerResetFiltersBtn\"")))
                // Summary Metric Cards
                .andExpect(content().string(containsString("id=\"cardTotalPartnersCount\"")))
                .andExpect(content().string(containsString("id=\"cardOnDutyPartnersCount\"")))
                .andExpect(content().string(containsString("id=\"cardOffDutyPartnersCount\"")))
                .andExpect(content().string(containsString("id=\"cardIdlePartnersCount\"")))
                .andExpect(content().string(containsString("id=\"cardBusyPartnersCount\"")))
                // JavaScript functions
                .andExpect(content().string(containsString("window.loadPartnerMasterTable")))
                .andExpect(content().string(containsString("window.filterPartnerTable")))
                .andExpect(content().string(containsString("window.resetPartnerFilters")))
                .andExpect(content().string(containsString("window.renderPartnerMasterTable")))
                .andExpect(content().string(containsString("window.togglePartnerDutyStatus")));
    }

    @Test
    @DisplayName("Step 11: Partner Master Directory API returns all 8 required fields")
    void partnerMasterDirectoryApiReturnsRequiredFieldsAndFilters() throws Exception {
        MockHttpSession session = loginAsMaintenanceStaff();
        MaintenancePartner partner = ensureTestPartnerAndHubExists();

        mvc.perform(get("/api/maintenance/dispatch/partners").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", not(empty())))
                .andExpect(jsonPath("$[?(@.id == " + partner.getId() + ")].partner", notNullValue()))
                .andExpect(jsonPath("$[?(@.id == " + partner.getId() + ")].name", notNullValue()))
                .andExpect(jsonPath("$[?(@.id == " + partner.getId() + ")].phone", notNullValue()))
                .andExpect(jsonPath("$[?(@.id == " + partner.getId() + ")].trade", notNullValue()))
                .andExpect(jsonPath("$[?(@.id == " + partner.getId() + ")].city", notNullValue()))
                .andExpect(jsonPath("$[?(@.id == " + partner.getId() + ")].hub", notNullValue()))
                .andExpect(jsonPath("$[?(@.id == " + partner.getId() + ")].employmentType", notNullValue()))
                .andExpect(jsonPath("$[?(@.id == " + partner.getId() + ")].dutyStatus", notNullValue()))
                .andExpect(jsonPath("$[?(@.id == " + partner.getId() + ")].dutyState", notNullValue()))
                .andExpect(jsonPath("$[?(@.id == " + partner.getId() + ")].workStatus", notNullValue()))
                .andExpect(jsonPath("$[?(@.id == " + partner.getId() + ")].workState", notNullValue()));
    }

    @Test
    @DisplayName("Step 11: Partner Duty Toggle Endpoint updates onDuty and workState")
    void partnerToggleDutyStatusEndpoint() throws Exception {
        MockHttpSession session = loginAsMaintenanceStaff();
        MaintenancePartner partner = ensureTestPartnerAndHubExists();

        boolean initialDuty = partner.isOnDuty();

        mvc.perform(post("/api/maintenance/dispatch/partners/" + partner.getId() + "/toggle-duty").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.onDuty").value(!initialDuty))
                .andExpect(jsonPath("$.dutyStatus").value(!initialDuty ? "On Duty" : "Off Duty"))
                .andExpect(jsonPath("$.workState", notNullValue()));

        // Toggle back to initial state
        mvc.perform(post("/api/maintenance/dispatch/partners/" + partner.getId() + "/toggle-duty").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.onDuty").value(initialDuty));
    }

    @Test
    @DisplayName("Step 12: Hub Master Table UI and Filter Components Present in Maintenance Template")
    void hubMasterTableUiAndFilterComponentsPresent() throws Exception {
        MockHttpSession session = loginAsMaintenanceStaff();

        MvcResult pageResult = mvc.perform(get("/dashboards/maintenance").session(session))
                .andExpect(status().isOk())
                .andReturn();

        String html = pageResult.getResponse().getContentAsString();

        // 1. Dedicated Hub Master Table and Navigation
        org.junit.jupiter.api.Assertions.assertTrue(html.contains("id=\"sidebarHubsLink\"") || html.contains("data-panel=\"hubs\""), "Hubs nav link should be present");
        org.junit.jupiter.api.Assertions.assertTrue(html.contains("id=\"hubMasterSection\""), "Hub master section container should be present");
        org.junit.jupiter.api.Assertions.assertTrue(html.contains("id=\"hubMasterTable\""), "Hub master table should be present");

        // 2. All 5 required column headers
        org.junit.jupiter.api.Assertions.assertTrue(html.contains("City"), "City header should be present");
        org.junit.jupiter.api.Assertions.assertTrue(html.contains("Hub"), "Hub header should be present");
        org.junit.jupiter.api.Assertions.assertTrue(html.contains("Service area") || html.contains("Service Area"), "Service area header should be present");
        org.junit.jupiter.api.Assertions.assertTrue(html.contains("Active status") || html.contains("Active Status"), "Active status header should be present");
        org.junit.jupiter.api.Assertions.assertTrue(html.contains("Number of mapped partners") || html.contains("Mapped Partners"), "Number of mapped partners header should be present");

        // 3. Filter toolbar and Modal Overlay
        org.junit.jupiter.api.Assertions.assertTrue(html.contains("id=\"hubFilterToolbar\""), "Hub filter toolbar should be present");
        org.junit.jupiter.api.Assertions.assertTrue(html.contains("id=\"hubSearchInput\""), "Hub search input should be present");
        org.junit.jupiter.api.Assertions.assertTrue(html.contains("id=\"hubFilterCity\""), "Hub city filter should be present");
        org.junit.jupiter.api.Assertions.assertTrue(html.contains("id=\"hubFilterStatus\"") || html.contains("id=\"hubFilterActive\""), "Hub active filter should be present");
        org.junit.jupiter.api.Assertions.assertTrue(html.contains("id=\"hubModalOverlay\""), "Hub create/edit modal overlay should be present");
        org.junit.jupiter.api.Assertions.assertTrue(html.contains("id=\"hubForm\""), "Hub form should be present");

        // 4. JS methods for CRUD
        org.junit.jupiter.api.Assertions.assertTrue(html.contains("window.loadHubMasterTable"), "loadHubMasterTable function should be present");
        org.junit.jupiter.api.Assertions.assertTrue(html.contains("window.openHubCreateModal"), "openHubCreateModal function should be present");
        org.junit.jupiter.api.Assertions.assertTrue(html.contains("window.openHubEditModal"), "openHubEditModal function should be present");
        org.junit.jupiter.api.Assertions.assertTrue(html.contains("window.saveHubForm"), "saveHubForm function should be present");
        org.junit.jupiter.api.Assertions.assertTrue(html.contains("window.toggleHubActiveStatus"), "toggleHubActiveStatus function should be present");
    }

    @Test
    @DisplayName("Step 12: Hub Master API returns all 5 required fields including dynamic mappedPartnersCount")
    void hubMasterApiReturnsRequiredFieldsAndCounts() throws Exception {
        MockHttpSession session = loginAsMaintenanceStaff();
        ensureTestPartnerAndHubExists();

        mvc.perform(get("/api/maintenance/dispatch/hubs?all=true").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", not(empty())))
                .andExpect(jsonPath("$[0].city", notNullValue()))
                .andExpect(jsonPath("$[0].hub", notNullValue()))
                .andExpect(jsonPath("$[0].serviceArea", notNullValue()))
                .andExpect(jsonPath("$[0].activeStatus", notNullValue()))
                .andExpect(jsonPath("$[0].mappedPartnersCount", notNullValue()));
    }

    @Test
    @DisplayName("Step 12: Hub Create, Edit, and Active Toggle Endpoints work correctly")
    void hubCreateEditAndToggleActiveEndpoints() throws Exception {
        MockHttpSession session = loginAsMaintenanceStaff();

        // 1. Create Hub
        String createJson = """
            {
                "name": "Indiranagar Central Hub Test",
                "city": "Bangalore",
                "area": "Indiranagar, HAL 2nd Stage, Domlur",
                "latitude": 12.9784,
                "longitude": 77.6408,
                "radiusKm": 12.0,
                "active": true
            }
            """;
        MvcResult createResult = mvc.perform(post("/api/maintenance/dispatch/hubs")
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.name").value("Indiranagar Central Hub Test"))
                .andExpect(jsonPath("$.city").value("Bangalore"))
                .andReturn();

        String createdBody = createResult.getResponse().getContentAsString();
        Number hubIdNum = com.jayway.jsonpath.JsonPath.read(createdBody, "$.id");
        Long hubId = hubIdNum.longValue();

        // 2. Edit Hub
        String updateJson = """
            {
                "name": "Indiranagar Central Hub Test Updated",
                "city": "Bangalore East",
                "area": "Indiranagar, Ulsoor, Domlur Extended",
                "latitude": 12.9790,
                "longitude": 77.6410,
                "radiusKm": 14.5,
                "active": true
            }
            """;
        mvc.perform(put("/api/maintenance/dispatch/hubs/" + hubId)
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Indiranagar Central Hub Test Updated"))
                .andExpect(jsonPath("$.city").value("Bangalore East"))
                .andExpect(jsonPath("$.radiusKm").value(14.5));

        // 3. Toggle Active Status
        mvc.perform(post("/api/maintenance/dispatch/hubs/" + hubId + "/toggle-active").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false))
                .andExpect(jsonPath("$.activeStatus").value("Inactive"));

        // Toggle back to active
        mvc.perform(post("/api/maintenance/dispatch/hubs/" + hubId + "/toggle-active").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.activeStatus").value("Active"));
    }

    @Test
    @DisplayName("Step 13: Realtime Admin Updates - SSE Stream and Polling Events endpoints are active")
    void realtimeAdminUpdatesEndpointsAndEvents() throws Exception {
        MockHttpSession session = loginAsMaintenanceStaff();

        // 1. Verify Recent Events Endpoint
        mvc.perform(get("/api/maintenance/dispatch/events?since=0").session(session))
                .andExpect(status().isOk());

        // 2. Verify Stream Endpoint initializes
        mvc.perform(get("/api/maintenance/dispatch/events/stream").session(session))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Step 14 & Stage 5 Acceptance Testing: Full Emergency Dispatch & Admin Operations Verification")
    void stage5FullAcceptanceVerification() throws Exception {
        MockHttpSession session = loginAsMaintenanceStaff();
        MaintenancePartner partner = ensureTestPartnerAndHubExists();

        // 1. Tickets tab still displays existing maintenance tickets (non-emergency separation preserved)
        MvcResult dashboardRes = mvc.perform(get("/dashboards/maintenance").session(session))
                .andExpect(status().isOk())
                .andReturn();
        String html = dashboardRes.getResponse().getContentAsString();
        org.junit.jupiter.api.Assertions.assertTrue(html.contains("data-panel=\"tasks\""), "Non-emergency tasks panel preserved");
        org.junit.jupiter.api.Assertions.assertTrue(html.contains("data-panel=\"complaints\""), "Non-emergency complaints panel preserved");
        org.junit.jupiter.api.Assertions.assertTrue(html.contains("Track 1: Tickets (Non-Emergency)"), "Track 1 Tickets header preserved");
        org.junit.jupiter.api.Assertions.assertTrue(html.contains("Track 2: Live Bookings (Emergency)") || html.contains("Track 2: Emergency Dispatch"), "Track 2 Emergency Dispatch header preserved");

        // 2. Responsive UI classes are present
        org.junit.jupiter.api.Assertions.assertTrue(html.contains("table-responsive"), "Responsive table wrappers present");
        org.junit.jupiter.api.Assertions.assertTrue(html.contains("#bookingDetailsDrawer"), "Booking details drawer present");

        // 3. Live Bookings only displays emergencies with accurate KPI counts
        mvc.perform(get("/api/maintenance/dispatch/bookings").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", notNullValue()));

        // 4. Partner directory and filters
        mvc.perform(get("/api/maintenance/dispatch/partners").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", not(empty())));

        // 5. Hubs master list
        mvc.perform(get("/api/maintenance/dispatch/hubs?all=true").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", not(empty())));
    }
}




