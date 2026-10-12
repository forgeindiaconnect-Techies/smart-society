package com.smartapartment;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import jakarta.servlet.http.HttpSession;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartapartment.entity.BillingRule;
import com.smartapartment.repository.BillingRuleRepository;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.mock.web.MockMultipartFile;

@SpringBootTest @AutoConfigureMockMvc
class WorkflowIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired BillingRuleRepository billingRules;

    @Test void societyApisRejectAnonymousRequests() throws Exception {
        mvc.perform(get("/api/society/overview")).andExpect(status().is3xxRedirection());
    }

    @Test void publicPagesCanLoadTheirStylesAndImagesWithoutLogin() throws Exception {
        mvc.perform(get("/"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("id=\"landingHeader\"")))
                .andExpect(content().string(containsString("id=\"phoneCarousel\"")))
                .andExpect(content().string(containsString("id=\"landingDemoForm\"")))
                .andExpect(content().string(containsString("Managed <em>Smarter.</em>")));
        mvc.perform(get("/shared/css/theme.css")).andExpect(status().isOk());
        mvc.perform(get("/smartapartment/css/styles.css")).andExpect(status().isOk());
        mvc.perform(get("/smartapartment/js/landing.js")).andExpect(status().isOk());
        mvc.perform(get("/shared/images/smartapartment-cinematic-1.webp")).andExpect(status().isOk());
        mvc.perform(get("/favicon.svg")).andExpect(status().isOk());
    }

    @Test void adminLoginLoadsTenantDataAndBillingIsIdempotent() throws Exception {
        HttpSession session = mvc.perform(post("/api/auth/dashboard-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"platform\":\"smartapartment\",\"role\":\"admin\",\"username\":\"admin@smartapartment\",\"password\":\"admin123\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.redirect").value("/dashboards/society-admin"))
                .andReturn().getRequest().getSession(false);

        mvc.perform(get("/api/society/me").session((org.springframework.mock.web.MockHttpSession) session))
                .andExpect(status().isOk()).andExpect(jsonPath("$.tenantId").value("green-heights"))
                .andExpect(jsonPath("$.role").value("SOCIETY_ADMIN"));

        mvc.perform(post("/api/billing/generate").param("amount","2500").session((org.springframework.mock.web.MockHttpSession) session))
                .andExpect(status().isOk()).andExpect(jsonPath("$.count").value(1));
        mvc.perform(post("/api/billing/generate").param("amount","2500").session((org.springframework.mock.web.MockHttpSession) session))
                .andExpect(status().isOk()).andExpect(jsonPath("$.count").value(0));
        mvc.perform(get("/api/society/bills").session((org.springframework.mock.web.MockHttpSession) session))
                .andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))));
    }

    @Test void residentCannotUseAdminBillingEndpoint() throws Exception {
        HttpSession session = mvc.perform(post("/api/auth/dashboard-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"platform\":\"smartapartment\",\"role\":\"resident\",\"username\":\"resident@smartapartment\",\"password\":\"resident123\"}"))
                .andExpect(status().isOk()).andReturn().getRequest().getSession(false);
        mvc.perform(post("/api/billing/generate").session((org.springframework.mock.web.MockHttpSession) session))
                .andExpect(status().isForbidden());
    }

    @Test void everyDashboardUsesTheUnifiedLandingPageDesignSystem() throws Exception {
        mvc.perform(get("/shared/css/dashboard-system.css")).andExpect(status().isOk());
        mvc.perform(get("/shared/js/dashboard-system.js")).andExpect(status().isOk());

        Object[][] dashboardLogins = {
                {"/dashboards/superadmin", "smartapartment", "superadmin", "superadmin@smartapartment", "superadmin123"},
                {"/dashboards/society-admin", "smartapartment", "admin", "admin@smartapartment", "admin123"},
                {"/dashboards/resident", "smartapartment", "resident", "resident@smartapartment", "resident123"},
                {"/dashboards/security", "smartapartment", "security", "security@smartapartment", "security123"},
                {"/dashboards/maintenance", "smartapartment", "maintenance", "maintenance@smartapartment", "maintenance123"},
                {"/propertydirect/dashboards/superadmin", "propertydirect", "superadmin", "superadmin@propertydirect", "superadmin123"},
                {"/propertydirect/dashboards/admin", "propertydirect", "admin", "admin@propertydirect", "admin123"}
        };
        for (Object[] item : dashboardLogins) {
            var session = login((String) item[1], (String) item[2], (String) item[3], (String) item[4]);
            mvc.perform(get((String) item[0]).session(session))
                    .andExpect(status().isOk())
                    .andExpect(content().string(containsString("/shared/css/dashboard-system.css")))
                    .andExpect(content().string(containsString("/shared/js/dashboard-system.js")));
        }

        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String registration = "{\"name\":\"Dashboard Test Customer\",\"phone\":\"9000000000\",\"email\":\"dashboard-" + suffix + "@example.com\",\"username\":\"dashboard-" + suffix + "\",\"password\":\"secret123\"}";
        var customer = (org.springframework.mock.web.MockHttpSession) mvc.perform(post("/api/auth/propertydirect/register-customer")
                        .contentType(MediaType.APPLICATION_JSON).content(registration))
                .andExpect(status().isOk()).andReturn().getRequest().getSession(false);
        mvc.perform(get("/propertydirect/dashboards/customer").session(customer))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("/shared/css/dashboard-system.css")))
                .andExpect(content().string(containsString("/shared/js/dashboard-system.js")));
    }

    @Test void advancedSocietyWorkflowsAreRoleScopedAndTenantIsolated() throws Exception {
        var admin = login("smartapartment", "admin", "admin@smartapartment", "admin123");
        var resident = login("smartapartment", "resident", "resident@smartapartment", "resident123");
        var security = login("smartapartment", "security", "security@smartapartment", "security123");

        BillingRule foreignRule = billingRules.findByTenantIdOrderByNameAsc("another-society").stream()
                .filter(r -> "Must remain invisible".equals(r.getName()))
                .findFirst()
                .orElseGet(() -> {
                    BillingRule r = new BillingRule();
                    r.setTenantId("another-society");
                    r.setName("Must remain invisible");
                    r.setAmount(new BigDecimal("999"));
                    r.setDueDay(5);
                    r.setLateFee(BigDecimal.ZERO);
                    r.setFrequency("MONTHLY");
                    return billingRules.save(r);
                });

        mvc.perform(post("/api/society/advanced/billing-rules").session(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Quarterly sinking fund\",\"amount\":1500,\"dueDay\":12,\"lateFee\":50,\"frequency\":\"QUARTERLY\",\"nextRunDate\":\"2099-01-01\",\"automatic\":false}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Quarterly sinking fund"));
        mvc.perform(get("/api/society/advanced/billing-rules").session(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].name", not(hasItem("Must remain invisible"))));
        mvc.perform(post("/api/society/advanced/billing-rules").session(resident)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Forbidden\",\"amount\":1,\"dueDay\":1,\"lateFee\":0,\"frequency\":\"MONTHLY\",\"automatic\":false}"))
                .andExpect(status().isForbidden());

        String deliveryJson = mvc.perform(post("/api/society/advanced/deliveries").session(security)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"unitNo\":\"A-204\",\"provider\":\"QuickCart\",\"agentName\":\"Arun\",\"phone\":\"9876543210\",\"packageType\":\"PARCEL\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.message").value("Delivery recorded"))
                .andReturn().getResponse().getContentAsString();
        long deliveryId = json.readTree(deliveryJson).get("id").asLong();
        mvc.perform(patch("/api/society/advanced/deliveries/{id}/collect", deliveryId).session(resident))
                .andExpect(status().isOk()).andExpect(jsonPath("$.message").value("Delivery collected"));

        String pollJson = mvc.perform(post("/api/society/advanced/polls").session(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"question\":\"Install solar panels?\",\"options\":[\"Yes\",\"No\"],\"closesAt\":\"2099-01-01T12:00:00\",\"anonymous\":true}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        long pollId = json.readTree(pollJson).get("id").asLong();
        mvc.perform(post("/api/society/advanced/polls/{id}/vote", pollId).param("option", "0").session(resident))
                .andExpect(status().isOk()).andExpect(jsonPath("$.option").value(0));
        mvc.perform(post("/api/society/advanced/polls/{id}/vote", pollId).param("option", "1").session(resident))
                .andExpect(status().isOk()).andExpect(jsonPath("$.option").value(1));
        mvc.perform(get("/api/society/advanced/polls").session(resident))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == " + pollId + ")].selectedOption").value(hasItem(1)));
    }

    @Test void propertyDiscoveryPersistsShortlistsSearchesVisitsAndServices() throws Exception {
        var vendor = login("propertydirect", "vendor", "vendor@propertydirect", "vendor123");
        var superAdmin = login("propertydirect", "superadmin", "superadmin@propertydirect", "superadmin123");
        String listingPayload = "{\"title\":\"Test Lake View Home\",\"society\":\"Lake View\",\"locality\":\"Whitefield\",\"address\":\"12 Lake Road\",\"pincode\":\"560066\",\"city\":\"Bangalore\",\"type\":\"RENT\",\"propertyType\":\"APARTMENT\",\"price\":32000,\"deposit\":100000,\"maintenance\":2500,\"areaSqft\":1100,\"bhk\":\"2 BHK\",\"bathrooms\":2,\"furnishing\":\"Semi Furnished\",\"parking\":\"Car Parking\",\"amenities\":\"Gym, Pool\"}";
        MockMultipartFile listingPart = new MockMultipartFile("listing", "listing.json", "application/json", listingPayload.getBytes());
        MockMultipartFile photoPart = new MockMultipartFile("photos", "lake-view.jpg", "image/jpeg", new byte[]{1, 2, 3});
        String listingJson = mvc.perform(multipart("/api/property/listings/with-photos").file(listingPart).file(photoPart).session(vendor))
                .andExpect(status().isOk()).andExpect(jsonPath("$.verificationStatus").value("PENDING"))
                .andReturn().getResponse().getContentAsString();
        long listingId = json.readTree(listingJson).get("id").asLong();
        mvc.perform(patch("/api/property/listings/{id}/verification", listingId).session(superAdmin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"APPROVED\",\"reviewer\":\"Workflow test\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.verificationStatus").value("APPROVED"));
        mvc.perform(get("/api/property/listings").param("city", "Bangalore").param("bhk", "2 BHK").param("maxPrice", "35000"))
                .andExpect(status().isOk()).andExpect(jsonPath("$[*].id", hasItem((int) listingId)));

        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String registration = "{\"name\":\"Test Customer\",\"phone\":\"9000000000\",\"email\":\"customer-" + suffix + "@example.com\",\"username\":\"customer-" + suffix + "\",\"password\":\"secret123\"}";
        var customer = (org.springframework.mock.web.MockHttpSession) mvc.perform(post("/api/auth/propertydirect/register-customer")
                        .contentType(MediaType.APPLICATION_JSON).content(registration))
                .andExpect(status().isOk()).andReturn().getRequest().getSession(false);

        mvc.perform(post("/api/property/saved/{id}", listingId).session(customer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.message").value("Property shortlisted"));
        mvc.perform(get("/api/property/saved").session(customer))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].listing.id").value(listingId));
        mvc.perform(post("/api/property/saved-searches").session(customer).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Affordable Whitefield\",\"city\":\"Bangalore\",\"locality\":\"Whitefield\",\"type\":\"RENT\",\"bhk\":\"2 BHK\",\"minPrice\":20000,\"maxPrice\":35000,\"alertsEnabled\":true}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.alertsEnabled").value(true));
        mvc.perform(post("/api/property/visits").session(customer).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"listingId\":" + listingId + ",\"scheduledAt\":\"2099-01-02T11:00:00\",\"notes\":\"Morning preferred\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.visitStatus").value("REQUESTED"));
        mvc.perform(post("/api/property/services").session(customer).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"listingId\":" + listingId + ",\"serviceType\":\"LEGAL_DOCUMENTATION\",\"preferredAt\":\"2099-01-03T11:00:00\",\"details\":\"Review rental agreement\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.requestStatus").value("REQUESTED"));
    }

    @Test void emergencyBookingAddressAndCoordinateHandlingTest() throws Exception {
        var superAdmin = login("smartapartment", "superadmin", "superadmin@smartapartment", "superadmin123");
        
        // Create hub via admin endpoint
        mvc.perform(post("/api/maintenance/dispatch/hubs").session(superAdmin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"city\":\"Metropolis\",\"area\":\"Downtown\",\"latitude\":12.9716,\"longitude\":77.5946,\"radiusKm\":10.0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.city").value("Metropolis"))
                .andExpect(jsonPath("$.area").value("Downtown"));

        // Register customer
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String registration = "{\"name\":\"Geo Test Customer\",\"phone\":\"9876543210\",\"email\":\"geo-" + suffix + "@example.com\",\"username\":\"geo-" + suffix + "\",\"password\":\"secret123\"}";
        var customer = (org.springframework.mock.web.MockHttpSession) mvc.perform(post("/api/auth/propertydirect/register-customer")
                        .contentType(MediaType.APPLICATION_JSON).content(registration))
                .andExpect(status().isOk()).andReturn().getRequest().getSession(false);

        // Case 1: Coordinate-based booking (lat/lon provided)
        String geoBooking = "{\"requesterPhone\":\"9876543210\",\"serviceAddress\":\"123 Tech Park\",\"city\":\"Metropolis\",\"area\":\"Downtown\",\"category\":\"Plumbing\",\"description\":\"Pipe burst in bathroom\",\"latitude\":12.9720,\"longitude\":77.5950}";
        mvc.perform(post("/api/maintenance/dispatch/bookings?platform=propertydirect").session(customer).contentType(MediaType.APPLICATION_JSON).content(geoBooking))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.city").value("Metropolis"))
                .andExpect(jsonPath("$.latitude").value(12.9720))
                .andExpect(jsonPath("$.longitude").value(77.5950))
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.bookingReference", startsWith("EMG-")))
                .andExpect(jsonPath("$.jobStatus").value("UNASSIGNED"))
                .andExpect(jsonPath("$.partnerId").value(nullValue()))
                .andExpect(jsonPath("$.offeredAt").value(nullValue()))
                .andExpect(jsonPath("$.acceptedAt").value(nullValue()));

        // Case 2: Address text-based booking (only city and area text provided, lat/lon null)
        String textBooking = "{\"requesterPhone\":\"9876543210\",\"serviceAddress\":\"456 Main St\",\"city\":\"Metropolis\",\"area\":\"Downtown\",\"category\":\"Electrical\",\"description\":\"Main circuit breaker trip\",\"latitude\":null,\"longitude\":null}";
        mvc.perform(post("/api/maintenance/dispatch/bookings?platform=propertydirect").session(customer).contentType(MediaType.APPLICATION_JSON).content(textBooking))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.city").value("Metropolis"))
                .andExpect(jsonPath("$.area").value("Downtown"))
                .andExpect(jsonPath("$.hubId").isNumber())
                .andExpect(jsonPath("$.jobStatus").value("UNASSIGNED"));

        // Case 3: Safe fallback when hub resolution is impossible (uncovered city)
        String unmappedBooking = "{\"requesterPhone\":\"9876543210\",\"serviceAddress\":\"789 Remote Road\",\"city\":\"UncoveredCity\",\"area\":\"RemoteZone\",\"category\":\"Plumbing\",\"description\":\"Remote leak\",\"latitude\":null,\"longitude\":null}";
        String unmappedJson = mvc.perform(post("/api/maintenance/dispatch/bookings?platform=propertydirect").session(customer).contentType(MediaType.APPLICATION_JSON).content(unmappedBooking))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.city").value("UncoveredCity"))
                .andExpect(jsonPath("$.hubId").value(nullValue()))
                .andExpect(jsonPath("$.jobStatus").value("UNASSIGNED"))
                .andExpect(jsonPath("$.dispatchReason", containsString("admin review required")))
                .andReturn().getResponse().getContentAsString();

        long unmappedId = json.readTree(unmappedJson).get("id").asLong();

        // Verify booking remains valid and visible in customer booking list
        mvc.perform(get("/api/maintenance/dispatch/bookings?platform=propertydirect").session(customer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", hasItem((int) unmappedId)))
                .andExpect(jsonPath("$[?(@.id == " + unmappedId + ")].hubId").value(hasItem(nullValue())));

        // Verify booking is visible in emergency admin queue for routing/triage
        mvc.perform(get("/api/maintenance/dispatch/bookings?platform=smartapartment").session(superAdmin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", hasItem((int) unmappedId)))
                .andExpect(jsonPath("$[?(@.id == " + unmappedId + ")].dispatchReason").value(hasItem(containsString("admin review required"))));

        // Verify Maintenance Admin staff account can query bookings and inspect resolved hub ID
        var maintenanceAdmin = login("smartapartment", "maintenance", "maintenance@smartapartment", "maintenance123");
        mvc.perform(get("/api/maintenance/dispatch/bookings?platform=smartapartment").session(maintenanceAdmin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", hasItem((int) unmappedId)))
                .andExpect(jsonPath("$[?(@.id == " + unmappedId + ")].bookingReference").value(hasItem(startsWith("EMG-"))));
    }

    @Test void stage2EmergencyBookingVerificationTests() throws Exception {
        var superAdmin = login("smartapartment", "superadmin", "superadmin@smartapartment", "superadmin123");
        
        // Setup hub in database for testing
        String hubJson = mvc.perform(post("/api/maintenance/dispatch/hubs").session(superAdmin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"city\":\"Gotham\",\"area\":\"Central\",\"latitude\":13.0827,\"longitude\":80.2707,\"radiusKm\":15.0}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        long hubId = json.readTree(hubJson).get("id").asLong();

        // Customer login
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String registration = "{\"name\":\"Stage2 Customer\",\"phone\":\"9111122222\",\"email\":\"stage2-" + suffix + "@example.com\",\"username\":\"stage2-" + suffix + "\",\"password\":\"secret123\"}";
        var customer = (org.springframework.mock.web.MockHttpSession) mvc.perform(post("/api/auth/propertydirect/register-customer")
                        .contentType(MediaType.APPLICATION_JSON).content(registration))
                .andExpect(status().isOk()).andReturn().getRequest().getSession(false);

        // Case 1: Emergency request with coordinates and valid nearby hub
        String case1Payload = "{\"requesterPhone\":\"9111122222\",\"serviceAddress\":\"100 Gotham Center\",\"city\":\"Gotham\",\"area\":\"Central\",\"category\":\"Electrical\",\"description\":\"High voltage wire sparking\",\"latitude\":13.0830,\"longitude\":80.2710}";
        mvc.perform(post("/api/maintenance/dispatch/bookings?platform=propertydirect").session(customer).contentType(MediaType.APPLICATION_JSON).content(case1Payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.bookingReference", startsWith("EMG-")))
                .andExpect(jsonPath("$.hubId").value((int) hubId))
                .andExpect(jsonPath("$.jobStatus").value("UNASSIGNED"));

        // Case 2: Emergency request with address/locality and valid hub mapping
        String case2Payload = "{\"requesterPhone\":\"9111122222\",\"serviceAddress\":\"200 Gotham Ave\",\"city\":\"Gotham\",\"area\":\"Central\",\"category\":\"Plumbing\",\"description\":\"Major water pipe burst\",\"latitude\":null,\"longitude\":null}";
        mvc.perform(post("/api/maintenance/dispatch/bookings?platform=propertydirect").session(customer).contentType(MediaType.APPLICATION_JSON).content(case2Payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.hubId").value((int) hubId))
                .andExpect(jsonPath("$.jobStatus").value("UNASSIGNED"));

        // Case 3: Emergency request where no hub can be resolved
        String case3Payload = "{\"requesterPhone\":\"9111122222\",\"serviceAddress\":\"Deep Forest Road\",\"city\":\"UnknownForest\",\"area\":\"NoHubArea\",\"category\":\"Carpentry\",\"description\":\"Door jam locked in emergency\",\"latitude\":null,\"longitude\":null}";
        mvc.perform(post("/api/maintenance/dispatch/bookings?platform=propertydirect").session(customer).contentType(MediaType.APPLICATION_JSON).content(case3Payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.hubId").value(nullValue()))
                .andExpect(jsonPath("$.jobStatus").value("UNASSIGNED"))
                .andExpect(jsonPath("$.dispatchReason", containsString("admin review required")));

        // Case 4: Normal maintenance request (creates standard Maintenance Ticket)
        String case4Payload = "{\"sourcePlatform\":\"propertydirect\",\"targetEntityType\":\"PROPERTY_LISTING\",\"requesterName\":\"Stage2 Customer\",\"requesterPhone\":\"9111122222\",\"serviceType\":\"Routine Plumbing Check\",\"serviceCategory\":\"Plumbing\",\"serviceOption\":\"General Inspection\",\"title\":\"Tap dripping\",\"description\":\"Low priority tap drip\",\"serviceAddress\":\"200 Gotham Ave\",\"priority\":\"LOW\"}";
        mvc.perform(post("/api/maintenance").session(customer).contentType(MediaType.APPLICATION_JSON).content(case4Payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.ticketReference", startsWith("TKT-")))
                .andExpect(jsonPath("$.ticketStatus").value("REQUESTED"));

        // Case 5: Emergency request validation (missing mandatory fields)
        String case5InvalidCategory = "{\"requesterPhone\":\"9111122222\",\"serviceAddress\":\"200 Gotham Ave\",\"city\":\"Gotham\",\"area\":\"Central\",\"category\":\"\",\"description\":\"Blank category\",\"latitude\":null,\"longitude\":null}";
        mvc.perform(post("/api/maintenance/dispatch/bookings?platform=propertydirect").session(customer).contentType(MediaType.APPLICATION_JSON).content(case5InvalidCategory))
                .andExpect(status().isBadRequest());

        String case5InvalidAddress = "{\"requesterPhone\":\"9111122222\",\"serviceAddress\":\"\",\"city\":\"Gotham\",\"area\":\"Central\",\"category\":\"Electrical\",\"description\":\"Blank address\",\"latitude\":null,\"longitude\":null}";
        mvc.perform(post("/api/maintenance/dispatch/bookings?platform=propertydirect").session(customer).contentType(MediaType.APPLICATION_JSON).content(case5InvalidAddress))
                .andExpect(status().isBadRequest());
    }

    @Autowired com.smartapartment.service.EmergencyMaintenanceService emergencyService;
    @Autowired com.smartapartment.repository.MaintenancePartnerRepository partnerRepo;
    @Autowired com.smartapartment.repository.MaintenanceHubRepository hubRepo;
    @Autowired com.smartapartment.repository.EmergencyMaintenanceBookingRepository bookingRepo;

    @Test void partnerEligibilityTests() throws Exception {
        com.smartapartment.entity.MaintenancePartner p = new com.smartapartment.entity.MaintenancePartner();
        p.setTrade("Plumbing");
        p.setSkillCategories("Plumbing,Electrical");
        
        org.junit.jupiter.api.Assertions.assertTrue(emergencyService.isTradeMatch(p, "Plumbing"));
        org.junit.jupiter.api.Assertions.assertTrue(emergencyService.isTradeMatch(p, "Electrical"));
        org.junit.jupiter.api.Assertions.assertFalse(emergencyService.isTradeMatch(p, "Carpentry"));
    }

    @Autowired com.smartapartment.repository.AppUserRepository userRepo;
    @Autowired com.smartapartment.repository.AuditLogRepository auditLogRepo;

    @Test void failedAutoAssignmentTests() throws Exception {
        var superAdmin = login("smartapartment", "superadmin", "superadmin@smartapartment", "superadmin123");
        Long validUserId = userRepo.findByEmail("superadmin@smartapartment").map(com.smartapartment.entity.AppUser::getId).orElse(1L);
        
        // 1. Setup a test hub
        com.smartapartment.entity.MaintenanceHub hub = new com.smartapartment.entity.MaintenanceHub();
        hub.setName("TestCity Central Hub");
        hub.setCity("TestCity");
        hub.setArea("NorthZone");
        hub.setLatitude(10.0);
        hub.setLongitude(20.0);
        hub.setRadiusKm(10.0);
        hub.setActive(true);
        hub.setStatus("ACTIVE");
        hub = hubRepo.save(hub);

        // Case A: No partners in hub -> "No partners within service area"
        com.smartapartment.entity.EmergencyMaintenanceBooking b1 = new com.smartapartment.entity.EmergencyMaintenanceBooking();
        b1.setCity("TestCity");
        b1.setArea("NorthZone");
        b1.setCategory("Plumbing");
        b1.setRequesterPhone("1234567890");
        b1.setServiceAddress("123 Main St");
        b1.setTenantId("test-tenant");
        b1.setSourcePlatform("propertydirect");
        b1 = bookingRepo.save(b1);

        emergencyService.dispatch(b1);
        org.junit.jupiter.api.Assertions.assertEquals("FAILED_ASSIGNMENT", b1.getJobStatus());
        org.junit.jupiter.api.Assertions.assertEquals("No partners within service area", b1.getDispatchReason());

        // Case B: Partner exists with different trade -> "No partner with matching trade"
        com.smartapartment.entity.MaintenancePartner p1 = new com.smartapartment.entity.MaintenancePartner();
        p1.setHubId(hub.getId());
        p1.setTrade("Electrical");
        p1.setSkillCategories("Electrical");
        p1.setOnDuty(true);
        p1.setWorkState("IDLE");
        p1.setAvailability("IDLE");
        p1.setUserId(validUserId);
        p1 = partnerRepo.save(p1);

        com.smartapartment.entity.EmergencyMaintenanceBooking b2 = new com.smartapartment.entity.EmergencyMaintenanceBooking();
        b2.setCity("TestCity");
        b2.setArea("NorthZone");
        b2.setCategory("Plumbing");
        b2.setRequesterPhone("1234567890");
        b2.setServiceAddress("456 Oak St");
        b2.setTenantId("test-tenant");
        b2.setSourcePlatform("propertydirect");
        b2 = bookingRepo.save(b2);

        emergencyService.dispatch(b2);
        org.junit.jupiter.api.Assertions.assertEquals("FAILED_ASSIGNMENT", b2.getJobStatus());
        org.junit.jupiter.api.Assertions.assertEquals("No partner with matching trade", b2.getDispatchReason());

        // Case C: Matching trade exists, but off duty -> "No on-duty partners"
        com.smartapartment.entity.MaintenancePartner pOffDuty = new com.smartapartment.entity.MaintenancePartner();
        pOffDuty.setHubId(hub.getId());
        pOffDuty.setTrade("Plumbing");
        pOffDuty.setSkillCategories("Plumbing");
        pOffDuty.setOnDuty(false);
        pOffDuty.setWorkState("IDLE");
        pOffDuty.setAvailability("IDLE");
        pOffDuty.setUserId(validUserId);
        partnerRepo.save(pOffDuty);

        com.smartapartment.entity.EmergencyMaintenanceBooking b3 = new com.smartapartment.entity.EmergencyMaintenanceBooking();
        b3.setCity("TestCity");
        b3.setArea("NorthZone");
        b3.setCategory("Plumbing");
        b3.setRequesterPhone("1234567890");
        b3.setServiceAddress("789 Pine St");
        b3.setTenantId("test-tenant");
        b3.setSourcePlatform("propertydirect");
        b3 = bookingRepo.save(b3);

        emergencyService.dispatch(b3);
        org.junit.jupiter.api.Assertions.assertEquals("FAILED_ASSIGNMENT", b3.getJobStatus());
        org.junit.jupiter.api.Assertions.assertEquals("No on-duty partners", b3.getDispatchReason());

        // Case D: Matching trade on duty, but busy -> "All partners busy"
        com.smartapartment.entity.MaintenancePartner pBusy = new com.smartapartment.entity.MaintenancePartner();
        pBusy.setHubId(hub.getId());
        pBusy.setTrade("Plumbing");
        pBusy.setSkillCategories("Plumbing");
        pBusy.setOnDuty(true);
        pBusy.setWorkState("BUSY");
        pBusy.setAvailability("BUSY");
        pBusy.setUserId(validUserId);
        partnerRepo.save(pBusy);

        com.smartapartment.entity.EmergencyMaintenanceBooking b4 = new com.smartapartment.entity.EmergencyMaintenanceBooking();
        b4.setCity("TestCity");
        b4.setArea("NorthZone");
        b4.setCategory("Plumbing");
        b4.setRequesterPhone("1234567890");
        b4.setServiceAddress("101 Elm St");
        b4.setTenantId("test-tenant");
        b4.setSourcePlatform("propertydirect");
        b4 = bookingRepo.save(b4);

        emergencyService.dispatch(b4);
        org.junit.jupiter.api.Assertions.assertEquals("FAILED_ASSIGNMENT", b4.getJobStatus());
        org.junit.jupiter.api.Assertions.assertEquals("All partners busy", b4.getDispatchReason());

        // Case E: Partner declined -> "All candidates declined"
        com.smartapartment.entity.MaintenancePartner pDeclined = new com.smartapartment.entity.MaintenancePartner();
        pDeclined.setHubId(hub.getId());
        pDeclined.setTrade("Plumbing");
        pDeclined.setSkillCategories("Plumbing");
        pDeclined.setOnDuty(true);
        pDeclined.setWorkState("IDLE");
        pDeclined.setAvailability("IDLE");
        pDeclined.setUserId(validUserId);
        pDeclined = partnerRepo.save(pDeclined);

        com.smartapartment.entity.EmergencyMaintenanceBooking b5 = new com.smartapartment.entity.EmergencyMaintenanceBooking();
        b5.setCity("TestCity");
        b5.setArea("NorthZone");
        b5.setCategory("Plumbing");
        b5.setRequesterPhone("1234567890");
        b5.setServiceAddress("202 Maple St");
        b5.setTenantId("test-tenant");
        b5.setSourcePlatform("propertydirect");
        b5.setDeclinedPartnerIds("," + pOffDuty.getId() + "," + pBusy.getId() + "," + pDeclined.getId() + ",");
        b5 = bookingRepo.save(b5);

        emergencyService.dispatch(b5, false);
        org.junit.jupiter.api.Assertions.assertEquals("FAILED_ASSIGNMENT", b5.getJobStatus());
        org.junit.jupiter.api.Assertions.assertEquals("All candidates declined", b5.getDispatchReason());

        // Case F: Assignment timeout -> "Assignment timeout"
        com.smartapartment.entity.EmergencyMaintenanceBooking b6 = new com.smartapartment.entity.EmergencyMaintenanceBooking();
        b6.setCity("TestCity");
        b6.setArea("NorthZone");
        b6.setCategory("Plumbing");
        b6.setRequesterPhone("1234567890");
        b6.setServiceAddress("303 Cedar St");
        b6.setTenantId("test-tenant");
        b6.setSourcePlatform("propertydirect");
        b6.setDeclinedPartnerIds("," + pOffDuty.getId() + "," + pBusy.getId() + "," + pDeclined.getId() + ",");
        b6 = bookingRepo.save(b6);

        emergencyService.dispatch(b6, true);
        org.junit.jupiter.api.Assertions.assertEquals("FAILED_ASSIGNMENT", b6.getJobStatus());
        org.junit.jupiter.api.Assertions.assertEquals("Assignment timeout", b6.getDispatchReason());

        // Verify all failed bookings remain visible to Maintenance Admin
        mvc.perform(get("/api/maintenance/dispatch/admin/failed").session(superAdmin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", hasItem(b1.getId().intValue())))
                .andExpect(jsonPath("$[*].id", hasItem(b2.getId().intValue())))
                .andExpect(jsonPath("$[*].id", hasItem(b3.getId().intValue())))
                .andExpect(jsonPath("$[*].id", hasItem(b4.getId().intValue())))
                .andExpect(jsonPath("$[*].id", hasItem(b5.getId().intValue())))
                .andExpect(jsonPath("$[*].id", hasItem(b6.getId().intValue())));

        // Verify manual admin assignment:
        // 1. Candidate partners list exposes name, trade, hub, distance, duty status, work status, employment type
        mvc.perform(get("/api/maintenance/dispatch/bookings/" + b1.getId() + "/candidates").session(superAdmin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].trade", hasItem("Plumbing")))
                .andExpect(jsonPath("$[*].dutyStatus", hasItem("On Duty")))
                .andExpect(jsonPath("$[*].employmentType", hasItem("THIRD_PARTY")));

        // 2. Admin manually assigns an eligible partner
        com.smartapartment.entity.MaintenancePartner freshPartner = partnerRepo.findById(pDeclined.getId()).orElseThrow();
        freshPartner.setWorkState("IDLE");
        freshPartner.setAvailability("IDLE");
        partnerRepo.save(freshPartner);

        String assignPayload = "{\"bookingId\":" + b1.getId() + ",\"partnerId\":" + freshPartner.getId() + "}";
        mvc.perform(post("/api/maintenance/dispatch/admin/assign").session(superAdmin).contentType(MediaType.APPLICATION_JSON).content(assignPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", containsString("Admin manually assigned partner")));

        // Verify booking has Assignment Type = Manual, assignedBy, and assignedAt
        var updatedB1 = bookingRepo.findById(b1.getId()).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals("ASSIGNED", updatedB1.getJobStatus());
        org.junit.jupiter.api.Assertions.assertEquals("Manual", updatedB1.getAssignmentType());
        org.junit.jupiter.api.Assertions.assertNotNull(updatedB1.getAssignedBy());
        org.junit.jupiter.api.Assertions.assertNotNull(updatedB1.getAssignedAt());
    }

    @Test void auditAndAssignmentHistoryTests() throws Exception {
        var superAdmin = login("smartapartment", "superadmin", "superadmin@smartapartment", "superadmin123");
        Long validUserId = userRepo.findByEmail("superadmin@smartapartment").map(com.smartapartment.entity.AppUser::getId).orElse(1L);

        // 1. Setup a test hub for Audit City
        String auditCity = "AuditCity-" + UUID.randomUUID().toString().substring(0, 6);
        com.smartapartment.entity.MaintenanceHub hub = new com.smartapartment.entity.MaintenanceHub();
        hub.setName("AuditHub Central");
        hub.setCity(auditCity);
        hub.setArea("CentralZone");
        hub.setLatitude(33.0);
        hub.setLongitude(66.0);
        hub.setRadiusKm(15.0);
        hub.setActive(true);
        hub.setStatus("ACTIVE");
        hub = hubRepo.save(hub);

        // 2. Setup 3 distinct partners with different coordinates
        com.smartapartment.entity.MaintenancePartner p1 = new com.smartapartment.entity.MaintenancePartner();
        p1.setName("Partner Alpha");
        p1.setHubId(hub.getId());
        p1.setTrade("Electrical");
        p1.setSkillCategories("Electrical");
        p1.setOnDuty(true);
        p1.setWorkState("IDLE");
        p1.setAvailability("IDLE");
        p1.setUserId(validUserId);
        p1.setLatitude(33.01);
        p1.setLongitude(66.01);
        p1.setLocationUpdatedAt(java.time.LocalDateTime.now());
        p1 = partnerRepo.save(p1);

        com.smartapartment.entity.MaintenancePartner p2 = new com.smartapartment.entity.MaintenancePartner();
        p2.setName("Partner Beta");
        p2.setHubId(hub.getId());
        p2.setTrade("Electrical");
        p2.setSkillCategories("Electrical");
        p2.setOnDuty(true);
        p2.setWorkState("IDLE");
        p2.setAvailability("IDLE");
        p2.setUserId(validUserId);
        p2.setLatitude(33.03);
        p2.setLongitude(66.03);
        p2.setLocationUpdatedAt(java.time.LocalDateTime.now());
        p2 = partnerRepo.save(p2);

        com.smartapartment.entity.MaintenancePartner p3 = new com.smartapartment.entity.MaintenancePartner();
        p3.setName("Partner Gamma");
        p3.setHubId(hub.getId());
        p3.setTrade("Electrical");
        p3.setSkillCategories("Electrical");
        p3.setOnDuty(true);
        p3.setWorkState("IDLE");
        p3.setAvailability("IDLE");
        p3.setUserId(validUserId);
        p3.setLatitude(33.05);
        p3.setLongitude(66.05);
        p3.setLocationUpdatedAt(java.time.LocalDateTime.now());
        p3 = partnerRepo.save(p3);

        // 3. Create emergency booking
        com.smartapartment.entity.EmergencyMaintenanceBooking b = new com.smartapartment.entity.EmergencyMaintenanceBooking();
        b.setCity(auditCity);
        b.setArea("CentralZone");
        b.setCategory("Electrical");
        b.setRequesterPhone("9988776655");
        b.setServiceAddress("77 Spark Lane");
        b.setTenantId("test-tenant");
        b.setSourcePlatform("smartsociety");
        b.setLatitude(33.0);
        b.setLongitude(66.0);
        b = bookingRepo.save(b);

        // Dispatch: Partner Alpha is offered (Auto assignment)
        emergencyService.dispatch(b);
        b = bookingRepo.findById(b.getId()).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals(p1.getId(), b.getPartnerId());
        org.junit.jupiter.api.Assertions.assertEquals("OFFERED", b.getJobStatus());
        org.junit.jupiter.api.Assertions.assertEquals("Auto", b.getAssignmentType());
        org.junit.jupiter.api.Assertions.assertTrue(b.getAssignmentAuditLog().contains("OFFERED"));
        org.junit.jupiter.api.Assertions.assertTrue(b.getAssignmentAuditLog().contains("Partner Alpha"));

        // Partner Alpha declines
        var workerActor = new com.smartapartment.service.EmergencyMaintenanceService.Actor(validUserId, "smartsociety", "test-tenant", "Worker", false, true);
        emergencyService.transition(workerActor, b.getId(), "DECLINE");
        b = bookingRepo.findById(b.getId()).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals(p2.getId(), b.getPartnerId());
        org.junit.jupiter.api.Assertions.assertEquals("OFFERED", b.getJobStatus());
        org.junit.jupiter.api.Assertions.assertTrue(b.getAssignmentAuditLog().contains("DECLINED"));
        org.junit.jupiter.api.Assertions.assertTrue(b.getAssignmentAuditLog().contains("Partner Beta"));

        // Partner Beta times out (simulate 5 minutes elapsed)
        b.setOfferedAt(java.time.LocalDateTime.now().minusMinutes(5));
        b = bookingRepo.save(b);
        emergencyService.retryPending();
        b = bookingRepo.findById(b.getId()).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals(p3.getId(), b.getPartnerId());
        org.junit.jupiter.api.Assertions.assertEquals("OFFERED", b.getJobStatus());
        org.junit.jupiter.api.Assertions.assertTrue(b.getAssignmentAuditLog().contains("TIMED_OUT"));
        org.junit.jupiter.api.Assertions.assertTrue(b.getAssignmentAuditLog().contains("Partner Gamma"));

        // Partner Gamma accepts
        emergencyService.transition(workerActor, b.getId(), "ACCEPT");
        b = bookingRepo.findById(b.getId()).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals("ACCEPTED", b.getJobStatus());
        org.junit.jupiter.api.Assertions.assertTrue(b.getAssignmentAuditLog().contains("ACCEPTED"));

        // Verify history endpoint returns structured audit records
        mvc.perform(get("/api/maintenance/dispatch/bookings/" + b.getId() + "/history").session(superAdmin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].action", hasItem("OFFERED")))
                .andExpect(jsonPath("$[*].action", hasItem("DECLINED")))
                .andExpect(jsonPath("$[*].action", hasItem("TIMED_OUT")))
                .andExpect(jsonPath("$[*].action", hasItem("ACCEPTED")));

        // Verify view endpoint contains assignmentAuditLog and assignmentHistory
        mvc.perform(get("/api/maintenance/dispatch/bookings/" + b.getId()).session(superAdmin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assignmentType").value("Auto"))
                .andExpect(jsonPath("$.assignmentAuditLog", containsString("ACCEPTED")))
                .andExpect(jsonPath("$.assignmentHistory", hasSize(greaterThanOrEqualTo(4))));

        // Verify AuditLog repository contains entries for EMERGENCY_DISPATCH
        var auditEntries = auditLogRepo.findByModuleOrderByCreatedAtDesc("EMERGENCY_DISPATCH");
        org.junit.jupiter.api.Assertions.assertFalse(auditEntries.isEmpty());
        org.junit.jupiter.api.Assertions.assertTrue(auditEntries.stream().anyMatch(al -> al.getDetails().contains("Partner Alpha")));
    }

    @Test void customerContactPrivacyTests() throws Exception {
        Long validUserId = userRepo.findByEmail("superadmin@smartapartment").map(com.smartapartment.entity.AppUser::getId).orElse(1L);

        // 1. Hub and partner setup
        com.smartapartment.entity.MaintenanceHub hub = new com.smartapartment.entity.MaintenanceHub();
        hub.setName("PrivacyHub");
        hub.setCity("PrivacyCity");
        hub.setArea("SafeZone");
        hub.setLatitude(15.0);
        hub.setLongitude(75.0);
        hub.setRadiusKm(10.0);
        hub.setActive(true);
        hub.setStatus("ACTIVE");
        hub = hubRepo.save(hub);

        com.smartapartment.entity.MaintenancePartner partner = new com.smartapartment.entity.MaintenancePartner();
        partner.setName("Privacy Partner");
        partner.setHubId(hub.getId());
        partner.setTrade("HVAC");
        partner.setSkillCategories("HVAC");
        partner.setOnDuty(true);
        partner.setWorkState("IDLE");
        partner.setAvailability("IDLE");
        partner.setUserId(validUserId);
        partner.setLatitude(15.01);
        partner.setLongitude(75.01);
        partner.setLocationUpdatedAt(java.time.LocalDateTime.now());
        partner = partnerRepo.save(partner);

        // 2. Customer booking created
        com.smartapartment.entity.EmergencyMaintenanceBooking b = new com.smartapartment.entity.EmergencyMaintenanceBooking();
        b.setCity("PrivacyCity");
        b.setArea("SafeZone");
        b.setCategory("HVAC");
        b.setRequesterName("Jane Private");
        b.setRequesterPhone("9900112233");
        b.setServiceAddress("99 Secret Garden Blvd");
        b.setTenantId("test-tenant");
        b.setSourcePlatform("smartsociety");
        b.setLatitude(15.0);
        b.setLongitude(75.0);
        b = bookingRepo.save(b);
        final Long bookingId = b.getId();

        emergencyService.dispatch(b);
        b = bookingRepo.findById(bookingId).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals("OFFERED", b.getJobStatus());

        // 3. Worker views booking before acceptance
        var workerActor = new com.smartapartment.service.EmergencyMaintenanceService.Actor(validUserId, "smartsociety", "test-tenant", "Worker", false, true);
        var preAcceptanceView = emergencyService.view(workerActor, b);

        // Assert privacy protection before acceptance
        org.junit.jupiter.api.Assertions.assertEquals(false, preAcceptanceView.get("contactUnlocked"));
        org.junit.jupiter.api.Assertions.assertEquals(false, preAcceptanceView.get("canCallCustomer"));
        org.junit.jupiter.api.Assertions.assertNull(preAcceptanceView.get("requesterName"));
        org.junit.jupiter.api.Assertions.assertNull(preAcceptanceView.get("requesterPhone"));
        org.junit.jupiter.api.Assertions.assertNull(preAcceptanceView.get("serviceAddress"));

        // Partner attempts CALL_CUSTOMER before acceptance -> throws 403
        org.junit.jupiter.api.Assertions.assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> {
            emergencyService.transition(workerActor, bookingId, "CALL_CUSTOMER");
        });

        // 4. Partner accepts booking
        emergencyService.transition(workerActor, bookingId, "ACCEPT");
        b = bookingRepo.findById(bookingId).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals("ACCEPTED", b.getJobStatus());

        // 5. Worker views booking after acceptance
        var postAcceptanceView = emergencyService.view(workerActor, b);

        // Assert customer contact is unlocked after acceptance
        org.junit.jupiter.api.Assertions.assertEquals(true, postAcceptanceView.get("contactUnlocked"));
        org.junit.jupiter.api.Assertions.assertEquals(true, postAcceptanceView.get("canCallCustomer"));
        org.junit.jupiter.api.Assertions.assertEquals("Jane Private", postAcceptanceView.get("requesterName"));
        org.junit.jupiter.api.Assertions.assertEquals("9900112233", postAcceptanceView.get("requesterPhone"));
        org.junit.jupiter.api.Assertions.assertEquals("99 Secret Garden Blvd", postAcceptanceView.get("serviceAddress"));

        // 6. Partner invokes CALL_CUSTOMER after acceptance -> succeeds
        org.junit.jupiter.api.Assertions.assertDoesNotThrow(() -> {
            emergencyService.transition(workerActor, bookingId, "CALL_CUSTOMER");
        });
        b = bookingRepo.findById(bookingId).orElseThrow();
        org.junit.jupiter.api.Assertions.assertTrue(b.getAssignmentAuditLog().contains("CALL_CUSTOMER"));
    }

    @Test void realtimeDispatchUpdatesTests() throws Exception {
        var superAdmin = login("smartapartment", "superadmin", "superadmin@smartapartment", "superadmin123");
        Long validUserId = userRepo.findByEmail("superadmin@smartapartment").map(com.smartapartment.entity.AppUser::getId).orElse(1L);

        long startTimestamp = System.currentTimeMillis() - 1000;

        // 1. Setup hub and partners
        com.smartapartment.entity.MaintenanceHub hub = new com.smartapartment.entity.MaintenanceHub();
        hub.setName("RealtimeHub");
        hub.setCity("RealtimeCity");
        hub.setArea("FastZone");
        hub.setLatitude(18.0);
        hub.setLongitude(78.0);
        hub.setRadiusKm(10.0);
        hub.setActive(true);
        hub.setStatus("ACTIVE");
        hub = hubRepo.save(hub);

        com.smartapartment.entity.MaintenancePartner p1 = new com.smartapartment.entity.MaintenancePartner();
        p1.setName("Realtime Partner 1");
        p1.setHubId(hub.getId());
        p1.setTrade("Carpentry");
        p1.setSkillCategories("Carpentry");
        p1.setOnDuty(true);
        p1.setWorkState("IDLE");
        p1.setAvailability("IDLE");
        p1.setUserId(validUserId);
        p1.setLatitude(18.01);
        p1.setLongitude(78.01);
        p1.setLocationUpdatedAt(java.time.LocalDateTime.now());
        p1 = partnerRepo.save(p1);

        com.smartapartment.entity.MaintenancePartner p2 = new com.smartapartment.entity.MaintenancePartner();
        p2.setName("Realtime Partner 2");
        p2.setHubId(hub.getId());
        p2.setTrade("Carpentry");
        p2.setSkillCategories("Carpentry");
        p2.setOnDuty(true);
        p2.setWorkState("IDLE");
        p2.setAvailability("IDLE");
        p2.setUserId(validUserId);
        p2.setLatitude(18.02);
        p2.setLongitude(78.02);
        p2.setLocationUpdatedAt(java.time.LocalDateTime.now());
        p2 = partnerRepo.save(p2);

        // 2. Create emergency booking
        com.smartapartment.entity.EmergencyMaintenanceBooking b = new com.smartapartment.entity.EmergencyMaintenanceBooking();
        b.setCity("RealtimeCity");
        b.setArea("FastZone");
        b.setCategory("Carpentry");
        b.setRequesterName("Alex Realtime");
        b.setRequesterPhone("8877665544");
        b.setServiceAddress("100 Live Stream Ave");
        b.setTenantId("test-tenant");
        b.setSourcePlatform("smartsociety");
        b.setLatitude(18.0);
        b.setLongitude(78.0);
        b = bookingRepo.save(b);
        final Long bookingId = b.getId();

        // 3. Dispatch triggers OFFERED event
        emergencyService.dispatch(b);

        // 4. Partner 1 declines -> triggers DECLINE event and cascaded OFFERED to Partner 2
        var workerActor = new com.smartapartment.service.EmergencyMaintenanceService.Actor(validUserId, "smartsociety", "test-tenant", "Worker", false, true);
        emergencyService.transition(workerActor, bookingId, "DECLINE");

        // 5. Partner 2 accepts -> triggers ACCEPT event
        emergencyService.transition(workerActor, bookingId, "ACCEPT");

        // 6. Verify recent events endpoint returns the real-time event updates
        mvc.perform(get("/api/maintenance/dispatch/events?since=" + startTimestamp).session(superAdmin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(3))))
                .andExpect(jsonPath("$[*].action", hasItem("OFFERED")))
                .andExpect(jsonPath("$[*].action", hasItem("DECLINE")))
                .andExpect(jsonPath("$[*].action", hasItem("ACCEPT")));

        // 7. Verify SSE event stream endpoint connects and sends initial confirmation
        mvc.perform(get("/api/maintenance/dispatch/events/stream").session(superAdmin))
                .andExpect(status().isOk());
    }

    private org.springframework.mock.web.MockHttpSession login(String platform, String role, String username, String password) throws Exception {
        return (org.springframework.mock.web.MockHttpSession) mvc.perform(post("/api/auth/dashboard-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(java.util.Map.of("platform", platform, "role", role, "username", username, "password", password))))
                .andExpect(status().isOk()).andReturn().getRequest().getSession(false);
    }
}

