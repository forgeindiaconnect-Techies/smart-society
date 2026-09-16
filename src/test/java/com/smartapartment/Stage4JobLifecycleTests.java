package com.smartapartment;

import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import com.smartapartment.service.EmergencyMaintenanceService;
import com.smartapartment.service.EmergencyMaintenanceService.Actor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class Stage4JobLifecycleTests {

    @Autowired private EmergencyMaintenanceService emergencyService;
    @Autowired private EmergencyMaintenanceBookingRepository bookingRepo;
    @Autowired private MaintenancePartnerRepository partnerRepo;
    @Autowired private MaintenanceHubRepository hubRepo;
    @Autowired private AppUserRepository userRepo;
    @Autowired private NotificationRepository notificationRepo;
    @Autowired private CommonMaintenanceTicketRepository ticketRepo;

    private Long primaryUserId;
    private Long intruderUserId;

    @BeforeEach
    void setUp() {
        primaryUserId = userRepo.findByEmail("worker1_stage4@smartapartment.local")
                .map(AppUser::getId)
                .orElseGet(() -> {
                    AppUser u = new AppUser();
                    u.setEmail("worker1_stage4@smartapartment.local");
                    u.setFullName("Assigned Worker");
                    u.setRole(UserRole.MAINTENANCE_STAFF);
                    u.setTenantId("test-tenant");
                    u.setPasswordHash("$2a$10$dummyhash");
                    u.setAccountLocked(false);
                    return userRepo.save(u).getId();
                });

        intruderUserId = userRepo.findByEmail("worker2_stage4@smartapartment.local")
                .map(AppUser::getId)
                .orElseGet(() -> {
                    AppUser u = new AppUser();
                    u.setEmail("worker2_stage4@smartapartment.local");
                    u.setFullName("Intruder Worker");
                    u.setRole(UserRole.MAINTENANCE_STAFF);
                    u.setTenantId("test-tenant");
                    u.setPasswordHash("$2a$10$dummyhash");
                    u.setAccountLocked(false);
                    return userRepo.save(u).getId();
                });
    }

    private MaintenanceHub createTestHub(String cityName, String areaName, double lat, double lon) {
        MaintenanceHub hub = new MaintenanceHub();
        hub.setName("Hub " + UUID.randomUUID().toString().substring(0, 8));
        hub.setCity(cityName);
        hub.setArea(areaName);
        hub.setLatitude(lat);
        hub.setLongitude(lon);
        hub.setRadiusKm(15.0);
        hub.setActive(true);
        hub.setStatus("ACTIVE");
        return hubRepo.save(hub);
    }

    private MaintenancePartner createPartner(String name, Long hubId, String trade, Long userId) {
        MaintenancePartner p = new MaintenancePartner();
        p.setName(name);
        p.setHubId(hubId);
        p.setTrade(trade);
        p.setSkillCategories(trade);
        p.setOnDuty(true);
        p.setWorkState("BUSY");
        p.setAvailability("BUSY");
        p.setUserId(userId);
        p.setLatitude(45.0);
        p.setLongitude(8.0);
        p.setLocationUpdatedAt(LocalDateTime.now());
        p.setEmploymentType("THIRD_PARTY");
        return partnerRepo.save(p);
    }

    private EmergencyMaintenanceBooking createAcceptedBooking(MaintenancePartner partner, MaintenanceHub hub) {
        EmergencyMaintenanceBooking b = new EmergencyMaintenanceBooking();
        b.setCity(hub.getCity());
        b.setArea(hub.getArea());
        b.setCategory(partner.getTrade());
        b.setRequesterId(99001L);
        b.setRequesterName("Customer " + UUID.randomUUID().toString().substring(0, 5));
        b.setRequesterPhone("9988776655");
        b.setServiceAddress("100 Emergency Ave");
        b.setTenantId("test-tenant");
        b.setSourcePlatform("smartsociety");
        b.setPartnerId(partner.getId());
        b.setHubId(hub.getId());
        b.setJobStatus("ACCEPTED");
        b.setOfferedAt(LocalDateTime.now().minusMinutes(5));
        b.setAcceptedAt(LocalDateTime.now().minusMinutes(4));
        b.setArrivalDueAt(LocalDateTime.now().plusMinutes(26));
        b.setAssignmentType("Auto");
        b.setAssignmentAuditLog(String.format("[%s] ACCEPTED: Partner=%s (ID: %s) - Partner accepted assignment",
                LocalDateTime.now().minusMinutes(4).format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")),
                partner.getName(), partner.getId()));
        return bookingRepo.save(b);
    }

    private Actor workerActor(Long userId, String name) {
        return new Actor(userId, "smartsociety", "test-tenant", name, false, true);
    }

    private Actor adminActor() {
        return new Actor(0L, "smartsociety", "test-tenant", "SuperAdmin", true, false);
    }

    private static final byte[] DUMMY_PHOTO = new byte[] { (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A };

    @Test
    @DisplayName("Happy Path: Full sequential lifecycle Accepted -> Reached -> Photo (Start) -> In Progress -> Photo (After) -> Completed")
    void happyPath_FullSequentialLifecycle() {
        String city = "LifeCycleCity-" + UUID.randomUUID().toString().substring(0, 6);
        MaintenanceHub hub = createTestHub(city, "Central", 45.0, 8.0);
        MaintenancePartner partner = createPartner("Partner Alex", hub.getId(), "Plumbing", primaryUserId);
        EmergencyMaintenanceBooking b = createAcceptedBooking(partner, hub);

        Actor assignedActor = workerActor(primaryUserId, "Partner Alex");

        // 1. Initial State: ACCEPTED
        assertEquals("ACCEPTED", b.getJobStatus());
        assertNotNull(b.getAcceptedAt());
        assertNull(b.getReachedAt());
        assertNull(b.getPhotoStartAt());
        assertNull(b.getStartedAt());
        assertNull(b.getCompletedAt());

        // 2. Step 1: Reached Location
        emergencyService.transition(assignedActor, b.getId(), "REACHED");
        b = bookingRepo.findById(b.getId()).orElseThrow();
        assertEquals("REACHED_LOCATION", b.getJobStatus());
        assertNotNull(b.getReachedAt());

        // 3. Step 2: Photo (Start)
        emergencyService.photo(assignedActor, b.getId(), "before", DUMMY_PHOTO);
        b = bookingRepo.findById(b.getId()).orElseThrow();
        assertEquals("PHOTO_START", b.getJobStatus());
        assertNotNull(b.getPhotoStartAt());
        assertNotNull(b.getBeforePhoto());

        // 4. Step 3: In Progress
        emergencyService.transition(assignedActor, b.getId(), "START");
        b = bookingRepo.findById(b.getId()).orElseThrow();
        assertEquals("IN_PROGRESS", b.getJobStatus());
        assertNotNull(b.getStartedAt());

        // 5. Upload After Photo
        emergencyService.photo(assignedActor, b.getId(), "after", DUMMY_PHOTO);
        b = bookingRepo.findById(b.getId()).orElseThrow();
        assertNotNull(b.getAfterPhoto());
        assertEquals("IN_PROGRESS", b.getJobStatus());

        // 6. Step 4: Completed
        emergencyService.transition(assignedActor, b.getId(), "COMPLETE");
        b = bookingRepo.findById(b.getId()).orElseThrow();
        assertEquals("COMPLETED", b.getJobStatus());
        assertNotNull(b.getCompletedAt());
        assertNotNull(b.getReviewRequestedAt());

        // Partner availability released to IDLE
        partner = partnerRepo.findById(partner.getId()).orElseThrow();
        assertEquals("IDLE", partner.getAvailability());
        assertEquals("IDLE", partner.getWorkState());
    }

    @Test
    @DisplayName("Sequence Enforcement: Cannot start directly from ACCEPTED (skipping Reached and Photo)")
    void skipAttempt_CannotStartFromAccepted() {
        String city = "SkipCity1-" + UUID.randomUUID().toString().substring(0, 6);
        MaintenanceHub hub = createTestHub(city, "Central", 45.1, 8.1);
        MaintenancePartner partner = createPartner("Partner Sam", hub.getId(), "Electrical", primaryUserId);
        EmergencyMaintenanceBooking b = createAcceptedBooking(partner, hub);

        Actor assignedActor = workerActor(primaryUserId, "Partner Sam");

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                emergencyService.transition(assignedActor, b.getId(), "START")
        );
        assertEquals(409, ex.getStatusCode().value());
        assertTrue(ex.getReason().contains("requires PHOTO_START"));
    }

    @Test
    @DisplayName("Sequence Enforcement: Cannot complete directly from ACCEPTED (skipping all intermediate steps)")
    void skipAttempt_CannotCompleteFromAccepted() {
        String city = "SkipCity2-" + UUID.randomUUID().toString().substring(0, 6);
        MaintenanceHub hub = createTestHub(city, "Central", 45.2, 8.2);
        MaintenancePartner partner = createPartner("Partner Dave", hub.getId(), "Electrical", primaryUserId);
        EmergencyMaintenanceBooking b = createAcceptedBooking(partner, hub);

        Actor assignedActor = workerActor(primaryUserId, "Partner Dave");

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                emergencyService.transition(assignedActor, b.getId(), "COMPLETE")
        );
        assertEquals(409, ex.getStatusCode().value());
        assertTrue(ex.getReason().contains("requires IN_PROGRESS"));
    }

    @Test
    @DisplayName("Sequence Enforcement: Cannot start from REACHED_LOCATION without uploading start photo")
    void skipAttempt_CannotStartFromReachedLocationWithoutPhoto() {
        String city = "SkipCity3-" + UUID.randomUUID().toString().substring(0, 6);
        MaintenanceHub hub = createTestHub(city, "Central", 45.3, 8.3);
        MaintenancePartner partner = createPartner("Partner John", hub.getId(), "Plumbing", primaryUserId);
        EmergencyMaintenanceBooking b = createAcceptedBooking(partner, hub);

        Actor assignedActor = workerActor(primaryUserId, "Partner John");
        emergencyService.transition(assignedActor, b.getId(), "REACHED");

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                emergencyService.transition(assignedActor, b.getId(), "START")
        );
        assertEquals(409, ex.getStatusCode().value());
        assertTrue(ex.getReason().contains("requires PHOTO_START"));
    }

    @Test
    @DisplayName("Sequence Enforcement: Cannot complete from PHOTO_START without transitioning to IN_PROGRESS")
    void skipAttempt_CannotCompleteFromPhotoStart() {
        String city = "SkipCity4-" + UUID.randomUUID().toString().substring(0, 6);
        MaintenanceHub hub = createTestHub(city, "Central", 45.4, 8.4);
        MaintenancePartner partner = createPartner("Partner Leo", hub.getId(), "Plumbing", primaryUserId);
        EmergencyMaintenanceBooking b = createAcceptedBooking(partner, hub);

        Actor assignedActor = workerActor(primaryUserId, "Partner Leo");
        emergencyService.transition(assignedActor, b.getId(), "REACHED");
        emergencyService.photo(assignedActor, b.getId(), "before", DUMMY_PHOTO);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                emergencyService.transition(assignedActor, b.getId(), "COMPLETE")
        );
        assertEquals(409, ex.getStatusCode().value());
        assertTrue(ex.getReason().contains("requires IN_PROGRESS"));
    }

    @Test
    @DisplayName("Sequence Enforcement: Cannot complete in IN_PROGRESS without uploading after photo")
    void skipAttempt_CannotCompleteWithoutAfterPhoto() {
        String city = "SkipCity5-" + UUID.randomUUID().toString().substring(0, 6);
        MaintenanceHub hub = createTestHub(city, "Central", 45.5, 8.5);
        MaintenancePartner partner = createPartner("Partner Nick", hub.getId(), "Plumbing", primaryUserId);
        EmergencyMaintenanceBooking b = createAcceptedBooking(partner, hub);

        Actor assignedActor = workerActor(primaryUserId, "Partner Nick");
        emergencyService.transition(assignedActor, b.getId(), "REACHED");
        emergencyService.photo(assignedActor, b.getId(), "before", DUMMY_PHOTO);
        emergencyService.transition(assignedActor, b.getId(), "START");

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                emergencyService.transition(assignedActor, b.getId(), "COMPLETE")
        );
        assertEquals(409, ex.getStatusCode().value());
        assertTrue(ex.getReason().contains("after photo"));
    }

    @Test
    @DisplayName("Photo Validation: Premature photo uploads rejected at wrong lifecycle phases")
    void photoValidation_PrematureUploadsRejected() {
        String city = "PhotoCity-" + UUID.randomUUID().toString().substring(0, 6);
        MaintenanceHub hub = createTestHub(city, "Central", 45.6, 8.6);
        MaintenancePartner partner = createPartner("Partner Tim", hub.getId(), "Carpentry", primaryUserId);
        EmergencyMaintenanceBooking b = createAcceptedBooking(partner, hub);

        Actor assignedActor = workerActor(primaryUserId, "Partner Tim");

        // 1. In ACCEPTED: Before photo rejected
        ResponseStatusException ex1 = assertThrows(ResponseStatusException.class, () ->
                emergencyService.photo(assignedActor, b.getId(), "before", DUMMY_PHOTO)
        );
        assertEquals(409, ex1.getStatusCode().value());

        // 2. In ACCEPTED: After photo rejected
        ResponseStatusException ex2 = assertThrows(ResponseStatusException.class, () ->
                emergencyService.photo(assignedActor, b.getId(), "after", DUMMY_PHOTO)
        );
        assertEquals(409, ex2.getStatusCode().value());

        // Move to REACHED_LOCATION
        emergencyService.transition(assignedActor, b.getId(), "REACHED");

        // 3. In REACHED_LOCATION: After photo rejected
        ResponseStatusException ex3 = assertThrows(ResponseStatusException.class, () ->
                emergencyService.photo(assignedActor, b.getId(), "after", DUMMY_PHOTO)
        );
        assertEquals(409, ex3.getStatusCode().value());
    }

    @Test
    @DisplayName("Authorization: Non-assigned worker cannot execute lifecycle actions or upload photos")
    void security_NonAssignedWorkerCannotPerformActions() {
        String city = "SecCity-" + UUID.randomUUID().toString().substring(0, 6);
        MaintenanceHub hub = createTestHub(city, "Central", 45.7, 8.7);
        MaintenancePartner assignedPartner = createPartner("Assigned Worker", hub.getId(), "Electrical", primaryUserId);
        createPartner("Intruder Worker", hub.getId(), "Electrical", intruderUserId);
        EmergencyMaintenanceBooking b = createAcceptedBooking(assignedPartner, hub);

        Actor intruderActor = workerActor(intruderUserId, "Intruder Worker");

        // Transition attempt by unassigned partner
        ResponseStatusException ex1 = assertThrows(ResponseStatusException.class, () ->
                emergencyService.transition(intruderActor, b.getId(), "REACHED")
        );
        assertEquals(403, ex1.getStatusCode().value());

        // Photo upload attempt by unassigned partner
        ResponseStatusException ex2 = assertThrows(ResponseStatusException.class, () ->
                emergencyService.photo(intruderActor, b.getId(), "before", DUMMY_PHOTO)
        );
        assertEquals(403, ex2.getStatusCode().value());
    }

    @Test
    @DisplayName("Admin Assigned Workflow: Manually assigned booking (ASSIGNED) follows identical valid lifecycle")
    void adminAssignedBooking_FollowsIdenticalLifecycle() {
        String city = "AdminAssignCity-" + UUID.randomUUID().toString().substring(0, 6);
        MaintenanceHub hub = createTestHub(city, "Downtown", 45.8, 8.8);
        MaintenancePartner partner = createPartner("Partner Chris", hub.getId(), "Electrical", primaryUserId);
        partner.setAvailability("IDLE");
        partner.setWorkState("IDLE");
        partnerRepo.save(partner);

        EmergencyMaintenanceBooking b = new EmergencyMaintenanceBooking();
        b.setCity(city);
        b.setArea("Downtown");
        b.setCategory("Electrical");
        b.setRequesterName("Customer Jane");
        b.setRequesterPhone("9988776655");
        b.setServiceAddress("200 Downtown St");
        b.setTenantId("test-tenant");
        b.setSourcePlatform("smartsociety");
        b.setJobStatus("FAILED_ASSIGNMENT");
        b = bookingRepo.save(b);

        // Admin manually assigns partner -> status becomes ASSIGNED
        Actor admin = adminActor();
        emergencyService.adminAssignPartner(admin, b.getId(), partner.getId());

        b = bookingRepo.findById(b.getId()).orElseThrow();
        assertEquals("ASSIGNED", b.getJobStatus());

        Actor worker = workerActor(primaryUserId, "Partner Chris");

        // 1. REACHED from ASSIGNED
        emergencyService.transition(worker, b.getId(), "REACHED");
        b = bookingRepo.findById(b.getId()).orElseThrow();
        assertEquals("REACHED_LOCATION", b.getJobStatus());

        // 2. Photo (Start)
        emergencyService.photo(worker, b.getId(), "before", DUMMY_PHOTO);
        b = bookingRepo.findById(b.getId()).orElseThrow();
        assertEquals("PHOTO_START", b.getJobStatus());

        // 3. In Progress
        emergencyService.transition(worker, b.getId(), "START");
        b = bookingRepo.findById(b.getId()).orElseThrow();
        assertEquals("IN_PROGRESS", b.getJobStatus());

        // 4. Photo (After)
        emergencyService.photo(worker, b.getId(), "after", DUMMY_PHOTO);
        b = bookingRepo.findById(b.getId()).orElseThrow();
        assertNotNull(b.getAfterPhoto());

        // 5. Complete
        emergencyService.transition(worker, b.getId(), "COMPLETE");
        b = bookingRepo.findById(b.getId()).orElseThrow();
        assertEquals("COMPLETED", b.getJobStatus());
        assertNotNull(b.getCompletedAt());

        // Partner released
        partner = partnerRepo.findById(partner.getId()).orElseThrow();
        assertEquals("IDLE", partner.getAvailability());
    }

    @Test
    @DisplayName("Accepted State: Partner sees full job details, customer contact, call action, and acceptance timestamp")
    void acceptedState_PartnerSeesFullDetailsAndActions() {
        String city = "AcceptedCity-" + UUID.randomUUID().toString().substring(0, 6);
        MaintenanceHub hub = createTestHub(city, "Central", 46.0, 9.0);
        MaintenancePartner partner = createPartner("Partner Walter", hub.getId(), "Plumbing", primaryUserId);

        EmergencyMaintenanceBooking b = new EmergencyMaintenanceBooking();
        b.setCity(hub.getCity());
        b.setArea(hub.getArea());
        b.setCategory("Plumbing");
        b.setDescription("Major pipe leak under kitchen sink");
        b.setRequesterName("Alice Resident");
        b.setRequesterPhone("9876543210");
        b.setServiceAddress("Flat 402, Sunshine Towers, Central");
        b.setTenantId("test-tenant");
        b.setSourcePlatform("smartsociety");
        b.setPartnerId(partner.getId());
        b.setHubId(hub.getId());
        b.setJobStatus("OFFERED");
        b.setOfferedAt(LocalDateTime.now());
        b.setDistanceKm(3.5);
        b = bookingRepo.save(b);

        Actor assignedActor = workerActor(primaryUserId, "Partner Walter");

        // Prior to acceptance: customer contact details must NOT be exposed
        var preView = emergencyService.view(assignedActor, b);
        assertEquals(false, preView.get("contactUnlocked"));
        assertEquals(false, preView.get("canCallCustomer"));
        assertNull(preView.get("customer"));
        assertNull(preView.get("customerName"));
        assertNull(preView.get("phone"));
        assertNull(preView.get("customerPhone"));
        assertNull(preView.get("address"));
        assertNull(preView.get("serviceAddress"));

        final Long bookingId = b.getId();

        // Partner accepts booking
        emergencyService.transition(assignedActor, bookingId, "ACCEPT");

        // Reload booking
        b = bookingRepo.findById(bookingId).orElseThrow();

        // 1. Status is Accepted & acceptance timestamp is stored
        assertEquals("ACCEPTED", b.getJobStatus());
        assertNotNull(b.getAcceptedAt());

        // 2. Full view for the assigned partner
        var postView = emergencyService.view(assignedActor, b);

        // Emergency booking ID
        assertNotNull(postView.get("id"));
        assertNotNull(postView.get("bookingReference"));
        assertEquals(bookingId, postView.get("id"));

        // Customer
        assertEquals(true, postView.get("contactUnlocked"));
        assertEquals("Alice Resident", postView.get("customer"));
        assertEquals("Alice Resident", postView.get("customerName"));
        assertEquals("Alice Resident", postView.get("requesterName"));
        assertEquals("9876543210", postView.get("phone"));
        assertEquals("9876543210", postView.get("customerPhone"));
        assertEquals("9876543210", postView.get("requesterPhone"));

        // Issue type
        assertEquals("Plumbing", postView.get("issueType"));
        assertEquals("Plumbing", postView.get("category"));

        // Issue description
        assertEquals("Major pipe leak under kitchen sink", postView.get("issueDescription"));
        assertEquals("Major pipe leak under kitchen sink", postView.get("description"));

        // Address
        assertEquals("Flat 402, Sunshine Towers, Central", postView.get("address"));
        assertEquals("Flat 402, Sunshine Towers, Central", postView.get("serviceAddress"));

        // Distance where available
        assertEquals(3.5, postView.get("distanceKm"));
        assertEquals("3.5 km", postView.get("distance"));

        // Call Customer action available
        assertEquals(true, postView.get("canCallCustomer"));
        assertDoesNotThrow(() -> emergencyService.transition(assignedActor, bookingId, "CALL_CUSTOMER"));

        // Current lifecycle status
        assertEquals("ACCEPTED", postView.get("lifecycleStatus"));
        assertEquals("ACCEPTED", postView.get("jobStatus"));
        assertEquals("ACCEPTED", postView.get("status"));
        assertEquals(b.getAcceptedAt(), postView.get("acceptedAt"));
    }

    @Test
    @DisplayName("Reached Location: Explicit action updates status to REACHED_LOCATION and records reached timestamp")
    void reachedLocation_ExplicitActionUpdatesStatusAndTimestamp() {
        String city = "ReachedCity1-" + UUID.randomUUID().toString().substring(0, 6);
        MaintenanceHub hub = createTestHub(city, "North", 47.0, 10.0);
        MaintenancePartner partner = createPartner("Partner Ronald", hub.getId(), "Electrical", primaryUserId);
        EmergencyMaintenanceBooking b = createAcceptedBooking(partner, hub);

        Actor assignedActor = workerActor(primaryUserId, "Partner Ronald");

        // Execute explicit "REACHED_LOCATION" action (alias for "REACHED")
        emergencyService.transition(assignedActor, b.getId(), "REACHED_LOCATION");

        b = bookingRepo.findById(b.getId()).orElseThrow();
        assertEquals("REACHED_LOCATION", b.getJobStatus());
        assertNotNull(b.getReachedAt());

        var view = emergencyService.view(assignedActor, b);
        assertEquals("REACHED_LOCATION", view.get("jobStatus"));
        assertEquals(b.getReachedAt(), view.get("reachedAt"));
    }

    @Test
    @DisplayName("Reached Location: Optional GPS proximity validates partner arrival within geofence")
    void reachedLocation_OptionalGpsProximityValidatesWithinGeofence() {
        String city = "ReachedCity2-" + UUID.randomUUID().toString().substring(0, 6);
        MaintenanceHub hub = createTestHub(city, "South", 47.1, 10.1);
        MaintenancePartner partner = createPartner("Partner Victor", hub.getId(), "Plumbing", primaryUserId);

        EmergencyMaintenanceBooking b = createAcceptedBooking(partner, hub);
        b.setLatitude(47.1000);
        b.setLongitude(10.1000);
        b = bookingRepo.save(b);

        Actor assignedActor = workerActor(primaryUserId, "Partner Victor");

        // Partner confirms arrival with GPS coordinates within ~200 meters
        double partnerArrivalLat = 47.1010;
        double partnerArrivalLon = 10.1010;
        emergencyService.transition(assignedActor, b.getId(), "REACHED", partnerArrivalLat, partnerArrivalLon);

        b = bookingRepo.findById(b.getId()).orElseThrow();
        assertEquals("REACHED_LOCATION", b.getJobStatus());
        assertNotNull(b.getReachedAt());
        assertNotNull(b.getArrivalDistanceKm());
        assertTrue(b.getArrivalDistanceKm() < 1.0, "Partner should be within 1 km geofence");
        assertEquals(true, b.getArrivalGeofenceVerified());

        // Verify audit log contains proximity and geofence verification
        assertTrue(b.getAssignmentAuditLog().contains("Proximity:"));
        assertTrue(b.getAssignmentAuditLog().contains("Geofence verified: true"));
    }

    @Test
    @DisplayName("Reached Location: Outside geofence does not block arrival by default, but blocks if enforcement enabled")
    void reachedLocation_OutsideGeofenceNonBlockingByDefaultAndEnforcedWhenConfigured() {
        String city = "ReachedCity3-" + UUID.randomUUID().toString().substring(0, 6);
        MaintenanceHub hub = createTestHub(city, "East", 47.2, 10.2);
        MaintenancePartner partner = createPartner("Partner Oscar", hub.getId(), "Electrical", primaryUserId);

        EmergencyMaintenanceBooking b = createAcceptedBooking(partner, hub);
        b.setLatitude(47.2000);
        b.setLongitude(10.2000);
        b = bookingRepo.save(b);

        Actor assignedActor = workerActor(primaryUserId, "Partner Oscar");

        // Partner coordinates are ~11 km away
        double farLat = 47.3000;
        double farLon = 10.3000;

        // 1. By default: non-blocking, arrival succeeds, geofence marked false
        emergencyService.transition(assignedActor, b.getId(), "REACHED", farLat, farLon);

        b = bookingRepo.findById(b.getId()).orElseThrow();
        assertEquals("REACHED_LOCATION", b.getJobStatus());
        assertNotNull(b.getReachedAt());
        assertTrue(b.getArrivalDistanceKm() > 5.0);
        assertEquals(false, b.getArrivalGeofenceVerified());

        // 2. When strict geofencing enforcement is enabled: blocks arrival with 409
        EmergencyMaintenanceBooking b2 = createAcceptedBooking(partner, hub);
        b2.setLatitude(47.2000);
        b2.setLongitude(10.2000);
        b2 = bookingRepo.save(b2);

        try {
            emergencyService.setEnforceGeofence(true);
            final Long b2Id = b2.getId();
            ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                    emergencyService.transition(assignedActor, b2Id, "REACHED", farLat, farLon)
            );
            assertEquals(409, ex.getStatusCode().value());
            assertTrue(ex.getReason().contains("outside the arrival geofence"));
        } finally {
            emergencyService.setEnforceGeofence(false);
        }
    }

    @Test
    @DisplayName("Mandatory Before Photo: Cannot start work (In Progress) until valid Before Photo is uploaded")
    void mandatoryBeforePhoto_WorkCannotStartUntilPhotoUploaded() {
        String city = "BeforePhotoCity-" + UUID.randomUUID().toString().substring(0, 6);
        MaintenanceHub hub = createTestHub(city, "North", 48.0, 11.0);
        MaintenancePartner partner = createPartner("Partner Bruce", hub.getId(), "Plumbing", primaryUserId);
        EmergencyMaintenanceBooking b = createAcceptedBooking(partner, hub);

        Actor assignedActor = workerActor(primaryUserId, "Partner Bruce");

        // 1. Reached location
        emergencyService.transition(assignedActor, b.getId(), "REACHED");
        b = bookingRepo.findById(b.getId()).orElseThrow();
        assertEquals("REACHED_LOCATION", b.getJobStatus());

        // 2. Attempt to start work without Before Photo -> strictly forbidden with 409
        final Long bookingId = b.getId();
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                emergencyService.transition(assignedActor, bookingId, "START")
        );
        assertEquals(409, ex.getStatusCode().value());
        assertTrue(ex.getReason().contains("requires PHOTO_START"));

        // Confirm status remains REACHED_LOCATION
        b = bookingRepo.findById(bookingId).orElseThrow();
        assertEquals("REACHED_LOCATION", b.getJobStatus());
        assertNull(b.getBeforePhoto());
        assertNull(b.getStartedAt());

        // 3. Attempt empty before photo upload -> 400 Bad Request
        ResponseStatusException emptyEx = assertThrows(ResponseStatusException.class, () ->
                emergencyService.photo(assignedActor, bookingId, "before", new byte[0])
        );
        assertEquals(400, emptyEx.getStatusCode().value());

        // 4. Upload valid Before Photo
        emergencyService.photo(assignedActor, bookingId, "before", DUMMY_PHOTO);
        b = bookingRepo.findById(bookingId).orElseThrow();
        assertEquals("PHOTO_START", b.getJobStatus());
        assertNotNull(b.getBeforePhoto());
        assertNotNull(b.getPhotoStartAt());
        assertNotNull(b.getBeforePhotoUrl());

        // Check audit log documentation
        assertTrue(b.getAssignmentAuditLog().contains("BEFORE_PHOTO_UPLOADED"));
        assertTrue(b.getAssignmentAuditLog().contains("existing damage documented"));

        // 5. Work can now start -> IN_PROGRESS
        emergencyService.transition(assignedActor, bookingId, "START");
        b = bookingRepo.findById(bookingId).orElseThrow();
        assertEquals("IN_PROGRESS", b.getJobStatus());
        assertNotNull(b.getStartedAt());

        // 6. View exposes beforePhotoUrl and hasBeforePhoto
        var view = emergencyService.view(assignedActor, b);
        assertEquals(true, view.get("hasBeforePhoto"));
        assertNotNull(view.get("beforePhotoUrl"));
    }

    @Test
    @DisplayName("Start Work / In Progress: Backend strictly enforces Before Photo prerequisite and records startedAt")
    void startWork_StrictBackendEnforcementAndTimestampStorage() {
        String city = "StartWorkCity-" + UUID.randomUUID().toString().substring(0, 6);
        MaintenanceHub hub = createTestHub(city, "Central", 48.5, 11.5);
        MaintenancePartner partner = createPartner("Partner Tony", hub.getId(), "Electrical", primaryUserId);
        EmergencyMaintenanceBooking b = createAcceptedBooking(partner, hub);

        Actor assignedActor = workerActor(primaryUserId, "Partner Tony");
        final Long bookingId = b.getId();

        // 1. Backend rejects START_WORK from ACCEPTED (before Reached and Before Photo)
        ResponseStatusException ex1 = assertThrows(ResponseStatusException.class, () ->
                emergencyService.transition(assignedActor, bookingId, "START_WORK")
        );
        assertEquals(409, ex1.getStatusCode().value());

        // Partner reaches location
        emergencyService.transition(assignedActor, bookingId, "REACHED");

        // 2. Backend rejects IN_PROGRESS from REACHED_LOCATION (before mandatory Before Photo)
        ResponseStatusException ex2 = assertThrows(ResponseStatusException.class, () ->
                emergencyService.transition(assignedActor, bookingId, "IN_PROGRESS")
        );
        assertEquals(409, ex2.getStatusCode().value());
        assertTrue(ex2.getReason().contains("requires PHOTO_START"));

        // Confirm status remains REACHED_LOCATION and startedAt is null
        b = bookingRepo.findById(bookingId).orElseThrow();
        assertEquals("REACHED_LOCATION", b.getJobStatus());
        assertNull(b.getStartedAt());

        // Partner uploads valid Before Photo
        emergencyService.photo(assignedActor, bookingId, "before", DUMMY_PHOTO);
        b = bookingRepo.findById(bookingId).orElseThrow();
        assertEquals("PHOTO_START", b.getJobStatus());

        // 3. Partner invokes START_WORK -> success
        emergencyService.transition(assignedActor, bookingId, "START_WORK");

        b = bookingRepo.findById(bookingId).orElseThrow();
        assertEquals("IN_PROGRESS", b.getJobStatus());
        assertNotNull(b.getStartedAt());
        assertEquals("Service in progress", b.getDispatchReason());

        // Audit log records IN_PROGRESS
        assertTrue(b.getAssignmentAuditLog().contains("IN_PROGRESS"));
        assertTrue(b.getAssignmentAuditLog().contains("Partner started service work"));

        // View returns updated lifecycle status and timestamp
        var view = emergencyService.view(assignedActor, b);
        assertEquals("IN_PROGRESS", view.get("lifecycleStatus"));
        assertEquals("IN_PROGRESS", view.get("jobStatus"));
        assertEquals(b.getStartedAt(), view.get("startedAt"));
    }

    @Test
    @DisplayName("During Work: Partner continues seeing Customer, Issue, Address, Status, Start Time, and Before Photo")
    void duringWork_PartnerSeesCustomerIssueAddressStatusStartTimeAndBeforePhoto() {
        String city = "DuringWorkCity-" + UUID.randomUUID().toString().substring(0, 6);
        MaintenanceHub hub = createTestHub(city, "Central", 48.6, 11.6);
        MaintenancePartner partner = createPartner("Partner Sam", hub.getId(), "Plumbing", primaryUserId);
        EmergencyMaintenanceBooking b = createAcceptedBooking(partner, hub);

        Actor assignedActor = workerActor(primaryUserId, "Partner Sam");
        final Long bookingId = b.getId();

        // Advance through sequence to IN_PROGRESS: Accepted -> Reached -> Before Photo -> Start Work
        emergencyService.transition(assignedActor, bookingId, "REACHED");
        emergencyService.photo(assignedActor, bookingId, "before", DUMMY_PHOTO);
        emergencyService.transition(assignedActor, bookingId, "START");

        EmergencyMaintenanceBooking inProgressBooking = bookingRepo.findById(bookingId).orElseThrow();
        assertEquals("IN_PROGRESS", inProgressBooking.getJobStatus());

        var view = emergencyService.view(assignedActor, inProgressBooking);

        // 1. Customer details (name, phone, call action enabled)
        assertEquals(inProgressBooking.getRequesterName(), view.get("customer"));
        assertEquals(inProgressBooking.getRequesterName(), view.get("customerName"));
        assertEquals(inProgressBooking.getRequesterPhone(), view.get("phone"));
        assertEquals(true, view.get("canCallCustomer"));
        assertEquals(true, view.get("contactUnlocked"));

        // 2. Issue details (trade, description)
        assertEquals(inProgressBooking.getCategory(), view.get("issueType"));
        assertEquals(inProgressBooking.getDescription(), view.get("issueDescription"));

        // 3. Address & Distance details
        assertEquals(inProgressBooking.getServiceAddress(), view.get("address"));
        assertEquals(inProgressBooking.getServiceAddress(), view.get("serviceAddress"));
        assertNotNull(view.get("distance"));

        // 4. Current status
        assertEquals("IN_PROGRESS", view.get("jobStatus"));
        assertEquals("IN_PROGRESS", view.get("lifecycleStatus"));

        // 5. Start time
        assertNotNull(view.get("startedAt"));
        assertEquals(inProgressBooking.getStartedAt(), view.get("startedAt"));

        // 6. Before photo
        assertEquals(true, view.get("hasBeforePhoto"));
        assertNotNull(view.get("beforePhotoUrl"));
        assertTrue(view.get("beforePhotoUrl").toString().contains("/api/maintenance/dispatch/bookings/" + bookingId + "/photos/before"));

        // Stored photo bytes match the uploaded image
        var loaded = emergencyService.readable(assignedActor, bookingId);
        assertArrayEquals(DUMMY_PHOTO, loaded.getBeforePhoto());
    }

    @Test
    @DisplayName("After Photo: Mandatory for completion, records photoEndAt, enables side-by-side comparison, and releases partner upon completion")
    void afterPhoto_MandatoryForCompletionWithSideBySideEvidence() {
        String city = "AfterPhotoCity-" + UUID.randomUUID().toString().substring(0, 6);
        MaintenanceHub hub = createTestHub(city, "Central", 48.7, 11.7);
        MaintenancePartner partner = createPartner("Partner Walter", hub.getId(), "Electrical", primaryUserId);
        EmergencyMaintenanceBooking b = createAcceptedBooking(partner, hub);

        Actor assignedActor = workerActor(primaryUserId, "Partner Walter");
        Actor intruderActor = workerActor(intruderUserId, "Intruder Worker");
        final Long bookingId = b.getId();

        // 1. Progress to IN_PROGRESS: Accepted -> Reached -> Before Photo -> Start Work
        emergencyService.transition(assignedActor, bookingId, "REACHED");
        emergencyService.photo(assignedActor, bookingId, "before", DUMMY_PHOTO);
        emergencyService.transition(assignedActor, bookingId, "START");

        // 2. Cannot complete without uploading After Photo (mandatory enforcement)
        ResponseStatusException completeEx = assertThrows(ResponseStatusException.class, () ->
                emergencyService.transition(assignedActor, bookingId, "COMPLETE")
        );
        assertEquals(409, completeEx.getStatusCode().value());
        assertTrue(completeEx.getReason().contains("after photo"));

        // 3. Reject empty/null after photo
        ResponseStatusException emptyEx = assertThrows(ResponseStatusException.class, () ->
                emergencyService.photo(assignedActor, bookingId, "after", new byte[0])
        );
        assertEquals(400, emptyEx.getStatusCode().value());

        // 4. Reject unauthorized worker uploading after photo
        ResponseStatusException authEx = assertThrows(ResponseStatusException.class, () ->
                emergencyService.photo(intruderActor, bookingId, "after", DUMMY_PHOTO)
        );
        assertEquals(403, authEx.getStatusCode().value());

        // 5. Upload valid After Photo
        byte[] AFTER_PHOTO_BYTES = java.util.Arrays.copyOf(DUMMY_PHOTO, DUMMY_PHOTO.length);
        AFTER_PHOTO_BYTES[5] = (byte) 0x99; // small differentiator
        emergencyService.photo(assignedActor, bookingId, "after", AFTER_PHOTO_BYTES);

        EmergencyMaintenanceBooking afterBooking = bookingRepo.findById(bookingId).orElseThrow();
        assertEquals("IN_PROGRESS", afterBooking.getJobStatus());
        assertNotNull(afterBooking.getPhotoEndAt());
        assertNotNull(afterBooking.getAfterPhotoUrl());
        assertTrue(afterBooking.getAfterPhotoUrl().contains("/api/maintenance/dispatch/bookings/" + bookingId + "/photos/after"));
        assertTrue(afterBooking.getAssignmentAuditLog().contains("AFTER_PHOTO_UPLOADED"));
        assertTrue(afterBooking.getAssignmentAuditLog().contains("completion evidence documented"));

        // 6. View provides both Before and After photos for side-by-side evidence comparison
        var view = emergencyService.view(assignedActor, afterBooking);
        assertEquals(true, view.get("hasBeforePhoto"));
        assertEquals(true, view.get("hasAfterPhoto"));
        assertNotNull(view.get("beforePhotoUrl"));
        assertNotNull(view.get("afterPhotoUrl"));
        assertNotNull(view.get("photoStartAt"));
        assertNotNull(view.get("photoEndAt"));
        assertNotNull(view.get("photoCompletedAt"));

        // Both photos are readable by assigned actor
        var loadedAfter = emergencyService.readable(assignedActor, bookingId);
        assertArrayEquals(DUMMY_PHOTO, loadedAfter.getBeforePhoto());
        assertArrayEquals(AFTER_PHOTO_BYTES, loadedAfter.getAfterPhoto());

        // 7. Now completion succeeds
        emergencyService.transition(assignedActor, bookingId, "COMPLETE");

        EmergencyMaintenanceBooking completedBooking = bookingRepo.findById(bookingId).orElseThrow();
        assertEquals("COMPLETED", completedBooking.getJobStatus());
        assertNotNull(completedBooking.getCompletedAt());
        assertNotNull(completedBooking.getReviewRequestedAt());
        assertTrue(completedBooking.getAssignmentAuditLog().contains("COMPLETED"));

        // Partner is released to IDLE
        MaintenancePartner updatedPartner = partnerRepo.findById(partner.getId()).orElseThrow();
        assertEquals("IDLE", updatedPartner.getAvailability());
        assertEquals("IDLE", updatedPartner.getWorkState());
    }

    @Test
    @DisplayName("Complete Job: Enforces all completion prerequisites, stamps completedAt, releases partner to IDLE, and marks emergency work inactive")
    void completeJob_EnforcesPrerequisites_SetsCompleted_StoresTimestamp_ReleasesPartner_MarksInactive() {
        String city = "CompleteJobCity-" + UUID.randomUUID().toString().substring(0, 6);
        MaintenanceHub hub = createTestHub(city, "Central", 48.8, 11.8);
        MaintenancePartner partner = createPartner("Partner Bruce", hub.getId(), "Plumbing", primaryUserId);
        EmergencyMaintenanceBooking b = createAcceptedBooking(partner, hub);

        Actor assignedActor = workerActor(primaryUserId, "Partner Bruce");
        final Long bookingId = b.getId();

        // 1. Cannot complete from ACCEPTED (not IN_PROGRESS)
        ResponseStatusException exNotStarted = assertThrows(ResponseStatusException.class, () ->
                emergencyService.transition(assignedActor, bookingId, "COMPLETE")
        );
        assertEquals(409, exNotStarted.getStatusCode().value());
        assertTrue(exNotStarted.getReason().contains("requires IN_PROGRESS"));

        // Partner reaches location
        emergencyService.transition(assignedActor, bookingId, "REACHED");

        // 2. Cannot complete from REACHED_LOCATION
        ResponseStatusException exReached = assertThrows(ResponseStatusException.class, () ->
                emergencyService.transition(assignedActor, bookingId, "COMPLETE")
        );
        assertEquals(409, exReached.getStatusCode().value());

        // Partner uploads Before Photo and starts work
        emergencyService.photo(assignedActor, bookingId, "before", DUMMY_PHOTO);
        emergencyService.transition(assignedActor, bookingId, "START");

        EmergencyMaintenanceBooking inProg = bookingRepo.findById(bookingId).orElseThrow();
        assertEquals("IN_PROGRESS", inProg.getJobStatus());
        var inProgView = emergencyService.view(assignedActor, inProg);
        assertEquals(true, inProgView.get("active"));
        assertEquals(true, inProgView.get("isActiveEmergency"));

        // 3. Cannot complete without After Photo
        ResponseStatusException exNoAfter = assertThrows(ResponseStatusException.class, () ->
                emergencyService.transition(assignedActor, bookingId, "COMPLETE")
        );
        assertEquals(409, exNoAfter.getStatusCode().value());
        assertTrue(exNoAfter.getReason().contains("after photo"));

        // 4. Upload valid After Photo
        byte[] afterBytes = java.util.Arrays.copyOf(DUMMY_PHOTO, DUMMY_PHOTO.length);
        afterBytes[3] = (byte) 0x77;
        emergencyService.photo(assignedActor, bookingId, "after", afterBytes);

        // 5. Complete job with completion notes
        String completionNotes = "Replaced faulty valve, soldered copper joint, and verified zero leakage under operating pressure.";
        emergencyService.transition(assignedActor, bookingId, "COMPLETE", null, null, completionNotes);

        // 6. Verify Completed state & completion timestamp
        EmergencyMaintenanceBooking completed = bookingRepo.findById(bookingId).orElseThrow();
        assertEquals("COMPLETED", completed.getJobStatus());
        assertNotNull(completed.getCompletedAt());
        assertEquals(completionNotes, completed.getCompletionNotes());
        assertNotNull(completed.getReviewRequestedAt());
        assertTrue(completed.getAssignmentAuditLog().contains("COMPLETED"));
        assertTrue(completed.getAssignmentAuditLog().contains(completionNotes));

        // 7. Verify partner returned to available/idle state
        MaintenancePartner releasedPartner = partnerRepo.findById(partner.getId()).orElseThrow();
        assertEquals("IDLE", releasedPartner.getAvailability());
        assertEquals("IDLE", releasedPartner.getWorkState());

        // 8. Verify booking is no longer treated as active emergency work
        var completedView = emergencyService.view(assignedActor, completed);
        assertEquals(false, completedView.get("active"));
        assertEquals(false, completedView.get("isActiveEmergency"));
        assertEquals("COMPLETED", completedView.get("jobStatus"));
        assertEquals("COMPLETED", completedView.get("lifecycleStatus"));
        assertEquals(completionNotes, completedView.get("completionNotes"));
        assertEquals(completed.getCompletedAt(), completedView.get("completedAt"));
    }

    @Test
    @DisplayName("Customer Confirmation & Approval: Clean integration using existing customer sign-off without unneeded OTP/signature systems")
    void customerConfirmation_CleanIntegrationWithExistingSignOff() {
        String city = "ConfirmCity-" + UUID.randomUUID().toString().substring(0, 6);
        MaintenanceHub hub = createTestHub(city, "Central", 48.9, 11.9);
        MaintenancePartner partner = createPartner("Partner Clark", hub.getId(), "Electrical", primaryUserId);
        EmergencyMaintenanceBooking b = createAcceptedBooking(partner, hub);

        Actor assignedActor = workerActor(primaryUserId, "Partner Clark");
        Actor customerActor = new EmergencyMaintenanceService.Actor(b.getRequesterId(), "smartsociety", "test-tenant", b.getRequesterName(), false, false);
        Actor otherCustomerActor = new EmergencyMaintenanceService.Actor(99999L, "smartsociety", "test-tenant", "Other Resident", false, false);
        final Long bookingId = b.getId();

        // Advance: Accepted -> Reached -> Before Photo -> Start Work -> After Photo -> Complete
        emergencyService.transition(assignedActor, bookingId, "REACHED");

        // 1. Customer cannot confirm prior to job completion
        ResponseStatusException exEarly = assertThrows(ResponseStatusException.class, () ->
                emergencyService.confirm(customerActor, bookingId, "Looks good")
        );
        assertEquals(409, exEarly.getStatusCode().value());

        emergencyService.photo(assignedActor, bookingId, "before", DUMMY_PHOTO);
        emergencyService.transition(assignedActor, bookingId, "START");
        emergencyService.photo(assignedActor, bookingId, "after", DUMMY_PHOTO);
        emergencyService.transition(assignedActor, bookingId, "COMPLETE");

        // 2. Unauthorized customer cannot confirm booking
        ResponseStatusException exUnauth = assertThrows(ResponseStatusException.class, () ->
                emergencyService.confirm(otherCustomerActor, bookingId, "Unauthorized approval")
        );
        assertEquals(403, exUnauth.getStatusCode().value());

        // 3. Authorized customer confirms service completion
        emergencyService.confirm(customerActor, bookingId, "Work verified and power restored safely");

        EmergencyMaintenanceBooking confirmedBooking = bookingRepo.findById(bookingId).orElseThrow();
        assertNotNull(confirmedBooking.getCustomerSignedOffAt());
        assertTrue(confirmedBooking.getAssignmentAuditLog().contains("CUSTOMER_CONFIRMED"));
        assertTrue(confirmedBooking.getAssignmentAuditLog().contains("power restored safely"));

        // View exposes customer confirmation flags
        var view = emergencyService.view(customerActor, confirmedBooking);
        assertEquals(true, view.get("customerConfirmed"));
        assertEquals(true, view.get("isCustomerConfirmed"));
        assertEquals(true, view.get("serviceCompletionApproved"));
        assertNotNull(view.get("customerSignedOffAt"));

        // 4. Duplicate confirmation rejected
        ResponseStatusException exDup = assertThrows(ResponseStatusException.class, () ->
                emergencyService.confirm(customerActor, bookingId, "Second confirmation")
        );
        assertEquals(409, exDup.getStatusCode().value());

        // 5. Customer review also integrates with sign-off & rating (1-5)
        emergencyService.review(customerActor, bookingId, 5, "Outstanding and prompt emergency service!");
        EmergencyMaintenanceBooking reviewedBooking = bookingRepo.findById(bookingId).orElseThrow();
        assertEquals(5, reviewedBooking.getRating());
        assertEquals("Outstanding and prompt emergency service!", reviewedBooking.getReview());
        assertTrue(reviewedBooking.getAssignmentAuditLog().contains("CUSTOMER_SIGNED_OFF"));
    }

    @Test
    @DisplayName("Step 10 Lifecycle Enforcement: Strict backend enforcement of valid sequence and prevention of invalid skips or re-activation")
    void lifecycleEnforcement_StrictSequenceAndNoReactivation() {
        String city = "LifecycleEnforce-" + UUID.randomUUID().toString().substring(0, 6);
        MaintenanceHub hub = createTestHub(city, "Central", 32.5, 74.5);
        MaintenancePartner partner = createPartner("Partner StateMachine", hub.getId(), "Plumbing", primaryUserId);
        EmergencyMaintenanceBooking b = createAcceptedBooking(partner, hub);

        Actor assignedActor = workerActor(primaryUserId, "Partner StateMachine");
        final Long bookingId = b.getId();

        // 1. Current state: ACCEPTED
        assertEquals("ACCEPTED", b.getJobStatus());

        // Invalid: Accepted -> Completed (must be prevented)
        ResponseStatusException exAcceptedToComplete = assertThrows(ResponseStatusException.class, () ->
                emergencyService.transition(assignedActor, bookingId, "COMPLETE")
        );
        assertEquals(409, exAcceptedToComplete.getStatusCode().value());

        // Invalid: Accepted -> In Progress without reaching location (must be prevented)
        ResponseStatusException exAcceptedToStart = assertThrows(ResponseStatusException.class, () ->
                emergencyService.transition(assignedActor, bookingId, "START")
        );
        assertEquals(409, exAcceptedToStart.getStatusCode().value());

        // Valid transition: Accepted -> Reached Location
        emergencyService.transition(assignedActor, bookingId, "REACHED");
        EmergencyMaintenanceBooking reachedBooking = bookingRepo.findById(bookingId).orElseThrow();
        assertEquals("REACHED_LOCATION", reachedBooking.getJobStatus());

        // Invalid: Reached Location -> In Progress without Before Photo (must be prevented)
        ResponseStatusException exReachedToStart = assertThrows(ResponseStatusException.class, () ->
                emergencyService.transition(assignedActor, bookingId, "START")
        );
        assertEquals(409, exReachedToStart.getStatusCode().value());

        // Invalid: Reached Location -> Completed (must be prevented)
        ResponseStatusException exReachedToComplete = assertThrows(ResponseStatusException.class, () ->
                emergencyService.transition(assignedActor, bookingId, "COMPLETE")
        );
        assertEquals(409, exReachedToComplete.getStatusCode().value());

        // Valid transition: Upload Before Photo -> PHOTO_START
        emergencyService.photo(assignedActor, bookingId, "before", DUMMY_PHOTO);
        EmergencyMaintenanceBooking photoBooking = bookingRepo.findById(bookingId).orElseThrow();
        assertEquals("PHOTO_START", photoBooking.getJobStatus());

        // Invalid: PHOTO_START -> Completed without In Progress (must be prevented)
        ResponseStatusException exPhotoToComplete = assertThrows(ResponseStatusException.class, () ->
                emergencyService.transition(assignedActor, bookingId, "COMPLETE")
        );
        assertEquals(409, exPhotoToComplete.getStatusCode().value());

        // Valid transition: Start Work -> IN_PROGRESS
        emergencyService.transition(assignedActor, bookingId, "START");
        EmergencyMaintenanceBooking inProgBooking = bookingRepo.findById(bookingId).orElseThrow();
        assertEquals("IN_PROGRESS", inProgBooking.getJobStatus());

        // Invalid: In Progress -> Completed without After Photo (must be prevented)
        ResponseStatusException exInProgWithoutAfter = assertThrows(ResponseStatusException.class, () ->
                emergencyService.transition(assignedActor, bookingId, "COMPLETE")
        );
        assertEquals(409, exInProgWithoutAfter.getStatusCode().value());

        // Upload After Photo
        emergencyService.photo(assignedActor, bookingId, "after", DUMMY_PHOTO);

        // Valid transition: Complete Job
        emergencyService.transition(assignedActor, bookingId, "COMPLETE", null, null, "All leakages fixed and tested under pressure.");
        EmergencyMaintenanceBooking completedBooking = bookingRepo.findById(bookingId).orElseThrow();
        assertEquals("COMPLETED", completedBooking.getJobStatus());
        assertNotNull(completedBooking.getCompletedAt());

        // Invalid: Completed -> In Progress (Completed job should not casually return to an active state)
        ResponseStatusException exCompletedToStart = assertThrows(ResponseStatusException.class, () ->
                emergencyService.transition(assignedActor, bookingId, "START")
        );
        assertEquals(409, exCompletedToStart.getStatusCode().value());
        assertTrue(exCompletedToStart.getReason().contains("completed or cancelled job cannot return to an active state"));

        // Invalid: Completed -> Reached Location
        ResponseStatusException exCompletedToReached = assertThrows(ResponseStatusException.class, () ->
                emergencyService.transition(assignedActor, bookingId, "REACHED")
        );
        assertEquals(409, exCompletedToReached.getStatusCode().value());
        assertTrue(exCompletedToReached.getReason().contains("completed or cancelled job cannot return to an active state"));

        // Invalid: Completed -> Complete again
        ResponseStatusException exCompletedToComplete = assertThrows(ResponseStatusException.class, () ->
                emergencyService.transition(assignedActor, bookingId, "COMPLETE")
        );
        assertEquals(409, exCompletedToComplete.getStatusCode().value());
        assertTrue(exCompletedToComplete.getReason().contains("completed or cancelled job cannot return to an active state"));

        // Invalid: Photo upload on Completed job
        ResponseStatusException exCompletedPhoto = assertThrows(ResponseStatusException.class, () ->
                emergencyService.photo(assignedActor, bookingId, "before", DUMMY_PHOTO)
        );
        assertEquals(409, exCompletedPhoto.getStatusCode().value());
        assertTrue(exCompletedPhoto.getReason().contains("cannot receive photo updates"));

        // Verify partner released and booking inactive
        MaintenancePartner p = partnerRepo.findById(partner.getId()).orElseThrow();
        assertEquals("IDLE", p.getAvailability());
        assertEquals("IDLE", p.getWorkState());

        var finalView = emergencyService.view(assignedActor, completedBooking);
        assertEquals(false, finalView.get("active"));
        assertEquals(false, finalView.get("isActiveEmergency"));
    }

    @Test
    @DisplayName("Step 11 Lifecycle Timeline: Chronological timestamps recorded for Accepted, Reached, Before Photo, In Progress, and Completed with audit persistence")
    void lifecycleTimeline_RecordsAllMilestoneTimestampsAndAuditHistory() {
        String city = "TimelineCity-" + UUID.randomUUID().toString().substring(0, 6);
        MaintenanceHub hub = createTestHub(city, "Central", 12.97, 77.59);
        MaintenancePartner partner = createPartner("Partner Chrono", hub.getId(), "Plumbing", primaryUserId);
        EmergencyMaintenanceBooking b = createAcceptedBooking(partner, hub);

        Actor assignedActor = workerActor(primaryUserId, "Partner Chrono");
        final Long bookingId = b.getId();

        // 1. Accepted milestone
        assertNotNull(b.getAcceptedAt(), "Accepted timestamp must be recorded upon acceptance");
        LocalDateTime tAccepted = b.getAcceptedAt();

        // 2. Reached Location milestone
        emergencyService.transition(assignedActor, bookingId, "REACHED");
        EmergencyMaintenanceBooking reachedBooking = bookingRepo.findById(bookingId).orElseThrow();
        assertNotNull(reachedBooking.getReachedAt(), "Reached Location timestamp must be recorded");
        LocalDateTime tReached = reachedBooking.getReachedAt();
        assertTrue(!tReached.isBefore(tAccepted), "Reached timestamp must be >= accepted timestamp");

        // 3. Before Photo milestone
        emergencyService.photo(assignedActor, bookingId, "before", DUMMY_PHOTO);
        EmergencyMaintenanceBooking photoBooking = bookingRepo.findById(bookingId).orElseThrow();
        assertNotNull(photoBooking.getPhotoStartAt(), "Before Photo timestamp must be recorded");
        LocalDateTime tPhoto = photoBooking.getPhotoStartAt();
        assertTrue(!tPhoto.isBefore(tReached), "Before photo timestamp must be >= reached timestamp");

        // 4. In Progress milestone
        emergencyService.transition(assignedActor, bookingId, "START");
        EmergencyMaintenanceBooking startedBooking = bookingRepo.findById(bookingId).orElseThrow();
        assertNotNull(startedBooking.getStartedAt(), "In Progress timestamp must be recorded");
        LocalDateTime tStarted = startedBooking.getStartedAt();
        assertTrue(!tStarted.isBefore(tPhoto), "Started timestamp must be >= before photo timestamp");

        // Upload After Photo & Complete
        emergencyService.photo(assignedActor, bookingId, "after", DUMMY_PHOTO);
        emergencyService.transition(assignedActor, bookingId, "COMPLETE", null, null, "All operational steps finalized.");
        EmergencyMaintenanceBooking completedBooking = bookingRepo.findById(bookingId).orElseThrow();
        assertNotNull(completedBooking.getCompletedAt(), "Completed timestamp must be recorded");
        LocalDateTime tCompleted = completedBooking.getCompletedAt();
        assertTrue(!tCompleted.isBefore(tStarted), "Completed timestamp must be >= started timestamp");

        // Verify view exposes all 5 milestone timestamps matching the persisted entity
        var view = emergencyService.view(assignedActor, completedBooking);
        assertEquals(completedBooking.getAcceptedAt(), view.get("acceptedAt"));
        assertEquals(completedBooking.getReachedAt(), view.get("reachedAt"));
        assertEquals(completedBooking.getPhotoStartAt(), view.get("photoStartAt"));
        assertEquals(completedBooking.getPhotoStartAt(), view.get("beforePhotoAt"));
        assertEquals(completedBooking.getStartedAt(), view.get("startedAt"));
        assertEquals(completedBooking.getStartedAt(), view.get("inProgressAt"));
        assertEquals(completedBooking.getCompletedAt(), view.get("completedAt"));

        // Verify timelineSummary map
        @SuppressWarnings("unchecked")
        Map<String, Object> summary = (Map<String, Object>) view.get("timelineSummary");
        assertNotNull(summary, "timelineSummary must be present");
        assertEquals(completedBooking.getAcceptedAt(), summary.get("accepted"));
        assertEquals(completedBooking.getReachedAt(), summary.get("reachedLocation"));
        assertEquals(completedBooking.getPhotoStartAt(), summary.get("beforePhoto"));
        assertEquals(completedBooking.getStartedAt(), summary.get("inProgress"));
        assertEquals(completedBooking.getCompletedAt(), summary.get("completed"));

        // Verify timeline list contains all 5 required stages
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> timeline = (List<Map<String, Object>>) view.get("timeline");
        assertNotNull(timeline);
        assertTrue(timeline.size() >= 5);

        Map<String, Object> sAccepted = timeline.stream().filter(m -> "ACCEPTED".equals(m.get("stage"))).findFirst().orElseThrow();
        assertEquals("Accepted", sAccepted.get("title"));
        assertEquals(true, sAccepted.get("completed"));
        assertNotNull(sAccepted.get("timestamp"));
        assertNotNull(sAccepted.get("formattedTime"));

        Map<String, Object> sReached = timeline.stream().filter(m -> "REACHED_LOCATION".equals(m.get("stage"))).findFirst().orElseThrow();
        assertEquals("Reached Location", sReached.get("title"));
        assertEquals(true, sReached.get("completed"));
        assertNotNull(sReached.get("timestamp"));

        Map<String, Object> sBefore = timeline.stream().filter(m -> "BEFORE_PHOTO".equals(m.get("stage"))).findFirst().orElseThrow();
        assertEquals("Before Photo", sBefore.get("title"));
        assertEquals(true, sBefore.get("completed"));
        assertNotNull(sBefore.get("timestamp"));

        Map<String, Object> sInProg = timeline.stream().filter(m -> "IN_PROGRESS".equals(m.get("stage"))).findFirst().orElseThrow();
        assertEquals("In Progress", sInProg.get("title"));
        assertEquals(true, sInProg.get("completed"));
        assertNotNull(sInProg.get("timestamp"));

        Map<String, Object> sComplete = timeline.stream().filter(m -> "COMPLETED".equals(m.get("stage"))).findFirst().orElseThrow();
        assertEquals("Completed", sComplete.get("title"));
        assertEquals(true, sComplete.get("completed"));
        assertNotNull(sComplete.get("timestamp"));

        // Verify dedicated timeline API endpoint service method
        List<Map<String, Object>> dedicatedTimeline = emergencyService.timeline(assignedActor, bookingId);
        assertEquals(timeline.size(), dedicatedTimeline.size());

        // Verify audit history includes all lifecycle actions
        List<Map<String, Object>> history = emergencyService.history(assignedActor, bookingId);
        assertFalse(history.isEmpty());
        List<String> actions = history.stream().map(h -> (String) h.get("action")).toList();
        assertTrue(actions.contains("ACCEPTED"));
        assertTrue(actions.contains("REACHED_LOCATION"));
        assertTrue(actions.contains("BEFORE_PHOTO_UPLOADED"));
        assertTrue(actions.contains("IN_PROGRESS"));
        assertTrue(actions.contains("AFTER_PHOTO_UPLOADED"));
        assertTrue(actions.contains("COMPLETED"));
    }

    @Test
    @DisplayName("Step 12 Customer Review Trigger: Automatically prepares review request referencing emergency booking across channels (In-App, SMS, WhatsApp, Push)")
    void customerReviewTrigger_PreparesMultiChannelNotificationUponCompletion() {
        String city = "ReviewCity-" + UUID.randomUUID().toString().substring(0, 6);
        MaintenanceHub hub = createTestHub(city, "Central", 19.07, 72.87);
        MaintenancePartner partner = createPartner("Partner Rev", hub.getId(), "Electrical", primaryUserId);
        EmergencyMaintenanceBooking b = createAcceptedBooking(partner, hub);

        Actor assignedActor = workerActor(primaryUserId, "Partner Rev");
        final Long bookingId = b.getId();
        final String bookingRef = b.getBookingReference();

        // Advance booking: Accepted -> Reached -> Before Photo -> Start Work -> After Photo -> Complete
        emergencyService.transition(assignedActor, bookingId, "REACHED");
        emergencyService.photo(assignedActor, bookingId, "before", DUMMY_PHOTO);
        emergencyService.transition(assignedActor, bookingId, "START");
        emergencyService.photo(assignedActor, bookingId, "after", DUMMY_PHOTO);

        // Before completion, review request should not be prepared
        EmergencyMaintenanceBooking preComplete = bookingRepo.findById(bookingId).orElseThrow();
        assertNull(preComplete.getReviewRequestedAt());

        // Complete the emergency maintenance job
        emergencyService.transition(assignedActor, bookingId, "COMPLETE", null, null, "Electrical repair complete and verified.");

        // 1. Verify booking state after completion
        EmergencyMaintenanceBooking completed = bookingRepo.findById(bookingId).orElseThrow();
        assertEquals("COMPLETED", completed.getJobStatus());
        assertNotNull(completed.getCompletedAt());
        assertNotNull(completed.getReviewRequestedAt(), "Review requested timestamp must be set upon completion");
        assertNotNull(completed.getCustomerReviewUrl(), "Customer review URL must be generated");
        assertTrue(completed.getCustomerReviewUrl().contains("/api/maintenance/dispatch/bookings/" + bookingId + "/review"));

        // 2. Verify multi-channel notification state & channels
        assertEquals("IN_APP,SMS,WHATSAPP,PUSH", completed.getReviewNotificationChannels());
        assertEquals("PREPARED", completed.getReviewNotificationStatus());
        assertNotNull(completed.getReviewRequestPayload(), "Review request payload must be prepared for consumers");
        assertTrue(completed.getReviewRequestPayload().contains(bookingRef != null ? bookingRef : String.valueOf(bookingId)),
                "Review request payload must reference the completed emergency booking");
        assertTrue(completed.getReviewRequestPayload().contains("Electrical"));
        assertTrue(completed.getReviewRequestPayload().contains("IN_APP"));
        assertTrue(completed.getReviewRequestPayload().contains("SMS"));
        assertTrue(completed.getReviewRequestPayload().contains("WHATSAPP"));
        assertTrue(completed.getReviewRequestPayload().contains("PUSH"));

        // 3. Verify in-app notification delivered via existing Notification system
        List<Notification> inAppNotifs = notificationRepo.findAll().stream()
                .filter(n -> "REVIEW_REQUEST".equals(n.getType()))
                .filter(n -> n.getMessage() != null && n.getMessage().contains(bookingRef != null ? bookingRef : ("EMG-" + String.format(Locale.ROOT, "%05d", bookingId))))
                .toList();
        assertFalse(inAppNotifs.isEmpty(), "An in-app notification referencing the booking must be saved in existing notification table");
        Notification notif = inAppNotifs.get(0);
        assertEquals(completed.getRequesterId(), notif.getUserId());
        assertTrue(notif.getTitle().contains("Rate Service"));

        // 4. Verify review-request API endpoint details
        var reviewDetails = emergencyService.reviewRequest(assignedActor, bookingId);
        assertEquals(bookingId, reviewDetails.get("bookingId"));
        assertEquals("PREPARED", reviewDetails.get("status"));
        assertNotNull(reviewDetails.get("reviewRequestedAt"));
        assertNotNull(reviewDetails.get("customerReviewUrl"));
        @SuppressWarnings("unchecked")
        List<String> channels = (List<String>) reviewDetails.get("channels");
        assertTrue(channels.containsAll(List.of("IN_APP", "SMS", "WHATSAPP", "PUSH")));

        // 5. Verify pending review notifications queue for external integrations
        List<Map<String, Object>> pending = emergencyService.pendingReviewNotifications(adminActor());
        assertFalse(pending.isEmpty());
        assertTrue(pending.stream().anyMatch(p -> bookingId.equals(p.get("bookingId"))));

        // 6. Verify audit history records REVIEW_REQUEST_PREPARED
        List<Map<String, Object>> history = emergencyService.history(assignedActor, bookingId);
        List<String> actions = history.stream().map(h -> (String) h.get("action")).toList();
        assertTrue(actions.contains("REVIEW_REQUEST_PREPARED"));

        // 7. Verify view exposes review notification details
        var view = emergencyService.view(assignedActor, completed);
        assertEquals("PREPARED", view.get("reviewNotificationStatus"));
        assertEquals(true, view.get("reviewNotificationPrepared"));
        assertEquals("IN_APP,SMS,WHATSAPP,PUSH", view.get("reviewNotificationChannels"));
    }

    @Test
    @DisplayName("Stage 4 Complete Testing Checklist: All 10 operational lifecycle and isolation requirements")
    void stage4Testing_CompleteVerificationChecklist() {
        String city = "ChecklistCity-" + UUID.randomUUID().toString().substring(0, 6);
        MaintenanceHub hub = createTestHub(city, "North Hub", 13.08, 80.27);
        MaintenancePartner partner = createPartner("Partner TestCheck", hub.getId(), "Plumbing", primaryUserId);
        EmergencyMaintenanceBooking b = createAcceptedBooking(partner, hub);

        Actor assignedActor = workerActor(primaryUserId, "Partner TestCheck");
        final Long bookingId = b.getId();

        // 10. Existing normal maintenance tickets remain unaffected (Setup regular ticket before emergency workflow)
        CommonMaintenanceTicket normalTicket = new CommonMaintenanceTicket();
        normalTicket.setTenantId("test-tenant");
        normalTicket.setSourcePlatform("smartsociety");
        normalTicket.setRequesterId(99002L);
        normalTicket.setRequesterName("Routine Resident");
        normalTicket.setRequesterPhone("9112233445");
        normalTicket.setServiceAddress("Apt 402, Block C");
        normalTicket.setCity(city);
        normalTicket.setServiceType("Plumbing");
        normalTicket.setPriority("LOW");
        normalTicket.setTitle("Dripping Balcony Tap");
        normalTicket.setDescription("Small drip on balcony outdoor tap, non-emergency");
        normalTicket.setTicketStatus("REQUESTED");
        normalTicket.setTargetEntityType("GENERAL");
        normalTicket = ticketRepo.save(normalTicket);
        final Long normalTicketId = normalTicket.getId();

        // 1. Accepted -> Reached works
        assertEquals("ACCEPTED", b.getJobStatus());
        emergencyService.transition(assignedActor, bookingId, "REACHED");
        EmergencyMaintenanceBooking reachedBooking = bookingRepo.findById(bookingId).orElseThrow();
        assertEquals("REACHED_LOCATION", reachedBooking.getJobStatus());
        assertNotNull(reachedBooking.getReachedAt(), "Reached Location timestamp must be recorded");

        // 3. In Progress without Before Photo is rejected
        ResponseStatusException exStartWithoutPhoto = assertThrows(ResponseStatusException.class, () ->
                emergencyService.transition(assignedActor, bookingId, "START")
        );
        assertEquals(409, exStartWithoutPhoto.getStatusCode().value(), "Starting work without Before Photo must return HTTP 409");

        // 2 & 4. Reached -> Before Photo works & Before Photo upload works
        emergencyService.photo(assignedActor, bookingId, "before", DUMMY_PHOTO);
        EmergencyMaintenanceBooking photoBooking = bookingRepo.findById(bookingId).orElseThrow();
        assertEquals("PHOTO_START", photoBooking.getJobStatus());
        assertNotNull(photoBooking.getPhotoStartAt(), "Before Photo timestamp must be recorded");
        assertNotNull(photoBooking.getBeforePhoto(), "Before Photo binary data must be persisted");
        var photoView = emergencyService.view(assignedActor, photoBooking);
        assertEquals(true, photoView.get("hasBeforePhoto"), "hasBeforePhoto flag must be true in view");
        assertNotNull(photoView.get("beforePhotoUrl"), "beforePhotoUrl must be generated");

        // 5. Start Work after photo works
        emergencyService.transition(assignedActor, bookingId, "START");
        EmergencyMaintenanceBooking startedBooking = bookingRepo.findById(bookingId).orElseThrow();
        assertEquals("IN_PROGRESS", startedBooking.getJobStatus());
        assertNotNull(startedBooking.getStartedAt(), "Work start timestamp must be recorded");

        // 6. Complete without required evidence is rejected (missing After Photo)
        ResponseStatusException exCompleteWithoutAfter = assertThrows(ResponseStatusException.class, () ->
                emergencyService.transition(assignedActor, bookingId, "COMPLETE")
        );
        assertEquals(409, exCompleteWithoutAfter.getStatusCode().value(), "Completion without After Photo must return HTTP 409");
        assertTrue(exCompleteWithoutAfter.getReason().toLowerCase(Locale.ROOT).contains("after photo"));

        // 7. After Photo works
        byte[] afterPhotoBytes = new byte[] { (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0B };
        emergencyService.photo(assignedActor, bookingId, "after", afterPhotoBytes);
        EmergencyMaintenanceBooking afterBooking = bookingRepo.findById(bookingId).orElseThrow();
        assertNotNull(afterBooking.getAfterPhoto(), "After Photo binary data must be persisted");
        assertNotNull(afterBooking.getPhotoEndAt(), "After Photo timestamp must be recorded");
        var afterView = emergencyService.view(assignedActor, afterBooking);
        assertEquals(true, afterView.get("hasAfterPhoto"), "hasAfterPhoto flag must be true in view");
        assertNotNull(afterView.get("afterPhotoUrl"), "afterPhotoUrl must be generated");

        // Complete the emergency booking
        emergencyService.transition(assignedActor, bookingId, "COMPLETE", null, null, "Leak resolved, verified watertight under pressure.");

        // 8. Completed booking stores timestamps
        EmergencyMaintenanceBooking completedBooking = bookingRepo.findById(bookingId).orElseThrow();
        assertEquals("COMPLETED", completedBooking.getJobStatus());
        assertNotNull(completedBooking.getAcceptedAt(), "acceptedAt timestamp must exist");
        assertNotNull(completedBooking.getReachedAt(), "reachedAt timestamp must exist");
        assertNotNull(completedBooking.getPhotoStartAt(), "photoStartAt (Before Photo) timestamp must exist");
        assertNotNull(completedBooking.getStartedAt(), "startedAt (In Progress) timestamp must exist");
        assertNotNull(completedBooking.getCompletedAt(), "completedAt timestamp must exist");
        assertTrue(!completedBooking.getReachedAt().isBefore(completedBooking.getAcceptedAt()), "reachedAt >= acceptedAt");
        assertTrue(!completedBooking.getPhotoStartAt().isBefore(completedBooking.getReachedAt()), "photoStartAt >= reachedAt");
        assertTrue(!completedBooking.getStartedAt().isBefore(completedBooking.getPhotoStartAt()), "startedAt >= photoStartAt");
        assertTrue(!completedBooking.getCompletedAt().isBefore(completedBooking.getStartedAt()), "completedAt >= startedAt");

        // 9. Partner returns to available state
        MaintenancePartner releasedPartner = partnerRepo.findById(partner.getId()).orElseThrow();
        assertEquals("IDLE", releasedPartner.getAvailability(), "Partner availability must reset to IDLE upon job completion");
        assertEquals("IDLE", releasedPartner.getWorkState(), "Partner workState must reset to IDLE upon job completion");

        // 10. Existing normal maintenance tickets remain unaffected
        CommonMaintenanceTicket reloadedNormalTicket = ticketRepo.findById(normalTicketId).orElseThrow();
        assertEquals("REQUESTED", reloadedNormalTicket.getTicketStatus(), "Normal maintenance ticket status must remain REQUESTED");
        assertEquals("Dripping Balcony Tap", reloadedNormalTicket.getTitle(), "Normal ticket title must remain untouched");
        assertEquals(normalTicket.getCreatedAt().truncatedTo(java.time.temporal.ChronoUnit.MILLIS),
                reloadedNormalTicket.getCreatedAt().truncatedTo(java.time.temporal.ChronoUnit.MILLIS),
                "Normal ticket createdAt must be unchanged");
        assertNull(reloadedNormalTicket.getResolvedAt(), "Normal ticket must not have resolvedAt timestamp");
    }
}
