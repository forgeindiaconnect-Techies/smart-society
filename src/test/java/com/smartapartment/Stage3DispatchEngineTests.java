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
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class Stage3DispatchEngineTests {

    @Autowired private EmergencyMaintenanceService emergencyService;
    @Autowired private EmergencyMaintenanceBookingRepository bookingRepo;
    @Autowired private MaintenancePartnerRepository partnerRepo;
    @Autowired private MaintenanceHubRepository hubRepo;
    @Autowired private AppUserRepository userRepo;

    private Long validUserId;
    private AppUser secondUser;

    @BeforeEach
    void setUp() {
        validUserId = userRepo.findByEmail("superadmin@smartapartment")
                .map(AppUser::getId)
                .orElseGet(() -> {
                    AppUser u = new AppUser();
                    u.setEmail("superadmin@smartapartment");
                    u.setFullName("Platform Super Admin");
                    u.setRole(UserRole.SUPER_ADMIN);
                    u.setTenantId("test-tenant");
                    u.setPasswordHash("$2a$10$dummyhash");
                    u.setAccountLocked(false);
                    return userRepo.save(u).getId();
                });

        secondUser = userRepo.findByEmail("worker2@smartapartment.local")
                .orElseGet(() -> {
                    AppUser u = new AppUser();
                    u.setEmail("worker2@smartapartment.local");
                    u.setFullName("Worker Two");
                    u.setRole(UserRole.MAINTENANCE_STAFF);
                    u.setTenantId("test-tenant");
                    u.setPasswordHash("$2a$10$dummyhash");
                    u.setAccountLocked(false);
                    return userRepo.save(u);
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

    private MaintenancePartner createPartner(String name, Long hubId, String trade, boolean onDuty, String workState, Long userId, double lat, double lon) {
        MaintenancePartner p = new MaintenancePartner();
        p.setName(name);
        p.setHubId(hubId);
        p.setTrade(trade);
        p.setSkillCategories(trade);
        p.setOnDuty(onDuty);
        p.setWorkState(workState);
        p.setAvailability(workState);
        p.setUserId(userId);
        p.setLatitude(lat);
        p.setLongitude(lon);
        p.setLocationUpdatedAt(LocalDateTime.now());
        p.setEmploymentType("THIRD_PARTY");
        return partnerRepo.save(p);
    }

    private EmergencyMaintenanceBooking createBooking(String city, String area, String category, double lat, double lon) {
        EmergencyMaintenanceBooking b = new EmergencyMaintenanceBooking();
        b.setCity(city);
        b.setArea(area);
        b.setCategory(category);
        b.setRequesterName("Customer " + UUID.randomUUID().toString().substring(0, 5));
        b.setRequesterPhone("9988776655");
        b.setServiceAddress("100 Emergency Ave");
        b.setTenantId("test-tenant");
        b.setSourcePlatform("smartsociety");
        b.setLatitude(lat);
        b.setLongitude(lon);
        return bookingRepo.save(b);
    }

    private Actor workerActor(Long userId, String name) {
        return new Actor(userId, "smartsociety", "test-tenant", name, false, true);
    }

    private Actor adminActor() {
        return new Actor(validUserId, "smartsociety", "test-tenant", "Admin", true, false);
    }

    // 1. Correct Trade
    @Test
    @DisplayName("Correct Trade: Plumbing request must not dispatch to electrician")
    void correctTrade_PlumbingRequestMustNotDispatchToElectrician() {
        String city = "TradeCity-" + UUID.randomUUID().toString().substring(0, 6);
        MaintenanceHub hub = createTestHub(city, "North", 12.0, 77.0);

        // Electrician partner exists and is idle & on duty
        MaintenancePartner electrician = createPartner("Electrician Bob", hub.getId(), "Electrical", true, "IDLE", validUserId, 12.01, 77.01);

        // Emergency booking category is Plumbing
        EmergencyMaintenanceBooking booking = createBooking(city, "North", "Plumbing", 12.0, 77.0);

        emergencyService.dispatch(booking);
        booking = bookingRepo.findById(booking.getId()).orElseThrow();

        // Electrician must NOT be selected
        assertNotEquals(electrician.getId(), booking.getPartnerId());
        assertEquals("FAILED_ASSIGNMENT", booking.getJobStatus());
        assertEquals("No partner with matching trade", booking.getDispatchReason());
    }

    // 2. Busy Partner
    @Test
    @DisplayName("Busy Partner: Busy partner should not be selected")
    void busyPartner_BusyPartnerShouldNotBeSelected() {
        String city = "BusyCity-" + UUID.randomUUID().toString().substring(0, 6);
        MaintenanceHub hub = createTestHub(city, "Central", 13.0, 77.0);

        // Plumber exists and is on duty, but currently BUSY
        MaintenancePartner busyPlumber = createPartner("Busy Plumber", hub.getId(), "Plumbing", true, "BUSY", validUserId, 13.01, 77.01);

        EmergencyMaintenanceBooking booking = createBooking(city, "Central", "Plumbing", 13.0, 77.0);

        emergencyService.dispatch(booking);
        booking = bookingRepo.findById(booking.getId()).orElseThrow();

        // Busy partner must NOT be selected
        assertNotEquals(busyPlumber.getId(), booking.getPartnerId());
        assertEquals("FAILED_ASSIGNMENT", booking.getJobStatus());
        assertEquals("All partners busy", booking.getDispatchReason());
    }

    // 3. Off-Duty Partner
    @Test
    @DisplayName("Off-Duty Partner: Should not be selected")
    void offDutyPartner_ShouldNotBeSelected() {
        String city = "DutyCity-" + UUID.randomUUID().toString().substring(0, 6);
        MaintenanceHub hub = createTestHub(city, "East", 14.0, 77.0);

        // Plumber exists, matching trade, IDLE, but is OFF DUTY
        MaintenancePartner offDutyPlumber = createPartner("Off Duty Plumber", hub.getId(), "Plumbing", false, "IDLE", validUserId, 14.01, 77.01);

        EmergencyMaintenanceBooking booking = createBooking(city, "East", "Plumbing", 14.0, 77.0);

        emergencyService.dispatch(booking);
        booking = bookingRepo.findById(booking.getId()).orElseThrow();

        // Off-duty partner must NOT be selected
        assertNotEquals(offDutyPlumber.getId(), booking.getPartnerId());
        assertEquals("FAILED_ASSIGNMENT", booking.getJobStatus());
        assertEquals("No on-duty partners", booking.getDispatchReason());
    }

    // 4. Decline
    @Test
    @DisplayName("Decline: First partner declines -> second eligible partner should receive request")
    void decline_FirstPartnerDeclines_SecondEligiblePartnerShouldReceiveRequest() {
        String city = "DeclineCity-" + UUID.randomUUID().toString().substring(0, 6);
        MaintenanceHub hub = createTestHub(city, "West", 15.0, 77.0);

        // Partner 1: closer (15.01, 77.01)
        MaintenancePartner p1 = createPartner("Closer Plumber", hub.getId(), "Plumbing", true, "IDLE", validUserId, 15.01, 77.01);
        // Partner 2: further (15.05, 77.05)
        MaintenancePartner p2 = createPartner("Further Plumber", hub.getId(), "Plumbing", true, "IDLE", secondUser.getId(), 15.05, 77.05);

        EmergencyMaintenanceBooking booking = createBooking(city, "West", "Plumbing", 15.0, 77.0);
        final Long bookingId = booking.getId();

        emergencyService.dispatch(booking);
        booking = bookingRepo.findById(bookingId).orElseThrow();

        // Partner 1 is offered first
        assertEquals(p1.getId(), booking.getPartnerId());
        assertEquals("OFFERED", booking.getJobStatus());

        // Partner 1 declines
        Actor p1Actor = workerActor(validUserId, "Closer Plumber");
        emergencyService.transition(p1Actor, bookingId, "DECLINE");

        booking = bookingRepo.findById(bookingId).orElseThrow();

        // Second eligible partner should now receive the offer
        assertEquals(p2.getId(), booking.getPartnerId());
        assertEquals("OFFERED", booking.getJobStatus());

        // Partner 1 should NOT receive the offer back
        assertTrue(booking.getDeclinedPartnerIds().contains("," + p1.getId() + ","));
    }

    // 5. Multiple Declines
    @Test
    @DisplayName("Multiple Declines: Continue through eligible pool until exhausted")
    void multipleDeclines_ContinueThroughEligiblePool() {
        String city = "MultiDeclineCity-" + UUID.randomUUID().toString().substring(0, 6);
        MaintenanceHub hub = createTestHub(city, "South", 16.0, 77.0);

        AppUser thirdUser = userRepo.findByEmail("worker3@smartapartment.local").orElseGet(() -> {
            AppUser u = new AppUser();
            u.setEmail("worker3@smartapartment.local");
            u.setFullName("Worker Three");
            u.setRole(UserRole.MAINTENANCE_STAFF);
            u.setTenantId("test-tenant");
            u.setPasswordHash("$2a$10$dummyhash");
            u.setAccountLocked(false);
            return userRepo.save(u);
        });

        MaintenancePartner p1 = createPartner("Plumber 1", hub.getId(), "Plumbing", true, "IDLE", validUserId, 16.01, 77.01);
        MaintenancePartner p2 = createPartner("Plumber 2", hub.getId(), "Plumbing", true, "IDLE", secondUser.getId(), 16.03, 77.03);
        MaintenancePartner p3 = createPartner("Plumber 3", hub.getId(), "Plumbing", true, "IDLE", thirdUser.getId(), 16.05, 77.05);

        EmergencyMaintenanceBooking booking = createBooking(city, "South", "Plumbing", 16.0, 77.0);
        final Long bookingId = booking.getId();

        emergencyService.dispatch(booking);

        // 1st offer -> p1
        booking = bookingRepo.findById(bookingId).orElseThrow();
        assertEquals(p1.getId(), booking.getPartnerId());
        emergencyService.transition(workerActor(validUserId, "Plumber 1"), bookingId, "DECLINE");

        // 2nd offer -> p2
        booking = bookingRepo.findById(bookingId).orElseThrow();
        assertEquals(p2.getId(), booking.getPartnerId());
        emergencyService.transition(workerActor(secondUser.getId(), "Plumber 2"), bookingId, "DECLINE");

        // 3rd offer -> p3
        booking = bookingRepo.findById(bookingId).orElseThrow();
        assertEquals(p3.getId(), booking.getPartnerId());
        emergencyService.transition(workerActor(thirdUser.getId(), "Plumber 3"), bookingId, "DECLINE");

        // Pool exhausted -> FAILED_ASSIGNMENT
        booking = bookingRepo.findById(bookingId).orElseThrow();
        assertEquals("FAILED_ASSIGNMENT", booking.getJobStatus());
        assertEquals("All candidates declined", booking.getDispatchReason());
    }

    // 6. No Partners
    @Test
    @DisplayName("No Partners: Booking enters Failed Assignment / Unassigned state")
    void noPartners_BookingEntersFailedAssignmentUnassignedState() {
        String city = "EmptyCity-" + UUID.randomUUID().toString().substring(0, 6);
        // Create hub with zero registered partners
        createTestHub(city, "EmptyArea", 17.0, 77.0);

        EmergencyMaintenanceBooking booking = createBooking(city, "EmptyArea", "Plumbing", 17.0, 77.0);

        emergencyService.dispatch(booking);
        booking = bookingRepo.findById(booking.getId()).orElseThrow();

        // Enters Failed Assignment state with reason
        assertEquals("FAILED_ASSIGNMENT", booking.getJobStatus());
        assertNull(booking.getPartnerId());
        assertEquals("No partners within service area", booking.getDispatchReason());
    }

    // 7. Manual Assignment
    @Test
    @DisplayName("Manual Assignment: Admin can select an eligible partner")
    void manualAssignment_AdminCanSelectAnEligiblePartner() {
        String city = "ManualCity-" + UUID.randomUUID().toString().substring(0, 6);
        MaintenanceHub hub = createTestHub(city, "AdminArea", 18.0, 77.0);

        MaintenancePartner p = createPartner("Manual Partner", hub.getId(), "Plumbing", true, "IDLE", validUserId, 18.01, 77.01);

        EmergencyMaintenanceBooking booking = createBooking(city, "AdminArea", "Plumbing", 18.0, 77.0);
        booking.setJobStatus("FAILED_ASSIGNMENT");
        booking.setDispatchReason("All candidates declined");
        booking = bookingRepo.save(booking);

        // Admin chooses eligible partner manually
        emergencyService.adminAssignPartner(adminActor(), booking.getId(), p.getId());

        booking = bookingRepo.findById(booking.getId()).orElseThrow();
        assertEquals("ASSIGNED", booking.getJobStatus());
        assertEquals("Manual", booking.getAssignmentType());
        assertEquals("Admin", booking.getAssignedBy());
        assertNotNull(booking.getAssignedAt());
        assertEquals(p.getId(), booking.getPartnerId());

        // Partner work status is marked BUSY
        var updatedPartner = partnerRepo.findById(p.getId()).orElseThrow();
        assertEquals("BUSY", updatedPartner.getWorkState());
    }

    // 8. Double Accept Attempt
    @Test
    @DisplayName("Double Accept Attempt: Only one partner can successfully own booking")
    void doubleAcceptAttempt_OnlyOnePartnerCanSuccessfullyOwnBooking() {
        String city = "DoubleAcceptCity-" + UUID.randomUUID().toString().substring(0, 6);
        MaintenanceHub hub = createTestHub(city, "RaceArea", 19.0, 77.0);

        MaintenancePartner p1 = createPartner("Primary Partner", hub.getId(), "Plumbing", true, "IDLE", validUserId, 19.01, 77.01);
        MaintenancePartner p2 = createPartner("Rival Partner", hub.getId(), "Plumbing", true, "IDLE", secondUser.getId(), 19.02, 77.02);

        EmergencyMaintenanceBooking booking = createBooking(city, "RaceArea", "Plumbing", 19.0, 77.0);
        final Long bookingId = booking.getId();

        emergencyService.dispatch(booking);
        booking = bookingRepo.findById(bookingId).orElseThrow();
        assertEquals(p1.getId(), booking.getPartnerId());

        // 1. Partner 1 accepts -> succeeds
        Actor p1Actor = workerActor(validUserId, "Primary Partner");
        assertDoesNotThrow(() -> emergencyService.transition(p1Actor, bookingId, "ACCEPT"));

        booking = bookingRepo.findById(bookingId).orElseThrow();
        assertEquals("ACCEPTED", booking.getJobStatus());

        // 2. Second acceptance attempt (e.g. Partner 2 or duplicate accept attempt) fails cleanly
        Actor p2Actor = workerActor(secondUser.getId(), "Rival Partner");
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> {
            emergencyService.transition(p2Actor, bookingId, "ACCEPT");
        });
        assertTrue(ex.getStatusCode().value() == 403 || ex.getStatusCode().value() == 409);

        // Even if p1 attempts to accept again, fails with 409
        ResponseStatusException duplicateEx = assertThrows(ResponseStatusException.class, () -> {
            emergencyService.transition(p1Actor, bookingId, "ACCEPT");
        });
        assertEquals(409, duplicateEx.getStatusCode().value());

        // Booking remains exclusively owned by Partner 1
        booking = bookingRepo.findById(bookingId).orElseThrow();
        assertEquals(p1.getId(), booking.getPartnerId());
        assertEquals("ACCEPTED", booking.getJobStatus());
    }

    // 9. Accepted Booking
    @Test
    @DisplayName("Accepted Booking: Partner status and booking status update correctly")
    void acceptedBooking_PartnerStatusAndBookingStatusUpdateCorrectly() {
        String city = "AcceptStatusCity-" + UUID.randomUUID().toString().substring(0, 6);
        MaintenanceHub hub = createTestHub(city, "SuccessArea", 20.0, 77.0);

        MaintenancePartner p = createPartner("Success Partner", hub.getId(), "Plumbing", true, "IDLE", validUserId, 20.01, 77.01);

        EmergencyMaintenanceBooking booking = createBooking(city, "SuccessArea", "Plumbing", 20.0, 77.0);
        final Long bookingId = booking.getId();

        emergencyService.dispatch(booking);
        booking = bookingRepo.findById(bookingId).orElseThrow();

        Actor pActor = workerActor(validUserId, "Success Partner");
        emergencyService.transition(pActor, bookingId, "ACCEPT");

        // 1. Booking status assertions
        booking = bookingRepo.findById(bookingId).orElseThrow();
        assertEquals("ACCEPTED", booking.getJobStatus());
        assertNotNull(booking.getAcceptedAt());
        assertNotNull(booking.getArrivalDueAt());
        assertTrue(booking.getArrivalDueAt().isAfter(booking.getAcceptedAt()));

        // 2. Partner status assertions
        MaintenancePartner updatedPartner = partnerRepo.findById(p.getId()).orElseThrow();
        assertEquals("BUSY", updatedPartner.getWorkState());
        assertEquals("BUSY", updatedPartner.getAvailability());

        // 3. Customer contact details unlocked
        Map<String, Object> view = emergencyService.view(pActor, booking);
        assertEquals(true, view.get("contactUnlocked"));
        assertEquals(true, view.get("canCallCustomer"));
        assertNotNull(view.get("requesterName"));
        assertNotNull(view.get("requesterPhone"));
        assertNotNull(view.get("serviceAddress"));
    }
}
