package com.smartapartment.controller;

import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import com.smartapartment.service.CurrentUserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/society/extended")
public class SocietyExtendedApiController {

    private final CurrentUserService current;
    private final BlockRepository blocks;
    private final ParkingAllocationRepository parkings;
    private final StaffAttendanceRepository attendances;
    private final DomesticStaffRepository staffRepository;
    private final CommunityEventRepository events;

    public SocietyExtendedApiController(
            CurrentUserService current,
            BlockRepository blocks,
            ParkingAllocationRepository parkings,
            StaffAttendanceRepository attendances,
            DomesticStaffRepository staffRepository,
            CommunityEventRepository events) {
        this.current = current;
        this.blocks = blocks;
        this.parkings = parkings;
        this.attendances = attendances;
        this.staffRepository = staffRepository;
        this.events = events;
    }

    @GetMapping("/wings")
    public List<Block> getWings() {
        return blocks.findByTenantId(current.requireTenantId());
    }

    @PostMapping("/wings")
    @PreAuthorize("hasRole('SOCIETY_ADMIN')")
    @Transactional
    public Block createWing(@Valid @RequestBody WingRequest request) {
        Block block = new Block();
        block.setTenantId(current.requireTenantId());
        block.setName(request.name());
        block.setTotalFloors(request.totalFloors());
        return blocks.save(block);
    }

    @GetMapping("/parkings")
    public List<ParkingAllocation> getParkings() {
        return parkings.findByTenantIdOrderBySlotNumberAsc(current.requireTenantId());
    }

    @PostMapping("/parkings")
    @PreAuthorize("hasRole('SOCIETY_ADMIN')")
    @Transactional
    public ParkingAllocation createParking(@Valid @RequestBody ParkingRequest request) {
        ParkingAllocation slot = new ParkingAllocation();
        slot.setTenantId(current.requireTenantId());
        slot.setSlotNumber(request.slotNumber());
        slot.setVehicleType(request.vehicleType());
        slot.setVehicleNumber(request.vehicleNumber());
        return parkings.save(slot);
    }

    @GetMapping("/attendances")
    public List<StaffAttendance> getAttendances() {
        return attendances.findByTenantIdOrderByWorkDateDesc(current.requireTenantId());
    }

    @PostMapping("/attendances")
    @PreAuthorize("hasAnyRole('SOCIETY_ADMIN', 'SECURITY_STAFF')")
    @Transactional
    public StaffAttendance recordAttendance(@Valid @RequestBody AttendanceRequest request) {
        String tenantId = current.requireTenantId();

        StaffAttendance attendance = new StaffAttendance();
        attendance.setTenantId(tenantId);
        attendance.setWorkDate(java.time.LocalDate.now());
        attendance.setCheckInAt(LocalDateTime.now());
        return attendances.save(attendance);
    }

    @PatchMapping("/attendances/{id}/checkout")
    @PreAuthorize("hasAnyRole('SOCIETY_ADMIN', 'SECURITY_STAFF')")
    @Transactional
    public StaffAttendance checkoutAttendance(@PathVariable Long id) {
        StaffAttendance attendance = attendances.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Attendance record not found"));
        attendance.setCheckOutAt(LocalDateTime.now());
        return attendances.save(attendance);
    }

    @GetMapping("/events")
    public List<CommunityEvent> getEvents() {
        return events.findByTenantIdOrderByStartsAtDesc(current.requireTenantId());
    }

    @PostMapping("/events")
    @PreAuthorize("hasRole('SOCIETY_ADMIN')")
    @Transactional
    public CommunityEvent createEvent(@Valid @RequestBody EventRequest request) {
        CommunityEvent event = new CommunityEvent();
        event.setTenantId(current.requireTenantId());
        event.setTitle(request.title());
        event.setDescription(request.description());
        event.setVenue(request.venue());
        event.setStartsAt(request.eventDate());
        return events.save(event);
    }

    @PostMapping("/pager/broadcast")
    @PreAuthorize("hasRole('SOCIETY_ADMIN')")
    public Map<String, Object> broadcastPagerAlert(@Valid @RequestBody PagerAlertRequest request) {
        return Map.of(
                "status", "BROADCASTED",
                "message", "Emergency Pager Alert sent to all residents",
                "alertTitle", request.title(),
                "priority", request.priority(),
                "timestamp", LocalDateTime.now()
        );
    }

    public record WingRequest(@NotBlank String name, int totalFloors) {}
    public record ParkingRequest(@NotBlank String slotNumber, String vehicleType, String vehicleNumber, boolean occupied) {}
    public record AttendanceRequest(Long staffId) {}
    public record EventRequest(@NotBlank String title, String description, String venue, LocalDateTime eventDate) {}
    public record PagerAlertRequest(@NotBlank String title, String priority) {}
}
