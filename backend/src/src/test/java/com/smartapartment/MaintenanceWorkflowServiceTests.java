package com.smartapartment;

import com.smartapartment.entity.AppUser;
import com.smartapartment.entity.EmergencyMaintenanceBooking;
import com.smartapartment.entity.MaintenanceHub;
import com.smartapartment.entity.MaintenancePartner;
import com.smartapartment.entity.UserRole;
import com.smartapartment.repository.AppUserRepository;
import com.smartapartment.repository.EmergencyMaintenanceBookingRepository;
import com.smartapartment.repository.MaintenanceHubRepository;
import com.smartapartment.repository.MaintenancePartnerRepository;
import com.smartapartment.service.EmergencyMaintenanceService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
class MaintenanceWorkflowServiceTests {

    @Autowired private EmergencyMaintenanceService service;
    @Autowired private AppUserRepository users;
    @Autowired private MaintenanceHubRepository hubs;
    @Autowired private MaintenancePartnerRepository partners;
    @Autowired private EmergencyMaintenanceBookingRepository bookings;

    @Test
    void immediateAssignmentThreeStageLifecycleAndReviewAreFunctional() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);

        AppUser worker = new AppUser();
        worker.setFullName("Workflow Plumber " + suffix);
        worker.setEmail("workflow-" + suffix + "@example.com");
        worker.setPhone("9000000001");
        worker.setPasswordHash("test-hash");
        worker.setRole(UserRole.MAINTENANCE_STAFF);
        worker.setTenantId("workflow-test");
        worker.setAccountLocked(false);
        worker = users.save(worker);

        MaintenanceHub hub = new MaintenanceHub();
        hub.setTenantId("workflow-test");
        hub.setName("Adyar Workflow Hub " + suffix);
        hub.setCity("Chennai");
        hub.setArea("Adyar-" + suffix);
        hub.setLatitude(13.0067);
        hub.setLongitude(80.2574);
        hub.setRadiusKm(15.0);
        hub.setActive(true);
        hub.setStatus("ACTIVE");
        hub = hubs.save(hub);

        MaintenancePartner partner = new MaintenancePartner();
        partner.setTenantId("workflow-test");
        partner.setUserId(worker.getId());
        partner.setName(worker.getFullName());
        partner.setPhone(worker.getPhone());
        partner.setHubId(hub.getId());
        partner.setTrade("Plumbing");
        partner.setSkillCategories("Plumbing");
        partner.setOnDuty(true);
        partner.setWorkState("IDLE");
        partner.setAvailability("IDLE");
        partner.setEmploymentType("INTERNAL");
        partner.setLatitude(13.0068);
        partner.setLongitude(80.2575);
        partner.setLocationUpdatedAt(LocalDateTime.now());
        partner = partners.save(partner);

        EmergencyMaintenanceService.Actor resident = new EmergencyMaintenanceService.Actor(
                991001L, "smartsociety", "workflow-test", "Workflow Resident", false, false);
        EmergencyMaintenanceService.BookingInput input = new EmergencyMaintenanceService.BookingInput(
                "9876543210", "Tower A - Flat 402, " + hub.getArea() + ", Chennai", "Chennai", hub.getArea(),
                "Plumbing", "Burst pipe under kitchen sink", null, null);

        EmergencyMaintenanceBooking order = service.createWorkflow(resident, input, "Tower A - Flat 402");
        assertEquals("ASSIGNED", service.workflowStageName(order));
        assertEquals(partner.getId(), order.getPartnerId());
        assertEquals("BUSY", partners.findById(partner.getId()).orElseThrow().getWorkState());

        EmergencyMaintenanceService.Actor technician = new EmergencyMaintenanceService.Actor(
                worker.getId(), "smartsociety", "workflow-test", worker.getFullName(), false, true);

        order = service.workflowStage(technician, String.valueOf(order.getId()), "STAGE_1_REACHED", null, null,
                13.0067, 80.2574, null, false);
        assertEquals("STAGE_1_REACHED", service.workflowStageName(order));

        order = service.workflowStage(technician, String.valueOf(order.getId()), "STAGE_2_STARTED",
                new byte[]{1,2,3,4}, null, 13.0067, 80.2574, null, false);
        assertEquals("STAGE_2_STARTED", service.workflowStageName(order));
        assertNotNull(order.getBeforePhotoUrl());

        order = service.workflowStage(technician, String.valueOf(order.getId()), "STAGE_3_COMPLETED",
                null, null, null, null, "Repair completed and pressure tested", false);
        assertEquals("STAGE_3_COMPLETED", service.workflowStageName(order));
        assertNotNull(order.getCompletedAt());
        assertEquals("IDLE", partners.findById(partner.getId()).orElseThrow().getWorkState());

        service.workflowReview(resident, String.valueOf(order.getId()), 5, "Fast and clean work",
                List.of("Punctual", "Clean Work", "Quick Fix"));

        EmergencyMaintenanceBooking reviewed = bookings.findById(order.getId()).orElseThrow();
        assertEquals(5, reviewed.getRating());
        assertTrue(reviewed.getReviewTags().contains("Punctual"));
        MaintenancePartner rated = partners.findById(partner.getId()).orElseThrow();
        assertEquals(5.0f, rated.getRating());
        assertEquals(1, rated.getRatingCount());
    }
}
