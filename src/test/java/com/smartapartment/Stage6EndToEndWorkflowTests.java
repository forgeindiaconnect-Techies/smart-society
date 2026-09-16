package com.smartapartment;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.imageio.ImageIO;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartapartment.entity.AppUser;
import com.smartapartment.entity.EmergencyMaintenanceBooking;
import com.smartapartment.entity.MaintenanceHub;
import com.smartapartment.entity.MaintenancePartner;
import com.smartapartment.repository.AppUserRepository;
import com.smartapartment.repository.EmergencyMaintenanceBookingRepository;
import com.smartapartment.repository.MaintenanceHubRepository;
import com.smartapartment.repository.MaintenancePartnerRepository;
import com.smartapartment.service.EmergencyMaintenanceService;

@SpringBootTest
@AutoConfigureMockMvc
class Stage6EndToEndWorkflowTests {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private EmergencyMaintenanceService emergencyService;

    @Autowired
    private MaintenanceHubRepository hubRepository;

    @Autowired
    private MaintenancePartnerRepository partnerRepository;

    @Autowired
    private EmergencyMaintenanceBookingRepository bookingRepository;

    @Autowired
    private AppUserRepository userRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private static final byte[] DUMMY_PHOTO = new byte[] { (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A };

    private MockHttpSession loginAsMaintenanceStaff() throws Exception {
        MvcResult result = mvc.perform(post("/api/auth/dashboard-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"platform\":\"smartapartment\",\"role\":\"maintenance\",\"username\":\"maintenance@smartapartment\",\"password\":\"maintenance123\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    private MockHttpSession registerCustomer(String name, String phone) throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String regJson = String.format("""
            {
                "name": "%s",
                "phone": "%s",
                "email": "cust-%s@example.com",
                "username": "user-%s",
                "password": "password123"
            }
            """, name, phone, suffix, suffix);
        MvcResult res = mvc.perform(post("/api/auth/propertydirect/register-customer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(regJson))
                .andExpect(status().isOk())
                .andReturn();
        return (MockHttpSession) res.getRequest().getSession(false);
    }

    private MockHttpSession createPartnerSession(AppUser workerUser) {
        MockHttpSession partnerSession = new MockHttpSession();
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(
                workerUser.getEmail(), null, List.of(new SimpleGrantedAuthority("ROLE_MAINTENANCE_STAFF"))));
        partnerSession.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);
        return partnerSession;
    }

    @Test
    @DisplayName("2. Standard Emergency Happy Path: Customer Plumbing Emergency -> Full Lifecycle -> Admin Monitoring -> Customer Review")
    void standardEmergencyHappyPath_EndToEnd() throws Exception {
        MockHttpSession adminSession = loginAsMaintenanceStaff();

        // 1. Setup Hub in Bangalore
        String city = "Bangalore";
        String area = "Indiranagar Central";
        double hubLat = 12.9850;
        double hubLon = 77.6550;

        MaintenanceHub hub = new MaintenanceHub();
        hub.setName("Indiranagar Emergency Hub - E2E");
        hub.setCity(city);
        hub.setArea(area);
        hub.setLatitude(hubLat);
        hub.setLongitude(hubLon);
        hub.setRadiusKm(15.0);
        hub.setActive(true);
        hub = hubRepository.save(hub);

        // 2. Setup Eligible On-Duty Plumbing Partner
        AppUser workerUser = userRepository.findByEmail("maintenance@smartapartment").orElseGet(() -> {
            AppUser u = new AppUser();
            u.setEmail("maintenance@smartapartment");
            u.setFullName("Alex Plumber");
            u.setPasswordHash("hashed_pw");
            u.setRole(com.smartapartment.entity.UserRole.MAINTENANCE_STAFF);
            return userRepository.save(u);
        });

        MaintenancePartner partner = new MaintenancePartner();
        partner.setHubId(hub.getId());
        partner.setName("Alex Plumber");
        partner.setPhone("9876543201");
        partner.setTrade("Plumbing");
        partner.setSkillCategories("Plumbing,Sanitary,Drainage");
        partner.setOnDuty(true);
        partner.setWorkState("IDLE");
        partner.setAvailability("AVAILABLE");
        partner.setUserId(workerUser.getId());
        partner.setLatitude(12.9852);
        partner.setLongitude(77.6552);
        partner.setLocationUpdatedAt(LocalDateTime.now());
        partner.setEmploymentType("FULL_TIME");
        partner = partnerRepository.save(partner);

        // Partner actor
        EmergencyMaintenanceService.Actor partnerActor = new EmergencyMaintenanceService.Actor(
                workerUser.getId(), "smartsociety", "smartsociety", partner.getName(), false, true);

        // 3. Customer creates Emergency Plumbing request
        MockHttpSession customerSession = registerCustomer("Emergency Customer Pooja", "9876543999");
        String bookingPayload = String.format("""
            {
                "category": "Plumbing",
                "description": "Burst pipe under kitchen sink violently flooding floor",
                "city": "%s",
                "area": "%s",
                "serviceAddress": "Tower C, Apartment 402, 100 Feet Rd",
                "latitude": %.4f,
                "longitude": %.4f,
                "requesterPhone": "9876543999"
            }
            """, city, area, hubLat, hubLon);

        MvcResult createResult = mvc.perform(post("/api/maintenance/dispatch/bookings?platform=propertydirect")
                        .session(customerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bookingPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.city").value(city))
                .andExpect(jsonPath("$.hubId").value(hub.getId().intValue()))
                .andExpect(jsonPath("$.jobStatus").value("UNASSIGNED"))
                .andReturn();

        JsonNode createdNode = objectMapper.readTree(createResult.getResponse().getContentAsString());
        long bookingId = createdNode.get("id").asLong();

        // 4. Auto-dispatch: find nearest hub & offer to eligible Plumbing partner
        EmergencyMaintenanceBooking booking = bookingRepository.findById(bookingId).orElseThrow();
        assertNotNull(booking.getCreatedAt(), "Booking createdAt timestamp must be set");
        emergencyService.dispatch(booking);

        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("OFFERED", booking.getJobStatus(), "State must be OFFERED");
        assertEquals(partner.getId(), booking.getPartnerId(), "Partner Alex Plumber must receive the offer");
        assertNotNull(booking.getOfferedAt(), "offeredAt timestamp must be recorded");

        // Verify partner availability state transitioned to BUSY
        partner = partnerRepository.findById(partner.getId()).orElseThrow();
        assertEquals("BUSY", partner.getWorkState(), "Partner workState must be BUSY during active offer");

        // 5. Customer contact protected prior to acceptance for technician
        var preAcceptanceView = emergencyService.view(partnerActor, booking);
        assertEquals(false, preAcceptanceView.get("contactUnlocked"), "Customer contact must be locked prior to acceptance");
        assertEquals(false, preAcceptanceView.get("canCallCustomer"), "Calling customer must not be allowed before acceptance");
        assertNull(preAcceptanceView.get("requesterPhone"), "Customer phone must be hidden before acceptance");

        // Partner attempting to call customer before acceptance throws 403
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> {
            emergencyService.transition(partnerActor, bookingId, "CALL_CUSTOMER", null, null, null);
        });

        // 6. Partner Accepts
        emergencyService.transition(partnerActor, bookingId, "ACCEPT", null, null, null);
        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("ACCEPTED", booking.getJobStatus(), "State must be ACCEPTED");
        assertNotNull(booking.getAcceptedAt(), "acceptedAt timestamp must be recorded");
        assertNotNull(booking.getArrivalDueAt(), "arrivalDueAt must be set (30 min SLA)");

        // Verify customer contact is now unlocked for the technician
        var postAcceptanceView = emergencyService.view(partnerActor, booking);
        assertEquals(true, postAcceptanceView.get("contactUnlocked"), "Customer contact must be unlocked after acceptance");
        assertEquals(true, postAcceptanceView.get("canCallCustomer"), "Calling customer must be allowed after acceptance");
        assertEquals("9876543999", postAcceptanceView.get("requesterPhone"), "Customer phone must be visible after acceptance");

        // 7. Partner Reached Location (geofence verification)
        emergencyService.transition(partnerActor, bookingId, "REACHED", hubLat, hubLon, null);
        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("REACHED_LOCATION", booking.getJobStatus(), "State must be REACHED_LOCATION");
        assertNotNull(booking.getReachedAt(), "reachedAt timestamp must be recorded");
        assertTrue(booking.getArrivalGeofenceVerified() != null && booking.getArrivalGeofenceVerified(), "Geofence must be verified");

        // 8. Partner uploads Before Photo
        emergencyService.photo(partnerActor, bookingId, "before", DUMMY_PHOTO);
        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("PHOTO_START", booking.getJobStatus(), "State must be PHOTO_START");
        assertNotNull(booking.getPhotoStartAt(), "photoStartAt timestamp must be recorded");
        assertNotNull(booking.getBeforePhoto(), "beforePhoto blob must be saved");
        assertTrue(booking.getBeforePhotoUrl().contains("/photos/before"), "beforePhotoUrl must be generated");

        // 9. Partner starts work
        emergencyService.transition(partnerActor, bookingId, "START", null, null, null);
        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("IN_PROGRESS", booking.getJobStatus(), "State must be IN_PROGRESS");
        assertNotNull(booking.getStartedAt(), "startedAt timestamp must be recorded");

        // 10. Partner uploads After Photo
        emergencyService.photo(partnerActor, bookingId, "after", DUMMY_PHOTO);
        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertNotNull(booking.getPhotoEndAt(), "photoEndAt timestamp must be recorded");
        assertNotNull(booking.getAfterPhoto(), "afterPhoto blob must be saved");
        assertTrue(booking.getAfterPhotoUrl().contains("/photos/after"), "afterPhotoUrl must be generated");

        // 11. Partner completes work
        String completionNotes = "Main 1-inch elbow pipe replaced with high-pressure PVC coupling. Water leak stopped.";
        emergencyService.transition(partnerActor, bookingId, "COMPLETE", null, null, completionNotes);
        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("COMPLETED", booking.getJobStatus(), "State must be COMPLETED");
        assertNotNull(booking.getCompletedAt(), "completedAt timestamp must be recorded");
        assertEquals(completionNotes, booking.getCompletionNotes(), "Completion notes must be saved");

        // 12. Partner becomes available (released to IDLE)
        partner = partnerRepository.findById(partner.getId()).orElseThrow();
        assertEquals("IDLE", partner.getWorkState(), "Partner must return to IDLE workState");

        // 13. Review trigger is created/sent
        assertNotNull(booking.getCustomerReviewUrl(), "customerReviewUrl must be generated");
        assertEquals("PREPARED", booking.getReviewNotificationStatus(), "Review notification status must be PREPARED");
        assertNotNull(booking.getReviewRequestedAt(), "reviewRequestedAt timestamp must be recorded");

        // 14. Customer submits review
        String reviewJson = """
            {
                "rating": 5,
                "review": "Outstanding emergency plumbing response! Fixed in 20 minutes."
            }
            """;
        mvc.perform(post("/api/maintenance/dispatch/bookings/" + bookingId + "/review?platform=propertydirect")
                        .session(customerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reviewJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", containsString("saved")));

        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals(5, booking.getRating());
        assertEquals("Outstanding emergency plumbing response! Fixed in 20 minutes.", booking.getReview());
        assertNotNull(booking.getCustomerSignedOffAt());

        // 15. Admin sees completed timeline
        EmergencyMaintenanceService.Actor adminActor = new EmergencyMaintenanceService.Actor(
                0L, "smartapartment", "smartapartment", "Admin", true, false);
        List<Map<String, Object>> timeline = emergencyService.timeline(adminActor, bookingId);
        assertNotNull(timeline, "Timeline must not be null");
        assertFalse(timeline.isEmpty(), "Timeline must contain audited events");

        // Verify chronological progression of milestone stages
        List<String> stages = timeline.stream().map(e -> String.valueOf(e.get("stage"))).toList();
        assertTrue(stages.contains("ACCEPTED"), "Timeline must contain ACCEPTED stage");
        assertTrue(stages.contains("REACHED_LOCATION"), "Timeline must contain REACHED_LOCATION stage");
        assertTrue(stages.contains("BEFORE_PHOTO"), "Timeline must contain BEFORE_PHOTO stage");
        assertTrue(stages.contains("IN_PROGRESS"), "Timeline must contain IN_PROGRESS stage");
        assertTrue(stages.contains("COMPLETED"), "Timeline must contain COMPLETED stage");
        assertTrue(stages.contains("AFTER_PHOTO"), "Timeline must contain AFTER_PHOTO stage");
        assertTrue(stages.contains("CUSTOMER_CONFIRMED"), "Timeline must contain CUSTOMER_CONFIRMED stage");

        // Verify all 8 chronological timestamps on entity
        assertNotNull(booking.getCreatedAt(), "createdAt must be non-null");
        assertNotNull(booking.getOfferedAt(), "offeredAt must be non-null");
        assertNotNull(booking.getAcceptedAt(), "acceptedAt must be non-null");
        assertNotNull(booking.getReachedAt(), "reachedAt must be non-null");
        assertNotNull(booking.getPhotoStartAt(), "photoStartAt must be non-null");
        assertNotNull(booking.getStartedAt(), "startedAt must be non-null");
        assertNotNull(booking.getPhotoEndAt(), "photoEndAt must be non-null");
        assertNotNull(booking.getCompletedAt(), "completedAt must be non-null");
        assertNotNull(booking.getCustomerSignedOffAt(), "customerSignedOffAt must be non-null");
    }

    @Test
    @DisplayName("3. Partner Decline Scenario: Partner 1 declines -> Returns to matching engine -> Partner 1 excluded -> Partner 2 offered -> Partner 2 accepts -> Admin audits")
    void partnerDeclineScenario_ReassignsToPartner2() throws Exception {
        MockHttpSession adminSession = loginAsMaintenanceStaff();

        // 1. Setup Hub
        String city = "Bangalore";
        String area = "Koramangala Decline Hub";
        double hubLat = 12.9352;
        double hubLon = 77.6245;

        MaintenanceHub hub = new MaintenanceHub();
        hub.setName("Koramangala Emergency Hub - Decline Test");
        hub.setCity(city);
        hub.setArea(area);
        hub.setLatitude(hubLat);
        hub.setLongitude(hubLon);
        hub.setRadiusKm(15.0);
        hub.setActive(true);
        hub = hubRepository.save(hub);

        // 2. Setup Partner 1 (closer: 0.1km away)
        AppUser workerUser1 = new AppUser();
        workerUser1.setEmail("partner1-" + UUID.randomUUID() + "@example.com");
        workerUser1.setFullName("Partner One Electrical");
        workerUser1.setPasswordHash("hashed_pw");
        workerUser1.setRole(com.smartapartment.entity.UserRole.MAINTENANCE_STAFF);
        workerUser1 = userRepository.save(workerUser1);

        MaintenancePartner partner1 = new MaintenancePartner();
        partner1.setHubId(hub.getId());
        partner1.setName("Partner One Electrical");
        partner1.setPhone("9876543001");
        partner1.setTrade("Electrical");
        partner1.setSkillCategories("Electrical,Short Circuit");
        partner1.setOnDuty(true);
        partner1.setWorkState("IDLE");
        partner1.setAvailability("AVAILABLE");
        partner1.setUserId(workerUser1.getId());
        partner1.setLatitude(12.9355);
        partner1.setLongitude(77.6248);
        partner1.setLocationUpdatedAt(LocalDateTime.now());
        partner1 = partnerRepository.save(partner1);

        EmergencyMaintenanceService.Actor partner1Actor = new EmergencyMaintenanceService.Actor(
                workerUser1.getId(), "smartsociety", "smartsociety", partner1.getName(), false, true);

        // 3. Setup Partner 2 (slightly farther: 0.8km away)
        AppUser workerUser2 = new AppUser();
        workerUser2.setEmail("partner2-" + UUID.randomUUID() + "@example.com");
        workerUser2.setFullName("Partner Two Electrical");
        workerUser2.setPasswordHash("hashed_pw");
        workerUser2.setRole(com.smartapartment.entity.UserRole.MAINTENANCE_STAFF);
        workerUser2 = userRepository.save(workerUser2);

        MaintenancePartner partner2 = new MaintenancePartner();
        partner2.setHubId(hub.getId());
        partner2.setName("Partner Two Electrical");
        partner2.setPhone("9876543002");
        partner2.setTrade("Electrical");
        partner2.setSkillCategories("Electrical,Short Circuit");
        partner2.setOnDuty(true);
        partner2.setWorkState("IDLE");
        partner2.setAvailability("AVAILABLE");
        partner2.setUserId(workerUser2.getId());
        partner2.setLatitude(12.9400);
        partner2.setLongitude(77.6300);
        partner2.setLocationUpdatedAt(LocalDateTime.now());
        partner2 = partnerRepository.save(partner2);

        EmergencyMaintenanceService.Actor partner2Actor = new EmergencyMaintenanceService.Actor(
                workerUser2.getId(), "smartsociety", "smartsociety", partner2.getName(), false, true);

        // 4. Customer creates emergency electrical request
        MockHttpSession customerSession = registerCustomer("Customer Maya", "9876543222");
        String bookingPayload = String.format("""
            {
                "category": "Electrical",
                "description": "Main electrical distribution board sparking and smoking",
                "city": "%s",
                "area": "%s",
                "serviceAddress": "Block B, Flat 101, 80 Feet Road",
                "latitude": %.4f,
                "longitude": %.4f,
                "requesterPhone": "9876543222"
            }
            """, city, area, hubLat, hubLon);

        MvcResult createResult = mvc.perform(post("/api/maintenance/dispatch/bookings?platform=propertydirect")
                        .session(customerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bookingPayload))
                .andExpect(status().isOk())
                .andReturn();

        long bookingId = objectMapper.readTree(createResult.getResponse().getContentAsString()).get("id").asLong();

        // 5. Initial Dispatch: Partner 1 is nearest, receives the initial offer
        EmergencyMaintenanceBooking booking = bookingRepository.findById(bookingId).orElseThrow();
        emergencyService.dispatch(booking);

        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("OFFERED", booking.getJobStatus(), "State must be OFFERED");
        assertEquals(partner1.getId(), booking.getPartnerId(), "Partner 1 (nearest) must receive initial offer");

        // 6. Partner 1 Declines
        emergencyService.transition(partner1Actor, bookingId, "DECLINE", null, null, "Too far from current location");

        booking = bookingRepository.findById(bookingId).orElseThrow();

        // 7. Verify: Booking returned to matching engine & Partner 1 is NOT selected again
        assertTrue(booking.getDeclinedPartnerIds().contains("," + partner1.getId() + ","),
                "Partner 1 ID must be recorded in declinedPartnerIds: " + booking.getDeclinedPartnerIds());
        assertNotEquals(partner1.getId(), booking.getPartnerId(),
                "Partner 1 must NOT be immediately selected again after declining");

        // 8. Verify Partner 1 is released back to IDLE
        partner1 = partnerRepository.findById(partner1.getId()).orElseThrow();
        assertEquals("IDLE", partner1.getWorkState(), "Partner 1 must be released to IDLE after decline");

        // 9. Verify Partner 2 received the subsequent offer
        assertEquals(partner2.getId(), booking.getPartnerId(), "Partner 2 must receive the next offer");
        assertEquals("OFFERED", booking.getJobStatus(), "Booking state must be OFFERED to Partner 2");

        // 10. Partner 2 Accepts
        emergencyService.transition(partner2Actor, bookingId, "ACCEPT", null, null, null);

        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("ACCEPTED", booking.getJobStatus(), "Booking must now be ACCEPTED by Partner 2");
        assertEquals(partner2.getId(), booking.getPartnerId(), "Partner 2 must be assigned partner");
        assertNotNull(booking.getAcceptedAt(), "acceptedAt must be recorded");

        // 11. Verify Admin can see what happened via audit history & timeline
        EmergencyMaintenanceService.Actor adminActor = new EmergencyMaintenanceService.Actor(
                0L, "smartapartment", "smartapartment", "Admin", true, false);

        // Check history entries parsed for admin
        final Long p1Id = partner1.getId();
        final Long p2Id = partner2.getId();
        final String p2Name = partner2.getName();
        List<Map<String, Object>> auditHistory = emergencyService.history(adminActor, bookingId);
        assertNotNull(auditHistory, "Admin audit history must be populated");
        boolean partner1DeclineFound = auditHistory.stream().anyMatch(h -> {
            String act = String.valueOf(h.get("action"));
            String det = String.valueOf(h.get("details"));
            return act.contains("DECLINED") && (det.contains(String.valueOf(p1Id)) || det.contains("Partner declined"));
        });
        assertTrue(partner1DeclineFound, "Admin audit history must document Partner 1 declining the offer");

        boolean partner2AcceptFound = auditHistory.stream().anyMatch(h -> {
            String act = String.valueOf(h.get("action"));
            String det = String.valueOf(h.get("details"));
            return act.contains("ACCEPTED") && (det.contains(String.valueOf(p2Id)) || det.contains(p2Name));
        });
        assertTrue(partner2AcceptFound, "Admin audit history must document Partner 2 accepting the offer");

        // Verify audit log strings in booking entity
        assertTrue(booking.getAssignmentAuditLog().contains("DECLINED"), "Assignment audit log must record DECLINED");
        assertTrue(booking.getAssignmentAuditLog().contains(String.valueOf(p1Id)), "Assignment audit log must reference Partner 1");
        assertTrue(booking.getAssignmentAuditLog().contains(String.valueOf(p2Id)), "Assignment audit log must reference Partner 2");

        // 12. Verify Admin API exposes declined status, full assignment history, and current assigned partner
        mvc.perform(get("/api/maintenance/dispatch/bookings/" + bookingId).session(adminSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.partnerId").value(partner2.getId().intValue()))
                .andExpect(jsonPath("$.jobStatus").value("ACCEPTED"))
                .andExpect(jsonPath("$.statusLabel").value("Accepted"))
                .andExpect(jsonPath("$.declinedPartnerIds").value(containsString(String.valueOf(partner1.getId()))))
                .andExpect(jsonPath("$.assignmentHistory", notNullValue()));
    }

    @Test
    @DisplayName("4. Partner Timeout Scenario: Partner 1 times out -> Expired -> Reassigned to Partner 2 -> Status never stuck")
    void partnerTimeoutScenario_ReassignsToNextPartner() throws Exception {
        MockHttpSession adminSession = loginAsMaintenanceStaff();

        // 1. Setup Hub
        String city = "Bangalore";
        String area = "Whitefield Timeout Hub";
        double hubLat = 12.9698;
        double hubLon = 77.7500;

        MaintenanceHub hub = new MaintenanceHub();
        hub.setName("Whitefield Emergency Hub - Timeout Test");
        hub.setCity(city);
        hub.setArea(area);
        hub.setLatitude(hubLat);
        hub.setLongitude(hubLon);
        hub.setRadiusKm(15.0);
        hub.setActive(true);
        hub = hubRepository.save(hub);

        // 2. Setup Partner 1 (closer: 0.1km away)
        AppUser workerUser1 = new AppUser();
        workerUser1.setEmail("timeout-p1-" + UUID.randomUUID() + "@example.com");
        workerUser1.setFullName("Partner One Carpentry");
        workerUser1.setPasswordHash("hashed_pw");
        workerUser1.setRole(com.smartapartment.entity.UserRole.MAINTENANCE_STAFF);
        workerUser1 = userRepository.save(workerUser1);

        MaintenancePartner partner1 = new MaintenancePartner();
        partner1.setHubId(hub.getId());
        partner1.setName("Partner One Carpentry");
        partner1.setPhone("9876543011");
        partner1.setTrade("Carpentry");
        partner1.setSkillCategories("Carpentry,Locks,Doors");
        partner1.setOnDuty(true);
        partner1.setWorkState("IDLE");
        partner1.setAvailability("AVAILABLE");
        partner1.setUserId(workerUser1.getId());
        partner1.setLatitude(12.9700);
        partner1.setLongitude(77.7502);
        partner1.setLocationUpdatedAt(LocalDateTime.now());
        partner1 = partnerRepository.save(partner1);

        // 3. Setup Partner 2 (farther: 0.5km away)
        AppUser workerUser2 = new AppUser();
        workerUser2.setEmail("timeout-p2-" + UUID.randomUUID() + "@example.com");
        workerUser2.setFullName("Partner Two Carpentry");
        workerUser2.setPasswordHash("hashed_pw");
        workerUser2.setRole(com.smartapartment.entity.UserRole.MAINTENANCE_STAFF);
        workerUser2 = userRepository.save(workerUser2);

        MaintenancePartner partner2 = new MaintenancePartner();
        partner2.setHubId(hub.getId());
        partner2.setName("Partner Two Carpentry");
        partner2.setPhone("9876543012");
        partner2.setTrade("Carpentry");
        partner2.setSkillCategories("Carpentry,Locks,Doors");
        partner2.setOnDuty(true);
        partner2.setWorkState("IDLE");
        partner2.setAvailability("AVAILABLE");
        partner2.setUserId(workerUser2.getId());
        partner2.setLatitude(12.9730);
        partner2.setLongitude(77.7520);
        partner2.setLocationUpdatedAt(LocalDateTime.now());
        partner2 = partnerRepository.save(partner2);

        EmergencyMaintenanceService.Actor partner2Actor = new EmergencyMaintenanceService.Actor(
                workerUser2.getId(), "smartsociety", "smartsociety", partner2.getName(), false, true);

        // 4. Customer creates emergency Carpentry booking
        MockHttpSession customerSession = registerCustomer("Customer Vivek", "9876543333");
        String bookingPayload = String.format("""
            {
                "category": "Carpentry",
                "description": "Main entryway door frame collapsed and jammed shut",
                "city": "%s",
                "area": "%s",
                "serviceAddress": "Tower D, Flat 501, ITPL Main Rd",
                "latitude": %.4f,
                "longitude": %.4f,
                "requesterPhone": "9876543333"
            }
            """, city, area, hubLat, hubLon);

        MvcResult createResult = mvc.perform(post("/api/maintenance/dispatch/bookings?platform=propertydirect")
                        .session(customerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bookingPayload))
                .andExpect(status().isOk())
                .andReturn();

        long bookingId = objectMapper.readTree(createResult.getResponse().getContentAsString()).get("id").asLong();

        // 5. Initial Dispatch: Partner 1 receives offer
        EmergencyMaintenanceBooking booking = bookingRepository.findById(bookingId).orElseThrow();
        emergencyService.dispatch(booking);

        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("OFFERED", booking.getJobStatus());
        assertEquals(partner1.getId(), booking.getPartnerId());

        partner1 = partnerRepository.findById(partner1.getId()).orElseThrow();
        assertEquals("BUSY", partner1.getWorkState(), "Partner 1 must be BUSY during offer");

        // 6. Partner 1 does not respond -> Simulate timeout (offered 5 minutes ago)
        booking.setOfferedAt(LocalDateTime.now().minusMinutes(5));
        booking = bookingRepository.save(booking);

        // 7. Trigger timeout check & pending retry
        emergencyService.retryPending();

        // 8. Verify Partner 1 released from BUSY to IDLE
        partner1 = partnerRepository.findById(partner1.getId()).orElseThrow();
        assertEquals("IDLE", partner1.getWorkState(), "Partner 1 must be released to IDLE after timeout");

        // 9. Verify Booking reassigned to Partner 2
        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("OFFERED", booking.getJobStatus(), "Job status must be OFFERED to Partner 2, not stuck");
        assertEquals(partner2.getId(), booking.getPartnerId(), "Partner 2 must receive next offer");
        assertTrue(booking.getDeclinedPartnerIds().contains("," + partner1.getId() + ","),
                "Partner 1 must be recorded in declinedPartnerIds after timeout");
        assertTrue(booking.getAssignmentAuditLog().contains("TIMED_OUT"),
                "Assignment audit log must record TIMED_OUT");

        // 10. Partner 2 Accepts
        emergencyService.transition(partner2Actor, bookingId, "ACCEPT", null, null, null);

        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("ACCEPTED", booking.getJobStatus(), "Booking must transition cleanly to ACCEPTED");
        assertEquals(partner2.getId(), booking.getPartnerId());

        // 11. Admin verification: TIMED_OUT visible in audit timeline
        EmergencyMaintenanceService.Actor adminActor = new EmergencyMaintenanceService.Actor(
                0L, "smartapartment", "smartapartment", "Admin", true, false);
        List<Map<String, Object>> auditHistory = emergencyService.history(adminActor, bookingId);
        final Long p1Id = partner1.getId();
        boolean timeoutFound = auditHistory.stream().anyMatch(h -> {
            String act = String.valueOf(h.get("action"));
            String det = String.valueOf(h.get("details"));
            return act.contains("TIMED_OUT") && (det.contains(String.valueOf(p1Id)) || det.contains("timed out"));
        });
        assertTrue(timeoutFound, "Admin audit history must document Partner 1 timing out");
    }

    @Test
    @DisplayName("5. No Available Partner Scenario: All partners Busy/Offline/Off Duty -> FAILED_ASSIGNMENT -> Admin Manually Resolves")
    void noAvailablePartnerScenario_UnassignedActionQueueAndManualResolve() throws Exception {
        MockHttpSession adminSession = loginAsMaintenanceStaff();

        // 1. Setup Hub
        String city = "Bangalore";
        String area = "Jayanagar Failover Hub";
        double hubLat = 12.9304;
        double hubLon = 77.5833;

        MaintenanceHub hub = new MaintenanceHub();
        hub.setName("Jayanagar Emergency Hub - Failover Test");
        hub.setCity(city);
        hub.setArea(area);
        hub.setLatitude(hubLat);
        hub.setLongitude(hubLon);
        hub.setRadiusKm(15.0);
        hub.setActive(true);
        hub = hubRepository.save(hub);

        // 2. Setup Partner 1: Off Duty
        AppUser u1 = new AppUser();
        u1.setEmail("offduty-" + UUID.randomUUID() + "@example.com");
        u1.setFullName("Partner OffDuty HVAC");
        u1.setPasswordHash("hashed_pw");
        u1.setRole(com.smartapartment.entity.UserRole.MAINTENANCE_STAFF);
        u1 = userRepository.save(u1);

        MaintenancePartner p1 = new MaintenancePartner();
        p1.setHubId(hub.getId());
        p1.setName("Partner OffDuty HVAC");
        p1.setPhone("9876543021");
        p1.setTrade("HVAC");
        p1.setOnDuty(false); // OFF DUTY
        p1.setWorkState("IDLE");
        p1.setAvailability("AVAILABLE");
        p1.setUserId(u1.getId());
        partnerRepository.save(p1);

        // 3. Setup Partner 2: Busy
        AppUser u2 = new AppUser();
        u2.setEmail("busy-" + UUID.randomUUID() + "@example.com");
        u2.setFullName("Partner Busy HVAC");
        u2.setPasswordHash("hashed_pw");
        u2.setRole(com.smartapartment.entity.UserRole.MAINTENANCE_STAFF);
        u2 = userRepository.save(u2);

        MaintenancePartner p2 = new MaintenancePartner();
        p2.setHubId(hub.getId());
        p2.setName("Partner Busy HVAC");
        p2.setPhone("9876543022");
        p2.setTrade("HVAC");
        p2.setOnDuty(true);
        p2.setWorkState("BUSY"); // BUSY
        p2.setAvailability("BUSY"); // BUSY
        p2.setUserId(u2.getId());
        partnerRepository.save(p2);

        // 4. Setup Partner 3: Offline
        AppUser u3 = new AppUser();
        u3.setEmail("offline-" + UUID.randomUUID() + "@example.com");
        u3.setFullName("Partner Offline HVAC");
        u3.setPasswordHash("hashed_pw");
        u3.setRole(com.smartapartment.entity.UserRole.MAINTENANCE_STAFF);
        u3 = userRepository.save(u3);

        MaintenancePartner p3 = new MaintenancePartner();
        p3.setHubId(hub.getId());
        p3.setName("Partner Offline HVAC");
        p3.setPhone("9876543023");
        p3.setTrade("HVAC");
        p3.setOnDuty(false); // OFF DUTY / OFFLINE
        p3.setWorkState("OFFLINE");
        p3.setAvailability("OFFLINE");
        p3.setUserId(u3.getId());
        partnerRepository.save(p3);

        // 5. Customer creates emergency HVAC booking
        MockHttpSession customerSession = registerCustomer("Customer Arvind", "9876543444");
        String bookingPayload = String.format("""
            {
                "category": "HVAC",
                "description": "Central ventilation system emitting chemical burning odor",
                "city": "%s",
                "area": "%s",
                "serviceAddress": "Tower E, Penthouse 1201, 11th Main",
                "latitude": %.4f,
                "longitude": %.4f,
                "requesterPhone": "9876543444"
            }
            """, city, area, hubLat, hubLon);

        MvcResult createResult = mvc.perform(post("/api/maintenance/dispatch/bookings?platform=propertydirect")
                        .session(customerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bookingPayload))
                .andExpect(status().isOk())
                .andReturn();

        long bookingId = objectMapper.readTree(createResult.getResponse().getContentAsString()).get("id").asLong();

        // 6. Auto-dispatch execution: no partners available
        EmergencyMaintenanceBooking booking = bookingRepository.findById(bookingId).orElseThrow();
        emergencyService.dispatch(booking);

        // 7. Verify Expected State:
        // - Booking remains valid
        // - No incorrect partner assigned (partnerId is null)
        // - Booking moves to FAILED_ASSIGNMENT / Unassigned Action Queue
        // - Reason is clearly visible
        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertNotNull(booking, "Booking must remain valid in database");
        assertNull(booking.getPartnerId(), "No incorrect partner must be assigned");
        assertEquals("FAILED_ASSIGNMENT", booking.getJobStatus(), "Booking must transition to FAILED_ASSIGNMENT");
        assertNotNull(booking.getDispatchReason(), "Failure reason must be present");
        assertTrue(booking.getDispatchReason().contains("partners") || booking.getDispatchReason().contains("No on-duty") || booking.getDispatchReason().contains("busy"),
                "Reason must be informative: " + booking.getDispatchReason());

        // 8. Verify Admin sees it in failed/unassigned queue API
        mvc.perform(get("/api/maintenance/dispatch/admin/failed").session(adminSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == " + bookingId + ")].id").value(hasItem((int) bookingId)))
                .andExpect(jsonPath("$[?(@.id == " + bookingId + ")].jobStatus").value(hasItem("FAILED_ASSIGNMENT")))
                .andExpect(jsonPath("$[?(@.id == " + bookingId + ")].dispatchReason", notNullValue()));

        // 9. Maintenance Admin manually resolves it:
        AppUser adminSpecialistUser = new AppUser();
        adminSpecialistUser.setEmail("specialist-" + UUID.randomUUID() + "@example.com");
        adminSpecialistUser.setFullName("Senior HVAC Specialist Vikram");
        adminSpecialistUser.setPasswordHash("hashed_pw");
        adminSpecialistUser.setRole(com.smartapartment.entity.UserRole.MAINTENANCE_STAFF);
        adminSpecialistUser = userRepository.save(adminSpecialistUser);

        MaintenancePartner specialist = new MaintenancePartner();
        specialist.setHubId(hub.getId());
        specialist.setName("Senior HVAC Specialist Vikram");
        specialist.setPhone("9876543099");
        specialist.setTrade("HVAC");
        specialist.setOnDuty(true);
        specialist.setWorkState("IDLE");
        specialist.setAvailability("AVAILABLE");
        specialist.setUserId(adminSpecialistUser.getId());
        specialist.setLatitude(12.9310);
        specialist.setLongitude(77.5840);
        specialist = partnerRepository.save(specialist);

        // Admin triggers POST /api/maintenance/dispatch/admin/assign
        String adminAssignPayload = String.format("""
            {
                "bookingId": %d,
                "partnerId": %d
            }
            """, bookingId, specialist.getId());

        mvc.perform(post("/api/maintenance/dispatch/admin/assign")
                        .session(adminSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(adminAssignPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", containsString("assigned")));

        // 10. Verify manual resolution:
        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("ASSIGNED", booking.getJobStatus(), "Booking must now be ASSIGNED");
        assertEquals(specialist.getId(), booking.getPartnerId(), "Partner must be the manually assigned specialist");
        assertEquals("Manual", booking.getAssignmentType(), "Assignment type must be Manual");
        assertNotNull(booking.getAssignedBy(), "Assigned by must be recorded");
        assertNotNull(booking.getAcceptedAt(), "acceptedAt must be recorded on manual assignment");
        assertNotNull(booking.getArrivalDueAt(), "arrivalDueAt SLA must be set");

        // Specialist is now marked BUSY
        specialist = partnerRepository.findById(specialist.getId()).orElseThrow();
        assertEquals("BUSY", specialist.getWorkState(), "Specialist must now be marked BUSY");

        // Verify audit trail documents manual assignment
        assertTrue(booking.getAssignmentAuditLog().contains("MANUALLY_ASSIGNED"));
        assertTrue(booking.getAssignmentAuditLog().contains(specialist.getName()));
    }

    @Test
    @DisplayName("6. Wrong Trade Protection: Verify mismatched trades are never auto-selected and rejected on manual assignment")
    void wrongTradeProtection_ExcludesMismatchedTradesAcrossAllCategories() throws Exception {
        MockHttpSession adminSession = loginAsMaintenanceStaff();

        // 1. Setup Dedicated Hub
        String city = "Bangalore";
        String area = "Trade Protection Zone";
        double hubLat = 12.9500;
        double hubLon = 77.6000;

        MaintenanceHub hub = new MaintenanceHub();
        hub.setName("Trade Protection Verification Hub");
        hub.setCity(city);
        hub.setArea(area);
        hub.setLatitude(hubLat);
        hub.setLongitude(hubLon);
        hub.setRadiusKm(15.0);
        hub.setActive(true);
        hub = hubRepository.save(hub);

        // 2. Setup 4 On-Duty Technicians with different trades
        AppUser uP = new AppUser();
        uP.setEmail("plumber-" + UUID.randomUUID() + "@example.com");
        uP.setFullName("Plumber Paul");
        uP.setPasswordHash("hashed_pw");
        uP.setRole(com.smartapartment.entity.UserRole.MAINTENANCE_STAFF);
        uP = userRepository.save(uP);

        MaintenancePartner partnerPlumber = new MaintenancePartner();
        partnerPlumber.setHubId(hub.getId());
        partnerPlumber.setName("Plumber Paul");
        partnerPlumber.setPhone("9876543101");
        partnerPlumber.setTrade("Plumbing");
        partnerPlumber.setSkillCategories("Plumbing");
        partnerPlumber.setOnDuty(true);
        partnerPlumber.setWorkState("IDLE");
        partnerPlumber.setAvailability("AVAILABLE");
        partnerPlumber.setUserId(uP.getId());
        partnerPlumber.setLatitude(hubLat + 0.005);
        partnerPlumber.setLongitude(hubLon + 0.005);
        partnerPlumber.setLocationUpdatedAt(LocalDateTime.now());
        partnerPlumber = partnerRepository.save(partnerPlumber);

        AppUser uE = new AppUser();
        uE.setEmail("electrician-" + UUID.randomUUID() + "@example.com");
        uE.setFullName("Electrician Eric");
        uE.setPasswordHash("hashed_pw");
        uE.setRole(com.smartapartment.entity.UserRole.MAINTENANCE_STAFF);
        uE = userRepository.save(uE);

        MaintenancePartner partnerElectrician = new MaintenancePartner();
        partnerElectrician.setHubId(hub.getId());
        partnerElectrician.setName("Electrician Eric");
        partnerElectrician.setPhone("9876543102");
        partnerElectrician.setTrade("Electrical");
        partnerElectrician.setSkillCategories("Electrical");
        partnerElectrician.setOnDuty(true);
        partnerElectrician.setWorkState("IDLE");
        partnerElectrician.setAvailability("AVAILABLE");
        partnerElectrician.setUserId(uE.getId());
        // Placed even closer than the plumber
        partnerElectrician.setLatitude(hubLat + 0.001);
        partnerElectrician.setLongitude(hubLon + 0.001);
        partnerElectrician.setLocationUpdatedAt(LocalDateTime.now());
        partnerElectrician = partnerRepository.save(partnerElectrician);

        AppUser uC = new AppUser();
        uC.setEmail("carpenter-" + UUID.randomUUID() + "@example.com");
        uC.setFullName("Carpenter Carl");
        uC.setPasswordHash("hashed_pw");
        uC.setRole(com.smartapartment.entity.UserRole.MAINTENANCE_STAFF);
        uC = userRepository.save(uC);

        MaintenancePartner partnerCarpenter = new MaintenancePartner();
        partnerCarpenter.setHubId(hub.getId());
        partnerCarpenter.setName("Carpenter Carl");
        partnerCarpenter.setPhone("9876543103");
        partnerCarpenter.setTrade("Carpentry");
        partnerCarpenter.setSkillCategories("Carpentry");
        partnerCarpenter.setOnDuty(true);
        partnerCarpenter.setWorkState("IDLE");
        partnerCarpenter.setAvailability("AVAILABLE");
        partnerCarpenter.setUserId(uC.getId());
        partnerCarpenter.setLatitude(hubLat + 0.002);
        partnerCarpenter.setLongitude(hubLon + 0.002);
        partnerCarpenter.setLocationUpdatedAt(LocalDateTime.now());
        partnerCarpenter = partnerRepository.save(partnerCarpenter);

        MockHttpSession customerSession = registerCustomer("Customer TradeTest", "9876543555");

        // --- CASE A: Plumbing Emergency ---
        // Even though Electrician and Carpenter are physically closer (0.001 and 0.002 vs 0.005),
        // ONLY the Plumbing partner can be selected.
        EmergencyMaintenanceBooking plumbingBooking = new EmergencyMaintenanceBooking();
        plumbingBooking.setCategory("Plumbing");
        plumbingBooking.setDescription("Kitchen pipe cracked");
        plumbingBooking.setCity(city);
        plumbingBooking.setArea(area);
        plumbingBooking.setLatitude(hubLat);
        plumbingBooking.setLongitude(hubLon);
        plumbingBooking.setJobStatus("UNASSIGNED");
        plumbingBooking.setSourcePlatform("propertydirect");
        plumbingBooking = bookingRepository.save(plumbingBooking);

        emergencyService.dispatch(plumbingBooking);
        plumbingBooking = bookingRepository.findById(plumbingBooking.getId()).orElseThrow();

        assertEquals(partnerPlumber.getId(), plumbingBooking.getPartnerId(),
                "Plumbing emergency must strictly select Plumber Paul");
        assertNotEquals(partnerElectrician.getId(), plumbingBooking.getPartnerId(),
                "Electrician must NEVER be selected for Plumbing emergency");
        assertNotEquals(partnerCarpenter.getId(), plumbingBooking.getPartnerId(),
                "Carpenter must NEVER be selected for Plumbing emergency");

        // Reset plumber for subsequent cases
        partnerPlumber = partnerRepository.findById(partnerPlumber.getId()).orElseThrow();
        partnerPlumber.setWorkState("IDLE");
        partnerPlumber.setAvailability("AVAILABLE");
        partnerRepository.save(partnerPlumber);

        // --- CASE B: Electrical Emergency ---
        // ONLY Electrician can be selected.
        EmergencyMaintenanceBooking electricalBooking = new EmergencyMaintenanceBooking();
        electricalBooking.setCategory("Electrical");
        electricalBooking.setDescription("Circuit breaker tripping repeatedly");
        electricalBooking.setCity(city);
        electricalBooking.setArea(area);
        electricalBooking.setLatitude(hubLat);
        electricalBooking.setLongitude(hubLon);
        electricalBooking.setJobStatus("UNASSIGNED");
        electricalBooking.setSourcePlatform("propertydirect");
        electricalBooking = bookingRepository.save(electricalBooking);

        emergencyService.dispatch(electricalBooking);
        electricalBooking = bookingRepository.findById(electricalBooking.getId()).orElseThrow();

        assertEquals(partnerElectrician.getId(), electricalBooking.getPartnerId(),
                "Electrical emergency must strictly select Electrician Eric");
        assertNotEquals(partnerPlumber.getId(), electricalBooking.getPartnerId(),
                "Plumber must NEVER be selected for Electrical emergency");
        assertNotEquals(partnerCarpenter.getId(), electricalBooking.getPartnerId(),
                "Carpenter must NEVER be selected for Electrical emergency");

        // Reset electrician
        partnerElectrician = partnerRepository.findById(partnerElectrician.getId()).orElseThrow();
        partnerElectrician.setWorkState("IDLE");
        partnerElectrician.setAvailability("AVAILABLE");
        partnerRepository.save(partnerElectrician);

        // --- CASE C: Carpentry Emergency ---
        // ONLY Carpenter can be selected.
        EmergencyMaintenanceBooking carpentryBooking = new EmergencyMaintenanceBooking();
        carpentryBooking.setCategory("Carpentry");
        carpentryBooking.setDescription("Balcony sliding door frame shattered");
        carpentryBooking.setCity(city);
        carpentryBooking.setArea(area);
        carpentryBooking.setLatitude(hubLat);
        carpentryBooking.setLongitude(hubLon);
        carpentryBooking.setJobStatus("UNASSIGNED");
        carpentryBooking.setSourcePlatform("propertydirect");
        carpentryBooking = bookingRepository.save(carpentryBooking);

        emergencyService.dispatch(carpentryBooking);
        carpentryBooking = bookingRepository.findById(carpentryBooking.getId()).orElseThrow();

        assertEquals(partnerCarpenter.getId(), carpentryBooking.getPartnerId(),
                "Carpentry emergency must strictly select Carpenter Carl");
        assertNotEquals(partnerPlumber.getId(), carpentryBooking.getPartnerId(),
                "Plumber must NEVER be selected for Carpentry emergency");
        assertNotEquals(partnerElectrician.getId(), carpentryBooking.getPartnerId(),
                "Electrician must NEVER be selected for Carpentry emergency");

        // --- CASE D: Hub with Zero Matching Trade (Plumbing Request when only Electrician & Carpenter exist) ---
        // Setup hub with only Electrician and Carpenter
        MaintenanceHub noPlumberHub = new MaintenanceHub();
        noPlumberHub.setName("Hub Without Plumbers");
        noPlumberHub.setCity("Chennai");
        noPlumberHub.setArea("T Nagar Zone");
        noPlumberHub.setLatitude(13.0418);
        noPlumberHub.setLongitude(80.2341);
        noPlumberHub.setRadiusKm(10.0);
        noPlumberHub.setActive(true);
        noPlumberHub = hubRepository.save(noPlumberHub);

        partnerElectrician = partnerRepository.findById(partnerElectrician.getId()).orElseThrow();
        partnerElectrician.setHubId(noPlumberHub.getId());
        partnerRepository.save(partnerElectrician);
        partnerCarpenter = partnerRepository.findById(partnerCarpenter.getId()).orElseThrow();
        partnerCarpenter.setWorkState("IDLE");
        partnerCarpenter.setAvailability("AVAILABLE");
        partnerCarpenter.setHubId(noPlumberHub.getId());
        partnerRepository.save(partnerCarpenter);

        EmergencyMaintenanceBooking chennaiPlumbing = new EmergencyMaintenanceBooking();
        chennaiPlumbing.setCategory("Plumbing");
        chennaiPlumbing.setDescription("Major water pipeline leak");
        chennaiPlumbing.setCity("Chennai");
        chennaiPlumbing.setArea("T Nagar Zone");
        chennaiPlumbing.setLatitude(13.0418);
        chennaiPlumbing.setLongitude(80.2341);
        chennaiPlumbing.setJobStatus("UNASSIGNED");
        chennaiPlumbing.setSourcePlatform("propertydirect");
        chennaiPlumbing = bookingRepository.save(chennaiPlumbing);

        emergencyService.dispatch(chennaiPlumbing);
        chennaiPlumbing = bookingRepository.findById(chennaiPlumbing.getId()).orElseThrow();

        // Must move to FAILED_ASSIGNMENT and NEVER select electrician or carpenter
        assertEquals("FAILED_ASSIGNMENT", chennaiPlumbing.getJobStatus());
        assertNull(chennaiPlumbing.getPartnerId(), "Partner ID must be null when no matching trade exists");
        assertEquals("No partner with matching trade", chennaiPlumbing.getDispatchReason());

        // --- CASE E: Admin Manual Assign Guard Rejects Mismatched Trade ---
        // Admin attempting to assign Electrician to a Plumbing request throws HTTP 409
        String invalidAssignJson = String.format("""
            {
                "bookingId": %d,
                "partnerId": %d
            }
            """, chennaiPlumbing.getId(), partnerElectrician.getId());

        mvc.perform(post("/api/maintenance/dispatch/admin/assign")
                        .session(adminSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidAssignJson))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("7. Manual Assignment: Unassigned emergency -> Admin opens failed queue -> Manually assigns -> Full lifecycle continuation")
    void manualAssignment_FullLifecycleContinuation() throws Exception {
        MockHttpSession adminSession = loginAsMaintenanceStaff();

        // 1. Setup Hub
        String city = "Bangalore";
        String area = "Hebbal Manual Hub";
        double hubLat = 13.0358;
        double hubLon = 77.5970;

        MaintenanceHub hub = new MaintenanceHub();
        hub.setName("Hebbal Emergency Hub - Manual Test");
        hub.setCity(city);
        hub.setArea(area);
        hub.setLatitude(hubLat);
        hub.setLongitude(hubLon);
        hub.setRadiusKm(15.0);
        hub.setActive(true);
        hub = hubRepository.save(hub);

        // 2. Setup Partner (Qualified Electrician initially BUSY so auto-dispatch cannot select him)
        AppUser workerUser = new AppUser();
        workerUser.setEmail("manual-electrician-" + UUID.randomUUID() + "@example.com");
        workerUser.setFullName("Daniel Electrician");
        workerUser.setPasswordHash("hashed_pw");
        workerUser.setRole(com.smartapartment.entity.UserRole.MAINTENANCE_STAFF);
        workerUser = userRepository.save(workerUser);

        MaintenancePartner partner = new MaintenancePartner();
        partner.setHubId(hub.getId());
        partner.setName("Daniel Electrician");
        partner.setPhone("9876543199");
        partner.setTrade("Electrical");
        partner.setSkillCategories("Electrical");
        partner.setOnDuty(true);
        partner.setWorkState("BUSY"); // Busy on another job initially
        partner.setAvailability("BUSY");
        partner.setUserId(workerUser.getId());
        partner.setLatitude(hubLat + 0.002);
        partner.setLongitude(hubLon + 0.002);
        partner.setLocationUpdatedAt(LocalDateTime.now());
        partner = partnerRepository.save(partner);

        EmergencyMaintenanceService.Actor partnerActor = new EmergencyMaintenanceService.Actor(
                workerUser.getId(), "smartsociety", "smartsociety", partner.getName(), false, true);

        // 3. Customer creates emergency Electrical request
        MockHttpSession customerSession = registerCustomer("Customer Leela", "9876543666");
        String bookingPayload = String.format("""
            {
                "category": "Electrical",
                "description": "Short circuit causing continuous smoke from basement riser",
                "city": "%s",
                "area": "%s",
                "serviceAddress": "Tower F, Flat 102, Hebbal Ring Rd",
                "latitude": %.4f,
                "longitude": %.4f,
                "requesterPhone": "9876543666"
            }
            """, city, area, hubLat, hubLon);

        MvcResult createRes = mvc.perform(post("/api/maintenance/dispatch/bookings?platform=propertydirect")
                        .session(customerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bookingPayload))
                .andExpect(status().isOk())
                .andReturn();

        long bookingId = objectMapper.readTree(createRes.getResponse().getContentAsString()).get("id").asLong();

        // 4. Auto-dispatch fails because Daniel is BUSY
        EmergencyMaintenanceBooking booking = bookingRepository.findById(bookingId).orElseThrow();
        emergencyService.dispatch(booking);

        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("FAILED_ASSIGNMENT", booking.getJobStatus(), "Booking must be in FAILED_ASSIGNMENT state");
        assertNull(booking.getPartnerId(), "Partner ID must be null");

        // 5. Admin opens Failed Assignment queue
        mvc.perform(get("/api/maintenance/dispatch/admin/failed").session(adminSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == " + bookingId + ")].id").value(hasItem((int) bookingId)))
                .andExpect(jsonPath("$[?(@.id == " + bookingId + ")].jobStatus").value(hasItem("FAILED_ASSIGNMENT")));

        // 6. Daniel finishes his other job and is now available
        partner = partnerRepository.findById(partner.getId()).orElseThrow();
        partner.setWorkState("IDLE");
        partner.setAvailability("AVAILABLE");
        partner = partnerRepository.save(partner);

        // 7. Admin manually assigns Daniel Electrician
        String assignPayload = String.format("""
            {
                "bookingId": %d,
                "partnerId": %d
            }
            """, bookingId, partner.getId());

        mvc.perform(post("/api/maintenance/dispatch/admin/assign")
                        .session(adminSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(assignPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", containsString("assigned")));

        // 8. Verify: Partner receives assignment & Assignment Type shows Manual & Audit information is retained
        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals(partner.getId(), booking.getPartnerId(), "Partner Daniel must receive the assignment");
        assertEquals("ASSIGNED", booking.getJobStatus(), "Job status must be ASSIGNED");
        assertEquals("Manual", booking.getAssignmentType(), "Assignment Type must show 'Manual'");
        assertNotNull(booking.getAssignedBy(), "Assigned admin info must be retained");
        assertNotNull(booking.getAssignedAt(), "AssignedAt timestamp must be retained");
        assertNotNull(booking.getAcceptedAt(), "AcceptedAt timestamp must be recorded");
        assertNotNull(booking.getArrivalDueAt(), "arrivalDueAt must be set (30 min SLA)");
        assertTrue(booking.getAssignmentAuditLog().contains("MANUALLY_ASSIGNED"),
                "Audit log must retain MANUALLY_ASSIGNED action");
        assertTrue(booking.getAssignmentAuditLog().contains(partner.getName()),
                "Audit log must retain assigned partner name");

        partner = partnerRepository.findById(partner.getId()).orElseThrow();
        assertEquals("BUSY", partner.getWorkState(), "Partner workState must be BUSY");

        // 9. Booking continues normal lifecycle: Reached Location
        emergencyService.transition(partnerActor, bookingId, "REACHED", hubLat, hubLon, null);
        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("REACHED_LOCATION", booking.getJobStatus());
        assertNotNull(booking.getReachedAt());

        // 10. Partner uploads Before Photo
        emergencyService.photo(partnerActor, bookingId, "before", DUMMY_PHOTO);
        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("PHOTO_START", booking.getJobStatus());
        assertNotNull(booking.getPhotoStartAt());
        assertNotNull(booking.getBeforePhotoUrl());

        // 11. Partner starts work
        emergencyService.transition(partnerActor, bookingId, "START", null, null, null);
        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("IN_PROGRESS", booking.getJobStatus());
        assertNotNull(booking.getStartedAt());

        // 12. Partner uploads After Photo
        emergencyService.photo(partnerActor, bookingId, "after", DUMMY_PHOTO);
        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertNotNull(booking.getPhotoEndAt());
        assertNotNull(booking.getAfterPhotoUrl());

        // 13. Partner completes work
        String completionNotes = "Burned 32A fuse cartridge replaced and busbar terminals cleaned.";
        emergencyService.transition(partnerActor, bookingId, "COMPLETE", null, null, completionNotes);
        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("COMPLETED", booking.getJobStatus());
        assertNotNull(booking.getCompletedAt());
        assertEquals(completionNotes, booking.getCompletionNotes());

        // 14. Partner becomes available
        partner = partnerRepository.findById(partner.getId()).orElseThrow();
        assertEquals("IDLE", partner.getWorkState(), "Partner must be released to IDLE upon completion");

        // 15. Review trigger is created/sent
        assertNotNull(booking.getCustomerReviewUrl(), "Review trigger URL must be created");
        assertEquals("PREPARED", booking.getReviewNotificationStatus());

        // 16. Admin sees audit history recording manual assignment and timeline of lifecycle completion
        EmergencyMaintenanceService.Actor adminActor = new EmergencyMaintenanceService.Actor(
                0L, "smartapartment", "smartapartment", "Admin", true, false);
        List<Map<String, Object>> auditHistory = emergencyService.history(adminActor, bookingId);
        assertNotNull(auditHistory);
        List<String> auditActions = auditHistory.stream().map(h -> String.valueOf(h.get("action"))).toList();
        assertTrue(auditActions.contains("MANUALLY_ASSIGNED"), "Audit history must contain MANUALLY_ASSIGNED action");

        List<Map<String, Object>> timeline = emergencyService.timeline(adminActor, bookingId);
        assertNotNull(timeline);
        List<String> stages = timeline.stream().map(t -> String.valueOf(t.get("stage"))).toList();
        assertTrue(stages.contains("ACCEPTED"), "Timeline must contain ACCEPTED stage");
        assertTrue(stages.contains("REACHED_LOCATION"), "Timeline must contain REACHED_LOCATION stage");
        assertTrue(stages.contains("BEFORE_PHOTO"), "Timeline must contain BEFORE_PHOTO stage");
        assertTrue(stages.contains("IN_PROGRESS"), "Timeline must contain IN_PROGRESS stage");
        assertTrue(stages.contains("AFTER_PHOTO"), "Timeline must contain AFTER_PHOTO stage");
        assertTrue(stages.contains("COMPLETED"), "Timeline must contain COMPLETED stage");
    }

    @Test
    @DisplayName("8. Double-Accept Protection: Simultaneous / duplicate acceptance attempts fail cleanly, only one partner owns booking, no duplicate jobs")
    void doubleAcceptProtection_CleanFailureAndZeroDuplicates() throws Exception {
        MockHttpSession adminSession = loginAsMaintenanceStaff();

        // 1. Setup Hub
        String city = "DoubleCity-" + UUID.randomUUID();
        String area = "DoubleArea-" + UUID.randomUUID();
        double hubLat = 13.2000;
        double hubLon = 78.2000;

        MaintenanceHub hub = new MaintenanceHub();
        hub.setName("Double Accept Prevention Hub");
        hub.setCity(city);
        hub.setArea(area);
        hub.setLatitude(hubLat);
        hub.setLongitude(hubLon);
        hub.setRadiusKm(15.0);
        hub.setActive(true);
        hub = hubRepository.save(hub);

        // 2. Setup Partner 1 (Offered technician)
        AppUser u1 = new AppUser();
        u1.setEmail("partner-one-double-" + UUID.randomUUID() + "@example.com");
        u1.setFullName("First Partner");
        u1.setPasswordHash("hashed_pw");
        u1.setRole(com.smartapartment.entity.UserRole.MAINTENANCE_STAFF);
        u1 = userRepository.save(u1);

        MaintenancePartner partner1 = new MaintenancePartner();
        partner1.setHubId(hub.getId());
        partner1.setName("First Partner");
        partner1.setPhone("9876543701");
        partner1.setTrade("Plumbing");
        partner1.setSkillCategories("Plumbing");
        partner1.setOnDuty(true);
        partner1.setWorkState("IDLE");
        partner1.setAvailability("AVAILABLE");
        partner1.setUserId(u1.getId());
        partner1.setLatitude(hubLat + 0.001);
        partner1.setLongitude(hubLon + 0.001);
        partner1.setLocationUpdatedAt(LocalDateTime.now());
        partner1 = partnerRepository.save(partner1);

        EmergencyMaintenanceService.Actor partner1Actor = new EmergencyMaintenanceService.Actor(
                u1.getId(), "smartsociety", "smartsociety", partner1.getName(), false, true);

        // 3. Setup Partner 2 (Competing technician)
        AppUser u2 = new AppUser();
        u2.setEmail("partner-two-double-" + UUID.randomUUID() + "@example.com");
        u2.setFullName("Second Partner");
        u2.setPasswordHash("hashed_pw");
        u2.setRole(com.smartapartment.entity.UserRole.MAINTENANCE_STAFF);
        u2 = userRepository.save(u2);

        MaintenancePartner partner2 = new MaintenancePartner();
        partner2.setHubId(hub.getId());
        partner2.setName("Second Partner");
        partner2.setPhone("9876543702");
        partner2.setTrade("Plumbing");
        partner2.setSkillCategories("Plumbing");
        partner2.setOnDuty(true);
        partner2.setWorkState("IDLE");
        partner2.setAvailability("AVAILABLE");
        partner2.setUserId(u2.getId());
        partner2.setLatitude(hubLat + 0.002);
        partner2.setLongitude(hubLon + 0.002);
        partner2.setLocationUpdatedAt(LocalDateTime.now());
        partner2 = partnerRepository.save(partner2);

        EmergencyMaintenanceService.Actor partner2Actor = new EmergencyMaintenanceService.Actor(
                u2.getId(), "smartsociety", "smartsociety", partner2.getName(), false, true);

        // 4. Create Emergency Request
        MockHttpSession customerSession = registerCustomer("Customer DoubleAccept", "9876543777");
        String bookingPayload = String.format("""
            {
                "category": "Plumbing",
                "description": "Geyser pressure relief valve spraying scalding water",
                "city": "%s",
                "area": "%s",
                "serviceAddress": "Block G, Apartment 301",
                "latitude": %.4f,
                "longitude": %.4f,
                "requesterPhone": "9876543777"
            }
            """, city, area, hubLat, hubLon);

        MvcResult createRes = mvc.perform(post("/api/maintenance/dispatch/bookings?platform=propertydirect")
                        .session(customerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bookingPayload))
                .andExpect(status().isOk())
                .andReturn();

        long bookingId = objectMapper.readTree(createRes.getResponse().getContentAsString()).get("id").asLong();

        // 5. Auto-dispatch: Partner 1 is offered
        EmergencyMaintenanceBooking booking = bookingRepository.findById(bookingId).orElseThrow();
        emergencyService.dispatch(booking);

        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("OFFERED", booking.getJobStatus());
        assertEquals(partner1.getId(), booking.getPartnerId());

        long initialBookingCount = bookingRepository.count();

        // 6. ATTEMPT A: Partner 2 (competing, unassigned) attempts to accept -> Must fail cleanly with 403
        org.springframework.web.server.ResponseStatusException ex2 = assertThrows(
                org.springframework.web.server.ResponseStatusException.class,
                () -> emergencyService.transition(partner2Actor, bookingId, "ACCEPT", null, null, null),
                "Unassigned Partner 2 acceptance attempt must fail"
        );
        assertEquals(403, ex2.getStatusCode().value(), "Must reject unassigned technician with HTTP 403");

        // 7. ATTEMPT B: Partner 1 accepts successfully
        emergencyService.transition(partner1Actor, bookingId, "ACCEPT", null, null, null);
        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("ACCEPTED", booking.getJobStatus());
        assertEquals(partner1.getId(), booking.getPartnerId());
        assertNotNull(booking.getAcceptedAt());

        // 8. ATTEMPT C: Partner 1 attempts to accept AGAIN (duplicate acceptance attempt)
        org.springframework.web.server.ResponseStatusException exDuplicate = assertThrows(
                org.springframework.web.server.ResponseStatusException.class,
                () -> emergencyService.transition(partner1Actor, bookingId, "ACCEPT", null, null, null),
                "Duplicate acceptance attempt by assigned partner must fail"
        );
        assertEquals(409, exDuplicate.getStatusCode().value(), "Must reject duplicate acceptance with HTTP 409 Conflict");
        assertTrue(exDuplicate.getReason().contains("OFFERED") || exDuplicate.getReason().contains("already accepted"),
                "Diagnostic message must indicate state conflict: " + exDuplicate.getReason());

        // 9. ATTEMPT D: Partner 2 attempts to accept after job is already accepted by Partner 1
        org.springframework.web.server.ResponseStatusException exLate = assertThrows(
                org.springframework.web.server.ResponseStatusException.class,
                () -> emergencyService.transition(partner2Actor, bookingId, "ACCEPT", null, null, null),
                "Late acceptance attempt by other partner must fail"
        );
        assertTrue(exLate.getStatusCode().value() == 403 || exLate.getStatusCode().value() == 409);

        // 10. Verify Zero Duplicates and Single Ownership
        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals(partner1.getId(), booking.getPartnerId(), "Only Partner 1 must own the booking");
        assertEquals("ACCEPTED", booking.getJobStatus(), "Job status must be ACCEPTED");

        // Total booking records in database must not have grown
        long finalBookingCount = bookingRepository.count();
        assertEquals(initialBookingCount, finalBookingCount, "No duplicate booking entity may be created in database");

        // Exactly one booking exists with this ID
        List<EmergencyMaintenanceBooking> matchingBookings = bookingRepository.findAll().stream()
                .filter(b -> b.getId().equals(bookingId))
                .toList();
        assertEquals(1, matchingBookings.size(), "Strictly exactly one booking entity must exist");
    }

    @Test
    @DisplayName("9. Lifecycle Protection: Invalid transitions rejected cleanly (Accepted->In Progress, Reached->Completed, Missing Photos, Completed->In Progress)")
    void lifecycleProtection_RejectsAllInvalidTransitionsCleanly() throws Exception {
        // 1. Setup Hub and Partner
        String city = "LifecycleCity-" + UUID.randomUUID();
        String area = "LifecycleArea-" + UUID.randomUUID();
        double hubLat = 13.6000;
        double hubLon = 78.6000;

        MaintenanceHub hub = new MaintenanceHub();
        hub.setName("Koramangala Lifecycle Guard Hub");
        hub.setCity(city);
        hub.setArea(area);
        hub.setLatitude(hubLat);
        hub.setLongitude(hubLon);
        hub.setRadiusKm(10.0);
        hub.setActive(true);
        hub = hubRepository.save(hub);

        AppUser u = new AppUser();
        u.setEmail("lifecycle-technician-" + UUID.randomUUID() + "@example.com");
        u.setFullName("Lifecycle Technician");
        u.setPasswordHash("pass");
        u.setPhone("9988776655");
        u.setRole(com.smartapartment.entity.UserRole.MAINTENANCE_STAFF);
        u = userRepository.save(u);

        MaintenancePartner partner = new MaintenancePartner();
        partner.setUserId(u.getId());
        partner.setName(u.getFullName());
        partner.setPhone(u.getPhone());
        partner.setTrade("Plumbing");
        partner.setSkillCategories("Plumbing");
        partner.setAvailability("AVAILABLE");
        partner.setWorkState("IDLE");
        partner.setOnDuty(true);
        partner.setHubId(hub.getId());
        partner.setLatitude(hubLat);
        partner.setLongitude(hubLon);
        partner.setLocationUpdatedAt(LocalDateTime.now());
        partner = partnerRepository.save(partner);

        EmergencyMaintenanceService.Actor partnerActor = new EmergencyMaintenanceService.Actor(
                u.getId(), "smartsociety", "smartsociety", partner.getName(), false, true);

        // 2. Create Emergency Booking
        MockHttpSession customerSession = registerCustomer("Customer Lifecycle", "9988771122");
        String bookingPayload = String.format("""
            {
                "category": "Plumbing",
                "description": "Burst main pipe overflowing into kitchen",
                "city": "%s",
                "area": "%s",
                "serviceAddress": "Tower C, Apartment 404",
                "latitude": %.4f,
                "longitude": %.4f,
                "requesterPhone": "9988771122"
            }
            """, city, area, hubLat, hubLon);

        MvcResult createRes = mvc.perform(post("/api/maintenance/dispatch/bookings?platform=propertydirect")
                        .session(customerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bookingPayload))
                .andExpect(status().isOk())
                .andReturn();

        long bookingId = objectMapper.readTree(createRes.getResponse().getContentAsString()).get("id").asLong();

        // Dispatch to Partner -> OFFERED
        EmergencyMaintenanceBooking booking = bookingRepository.findById(bookingId).orElseThrow();
        emergencyService.dispatch(booking);

        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("OFFERED", booking.getJobStatus());

        // Partner Accepts -> ACCEPTED
        emergencyService.transition(partnerActor, bookingId, "ACCEPT", null, null, null);
        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("ACCEPTED", booking.getJobStatus());

        // -------------------------------------------------------------
        // GUARD 1: Accepted -> In Progress without Reached / Before Photo
        // -------------------------------------------------------------
        org.springframework.web.server.ResponseStatusException ex1 = assertThrows(
                org.springframework.web.server.ResponseStatusException.class,
                () -> emergencyService.transition(partnerActor, bookingId, "START", null, null, null),
                "Should reject transition to IN_PROGRESS when status is ACCEPTED"
        );
        assertEquals(409, ex1.getStatusCode().value(), "Must return HTTP 409 Conflict");
        assertTrue(ex1.getReason().contains("PHOTO_START") && ex1.getReason().contains("ACCEPTED"),
                "Diagnostic message must explain invalid transition: " + ex1.getReason());

        // Verify status remains ACCEPTED
        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("ACCEPTED", booking.getJobStatus(), "Status must remain untouched at ACCEPTED");

        // -------------------------------------------------------------
        // GUARD 2: Reached Location -> Completed directly (skipping start & photos)
        // -------------------------------------------------------------
        emergencyService.transition(partnerActor, bookingId, "REACHED_LOCATION", hubLat, hubLon, null);
        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("REACHED_LOCATION", booking.getJobStatus());

        org.springframework.web.server.ResponseStatusException ex2 = assertThrows(
                org.springframework.web.server.ResponseStatusException.class,
                () -> emergencyService.transition(partnerActor, bookingId, "COMPLETED", null, null, "Done fast"),
                "Should reject transition to COMPLETED directly from REACHED_LOCATION"
        );
        assertEquals(409, ex2.getStatusCode().value(), "Must return HTTP 409 Conflict");
        assertTrue(ex2.getReason().contains("IN_PROGRESS") && ex2.getReason().contains("REACHED_LOCATION"),
                "Diagnostic message must require IN_PROGRESS: " + ex2.getReason());

        // Verify status remains REACHED_LOCATION
        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("REACHED_LOCATION", booking.getJobStatus(), "Status must remain untouched at REACHED_LOCATION");

        // -------------------------------------------------------------
        // GUARD 3: Before Photo Missing -> Start Work
        // -------------------------------------------------------------
        org.springframework.web.server.ResponseStatusException ex3 = assertThrows(
                org.springframework.web.server.ResponseStatusException.class,
                () -> emergencyService.transition(partnerActor, bookingId, "START", null, null, null),
                "Should reject transition to START when before photo is not uploaded"
        );
        assertEquals(409, ex3.getStatusCode().value(), "Must return HTTP 409 Conflict");
        assertTrue(ex3.getReason().contains("PHOTO_START"),
                "Diagnostic message must require PHOTO_START state before starting: " + ex3.getReason());

        // Attempting to upload AFTER photo while still in REACHED_LOCATION must also fail
        byte[] dummyPhoto = new byte[]{1, 2, 3, 4, 5};
        org.springframework.web.server.ResponseStatusException exAfterEarly = assertThrows(
                org.springframework.web.server.ResponseStatusException.class,
                () -> emergencyService.photo(partnerActor, bookingId, "after", dummyPhoto),
                "Should reject uploading AFTER photo before job is IN_PROGRESS"
        );
        assertEquals(409, exAfterEarly.getStatusCode().value());

        // Now upload legitimate BEFORE photo -> Transitions to PHOTO_START
        emergencyService.photo(partnerActor, bookingId, "before", dummyPhoto);
        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("PHOTO_START", booking.getJobStatus());

        // Now Start Work succeeds -> Transitions to IN_PROGRESS
        emergencyService.transition(partnerActor, bookingId, "START", null, null, null);
        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("IN_PROGRESS", booking.getJobStatus());
        assertNotNull(booking.getStartedAt());

        // -------------------------------------------------------------
        // GUARD 4: In Progress -> Completed without After Photo
        // -------------------------------------------------------------
        org.springframework.web.server.ResponseStatusException exNoAfterPhoto = assertThrows(
                org.springframework.web.server.ResponseStatusException.class,
                () -> emergencyService.transition(partnerActor, bookingId, "COMPLETED", null, null, "Trying without after photo"),
                "Should reject completion when after photo is missing"
        );
        assertEquals(409, exNoAfterPhoto.getStatusCode().value());
        assertTrue(exNoAfterPhoto.getReason().contains("after photo"),
                "Diagnostic message must require after photo: " + exNoAfterPhoto.getReason());

        // Upload legitimate AFTER photo
        emergencyService.photo(partnerActor, bookingId, "after", dummyPhoto);
        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertNotNull(booking.getAfterPhoto());

        // Now completion succeeds
        emergencyService.transition(partnerActor, bookingId, "COMPLETED", null, null, "Completed successfully with all evidence");
        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("COMPLETED", booking.getJobStatus());
        assertNotNull(booking.getCompletedAt());

        // Partner must be released to IDLE
        partner = partnerRepository.findById(partner.getId()).orElseThrow();
        assertEquals("IDLE", partner.getWorkState(), "Partner must be released to IDLE upon completion");

        // -------------------------------------------------------------
        // GUARD 5: Completed -> In Progress (or any other invalid backwards transition)
        // -------------------------------------------------------------
        // Attempt A: Completed -> START / IN_PROGRESS
        org.springframework.web.server.ResponseStatusException exBackToStart = assertThrows(
                org.springframework.web.server.ResponseStatusException.class,
                () -> emergencyService.transition(partnerActor, bookingId, "START", null, null, null),
                "Should reject transitioning completed job back to START"
        );
        assertEquals(409, exBackToStart.getStatusCode().value(), "Must reject with HTTP 409 Conflict");
        assertTrue(exBackToStart.getReason().contains("completed or cancelled") && exBackToStart.getReason().contains("COMPLETED"),
                "Diagnostic message: " + exBackToStart.getReason());

        // Attempt B: Completed -> REACHED_LOCATION
        org.springframework.web.server.ResponseStatusException exBackToReached = assertThrows(
                org.springframework.web.server.ResponseStatusException.class,
                () -> emergencyService.transition(partnerActor, bookingId, "REACHED_LOCATION", hubLat, hubLon, null),
                "Should reject transitioning completed job back to REACHED_LOCATION"
        );
        assertEquals(409, exBackToReached.getStatusCode().value(), "Must reject with HTTP 409 Conflict");

        // Attempt C: Completed -> COMPLETED again (duplicate completion)
        org.springframework.web.server.ResponseStatusException exDuplicateComplete = assertThrows(
                org.springframework.web.server.ResponseStatusException.class,
                () -> emergencyService.transition(partnerActor, bookingId, "COMPLETED", null, null, "Again"),
                "Should reject completing an already completed job"
        );
        assertEquals(409, exDuplicateComplete.getStatusCode().value(), "Must reject with HTTP 409 Conflict");

        // Attempt D: Uploading photo to completed booking
        org.springframework.web.server.ResponseStatusException exPhotoOnCompleted = assertThrows(
                org.springframework.web.server.ResponseStatusException.class,
                () -> emergencyService.photo(partnerActor, bookingId, "after", dummyPhoto),
                "Should reject uploading photo to completed job"
        );
        assertEquals(409, exPhotoOnCompleted.getStatusCode().value(), "Must reject with HTTP 409 Conflict");
        assertTrue(exPhotoOnCompleted.getReason().contains("completed or cancelled"),
                "Diagnostic message: " + exPhotoOnCompleted.getReason());

        // Final sanity check: Status remains strictly COMPLETED, partner remains IDLE
        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("COMPLETED", booking.getJobStatus(), "Status must remain strictly COMPLETED despite invalid transition attempts");

        partner = partnerRepository.findById(partner.getId()).orElseThrow();
        assertEquals("IDLE", partner.getWorkState(), "Partner work state must remain IDLE");
    }

    @Test
    @DisplayName("10. Photo Validation: Valid Before/After photos, invalid type, oversized, empty upload, missing photo guards, admin viewer, failed uploads don't advance state")
    void photoValidation_FullOperationalGuardsAndAdminViewer() throws Exception {
        // 1. Generate Valid Test PNG Images
        BufferedImage testImg1 = new BufferedImage(32, 32, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream baos1 = new ByteArrayOutputStream();
        ImageIO.write(testImg1, "png", baos1);
        byte[] validBeforePng = baos1.toByteArray();

        BufferedImage testImg2 = new BufferedImage(32, 32, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream baos2 = new ByteArrayOutputStream();
        ImageIO.write(testImg2, "png", baos2);
        byte[] validAfterPng = baos2.toByteArray();

        // 2. Setup Isolated Hub
        String city = "PhotoCity-" + UUID.randomUUID();
        String area = "PhotoArea-" + UUID.randomUUID();
        double hubLat = 14.1000;
        double hubLon = 79.1000;

        MaintenanceHub hub = new MaintenanceHub();
        hub.setName("Photo Validation Hub");
        hub.setCity(city);
        hub.setArea(area);
        hub.setLatitude(hubLat);
        hub.setLongitude(hubLon);
        hub.setRadiusKm(15.0);
        hub.setActive(true);
        hub = hubRepository.save(hub);

        // 3. Setup Technician Partner
        AppUser workerUser = new AppUser();
        workerUser.setEmail("photo-tech-" + UUID.randomUUID() + "@example.com");
        workerUser.setFullName("Photo Technician");
        workerUser.setPasswordHash("hashed_pw");
        workerUser.setRole(com.smartapartment.entity.UserRole.MAINTENANCE_STAFF);
        workerUser = userRepository.save(workerUser);

        MaintenancePartner partner = new MaintenancePartner();
        partner.setHubId(hub.getId());
        partner.setName(workerUser.getFullName());
        partner.setPhone("9876543999");
        partner.setTrade("Plumbing");
        partner.setSkillCategories("Plumbing");
        partner.setOnDuty(true);
        partner.setWorkState("IDLE");
        partner.setAvailability("AVAILABLE");
        partner.setUserId(workerUser.getId());
        partner.setLatitude(hubLat);
        partner.setLongitude(hubLon);
        partner.setLocationUpdatedAt(LocalDateTime.now());
        partner = partnerRepository.save(partner);

        EmergencyMaintenanceService.Actor partnerActor = new EmergencyMaintenanceService.Actor(
                workerUser.getId(), "smartsociety", "smartsociety", partner.getName(), false, true);

        // Setup Partner HTTP Session authenticated with worker credentials
        MockHttpSession partnerSession = new MockHttpSession();
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(
                workerUser.getEmail(), null, List.of(new SimpleGrantedAuthority("ROLE_MAINTENANCE_STAFF"))));
        partnerSession.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);

        MockHttpSession adminSession = loginAsMaintenanceStaff();

        // 4. Create Emergency Request
        MockHttpSession customerSession = registerCustomer("Customer PhotoTest", "9876543888");
        String bookingPayload = String.format("""
            {
                "category": "Plumbing",
                "description": "Severe wastewater backup flooding ground unit",
                "city": "%s",
                "area": "%s",
                "serviceAddress": "Block 9, Apartment 101",
                "latitude": %.4f,
                "longitude": %.4f,
                "requesterPhone": "9876543888"
            }
            """, city, area, hubLat, hubLon);

        MvcResult createRes = mvc.perform(post("/api/maintenance/dispatch/bookings?platform=propertydirect")
                        .session(customerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bookingPayload))
                .andExpect(status().isOk())
                .andReturn();

        long bookingId = objectMapper.readTree(createRes.getResponse().getContentAsString()).get("id").asLong();

        // Dispatch -> OFFERED to Partner
        EmergencyMaintenanceBooking booking = bookingRepository.findById(bookingId).orElseThrow();
        emergencyService.dispatch(booking);

        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("OFFERED", booking.getJobStatus());

        // 5. Admin Viewer check before any photos are uploaded -> Must return 404 NOT_FOUND
        mvc.perform(get("/api/maintenance/dispatch/bookings/" + bookingId + "/photos/before").session(adminSession))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/maintenance/dispatch/bookings/" + bookingId + "/photos/after").session(adminSession))
                .andExpect(status().isNotFound());

        // 6. Partner Accepts -> ACCEPTED
        emergencyService.transition(partnerActor, bookingId, "ACCEPT", null, null, null);
        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("ACCEPTED", booking.getJobStatus());

        // 7. Premature Upload Guard: Partner attempts Before Photo upload while in ACCEPTED (before reaching site)
        MockMultipartFile earlyPhoto = new MockMultipartFile("photo", "early.png", "image/png", validBeforePng);
        mvc.perform(multipart("/api/maintenance/dispatch/bookings/" + bookingId + "/photos/before")
                        .file(earlyPhoto)
                        .session(partnerSession))
                .andExpect(status().isConflict());

        // Verify status remains ACCEPTED, no photo saved
        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("ACCEPTED", booking.getJobStatus());
        assertNull(booking.getBeforePhoto());

        // 8. Partner arrives at site -> REACHED_LOCATION
        emergencyService.transition(partnerActor, bookingId, "REACHED_LOCATION", hubLat, hubLon, null);
        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("REACHED_LOCATION", booking.getJobStatus());

        // 9. Invalid File Type Guard: Upload plain text file
        MockMultipartFile textFile = new MockMultipartFile("photo", "document.txt", "text/plain", "This is plain text, not an image".getBytes());
        mvc.perform(multipart("/api/maintenance/dispatch/bookings/" + bookingId + "/photos/before")
                        .file(textFile)
                        .session(partnerSession))
                .andExpect(status().isBadRequest());

        // Verify status NOT advanced, photo NOT saved
        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("REACHED_LOCATION", booking.getJobStatus(), "Status must not advance on invalid file type");
        assertNull(booking.getBeforePhoto(), "Before photo must remain null");

        // 10. Oversized Image Guard: Upload 6 MB image (> 5 MB limit)
        MockMultipartFile oversizedFile = new MockMultipartFile("photo", "oversized.png", "image/png", new byte[6 * 1024 * 1024]);
        mvc.perform(multipart("/api/maintenance/dispatch/bookings/" + bookingId + "/photos/before")
                        .file(oversizedFile)
                        .session(partnerSession))
                .andExpect(status().isBadRequest());

        // Verify status NOT advanced, photo NOT saved
        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("REACHED_LOCATION", booking.getJobStatus(), "Status must not advance on oversized image");
        assertNull(booking.getBeforePhoto());

        // 11. Empty Upload / Interrupted Stream: 0-byte file
        MockMultipartFile emptyFile = new MockMultipartFile("photo", "empty.png", "image/png", new byte[0]);
        mvc.perform(multipart("/api/maintenance/dispatch/bookings/" + bookingId + "/photos/before")
                        .file(emptyFile)
                        .session(partnerSession))
                .andExpect(status().isBadRequest());

        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("REACHED_LOCATION", booking.getJobStatus(), "Status must not advance on empty upload");
        assertNull(booking.getBeforePhoto());

        // 12. Missing Before Photo Guard: Attempt to START work before uploading Before Photo
        assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> emergencyService.transition(partnerActor, bookingId, "START", null, null, null),
                "Starting work without before photo must fail"
        );
        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("REACHED_LOCATION", booking.getJobStatus());

        // 13. Valid Before Photo Upload -> Transitions to PHOTO_START
        MockMultipartFile validBefore = new MockMultipartFile("photo", "before.png", "image/png", validBeforePng);
        mvc.perform(multipart("/api/maintenance/dispatch/bookings/" + bookingId + "/photos/before")
                        .file(validBefore)
                        .session(partnerSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.jobStatus").value("PHOTO_START"))
                .andExpect(jsonPath("$.photoUrl", containsString("/photos/before")));

        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("PHOTO_START", booking.getJobStatus(), "Job status must transition to PHOTO_START");
        assertNotNull(booking.getBeforePhoto(), "Before photo binary must be stored");
        assertTrue(booking.getBeforePhotoUrl().contains("/photos/before"), "Before photo URL must be set");
        assertNotNull(booking.getPhotoStartAt(), "photoStartAt timestamp must be recorded");

        // 14. Admin Image Viewer for Before Photo: Serves PNG with Cache-Control no-store
        mvc.perform(get("/api/maintenance/dispatch/bookings/" + bookingId + "/photos/before").session(adminSession))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG))
                .andExpect(header().string("Cache-Control", containsString("no-store")));

        // 15. Partner Starts Work -> IN_PROGRESS
        emergencyService.transition(partnerActor, bookingId, "START", null, null, null);
        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("IN_PROGRESS", booking.getJobStatus());
        assertNotNull(booking.getStartedAt());

        // 16. Missing After Photo Guard: Attempt to COMPLETE work before uploading After Photo
        org.springframework.web.server.ResponseStatusException exNoAfter = assertThrows(
                org.springframework.web.server.ResponseStatusException.class,
                () -> emergencyService.transition(partnerActor, bookingId, "COMPLETED", null, null, "Trying without after photo")
        );
        assertEquals(409, exNoAfter.getStatusCode().value());
        assertTrue(exNoAfter.getReason().contains("after photo"), "Must indicate after photo missing: " + exNoAfter.getReason());

        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("IN_PROGRESS", booking.getJobStatus(), "Status must remain IN_PROGRESS");

        // 17. Invalid File Type for After Photo
        MockMultipartFile textAfterFile = new MockMultipartFile("photo", "note.txt", "text/plain", "work complete".getBytes());
        mvc.perform(multipart("/api/maintenance/dispatch/bookings/" + bookingId + "/photos/after")
                        .file(textAfterFile)
                        .session(partnerSession))
                .andExpect(status().isBadRequest());

        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("IN_PROGRESS", booking.getJobStatus());
        assertNull(booking.getAfterPhoto());

        // 18. Valid After Photo Upload -> Saves photo, status remains IN_PROGRESS until completion
        MockMultipartFile validAfter = new MockMultipartFile("photo", "after.png", "image/png", validAfterPng);
        mvc.perform(multipart("/api/maintenance/dispatch/bookings/" + bookingId + "/photos/after")
                        .file(validAfter)
                        .session(partnerSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.photoUrl", containsString("/photos/after")));

        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertNotNull(booking.getAfterPhoto(), "After photo binary must be stored");
        assertTrue(booking.getAfterPhotoUrl().contains("/photos/after"), "After photo URL must be set");
        assertEquals("IN_PROGRESS", booking.getJobStatus(), "Status remains IN_PROGRESS until completion action");

        // 19. Admin Image Viewer for After Photo: Serves PNG with Cache-Control no-store
        mvc.perform(get("/api/maintenance/dispatch/bookings/" + bookingId + "/photos/after").session(adminSession))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG))
                .andExpect(header().string("Cache-Control", containsString("no-store")));

        // 20. Partner Completes Work
        emergencyService.transition(partnerActor, bookingId, "COMPLETED", null, null, "Wastewater pipe cleared and sealed");
        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("COMPLETED", booking.getJobStatus());

        // Partner released to IDLE
        partner = partnerRepository.findById(partner.getId()).orElseThrow();
        assertEquals("IDLE", partner.getWorkState());

        // 21. Post-Completion Guard: Photo upload on completed booking must be rejected cleanly
        mvc.perform(multipart("/api/maintenance/dispatch/bookings/" + bookingId + "/photos/after")
                        .file(validAfter)
                        .session(partnerSession))
                .andExpect(status().isConflict());

        booking = bookingRepository.findById(bookingId).orElseThrow();
        assertEquals("COMPLETED", booking.getJobStatus());
    }

    @Test
    @DisplayName("11. Hub Routing Cases: Exact coordinates, known locality, city fallback, no valid hub, and inactive hub exclusion")
    void hubRoutingCases_MultiHubPrecisionAndExclusionGuards() throws Exception {
        String city = "MetroX-" + UUID.randomUUID();
        String northArea = "North Sector";
        String southArea = "South Sector";

        // 1. Setup Hub North
        double northLat = 15.1000;
        double northLon = 80.1000;
        MaintenanceHub hubNorth = new MaintenanceHub();
        hubNorth.setName("MetroX North Emergency Hub");
        hubNorth.setCity(city);
        hubNorth.setArea(northArea);
        hubNorth.setLatitude(northLat);
        hubNorth.setLongitude(northLon);
        hubNorth.setRadiusKm(10.0);
        hubNorth.setActive(true);
        hubNorth = hubRepository.save(hubNorth);

        // 2. Setup Hub South (about 30 km away, well separated)
        double southLat = 15.3500;
        double southLon = 80.3500;
        MaintenanceHub hubSouth = new MaintenanceHub();
        hubSouth.setName("MetroX South Emergency Hub");
        hubSouth.setCity(city);
        hubSouth.setArea(southArea);
        hubSouth.setLatitude(southLat);
        hubSouth.setLongitude(southLon);
        hubSouth.setRadiusKm(10.0);
        hubSouth.setActive(true);
        hubSouth = hubRepository.save(hubSouth);

        // -------------------------------------------------------------
        // CASE A: Exact customer coordinates routing
        // -------------------------------------------------------------
        // Coordinates close to North Hub (0.3 km away)
        MaintenanceHub resolvedNearNorth = emergencyService.resolveHub(
                city, "Random Text Locality", northLat + 0.002, northLon + 0.002);
        assertNotNull(resolvedNearNorth, "Must resolve a hub for near-North coordinates");
        assertEquals(hubNorth.getId(), resolvedNearNorth.getId(),
                "Coordinates near North Hub must route to Hub North, ignoring non-matching area name");

        // Coordinates close to South Hub (0.4 km away)
        MaintenanceHub resolvedNearSouth = emergencyService.resolveHub(
                city, "Random Text Locality", southLat - 0.003, southLon - 0.003);
        assertNotNull(resolvedNearSouth, "Must resolve a hub for near-South coordinates");
        assertEquals(hubSouth.getId(), resolvedNearSouth.getId(),
                "Coordinates near South Hub must route to Hub South, ignoring non-matching area name");

        // -------------------------------------------------------------
        // CASE B: Known locality (area name matching when GPS is unavailable)
        // -------------------------------------------------------------
        MaintenanceHub resolvedByAreaNorth = emergencyService.resolveHub(city, northArea, null, null);
        assertNotNull(resolvedByAreaNorth);
        assertEquals(hubNorth.getId(), resolvedByAreaNorth.getId(),
                "Area 'North Sector' without GPS must route to Hub North");

        MaintenanceHub resolvedByAreaSouth = emergencyService.resolveHub(city, southArea, null, null);
        assertNotNull(resolvedByAreaSouth);
        assertEquals(hubSouth.getId(), resolvedByAreaSouth.getId(),
                "Area 'South Sector' without GPS must route to Hub South");

        // Case-insensitive locality matching
        MaintenanceHub resolvedCaseInsensitive = emergencyService.resolveHub(city, "north sector", null, null);
        assertNotNull(resolvedCaseInsensitive);
        assertEquals(hubNorth.getId(), resolvedCaseInsensitive.getId(),
                "Locality matching must be case-insensitive");

        // -------------------------------------------------------------
        // CASE C: City-only fallback (unknown locality without GPS)
        // -------------------------------------------------------------
        MaintenanceHub resolvedCityFallback = emergencyService.resolveHub(city, "Unmapped Neighborhood", null, null);
        assertNotNull(resolvedCityFallback, "Must fall back to city hub when area is unknown");
        assertTrue(resolvedCityFallback.getId().equals(hubNorth.getId()) || resolvedCityFallback.getId().equals(hubSouth.getId()),
                "City fallback must resolve to one of the city's active hubs");
        assertEquals(city, resolvedCityFallback.getCity());

        // -------------------------------------------------------------
        // CASE D: No valid hub (unserved city / out-of-coverage coordinates)
        // -------------------------------------------------------------
        String unservedCity = "UnservedWilderness-" + UUID.randomUUID();
        MaintenanceHub resolvedNoHub = emergencyService.resolveHub(unservedCity, "Nowhere", null, null);
        assertNull(resolvedNoHub, "Must return null when city has no hubs registered");

        // Out-of-coverage coordinates (e.g. 500 km away in the ocean)
        MaintenanceHub resolvedOutOfRange = emergencyService.resolveHub(
                city, "Unknown", 0.0, 0.0);
        // Note: when coordinates are outside coverage radius, resolveHub checks city fallback if city is provided,
        // but for an unserved city with arbitrary coordinates, it returns null:
        MaintenanceHub resolvedUnservedCoord = emergencyService.resolveHub(
                unservedCity, "Unknown", 0.0, 0.0);
        assertNull(resolvedUnservedCoord, "Unserved city with distant coordinates must resolve to null");

        // End-to-end booking creation in unserved territory -> moves to unassigned / failed queue
        MockHttpSession customerSession = registerCustomer("Customer Unserved", "9876543111");
        String unservedBookingPayload = String.format("""
            {
                "category": "Plumbing",
                "description": "Pipe leaking in unserved outpost",
                "city": "%s",
                "area": "Outpost Remote",
                "serviceAddress": "Cabin 1, Wilderness Road",
                "latitude": 0.0,
                "longitude": 0.0,
                "requesterPhone": "9876543111"
            }
            """, unservedCity);

        MvcResult createRes = mvc.perform(post("/api/maintenance/dispatch/bookings?platform=propertydirect")
                        .session(customerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(unservedBookingPayload))
                .andExpect(status().isOk())
                .andReturn();

        long unservedBookingId = objectMapper.readTree(createRes.getResponse().getContentAsString()).get("id").asLong();
        EmergencyMaintenanceBooking unservedBooking = bookingRepository.findById(unservedBookingId).orElseThrow();
        assertNull(unservedBooking.getHubId(), "Hub ID must be null for unserved area");
        assertEquals("UNASSIGNED", unservedBooking.getJobStatus());

        // Dispatch must cleanly move to FAILED_ASSIGNMENT
        emergencyService.dispatch(unservedBooking);
        unservedBooking = bookingRepository.findById(unservedBookingId).orElseThrow();
        assertEquals("FAILED_ASSIGNMENT", unservedBooking.getJobStatus(), "Must transition to FAILED_ASSIGNMENT");
        assertNull(unservedBooking.getPartnerId(), "No partner may be assigned");
        assertTrue(unservedBooking.getDispatchReason().contains("No partners within service area"),
                "Reason must indicate unserved territory: " + unservedBooking.getDispatchReason());

        // -------------------------------------------------------------
        // CASE E: Inactive Hub exclusion
        // -------------------------------------------------------------
        String ghostCity = "GhostTown-" + UUID.randomUUID();
        MaintenanceHub inactiveHub = new MaintenanceHub();
        inactiveHub.setName("Decommissioned Ghost Hub");
        inactiveHub.setCity(ghostCity);
        inactiveHub.setArea("Ghost Zone");
        inactiveHub.setLatitude(20.0000);
        inactiveHub.setLongitude(85.0000);
        inactiveHub.setRadiusKm(15.0);
        inactiveHub.setActive(false);
        inactiveHub.setStatus("INACTIVE");
        inactiveHub = hubRepository.save(inactiveHub);

        // Verification 1: Coverage list must not contain the inactive hub
        List<MaintenanceHub> activeCoverage = emergencyService.coverage();
        final Long ghostHubId = inactiveHub.getId();
        boolean containsInactive = activeCoverage.stream().anyMatch(h -> h.getId().equals(ghostHubId));
        assertFalse(containsInactive, "Coverage list must strictly exclude inactive hubs");

        // Verification 2: resolveHub must return null for city with only an inactive hub
        MaintenanceHub resolvedGhost = emergencyService.resolveHub(ghostCity, "Ghost Zone", 20.001, 85.001);
        assertNull(resolvedGhost, "Must never resolve an inactive hub even if coordinates are identical");

        // Verification 3: Booking in inactive hub territory must not attach to the inactive hub
        String ghostBookingPayload = String.format("""
            {
                "category": "Plumbing",
                "description": "Emergency in inactive hub zone",
                "city": "%s",
                "area": "Ghost Zone",
                "serviceAddress": "Abandoned Building 4",
                "latitude": 20.001,
                "longitude": 85.001,
                "requesterPhone": "9876543222"
            }
            """, ghostCity);

        MvcResult ghostCreateRes = mvc.perform(post("/api/maintenance/dispatch/bookings?platform=propertydirect")
                        .session(customerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(ghostBookingPayload))
                .andExpect(status().isOk())
                .andReturn();

        long ghostBookingId = objectMapper.readTree(ghostCreateRes.getResponse().getContentAsString()).get("id").asLong();
        EmergencyMaintenanceBooking ghostBooking = bookingRepository.findById(ghostBookingId).orElseThrow();
        assertNull(ghostBooking.getHubId(), "Booking must NOT be linked to inactive hub");

        // Auto-dispatch on inactive hub booking
        emergencyService.dispatch(ghostBooking);
        ghostBooking = bookingRepository.findById(ghostBookingId).orElseThrow();
        assertEquals("FAILED_ASSIGNMENT", ghostBooking.getJobStatus(), "Must fail safely rather than dispatching to inactive hub");
        assertNull(ghostBooking.getHubId(), "Hub must remain unlinked");
        assertNull(ghostBooking.getPartnerId(), "No partner may be assigned from inactive hub");
    }

    @Test
    @DisplayName("12. Partner Status Synchronization: Idle -> Offered -> Decline releases to Idle -> Timeout releases to Idle -> Manual Assignment sets Busy -> Active during job -> Releases to Idle on complete")
    void partnerStatusSynchronization_FullStateLifecycleAndFailover() throws Exception {
        String city = "SyncCity-" + UUID.randomUUID();
        String area = "SyncArea-" + UUID.randomUUID();
        double hubLat = 16.1000;
        double hubLon = 81.1000;

        // 1. Setup Hub
        MaintenanceHub hub = new MaintenanceHub();
        hub.setName("Partner Sync Hub");
        hub.setCity(city);
        hub.setArea(area);
        hub.setLatitude(hubLat);
        hub.setLongitude(hubLon);
        hub.setRadiusKm(15.0);
        hub.setActive(true);
        hub = hubRepository.save(hub);

        // 2. Setup Partner in IDLE state before assignment
        AppUser u = new AppUser();
        u.setEmail("sync-partner-" + UUID.randomUUID() + "@example.com");
        u.setFullName("Sync Partner");
        u.setPasswordHash("pass");
        u.setPhone("9876543666");
        u.setRole(com.smartapartment.entity.UserRole.MAINTENANCE_STAFF);
        u = userRepository.save(u);

        MaintenancePartner partner = new MaintenancePartner();
        partner.setUserId(u.getId());
        partner.setName(u.getFullName());
        partner.setPhone(u.getPhone());
        partner.setTrade("Plumbing");
        partner.setSkillCategories("Plumbing");
        partner.setOnDuty(true);
        partner.setAvailability("AVAILABLE");
        partner.setWorkState("IDLE");
        partner.setHubId(hub.getId());
        partner.setLatitude(hubLat);
        partner.setLongitude(hubLon);
        partner.setLocationUpdatedAt(LocalDateTime.now());
        partner = partnerRepository.save(partner);

        EmergencyMaintenanceService.Actor partnerActor = new EmergencyMaintenanceService.Actor(
                u.getId(), "smartsociety", "smartsociety", partner.getName(), false, true);
        EmergencyMaintenanceService.Actor adminActor = new EmergencyMaintenanceService.Actor(
                0L, "smartsociety", "system", "Admin", true, false);

        // VERIFY 1: Idle before assignment
        partner = partnerRepository.findById(partner.getId()).orElseThrow();
        assertEquals("IDLE", partner.getWorkState(), "Partner must be IDLE before assignment");
        assertEquals("AVAILABLE", partner.getAvailability(), "Partner must be AVAILABLE before assignment");

        MockHttpSession customerSession = registerCustomer("Customer Sync", "9876543555");

        // -------------------------------------------------------------
        // VERIFY 2: Decline does not incorrectly leave partner Busy
        // -------------------------------------------------------------
        String b1Payload = String.format("""
            {
                "category": "Plumbing",
                "description": "Leak test 1",
                "city": "%s",
                "area": "%s",
                "serviceAddress": "Tower 1, Flat 101",
                "latitude": %.4f,
                "longitude": %.4f,
                "requesterPhone": "9876543555"
            }
            """, city, area, hubLat, hubLon);

        MvcResult res1 = mvc.perform(post("/api/maintenance/dispatch/bookings?platform=propertydirect")
                        .session(customerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(b1Payload))
                .andExpect(status().isOk())
                .andReturn();

        long b1Id = objectMapper.readTree(res1.getResponse().getContentAsString()).get("id").asLong();
        EmergencyMaintenanceBooking b1 = bookingRepository.findById(b1Id).orElseThrow();
        emergencyService.dispatch(b1);

        // While offered, partner is marked BUSY
        partner = partnerRepository.findById(partner.getId()).orElseThrow();
        assertEquals("BUSY", partner.getWorkState(), "Partner must be BUSY during active offer");

        // Partner declines -> must cleanly release back to IDLE
        emergencyService.transition(partnerActor, b1Id, "DECLINE", null, null, null);
        partner = partnerRepository.findById(partner.getId()).orElseThrow();
        assertEquals("IDLE", partner.getWorkState(), "Decline must not leave partner Busy; must be released to IDLE");
        assertEquals("IDLE", partner.getAvailability(), "Availability must be released to IDLE");

        // -------------------------------------------------------------
        // VERIFY 3: Timeout does not incorrectly leave partner Busy
        // -------------------------------------------------------------
        // Reset availability to AVAILABLE so partner can receive next booking
        partner.setAvailability("AVAILABLE");
        partnerRepository.save(partner);

        String b2Payload = String.format("""
            {
                "category": "Plumbing",
                "description": "Leak test 2 for timeout",
                "city": "%s",
                "area": "%s",
                "serviceAddress": "Tower 1, Flat 102",
                "latitude": %.4f,
                "longitude": %.4f,
                "requesterPhone": "9876543555"
            }
            """, city, area, hubLat, hubLon);

        MvcResult res2 = mvc.perform(post("/api/maintenance/dispatch/bookings?platform=propertydirect")
                        .session(customerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(b2Payload))
                .andExpect(status().isOk())
                .andReturn();

        long b2Id = objectMapper.readTree(res2.getResponse().getContentAsString()).get("id").asLong();
        EmergencyMaintenanceBooking b2 = bookingRepository.findById(b2Id).orElseThrow();
        emergencyService.dispatch(b2);

        // Partner offered -> marked BUSY
        partner = partnerRepository.findById(partner.getId()).orElseThrow();
        assertEquals("BUSY", partner.getWorkState(), "Partner must be marked BUSY on offer");

        // Artificially age offer by 3 minutes to simulate timeout
        b2 = bookingRepository.findById(b2Id).orElseThrow();
        b2.setOfferedAt(LocalDateTime.now().minusMinutes(3));
        bookingRepository.save(b2);

        // Trigger timeout retry
        emergencyService.retryPending();

        // Reload partner -> must be released to IDLE
        partner = partnerRepository.findById(partner.getId()).orElseThrow();
        assertEquals("IDLE", partner.getWorkState(), "Timeout must not leave partner Busy; must be released to IDLE");
        assertEquals("IDLE", partner.getAvailability(), "Availability must be released to IDLE");

        // -------------------------------------------------------------
        // VERIFY 4: Manual assignment updates correctly to BUSY
        // -------------------------------------------------------------
        partner.setAvailability("AVAILABLE");
        partnerRepository.save(partner);

        // Create booking in unassigned/failed state
        String b3Payload = String.format("""
            {
                "category": "Plumbing",
                "description": "Leak test 3 for manual assignment",
                "city": "%s",
                "area": "%s",
                "serviceAddress": "Tower 1, Flat 103",
                "latitude": %.4f,
                "longitude": %.4f,
                "requesterPhone": "9876543555"
            }
            """, city, area, hubLat, hubLon);

        MvcResult res3 = mvc.perform(post("/api/maintenance/dispatch/bookings?platform=propertydirect")
                        .session(customerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(b3Payload))
                .andExpect(status().isOk())
                .andReturn();

        long b3Id = objectMapper.readTree(res3.getResponse().getContentAsString()).get("id").asLong();
        EmergencyMaintenanceBooking b3 = bookingRepository.findById(b3Id).orElseThrow();
        // Dispatch to failed queue
        emergencyService.moveToFailedQueue(b3, "Simulated unassigned for manual test");

        // Admin manually assigns Partner
        emergencyService.adminAssignPartner(adminActor, b3Id, partner.getId());

        // Partner must now be updated to BUSY
        partner = partnerRepository.findById(partner.getId()).orElseThrow();
        assertEquals("BUSY", partner.getWorkState(), "Manual assignment must update partner workState to BUSY");
        assertEquals("BUSY", partner.getAvailability(), "Manual assignment must update partner availability to BUSY");

        b3 = bookingRepository.findById(b3Id).orElseThrow();
        assertEquals("ASSIGNED", b3.getJobStatus());
        assertEquals("Manual", b3.getAssignmentType());

        // -------------------------------------------------------------
        // VERIFY 5: Active status maintained while job progresses
        // -------------------------------------------------------------
        // Reached location
        emergencyService.transition(partnerActor, b3Id, "REACHED_LOCATION", hubLat, hubLon, null);
        partner = partnerRepository.findById(partner.getId()).orElseThrow();
        assertEquals("BUSY", partner.getWorkState(), "Partner must remain BUSY at REACHED_LOCATION");

        // Upload Before Photo
        byte[] dummyPhoto = new byte[]{1, 2, 3, 4};
        emergencyService.photo(partnerActor, b3Id, "before", dummyPhoto);
        partner = partnerRepository.findById(partner.getId()).orElseThrow();
        assertEquals("BUSY", partner.getWorkState(), "Partner must remain BUSY after Before Photo upload");

        // Start work
        emergencyService.transition(partnerActor, b3Id, "START", null, null, null);
        partner = partnerRepository.findById(partner.getId()).orElseThrow();
        assertEquals("BUSY", partner.getWorkState(), "Partner must remain BUSY while IN_PROGRESS");

        // Upload After Photo
        emergencyService.photo(partnerActor, b3Id, "after", dummyPhoto);
        partner = partnerRepository.findById(partner.getId()).orElseThrow();
        assertEquals("BUSY", partner.getWorkState(), "Partner must remain BUSY after After Photo upload");

        // -------------------------------------------------------------
        // VERIFY 6: Back to Idle/Available after completion
        // -------------------------------------------------------------
        emergencyService.transition(partnerActor, b3Id, "COMPLETED", null, null, "All done");

        partner = partnerRepository.findById(partner.getId()).orElseThrow();
        assertEquals("IDLE", partner.getWorkState(), "Partner must be released to IDLE after completion");
        assertEquals("IDLE", partner.getAvailability(), "Partner availability must return to IDLE after completion");

        b3 = bookingRepository.findById(b3Id).orElseThrow();
        assertEquals("COMPLETED", b3.getJobStatus());
    }

    @Test
    @DisplayName("13. SLA Validation: Normal SLA, Approaching Breach, Breached SLA, Completed before SLA, and Admin Dashboard Continuity")
    void slaValidation_FullStagesAndDashboardContinuity() throws Exception {
        String city = "SlaCity-" + UUID.randomUUID();
        String area = "SlaArea-" + UUID.randomUUID();
        double hubLat = 17.1000;
        double hubLon = 82.1000;

        // Setup Hub
        MaintenanceHub hub = new MaintenanceHub();
        hub.setName("SLA Validation Hub");
        hub.setCity(city);
        hub.setArea(area);
        hub.setLatitude(hubLat);
        hub.setLongitude(hubLon);
        hub.setRadiusKm(15.0);
        hub.setActive(true);
        hub = hubRepository.save(hub);

        // Setup Partner
        AppUser u = new AppUser();
        u.setEmail("sla-tech-" + UUID.randomUUID() + "@example.com");
        u.setFullName("SLA Technician");
        u.setPasswordHash("pass");
        u.setPhone("9876543444");
        u.setRole(com.smartapartment.entity.UserRole.MAINTENANCE_STAFF);
        u = userRepository.save(u);

        MaintenancePartner partner = new MaintenancePartner();
        partner.setUserId(u.getId());
        partner.setName(u.getFullName());
        partner.setPhone(u.getPhone());
        partner.setTrade("Plumbing");
        partner.setSkillCategories("Plumbing");
        partner.setOnDuty(true);
        partner.setAvailability("AVAILABLE");
        partner.setWorkState("IDLE");
        partner.setHubId(hub.getId());
        partner.setLatitude(hubLat);
        partner.setLongitude(hubLon);
        partner.setLocationUpdatedAt(LocalDateTime.now());
        partner = partnerRepository.save(partner);

        EmergencyMaintenanceService.Actor partnerActor = new EmergencyMaintenanceService.Actor(
                u.getId(), "smartsociety", "smartsociety", partner.getName(), false, true);

        MockHttpSession adminSession1 = loginAsMaintenanceStaff();
        MockHttpSession customerSession = registerCustomer("Customer SLA", "9876543333");

        // -------------------------------------------------------------
        // SCENARIO 1: Normal SLA (Fresh booking within target deadline)
        // -------------------------------------------------------------
        String payload1 = String.format("""
            {
                "category": "Plumbing",
                "description": "Burst pipe test normal SLA",
                "city": "%s",
                "area": "%s",
                "serviceAddress": "Tower A, Unit 101",
                "latitude": %.4f,
                "longitude": %.4f,
                "requesterPhone": "9876543333"
            }
            """, city, area, hubLat, hubLon);

        MvcResult res1 = mvc.perform(post("/api/maintenance/dispatch/bookings?platform=propertydirect")
                        .session(customerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload1))
                .andExpect(status().isOk())
                .andReturn();

        long b1Id = objectMapper.readTree(res1.getResponse().getContentAsString()).get("id").asLong();

        // Query booking via Admin Dashboard API
        mvc.perform(get("/api/maintenance/dispatch/bookings/" + b1Id).session(adminSession1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slaStage").value("WITHIN_SLA"))
                .andExpect(jsonPath("$.slaStageLabel").value("Within SLA"))
                .andExpect(jsonPath("$.slaBreached").value(false))
                .andExpect(jsonPath("$.slaRisk").value(false))
                .andExpect(jsonPath("$.isSlaRiskOrBreached").value(false))
                .andExpect(jsonPath("$.slaWithinSla").value(true))
                .andExpect(jsonPath("$.slaApproachingBreach").value(false))
                .andExpect(jsonPath("$.slaMinutesRemaining", greaterThan(20)))
                .andExpect(jsonPath("$.slaStatusText", containsString("Within SLA")));

        // -------------------------------------------------------------
        // SCENARIO 2: Approaching Breach (SLA deadline under 10 minutes remaining)
        // -------------------------------------------------------------
        EmergencyMaintenanceBooking b2 = new EmergencyMaintenanceBooking();
        b2.setTenantId("propertydirect");
        b2.setSourcePlatform("propertydirect");
        b2.setRequesterName("Customer Approaching");
        b2.setRequesterPhone("9876543333");
        b2.setCity(city);
        b2.setArea(area);
        b2.setServiceAddress("Tower B, Unit 202");
        b2.setCategory("Plumbing");
        b2.setDescription("Leak approaching deadline");
        b2.setJobStatus("OFFERED");
        b2.setHubId(hub.getId());
        b2.setPartnerId(partner.getId());
        LocalDateTime now = LocalDateTime.now();
        b2.setCreatedAt(now.minusMinutes(22));
        b2.setOfferedAt(now.minusMinutes(1));
        b2.setArrivalDueAt(now.plusMinutes(8)); // Exactly 8 minutes remaining (< 10m threshold)
        b2 = bookingRepository.save(b2);

        mvc.perform(get("/api/maintenance/dispatch/bookings/" + b2.getId()).session(adminSession1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slaStage").value("APPROACHING_BREACH"))
                .andExpect(jsonPath("$.slaStageLabel").value("Approaching SLA Breach"))
                .andExpect(jsonPath("$.slaBreached").value(false))
                .andExpect(jsonPath("$.slaRisk").value(true))
                .andExpect(jsonPath("$.isSlaRiskOrBreached").value(true))
                .andExpect(jsonPath("$.slaApproachingBreach").value(true))
                .andExpect(jsonPath("$.slaWithinSla").value(false))
                .andExpect(jsonPath("$.slaMinutesRemaining", lessThanOrEqualTo(8)))
                .andExpect(jsonPath("$.slaStatusText", containsString("Approaching SLA Breach")));

        // -------------------------------------------------------------
        // SCENARIO 3: Breached SLA (Target arrival deadline passed)
        // -------------------------------------------------------------
        EmergencyMaintenanceBooking b3 = new EmergencyMaintenanceBooking();
        b3.setTenantId("propertydirect");
        b3.setSourcePlatform("propertydirect");
        b3.setRequesterName("Customer Breached");
        b3.setRequesterPhone("9876543333");
        b3.setCity(city);
        b3.setArea(area);
        b3.setServiceAddress("Tower C, Unit 303");
        b3.setCategory("Plumbing");
        b3.setDescription("Severe flood past deadline");
        b3.setJobStatus("ACCEPTED");
        b3.setHubId(hub.getId());
        b3.setPartnerId(partner.getId());
        b3.setCreatedAt(now.minusMinutes(45));
        b3.setArrivalDueAt(now.minusMinutes(15)); // Breached by 15 minutes
        b3 = bookingRepository.save(b3);

        mvc.perform(get("/api/maintenance/dispatch/bookings/" + b3.getId()).session(adminSession1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slaStage").value("SLA_BREACHED"))
                .andExpect(jsonPath("$.slaStageLabel").value("SLA Breached"))
                .andExpect(jsonPath("$.slaBreached").value(true))
                .andExpect(jsonPath("$.slaRisk").value(false))
                .andExpect(jsonPath("$.isSlaRiskOrBreached").value(true))
                .andExpect(jsonPath("$.slaWithinSla").value(false))
                .andExpect(jsonPath("$.slaMinutesRemaining", lessThan(0)))
                .andExpect(jsonPath("$.slaOverdueMinutes", greaterThanOrEqualTo(14)))
                .andExpect(jsonPath("$.slaStatusText", containsString("overdue")));

        // -------------------------------------------------------------
        // SCENARIO 4: Completed Before SLA (Arrived On-Time and Finished)
        // -------------------------------------------------------------
        EmergencyMaintenanceBooking b4 = new EmergencyMaintenanceBooking();
        b4.setTenantId("propertydirect");
        b4.setSourcePlatform("propertydirect");
        b4.setRequesterName("Customer CompletedOnTime");
        b4.setRequesterPhone("9876543333");
        b4.setCity(city);
        b4.setArea(area);
        b4.setServiceAddress("Tower D, Unit 404");
        b4.setCategory("Plumbing");
        b4.setDescription("Pipe sealed on time");
        b4.setJobStatus("COMPLETED");
        b4.setHubId(hub.getId());
        b4.setPartnerId(partner.getId());
        b4.setCreatedAt(now.minusMinutes(25));
        b4.setAcceptedAt(now.minusMinutes(23));
        b4.setArrivalDueAt(now.plusMinutes(5)); // Target deadline was in future relative to arrival
        b4.setReachedAt(now.minusMinutes(12));  // Arrived 17 minutes before due time
        b4.setStartedAt(now.minusMinutes(10));
        b4.setCompletedAt(now.minusMinutes(2));
        b4 = bookingRepository.save(b4);

        mvc.perform(get("/api/maintenance/dispatch/bookings/" + b4.getId()).session(adminSession1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slaStage").value("SLA_MET"))
                .andExpect(jsonPath("$.slaStageLabel", containsString("Within SLA")))
                .andExpect(jsonPath("$.slaBreached").value(false))
                .andExpect(jsonPath("$.slaRisk").value(false))
                .andExpect(jsonPath("$.slaWithinSla").value(true));

        // -------------------------------------------------------------
        // SCENARIO 5: Countdown/Status Continuity Across Refresh / Re-login
        // -------------------------------------------------------------
        // Simulate admin logging out and establishing a brand new session
        MockHttpSession adminSession2 = loginAsMaintenanceStaff();

        // Re-query booking 2 (Approaching breach) and booking 3 (Breached) with new session
        mvc.perform(get("/api/maintenance/dispatch/bookings/" + b2.getId()).session(adminSession2))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(b2.getId()))
                .andExpect(jsonPath("$.slaStage").value("APPROACHING_BREACH"))
                .andExpect(jsonPath("$.slaRisk").value(true));

        mvc.perform(get("/api/maintenance/dispatch/bookings/" + b3.getId()).session(adminSession2))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(b3.getId()))
                .andExpect(jsonPath("$.slaStage").value("SLA_BREACHED"))
                .andExpect(jsonPath("$.slaBreached").value(true));

        // Verify overview list returns all states consistently
        mvc.perform(get("/api/maintenance/dispatch/bookings").session(adminSession2))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(4))));
    }

    @Test
    @DisplayName("14. Realtime Synchronization: Events broadcast and fresh admin data on Creation, Assignment, Decline, Accept, Reached, Photos, In Progress, and Completion with Zero Stale Data")
    void realtimeSynchronization_CustomerPartnerAdminEventStreamAndStaleDataChecks() throws Exception {
        String city = "RealtimeCity-" + UUID.randomUUID();
        String area = "RealtimeArea-" + UUID.randomUUID();
        double hubLat = 18.1000;
        double hubLon = 83.1000;

        // 1. Setup Hub
        MaintenanceHub hub = new MaintenanceHub();
        hub.setName("Realtime Sync Hub");
        hub.setCity(city);
        hub.setArea(area);
        hub.setLatitude(hubLat);
        hub.setLongitude(hubLon);
        hub.setRadiusKm(15.0);
        hub.setActive(true);
        hub = hubRepository.save(hub);

        // 2. Setup Partner 1
        AppUser u1 = new AppUser();
        u1.setEmail("realtime-p1-" + UUID.randomUUID() + "@example.com");
        u1.setFullName("Partner One Realtime");
        u1.setPasswordHash("pass");
        u1.setPhone("9876543001");
        u1.setRole(com.smartapartment.entity.UserRole.MAINTENANCE_STAFF);
        u1 = userRepository.save(u1);

        MaintenancePartner partner1 = new MaintenancePartner();
        partner1.setUserId(u1.getId());
        partner1.setName(u1.getFullName());
        partner1.setPhone(u1.getPhone());
        partner1.setTrade("Plumbing");
        partner1.setSkillCategories("Plumbing");
        partner1.setOnDuty(true);
        partner1.setAvailability("AVAILABLE");
        partner1.setWorkState("IDLE");
        partner1.setHubId(hub.getId());
        partner1.setLatitude(hubLat + 0.001);
        partner1.setLongitude(hubLon + 0.001);
        partner1.setLocationUpdatedAt(LocalDateTime.now());
        partner1 = partnerRepository.save(partner1);

        EmergencyMaintenanceService.Actor p1Actor = new EmergencyMaintenanceService.Actor(
                u1.getId(), "smartsociety", "smartsociety", partner1.getName(), false, true);

        // 3. Setup Partner 2
        AppUser u2 = new AppUser();
        u2.setEmail("realtime-p2-" + UUID.randomUUID() + "@example.com");
        u2.setFullName("Partner Two Realtime");
        u2.setPasswordHash("pass");
        u2.setPhone("9876543002");
        u2.setRole(com.smartapartment.entity.UserRole.MAINTENANCE_STAFF);
        u2 = userRepository.save(u2);

        MaintenancePartner partner2 = new MaintenancePartner();
        partner2.setUserId(u2.getId());
        partner2.setName(u2.getFullName());
        partner2.setPhone(u2.getPhone());
        partner2.setTrade("Plumbing");
        partner2.setSkillCategories("Plumbing");
        partner2.setOnDuty(true);
        partner2.setAvailability("AVAILABLE");
        partner2.setWorkState("IDLE");
        partner2.setHubId(hub.getId());
        partner2.setLatitude(hubLat + 0.002);
        partner2.setLongitude(hubLon + 0.002);
        partner2.setLocationUpdatedAt(LocalDateTime.now());
        partner2 = partnerRepository.save(partner2);

        EmergencyMaintenanceService.Actor p2Actor = new EmergencyMaintenanceService.Actor(
                u2.getId(), "smartsociety", "smartsociety", partner2.getName(), false, true);

        final Long p1Id = partner1.getId();
        final Long p2Id = partner2.getId();

        MockHttpSession adminSession = loginAsMaintenanceStaff();
        MockHttpSession customerSession = registerCustomer("Customer Realtime", "9876543000");

        long startTestTimestamp = System.currentTimeMillis() - 500;

        // -------------------------------------------------------------
        // STEP 1: Booking Creation
        // -------------------------------------------------------------
        String payload = String.format("""
            {
                "category": "Plumbing",
                "description": "Realtime sync test leak",
                "city": "%s",
                "area": "%s",
                "serviceAddress": "Block Z, Apt 99",
                "latitude": %.4f,
                "longitude": %.4f,
                "requesterPhone": "9876543000"
            }
            """, city, area, hubLat, hubLon);

        MvcResult createRes = mvc.perform(post("/api/maintenance/dispatch/bookings?platform=propertydirect")
                        .session(customerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andReturn();

        long bookingId = objectMapper.readTree(createRes.getResponse().getContentAsString()).get("id").asLong();

        // Verify CREATED event in realtime stream
        List<EmergencyMaintenanceService.DispatchEvent> eventsAfterCreate = emergencyService.recentEvents(startTestTimestamp);
        boolean createEventFound = eventsAfterCreate.stream().anyMatch(e -> 
                e.bookingId().equals(bookingId) && "CREATED".equals(e.action()));
        assertTrue(createEventFound, "CREATED event must be broadcast upon booking registration");

        // Verify Admin sees fresh, non-stale state immediately
        mvc.perform(get("/api/maintenance/dispatch/bookings/" + bookingId).session(adminSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(bookingId))
                .andExpect(jsonPath("$.jobStatus").value("UNASSIGNED"));

        // -------------------------------------------------------------
        // STEP 2: Assignment / Offer to Partner 1
        // -------------------------------------------------------------
        EmergencyMaintenanceBooking b = bookingRepository.findById(bookingId).orElseThrow();
        emergencyService.dispatch(b);

        List<EmergencyMaintenanceService.DispatchEvent> eventsAfterOffer = emergencyService.recentEvents(startTestTimestamp);
        boolean offerEventFound = eventsAfterOffer.stream().anyMatch(e -> 
                e.bookingId().equals(bookingId) && "OFFERED".equals(e.action()) && p1Id.equals(e.partnerId()));
        assertTrue(offerEventFound, "OFFERED event for Partner 1 must be broadcast");

        // Verify Admin query immediately shows fresh OFFERED status
        mvc.perform(get("/api/maintenance/dispatch/bookings/" + bookingId).session(adminSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.jobStatus").value("OFFERED"))
                .andExpect(jsonPath("$.partnerId").value(p1Id));

        // -------------------------------------------------------------
        // STEP 3: Decline by Partner 1 & Re-dispatch to Partner 2
        // -------------------------------------------------------------
        emergencyService.transition(p1Actor, bookingId, "DECLINE", null, null, null);

        List<EmergencyMaintenanceService.DispatchEvent> eventsAfterDecline = emergencyService.recentEvents(startTestTimestamp);
        boolean declineEventFound = eventsAfterDecline.stream().anyMatch(e -> 
                e.bookingId().equals(bookingId) && "DECLINE".equals(e.action()));
        assertTrue(declineEventFound, "DECLINE event must be broadcast");

        boolean secondOfferFound = eventsAfterDecline.stream().anyMatch(e -> 
                e.bookingId().equals(bookingId) && "OFFERED".equals(e.action()) && p2Id.equals(e.partnerId()));
        assertTrue(secondOfferFound, "Subsequent OFFERED event for Partner 2 must be broadcast");

        // Verify Admin query immediately shows reassignment to Partner 2
        mvc.perform(get("/api/maintenance/dispatch/bookings/" + bookingId).session(adminSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.jobStatus").value("OFFERED"))
                .andExpect(jsonPath("$.partnerId").value(p2Id));

        // -------------------------------------------------------------
        // STEP 4: Accept by Partner 2
        // -------------------------------------------------------------
        emergencyService.transition(p2Actor, bookingId, "ACCEPT", null, null, null);

        List<EmergencyMaintenanceService.DispatchEvent> eventsAfterAccept = emergencyService.recentEvents(startTestTimestamp);
        boolean acceptEventFound = eventsAfterAccept.stream().anyMatch(e -> 
                e.bookingId().equals(bookingId) && "ACCEPT".equals(e.action()) && "ACCEPTED".equals(e.status()));
        assertTrue(acceptEventFound, "ACCEPT event must be broadcast");

        // Verify Admin query immediately reflects ACCEPTED
        mvc.perform(get("/api/maintenance/dispatch/bookings/" + bookingId).session(adminSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.jobStatus").value("ACCEPTED"))
                .andExpect(jsonPath("$.contactUnlocked").value(true));

        // -------------------------------------------------------------
        // STEP 5: Reached Location
        // -------------------------------------------------------------
        emergencyService.transition(p2Actor, bookingId, "REACHED_LOCATION", hubLat, hubLon, null);

        List<EmergencyMaintenanceService.DispatchEvent> eventsAfterReached = emergencyService.recentEvents(startTestTimestamp);
        boolean reachedEventFound = eventsAfterReached.stream().anyMatch(e -> 
                e.bookingId().equals(bookingId) && "REACHED_LOCATION".equals(e.action()) && "REACHED_LOCATION".equals(e.status()));
        assertTrue(reachedEventFound, "REACHED_LOCATION event must be broadcast");

        mvc.perform(get("/api/maintenance/dispatch/bookings/" + bookingId).session(adminSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.jobStatus").value("REACHED_LOCATION"));

        // -------------------------------------------------------------
        // STEP 6: Before Photo Upload
        // -------------------------------------------------------------
        byte[] dummyPhoto = new byte[]{1, 2, 3, 4, 5};
        emergencyService.photo(p2Actor, bookingId, "before", dummyPhoto);

        List<EmergencyMaintenanceService.DispatchEvent> eventsAfterBeforePhoto = emergencyService.recentEvents(startTestTimestamp);
        boolean beforePhotoEventFound = eventsAfterBeforePhoto.stream().anyMatch(e -> 
                e.bookingId().equals(bookingId) && "PHOTO_START".equals(e.action()) && "PHOTO_START".equals(e.status()));
        assertTrue(beforePhotoEventFound, "PHOTO_START event must be broadcast on Before Photo upload");

        mvc.perform(get("/api/maintenance/dispatch/bookings/" + bookingId).session(adminSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.jobStatus").value("PHOTO_START"))
                .andExpect(jsonPath("$.hasBeforePhoto").value(true));

        // -------------------------------------------------------------
        // STEP 7: In Progress
        // -------------------------------------------------------------
        emergencyService.transition(p2Actor, bookingId, "START", null, null, null);

        List<EmergencyMaintenanceService.DispatchEvent> eventsAfterStart = emergencyService.recentEvents(startTestTimestamp);
        boolean startEventFound = eventsAfterStart.stream().anyMatch(e -> 
                e.bookingId().equals(bookingId) && "START".equals(e.action()) && "IN_PROGRESS".equals(e.status()));
        assertTrue(startEventFound, "START event must be broadcast when work begins");

        mvc.perform(get("/api/maintenance/dispatch/bookings/" + bookingId).session(adminSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.jobStatus").value("IN_PROGRESS"));

        // Upload After Photo
        emergencyService.photo(p2Actor, bookingId, "after", dummyPhoto);
        List<EmergencyMaintenanceService.DispatchEvent> eventsAfterAfterPhoto = emergencyService.recentEvents(startTestTimestamp);
        boolean afterPhotoEventFound = eventsAfterAfterPhoto.stream().anyMatch(e -> 
                e.bookingId().equals(bookingId) && "PHOTO_AFTER".equals(e.action()));
        assertTrue(afterPhotoEventFound, "PHOTO_AFTER event must be broadcast");

        // -------------------------------------------------------------
        // STEP 8: Completed Work & Review Trigger Prepared
        // -------------------------------------------------------------
        emergencyService.transition(p2Actor, bookingId, "COMPLETED", null, null, "Fixed completely");

        List<EmergencyMaintenanceService.DispatchEvent> eventsAfterComplete = emergencyService.recentEvents(startTestTimestamp);
        boolean completeEventFound = eventsAfterComplete.stream().anyMatch(e -> 
                e.bookingId().equals(bookingId) && "COMPLETED".equals(e.action()) && "COMPLETED".equals(e.status()));
        assertTrue(completeEventFound, "COMPLETED event must be broadcast upon completion");

        boolean reviewTriggerEventFound = eventsAfterComplete.stream().anyMatch(e -> 
                e.bookingId().equals(bookingId) && "REVIEW_REQUEST_PREPARED".equals(e.action()));
        assertTrue(reviewTriggerEventFound, "REVIEW_REQUEST_PREPARED event must be broadcast upon completion");

        // Verify Admin query immediately reflects COMPLETED state with partner released
        mvc.perform(get("/api/maintenance/dispatch/bookings/" + bookingId).session(adminSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.jobStatus").value("COMPLETED"))
                .andExpect(jsonPath("$.partnerWorkState").value("IDLE"))
                .andExpect(jsonPath("$.hasBeforePhoto").value(true))
                .andExpect(jsonPath("$.hasAfterPhoto").value(true));

        // -------------------------------------------------------------
        // STEP 9: Stale Data Check via Events Polling Endpoint
        // -------------------------------------------------------------
        // Verify GET /api/maintenance/dispatch/events?since={timestamp} returns the full event sequence
        mvc.perform(get("/api/maintenance/dispatch/events?since=" + startTestTimestamp).session(adminSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.bookingId == " + bookingId + " && @.action == 'CREATED')]").exists())
                .andExpect(jsonPath("$[?(@.bookingId == " + bookingId + " && @.action == 'OFFERED')]").exists())
                .andExpect(jsonPath("$[?(@.bookingId == " + bookingId + " && @.action == 'DECLINE')]").exists())
                .andExpect(jsonPath("$[?(@.bookingId == " + bookingId + " && @.action == 'ACCEPT')]").exists())
                .andExpect(jsonPath("$[?(@.bookingId == " + bookingId + " && @.action == 'REACHED_LOCATION')]").exists())
                .andExpect(jsonPath("$[?(@.bookingId == " + bookingId + " && @.action == 'PHOTO_START')]").exists())
                .andExpect(jsonPath("$[?(@.bookingId == " + bookingId + " && @.action == 'START')]").exists())
                .andExpect(jsonPath("$[?(@.bookingId == " + bookingId + " && @.action == 'PHOTO_AFTER')]").exists())
                .andExpect(jsonPath("$[?(@.bookingId == " + bookingId + " && @.action == 'COMPLETED')]").exists());
    }

    @Test
    @DisplayName("15. Permissions & Security: Access Controls, Partner Isolation, Contact Privacy, and Upload Authorization")
    void permissionsAndSecurity_RoleEnforcementAndPrivacyChecks() throws Exception {
        // -----------------------------------------------------------------
        // Setup Isolated Test Environment
        // -----------------------------------------------------------------
        String city = "SecurityCity-" + UUID.randomUUID().toString().substring(0, 6);
        String area = "SecurityArea-" + UUID.randomUUID().toString().substring(0, 6);
        double hubLat = 19.0760;
        double hubLon = 72.8777;

        MaintenanceHub hub = new MaintenanceHub();
        hub.setName("Security Verification Hub");
        hub.setCity(city);
        hub.setArea(area);
        hub.setLatitude(hubLat);
        hub.setLongitude(hubLon);
        hub.setRadiusKm(15.0);
        hub.setActive(true);
        hub = hubRepository.save(hub);

        // Setup Partner 1 (Authorized Worker for Job)
        AppUser workerUser1 = new AppUser();
        workerUser1.setEmail("perm-p1-" + UUID.randomUUID() + "@example.com");
        workerUser1.setFullName("Partner One Authorized");
        workerUser1.setPasswordHash("pass");
        workerUser1.setRole(com.smartapartment.entity.UserRole.MAINTENANCE_STAFF);
        workerUser1 = userRepository.save(workerUser1);

        MaintenancePartner partner1 = new MaintenancePartner();
        partner1.setUserId(workerUser1.getId());
        partner1.setName(workerUser1.getFullName());
        partner1.setPhone("9876543101");
        partner1.setTrade("Plumbing");
        partner1.setSkillCategories("Plumbing");
        partner1.setOnDuty(true);
        partner1.setAvailability("AVAILABLE");
        partner1.setWorkState("IDLE");
        partner1.setHubId(hub.getId());
        partner1.setLatitude(hubLat + 0.001);
        partner1.setLongitude(hubLon + 0.001);
        partner1.setLocationUpdatedAt(LocalDateTime.now());
        partner1 = partnerRepository.save(partner1);

        // Setup Partner 2 (Intruder / Other Worker)
        AppUser workerUser2 = new AppUser();
        workerUser2.setEmail("perm-p2-" + UUID.randomUUID() + "@example.com");
        workerUser2.setFullName("Partner Two Intruder");
        workerUser2.setPasswordHash("pass");
        workerUser2.setRole(com.smartapartment.entity.UserRole.MAINTENANCE_STAFF);
        workerUser2 = userRepository.save(workerUser2);

        MaintenancePartner partner2 = new MaintenancePartner();
        partner2.setUserId(workerUser2.getId());
        partner2.setName(workerUser2.getFullName());
        partner2.setPhone("9876543102");
        partner2.setTrade("Plumbing");
        partner2.setSkillCategories("Plumbing");
        partner2.setOnDuty(true);
        partner2.setAvailability("AVAILABLE");
        partner2.setWorkState("IDLE");
        partner2.setHubId(hub.getId());
        partner2.setLatitude(hubLat + 0.002);
        partner2.setLongitude(hubLon + 0.002);
        partner2.setLocationUpdatedAt(LocalDateTime.now());
        partner2 = partnerRepository.save(partner2);

        MockHttpSession partner1Session = createPartnerSession(workerUser1);
        MockHttpSession partner2Session = createPartnerSession(workerUser2);
        MockHttpSession adminSession = loginAsMaintenanceStaff();

        MockHttpSession customer1Session = registerCustomer("Customer Alice", "9876543111");
        MockHttpSession customer2Session = registerCustomer("Customer Bob", "9876543222");

        // -----------------------------------------------------------------
        // VERIFY 1: Customers cannot access Admin emergency controls
        // -----------------------------------------------------------------
        // Customer attempts GET /admin/failed
        mvc.perform(get("/api/maintenance/dispatch/admin/failed").session(customer1Session))
                .andExpect(status().isForbidden());

        // Customer attempts POST /admin/assign
        mvc.perform(post("/api/maintenance/dispatch/admin/assign")
                        .session(customer1Session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"bookingId\":1,\"partnerId\":" + partner1.getId() + "}"))
                .andExpect(status().isForbidden());

        // Customer attempts POST /hubs
        mvc.perform(post("/api/maintenance/dispatch/hubs")
                        .session(customer1Session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"city\":\"IllegalCity\",\"area\":\"IllegalArea\",\"latitude\":10.0,\"longitude\":10.0,\"radiusKm\":5.0}"))
                .andExpect(status().isForbidden());

        // Customer attempts PUT /hubs/{id}
        mvc.perform(put("/api/maintenance/dispatch/hubs/" + hub.getId())
                        .session(customer1Session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"radiusKm\":20.0}"))
                .andExpect(status().isForbidden());

        // Customer attempts POST /hubs/{id}/toggle-active
        mvc.perform(post("/api/maintenance/dispatch/hubs/" + hub.getId() + "/toggle-active").session(customer1Session))
                .andExpect(status().isForbidden());

        // Customer attempts POST /partners/{id}/toggle-duty
        mvc.perform(post("/api/maintenance/dispatch/partners/" + partner1.getId() + "/toggle-duty").session(customer1Session))
                .andExpect(status().isForbidden());

        // Customer attempts GET /worker-accounts
        mvc.perform(get("/api/maintenance/dispatch/worker-accounts").session(customer1Session))
                .andExpect(status().isForbidden());

        // Customer attempts GET /bookings/{id}/candidates
        mvc.perform(get("/api/maintenance/dispatch/bookings/1/candidates").session(customer1Session))
                .andExpect(status().isForbidden());

        // -----------------------------------------------------------------
        // VERIFY 2: Partners cannot access Admin controls & cannot self-assign arbitrary bookings
        // -----------------------------------------------------------------
        // Partner attempts POST /admin/assign
        mvc.perform(post("/api/maintenance/dispatch/admin/assign")
                        .session(partner1Session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"bookingId\":1,\"partnerId\":" + partner1.getId() + "}"))
                .andExpect(status().isForbidden());

        // Partner attempts POST /bookings/{id}/assign
        mvc.perform(post("/api/maintenance/dispatch/bookings/1/assign")
                        .session(partner1Session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"partnerId\":" + partner1.getId() + "}"))
                .andExpect(status().isForbidden());

        // Partner attempts GET /admin/failed
        mvc.perform(get("/api/maintenance/dispatch/admin/failed").session(partner1Session))
                .andExpect(status().isForbidden());

        // Partner attempts POST /hubs
        mvc.perform(post("/api/maintenance/dispatch/hubs")
                        .session(partner1Session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"city\":\"IllegalCity\",\"area\":\"IllegalArea\",\"latitude\":10.0,\"longitude\":10.0,\"radiusKm\":5.0}"))
                .andExpect(status().isForbidden());

        // Partner attempts POST /partners/{id}/toggle-duty
        mvc.perform(post("/api/maintenance/dispatch/partners/" + partner2.getId() + "/toggle-duty").session(partner1Session))
                .andExpect(status().isForbidden());

        // -----------------------------------------------------------------
        // VERIFY 3 & 4: Only authorized Admins can manually assign bookings
        // -----------------------------------------------------------------
        // Create an unassigned booking by Customer 1
        String payload1 = String.format("""
            {
                "category": "Plumbing",
                "description": "Pipe burst in master bathroom",
                "city": "%s",
                "area": "%s",
                "serviceAddress": "Tower A, Flat 501",
                "latitude": %.4f,
                "longitude": %.4f,
                "requesterPhone": "9876543111"
            }
            """, city, area, hubLat, hubLon);

        MvcResult createRes1 = mvc.perform(post("/api/maintenance/dispatch/bookings?platform=propertydirect")
                        .session(customer1Session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload1))
                .andExpect(status().isOk())
                .andReturn();
        long booking1Id = objectMapper.readTree(createRes1.getResponse().getContentAsString()).get("id").asLong();

        // Admin successfully performs manual assignment
        mvc.perform(post("/api/maintenance/dispatch/admin/assign")
                        .session(adminSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("{\"bookingId\":%d,\"partnerId\":%d}", booking1Id, partner1.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Admin manually assigned partner"));

        // Verify assignment details in DB
        EmergencyMaintenanceBooking b1 = bookingRepository.findById(booking1Id).orElseThrow();
        assertEquals("ASSIGNED", b1.getJobStatus());
        assertEquals("Manual", b1.getAssignmentType());
        assertEquals(partner1.getId(), b1.getPartnerId());
        assertNotNull(b1.getAssignedBy());

        // -----------------------------------------------------------------
        // VERIFY 5: Private customer contact should follow intended visibility rules
        // -----------------------------------------------------------------
        // Create a new Booking 2 by Customer 1
        String payload2 = String.format("""
            {
                "category": "Plumbing",
                "description": "Kitchen sink overflowing",
                "city": "%s",
                "area": "%s",
                "serviceAddress": "Tower B, Penthouse 12",
                "latitude": %.4f,
                "longitude": %.4f,
                "requesterPhone": "9876543111"
            }
            """, city, area, hubLat, hubLon);

        MvcResult createRes2 = mvc.perform(post("/api/maintenance/dispatch/bookings?platform=propertydirect")
                        .session(customer1Session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload2))
                .andExpect(status().isOk())
                .andReturn();
        long booking2Id = objectMapper.readTree(createRes2.getResponse().getContentAsString()).get("id").asLong();

        // Dispatch Booking 2 -> OFFERED to Partner 1
        EmergencyMaintenanceBooking b2 = bookingRepository.findById(booking2Id).orElseThrow();
        // Temporarily reset partner1 to IDLE for dispatch
        partner1 = partnerRepository.findById(partner1.getId()).orElseThrow();
        partner1.setWorkState("IDLE");
        partner1.setAvailability("AVAILABLE");
        partner1 = partnerRepository.save(partner1);
        emergencyService.dispatch(b2);

        b2 = bookingRepository.findById(booking2Id).orElseThrow();
        assertEquals("OFFERED", b2.getJobStatus());

        // A. Admin can view full contact details
        mvc.perform(get("/api/maintenance/dispatch/bookings/" + booking2Id).session(adminSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.contactUnlocked").value(true))
                .andExpect(jsonPath("$.requesterPhone").value("9876543111"))
                .andExpect(jsonPath("$.serviceAddress").value("Tower B, Penthouse 12"));

        // B. Customer 1 (owner) can view their own contact details
        mvc.perform(get("/api/maintenance/dispatch/bookings/" + booking2Id + "?platform=propertydirect").session(customer1Session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.contactUnlocked").value(true))
                .andExpect(jsonPath("$.requesterPhone").value("9876543111"));

        // C. Partner 1 (OFFERED, not yet accepted): Contact details MUST BE MASKED / HIDDEN
        mvc.perform(get("/api/maintenance/dispatch/bookings/" + booking2Id).session(partner1Session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.contactUnlocked").value(false))
                .andExpect(jsonPath("$.canCallCustomer").value(false))
                .andExpect(jsonPath("$.requesterPhone").doesNotExist())
                .andExpect(jsonPath("$.serviceAddress").doesNotExist());

        // Partner 1 attempts CALL_CUSTOMER prior to acceptance -> 403 Forbidden
        mvc.perform(post("/api/maintenance/dispatch/bookings/" + booking2Id + "/action")
                        .session(partner1Session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"action\":\"CALL_CUSTOMER\"}"))
                .andExpect(status().isForbidden());

        // D. Customer 2 (unrelated resident) attempts to view Booking 2 -> 403 Forbidden
        mvc.perform(get("/api/maintenance/dispatch/bookings/" + booking2Id + "?platform=propertydirect").session(customer2Session))
                .andExpect(status().isForbidden());

        // E. Partner 1 ACCEPTS Booking 2 -> Contact details UNLOCKED for assigned partner
        EmergencyMaintenanceService.Actor p1Actor = new EmergencyMaintenanceService.Actor(
                workerUser1.getId(), "smartsociety", "smartsociety", partner1.getName(), false, true);
        emergencyService.transition(p1Actor, booking2Id, "ACCEPT", null, null, null);

        mvc.perform(get("/api/maintenance/dispatch/bookings/" + booking2Id).session(partner1Session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.contactUnlocked").value(true))
                .andExpect(jsonPath("$.canCallCustomer").value(true))
                .andExpect(jsonPath("$.requesterPhone").value("9876543111"))
                .andExpect(jsonPath("$.serviceAddress").value("Tower B, Penthouse 12"));

        // Partner 1 can now authorizedly trigger CALL_CUSTOMER
        mvc.perform(post("/api/maintenance/dispatch/bookings/" + booking2Id + "/action")
                        .session(partner1Session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"action\":\"CALL_CUSTOMER\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.phone").value("9876543111"));

        // -----------------------------------------------------------------
        // VERIFY 6: Partners cannot access other partners' active booking details without authorization
        // -----------------------------------------------------------------
        // Partner 2 attempts GET /bookings/{booking2Id} -> 403 Forbidden
        mvc.perform(get("/api/maintenance/dispatch/bookings/" + booking2Id).session(partner2Session))
                .andExpect(status().isForbidden());

        // Partner 2 lists bookings -> Booking 2 MUST NOT be present
        mvc.perform(get("/api/maintenance/dispatch/bookings").session(partner2Session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == " + booking2Id + ")]").doesNotExist());

        // Partner 2 attempts to view history / timeline for Booking 2 -> 403 Forbidden
        mvc.perform(get("/api/maintenance/dispatch/bookings/" + booking2Id + "/history").session(partner2Session))
                .andExpect(status().isForbidden());

        mvc.perform(get("/api/maintenance/dispatch/bookings/" + booking2Id + "/timeline").session(partner2Session))
                .andExpect(status().isForbidden());

        // Partner 2 attempts to transition Booking 2 -> 403 Forbidden
        mvc.perform(post("/api/maintenance/dispatch/bookings/" + booking2Id + "/action")
                        .session(partner2Session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"action\":\"REACHED_LOCATION\"}"))
                .andExpect(status().isForbidden());

        // -----------------------------------------------------------------
        // VERIFY 7: Uploads must respect authorization
        // -----------------------------------------------------------------
        // Partner 1 transitions to REACHED_LOCATION
        emergencyService.transition(p1Actor, booking2Id, "REACHED_LOCATION", hubLat, hubLon, null);

        // Generate test PNG
        BufferedImage testImg = new BufferedImage(32, 32, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(testImg, "png", baos);
        byte[] validPngBytes = baos.toByteArray();

        MockMultipartFile intruderPhoto = new MockMultipartFile("photo", "intruder.png", "image/png", validPngBytes);
        MockMultipartFile customerPhoto = new MockMultipartFile("photo", "customer.png", "image/png", validPngBytes);
        MockMultipartFile validPhoto = new MockMultipartFile("photo", "valid.png", "image/png", validPngBytes);

        // A. Partner 2 (unassigned) attempts photo upload -> 403 Forbidden
        mvc.perform(multipart("/api/maintenance/dispatch/bookings/" + booking2Id + "/photos/before")
                        .file(intruderPhoto)
                        .session(partner2Session))
                .andExpect(status().isForbidden());

        // B. Customer attempts photo upload -> 403 Forbidden
        mvc.perform(multipart("/api/maintenance/dispatch/bookings/" + booking2Id + "/photos/before")
                        .file(customerPhoto)
                        .session(customer1Session))
                .andExpect(status().isForbidden());

        // C. Partner 2 attempts to view photo -> 403 Forbidden (readable checks auth first)
        mvc.perform(get("/api/maintenance/dispatch/bookings/" + booking2Id + "/photos/before").session(partner2Session))
                .andExpect(status().isForbidden());

        // D. Partner 1 (assigned) uploads photo -> 200 OK
        mvc.perform(multipart("/api/maintenance/dispatch/bookings/" + booking2Id + "/photos/before")
                        .file(validPhoto)
                        .session(partner1Session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Photo saved"))
                .andExpect(jsonPath("$.jobStatus").value("PHOTO_START"));

        // E. Partner 1 and Admin can view photo -> 200 OK
        mvc.perform(get("/api/maintenance/dispatch/bookings/" + booking2Id + "/photos/before").session(partner1Session))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "image/png"));

        mvc.perform(get("/api/maintenance/dispatch/bookings/" + booking2Id + "/photos/before").session(adminSession))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "image/png"));

        // F. Customer 2 (unrelated) attempts to view photo -> 403 Forbidden
        mvc.perform(get("/api/maintenance/dispatch/bookings/" + booking2Id + "/photos/before?platform=propertydirect").session(customer2Session))
                .andExpect(status().isForbidden());

        // G. Customer 1 (owner) can view photo -> 200 OK
        mvc.perform(get("/api/maintenance/dispatch/bookings/" + booking2Id + "/photos/before?platform=propertydirect").session(customer1Session))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "image/png"));
    }

    @Test
    @DisplayName("16. Error Handling: Clear messages, invalid bookings, disabled partners/hubs, missing locations, sanitized errors")
    void errorHandling_RobustnessAndSanitizationChecks() throws Exception {
        MockHttpSession adminSession = loginAsMaintenanceStaff();
        MockHttpSession customerSession = registerCustomer("Customer ErrorTest", "9876543555");

        String city = "ErrCity-" + UUID.randomUUID().toString().substring(0, 6);
        String area = "ErrArea-" + UUID.randomUUID().toString().substring(0, 6);
        double hubLat = 28.6139;
        double hubLon = 77.2090;

        // Setup active hub
        MaintenanceHub activeHub = new MaintenanceHub();
        activeHub.setName("Active Hub");
        activeHub.setCity(city);
        activeHub.setArea(area);
        activeHub.setLatitude(hubLat);
        activeHub.setLongitude(hubLon);
        activeHub.setRadiusKm(15.0);
        activeHub.setActive(true);
        activeHub = hubRepository.save(activeHub);

        // Setup inactive/disabled hub
        MaintenanceHub disabledHub = new MaintenanceHub();
        disabledHub.setName("Disabled Hub");
        disabledHub.setCity(city + "-Disabled");
        disabledHub.setArea(area + "-Disabled");
        disabledHub.setLatitude(hubLat + 0.1);
        disabledHub.setLongitude(hubLon + 0.1);
        disabledHub.setRadiusKm(15.0);
        disabledHub.setActive(false);
        disabledHub.setStatus("INACTIVE");
        disabledHub = hubRepository.save(disabledHub);

        // 1. Invalid Booking Scenarios
        // A. Fetch non-existent booking -> 404 with clean message
        mvc.perform(get("/api/maintenance/dispatch/bookings/9999999").session(adminSession))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Booking not found"))
                .andExpect(jsonPath("$.stackTrace").doesNotExist());

        // B. Transition non-existent booking -> 404 with clean message
        mvc.perform(post("/api/maintenance/dispatch/bookings/9999999/action")
                        .session(adminSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"action\":\"ACCEPT\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Booking not found"))
                .andExpect(jsonPath("$.stackTrace").doesNotExist());

        // C. Photo view for non-existent booking -> 404 with clean message
        mvc.perform(get("/api/maintenance/dispatch/bookings/9999999/photos/before").session(adminSession))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Booking not found"));

        // Create a valid booking for partner testing
        String bookingPayload = String.format("""
            {
                "category": "Plumbing",
                "description": "Basement drainage overflow",
                "city": "%s",
                "area": "%s",
                "serviceAddress": "Tower C, Unit 10",
                "latitude": %.4f,
                "longitude": %.4f,
                "requesterPhone": "9876543555"
            }
            """, city, area, hubLat, hubLon);

        MvcResult createRes = mvc.perform(post("/api/maintenance/dispatch/bookings?platform=propertydirect")
                        .session(customerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bookingPayload))
                .andExpect(status().isOk())
                .andReturn();
        long bookingId = objectMapper.readTree(createRes.getResponse().getContentAsString()).get("id").asLong();

        // 2. Disabled / Deleted Partner Scenarios
        // A. Manual assign non-existent partner -> 404 Partner not found
        mvc.perform(post("/api/maintenance/dispatch/admin/assign")
                        .session(adminSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("{\"bookingId\":%d,\"partnerId\":999999}", bookingId)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Partner not found"))
                .andExpect(jsonPath("$.stackTrace").doesNotExist());

        // B. Setup Partner with locked user account
        AppUser lockedUser = new AppUser();
        lockedUser.setEmail("locked-partner-" + UUID.randomUUID() + "@example.com");
        lockedUser.setFullName("Locked Partner");
        lockedUser.setPasswordHash("pass");
        lockedUser.setRole(com.smartapartment.entity.UserRole.MAINTENANCE_STAFF);
        lockedUser.setAccountLocked(true);
        lockedUser = userRepository.save(lockedUser);

        MaintenancePartner lockedPartner = new MaintenancePartner();
        lockedPartner.setUserId(lockedUser.getId());
        lockedPartner.setName(lockedUser.getFullName());
        lockedPartner.setTrade("Plumbing");
        lockedPartner.setSkillCategories("Plumbing");
        lockedPartner.setOnDuty(true);
        lockedPartner.setWorkState("IDLE");
        lockedPartner.setAvailability("AVAILABLE");
        lockedPartner.setHubId(activeHub.getId());
        lockedPartner = partnerRepository.save(lockedPartner);

        // Attempt manual assignment to locked partner -> 409 with clear error
        mvc.perform(post("/api/maintenance/dispatch/admin/assign")
                        .session(adminSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("{\"bookingId\":%d,\"partnerId\":%d}", bookingId, lockedPartner.getId())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Partner account is locked or disabled"))
                .andExpect(jsonPath("$.stackTrace").doesNotExist());

        // C. Setup Off-Duty partner
        AppUser offDutyUser = new AppUser();
        offDutyUser.setEmail("offduty-partner-" + UUID.randomUUID() + "@example.com");
        offDutyUser.setFullName("OffDuty Partner");
        offDutyUser.setPasswordHash("pass");
        offDutyUser.setRole(com.smartapartment.entity.UserRole.MAINTENANCE_STAFF);
        offDutyUser = userRepository.save(offDutyUser);

        MaintenancePartner offDutyPartner = new MaintenancePartner();
        offDutyPartner.setUserId(offDutyUser.getId());
        offDutyPartner.setName(offDutyUser.getFullName());
        offDutyPartner.setTrade("Plumbing");
        offDutyPartner.setSkillCategories("Plumbing");
        offDutyPartner.setOnDuty(false);
        offDutyPartner.setWorkState("OFFLINE");
        offDutyPartner.setAvailability("OFFLINE");
        offDutyPartner.setHubId(activeHub.getId());
        offDutyPartner = partnerRepository.save(offDutyPartner);

        // Attempt manual assignment to off-duty partner -> 409 with clear error
        mvc.perform(post("/api/maintenance/dispatch/admin/assign")
                        .session(adminSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("{\"bookingId\":%d,\"partnerId\":%d}", bookingId, offDutyPartner.getId())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Partner is currently off-duty and cannot receive assignments"))
                .andExpect(jsonPath("$.stackTrace").doesNotExist());

        // 3. Disabled Hub Scenarios
        // Setup partner in disabled hub
        AppUser disabledHubUser = new AppUser();
        disabledHubUser.setEmail("disabledhub-partner-" + UUID.randomUUID() + "@example.com");
        disabledHubUser.setFullName("DisabledHub Partner");
        disabledHubUser.setPasswordHash("pass");
        disabledHubUser.setRole(com.smartapartment.entity.UserRole.MAINTENANCE_STAFF);
        disabledHubUser = userRepository.save(disabledHubUser);

        MaintenancePartner disabledHubPartner = new MaintenancePartner();
        disabledHubPartner.setUserId(disabledHubUser.getId());
        disabledHubPartner.setName(disabledHubUser.getFullName());
        disabledHubPartner.setTrade("Plumbing");
        disabledHubPartner.setSkillCategories("Plumbing");
        disabledHubPartner.setOnDuty(true);
        disabledHubPartner.setWorkState("IDLE");
        disabledHubPartner.setAvailability("AVAILABLE");
        disabledHubPartner.setHubId(disabledHub.getId());
        disabledHubPartner = partnerRepository.save(disabledHubPartner);

        // Attempt manual assignment to partner in disabled hub -> 409 with clear error
        mvc.perform(post("/api/maintenance/dispatch/admin/assign")
                        .session(adminSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("{\"bookingId\":%d,\"partnerId\":%d}", bookingId, disabledHubPartner.getId())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Cannot assign partner belonging to an inactive hub"))
                .andExpect(jsonPath("$.stackTrace").doesNotExist());

        // 4. Missing Location Graceful Handling
        // Create emergency without latitude/longitude (missing coordinates)
        String noLocationPayload = String.format("""
            {
                "category": "Plumbing",
                "description": "Geoless leak request",
                "city": "%s",
                "area": "%s",
                "serviceAddress": "Floor 2, Flat 2B",
                "requesterPhone": "9876543555"
            }
            """, city, area);

        MvcResult noLocRes = mvc.perform(post("/api/maintenance/dispatch/bookings?platform=propertydirect")
                        .session(customerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(noLocationPayload))
                .andExpect(status().isOk())
                .andReturn();

        long noLocBookingId = objectMapper.readTree(noLocRes.getResponse().getContentAsString()).get("id").asLong();
        EmergencyMaintenanceBooking noLocBooking = bookingRepository.findById(noLocBookingId).orElseThrow();
        assertEquals(activeHub.getId(), noLocBooking.getHubId(), "Should resolve to active hub by city and area");

        // Verify view resolves coordinates from hub without throwing NPE
        mvc.perform(get("/api/maintenance/dispatch/bookings/" + noLocBookingId).session(adminSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(noLocBookingId))
                .andExpect(jsonPath("$.latitude").isNotEmpty())
                .andExpect(jsonPath("$.longitude").isNotEmpty());

        // 5. Raw Database / Validation Error Sanitization
        // Invalid payload: Blank category
        mvc.perform(post("/api/maintenance/dispatch/bookings?platform=propertydirect")
                        .session(customerSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"description\":\"Missing required category\",\"city\":\"Pune\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Please correct the highlighted fields"))
                .andExpect(jsonPath("$.errors.category").exists())
                .andExpect(jsonPath("$.stackTrace").doesNotExist());
    }
}
