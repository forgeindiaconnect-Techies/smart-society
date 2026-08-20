package com.smartapartment.controller;

import com.smartapartment.dto.DashboardStats;
import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import com.smartapartment.service.CurrentUserService;
import com.smartapartment.service.DashboardService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import java.io.ByteArrayOutputStream;

@RestController
@RequestMapping("/api/society")
public class SocietyApiController {

    private final CurrentUserService currentUser;
    private final DashboardService dashboards;
    private final ApartmentRepository apartments;
    private final ResidentRepository residents;
    private final ComplaintRepository complaints;
    private final VisitorRepository visitors;
    private final AnnouncementRepository announcements;
    private final MaintenanceBillRepository bills;
    private final AmenityRepository amenities;
    private final BookingRepository bookings;
    private final BlockRepository blocks;
    private final AppUserRepository users;
    private final PasswordEncoder passwordEncoder;

    public SocietyApiController(CurrentUserService currentUser, DashboardService dashboards,
                                ApartmentRepository apartments, ResidentRepository residents,
                                ComplaintRepository complaints, VisitorRepository visitors,
                                AnnouncementRepository announcements, MaintenanceBillRepository bills,
                                AmenityRepository amenities, BookingRepository bookings, BlockRepository blocks,
                                AppUserRepository users, PasswordEncoder passwordEncoder) {
        this.currentUser = currentUser;
        this.dashboards = dashboards;
        this.apartments = apartments;
        this.residents = residents;
        this.complaints = complaints;
        this.visitors = visitors;
        this.announcements = announcements;
        this.bills = bills;
        this.amenities = amenities;
        this.bookings = bookings;
        this.blocks = blocks;
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    @GetMapping("/me")
    public Map<String, Object> me() {
        AppUser user = currentUser.requireUser();
        return Map.of("id", user.getId(), "name", user.getFullName(), "email", user.getEmail(),
                "role", user.getRole().name(), "tenantId", user.getTenantId());
    }

    @GetMapping("/overview")
    public DashboardStats overview() {
        return dashboards.stats(currentUser.requireTenantId());
    }

    @GetMapping("/apartments")
    public List<Map<String, Object>> apartments() {
        return apartments.findByTenantId(currentUser.requireTenantId()).stream().map(this::apartmentView).toList();
    }

    @PostMapping("/apartments") @PreAuthorize("hasRole('SOCIETY_ADMIN')") @Transactional
    public Map<String,Object> apartment(@Valid @RequestBody ApartmentRequest request){String tenant=currentUser.requireTenantId();if(apartments.findFirstByTenantIdAndUnitNoOrderByIdAsc(tenant,request.unitNo()).isPresent())throw new IllegalArgumentException("Apartment already exists");Block block=blocks.findFirstByTenantIdAndNameOrderByIdAsc(tenant,request.block()).orElseGet(()->{Block b=new Block();b.setTenantId(tenant);b.setName(request.block());b.setTotalFloors(Math.max(1,request.floor()));return blocks.save(b);});Apartment a=new Apartment();a.setTenantId(tenant);a.setBlock(block);a.setUnitNo(request.unitNo());a.setFloorNo(request.floor());a.setUnitType(request.unitType());a.setOccupancyStatus(request.occupancy());a.setOwnerName(request.ownerName());return apartmentView(apartments.save(a));}

    @PatchMapping("/apartments/{id}") @PreAuthorize("hasRole('SOCIETY_ADMIN')") @Transactional
    public Map<String,Object> updateApartment(@PathVariable Long id, @Valid @RequestBody ApartmentRequest request){String tenant=currentUser.requireTenantId();Apartment a=apartments.findById(id).filter(item->tenant.equals(item.getTenantId())).orElseThrow(()->new IllegalArgumentException("Apartment was not found"));Block block=blocks.findFirstByTenantIdAndNameOrderByIdAsc(tenant,request.block()).orElseGet(()->{Block b=new Block();b.setTenantId(tenant);b.setName(request.block());b.setTotalFloors(Math.max(1,request.floor()));return blocks.save(b);});a.setBlock(block);a.setUnitNo(request.unitNo());a.setFloorNo(request.floor());a.setUnitType(request.unitType());a.setOccupancyStatus(request.occupancy());a.setOwnerName(request.ownerName());return apartmentView(apartments.save(a));}

    @PostMapping("/residents") @PreAuthorize("hasRole('SOCIETY_ADMIN')") @Transactional
    public Map<String,Object> resident(@Valid @RequestBody ResidentRequest request){String tenant=currentUser.requireTenantId();String email=request.email().trim().toLowerCase(Locale.ROOT);if(users.findByEmail(email).isPresent())throw new IllegalArgumentException("Email already exists");Apartment apartment=apartments.findFirstByTenantIdAndUnitNoOrderByIdAsc(tenant,request.unitNo()).orElseThrow(()->new IllegalArgumentException("Apartment was not found"));AppUser user=new AppUser();user.setTenantId(tenant);user.setFullName(request.name());user.setEmail(email);user.setRole(UserRole.RESIDENT);user.setPasswordHash(passwordEncoder.encode(request.temporaryPassword()));user=users.save(user);Resident resident=new Resident();resident.setTenantId(tenant);resident.setUser(user);resident.setApartment(apartment);resident.setResidentType(request.residentType().toUpperCase(Locale.ROOT));return residentView(residents.save(resident));}

    @GetMapping("/residents")
    @PreAuthorize("hasAnyRole('SOCIETY_ADMIN','ACCOUNTANT','SECURITY_STAFF','MAINTENANCE_STAFF')")
    public List<Map<String, Object>> residents() {
        return residents.findByTenantIdOrderByIdAsc(currentUser.requireTenantId()).stream().map(this::residentView).toList();
    }

    @GetMapping("/complaints")
    public List<Map<String, Object>> complaints() {
        AppUser user = currentUser.requireUser();
        return complaints.findByTenantIdOrderByCreatedAtDesc(user.getTenantId()).stream()
                .filter(item -> user.getRole() != UserRole.RESIDENT ||
                        (item.getResident() != null && item.getResident().getUser().getId().equals(user.getId())))
                .map(this::complaintView).toList();
    }

    @PostMapping("/complaints")
    @Transactional
    public Map<String, Object> createComplaint(@Valid @RequestBody ComplaintRequest request) {
        AppUser user = currentUser.requireUser();
        Resident resident = residentFor(user, request.residentId());
        Complaint complaint = new Complaint();
        complaint.setTenantId(user.getTenantId());
        complaint.setResident(resident);
        complaint.setCategory(request.category().trim());
        complaint.setPriority(request.priority().trim().toUpperCase(Locale.ROOT));
        complaint.setTitle(request.title().trim());
        complaint.setDescription(request.description().trim());
        complaint.setStatus("OPEN");
        complaint.setDueAt(LocalDateTime.now().plusHours(slaHours(complaint.getPriority())));
        return complaintView(complaints.save(complaint));
    }

    @PatchMapping("/complaints/{id}")
    @PreAuthorize("hasAnyRole('SOCIETY_ADMIN','MAINTENANCE_STAFF')")
    @Transactional
    public Map<String, Object> updateComplaint(@PathVariable Long id, @Valid @RequestBody ComplaintUpdate request) {
        Complaint complaint = complaints.findByIdAndTenantId(id, currentUser.requireTenantId())
                .orElseThrow(() -> new IllegalArgumentException("Complaint was not found"));
        complaint.setStatus(request.status().trim().toUpperCase(Locale.ROOT));
        complaint.setAssignedTo(clean(request.assignedTo()));
        complaint.setResolutionNotes(clean(request.resolutionNotes()));
        complaint.setSparePartsUsed(clean(request.sparePartsUsed()));
        complaint.setRepairCost(request.repairCost());
        if ("CLOSED".equals(complaint.getStatus()) || "RESOLVED".equals(complaint.getStatus())) complaint.setClosedAt(LocalDateTime.now());
        return complaintView(complaints.save(complaint));
    }

    @GetMapping("/visitors")
    public List<Map<String, Object>> visitors() {
        AppUser user = currentUser.requireUser();
        return visitors.findByTenantIdOrderByExpectedAtDesc(user.getTenantId()).stream()
                .filter(item -> user.getRole() != UserRole.RESIDENT ||
                        (item.getResident() != null && item.getResident().getUser().getId().equals(user.getId())))
                .map(this::visitorView).toList();
    }

    @PostMapping("/visitors")
    @Transactional
    public Map<String, Object> createVisitor(@Valid @RequestBody VisitorRequest request) {
        AppUser user = currentUser.requireUser();
        Visitor visitor = new Visitor();
        visitor.setTenantId(user.getTenantId());
        visitor.setResident(residentFor(user, request.residentId(), request.unitNo()));
        visitor.setVisitorName(request.name().trim());
        visitor.setVisitorPhone(request.phone().trim());
        visitor.setPurpose(request.purpose().trim());
        visitor.setVehicleNumber(clean(request.vehicleNumber()));
        visitor.setPhotoReference(clean(request.photoReference()));
        visitor.setExpectedAt(request.expectedAt());
        visitor.setApprovalStatus("APPROVED");
        visitor.setQrCode(UUID.randomUUID().toString());
        visitor.setStatus("EXPECTED");
        return visitorView(visitors.save(visitor));
    }

    @PatchMapping("/visitors/{id}/{action}")
    @PreAuthorize("hasAnyRole('SOCIETY_ADMIN','SECURITY_STAFF')")
    @Transactional
    public Map<String, Object> visitorAction(@PathVariable Long id, @PathVariable String action) {
        Visitor visitor = visitors.findByIdAndTenantId(id, currentUser.requireTenantId())
                .orElseThrow(() -> new IllegalArgumentException("Visitor was not found"));
        if ("checkin".equalsIgnoreCase(action)) {
            if (visitor.getCheckInAt() != null) throw new IllegalArgumentException("Visitor is already checked in");
            visitor.setCheckInAt(LocalDateTime.now());
            visitor.setStatus("CHECKED_IN");
        } else if ("checkout".equalsIgnoreCase(action)) {
            if (visitor.getCheckInAt() == null) throw new IllegalArgumentException("Visitor must check in first");
            visitor.setCheckOutAt(LocalDateTime.now());
            visitor.setStatus("CHECKED_OUT");
        } else {
            throw new IllegalArgumentException("Unsupported visitor action");
        }
        return visitorView(visitors.save(visitor));
    }

    @PostMapping("/visitors/scan")
    @PreAuthorize("hasRole('SECURITY_STAFF')")
    @Transactional
    public Map<String, Object> scanVisitorPass(@Valid @RequestBody VisitorScanRequest request) {
        Visitor visitor = visitors.findByTenantIdAndQrCode(currentUser.requireTenantId(), request.qrCode().trim())
                .orElseThrow(() -> new IllegalArgumentException("Visitor pass was not found"));
        if (!"EXPECTED".equals(visitor.getStatus())) throw new IllegalArgumentException("This visitor pass is no longer valid for entry");
        if (visitor.getExpectedAt().isBefore(LocalDateTime.now().minusHours(24))) throw new IllegalArgumentException("This visitor pass has expired");
        visitor.setCheckInAt(LocalDateTime.now());
        visitor.setStatus("CHECKED_IN");
        return visitorView(visitors.save(visitor));
    }

    @GetMapping(value = "/visitors/{id}/qr", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> visitorPassQr(@PathVariable Long id) throws Exception {
        AppUser user = currentUser.requireUser();
        Visitor visitor = visitors.findByIdAndTenantId(id, user.getTenantId())
                .orElseThrow(() -> new IllegalArgumentException("Visitor pass was not found"));
        if (user.getRole() == UserRole.RESIDENT && (visitor.getResident() == null || !visitor.getResident().getUser().getId().equals(user.getId()))) {
            throw new IllegalArgumentException("Visitor pass is not available to this resident");
        }
        BitMatrix matrix = new QRCodeWriter().encode(visitor.getQrCode(), BarcodeFormat.QR_CODE, 240, 240);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        MatrixToImageWriter.writeToStream(matrix, "PNG", output);
        return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).body(output.toByteArray());
    }

    @GetMapping("/announcements")
    public List<Map<String, Object>> announcements() {
        return announcements.findByTenantIdOrderByCreatedAtDesc(currentUser.requireTenantId()).stream()
                .map(a -> Map.<String, Object>of("id", a.getId(), "title", a.getTitle(), "message", a.getMessage(),
                        "audience", a.getAudience(), "emergency", a.isEmergency(), "createdAt", a.getCreatedAt()))
                .toList();
    }

    @PostMapping("/announcements")
    @PreAuthorize("hasRole('SOCIETY_ADMIN')")
    @Transactional
    public Map<String, Object> announce(@Valid @RequestBody AnnouncementRequest request) {
        Announcement item = new Announcement();
        item.setTenantId(currentUser.requireTenantId());
        item.setTitle(request.title().trim());
        item.setMessage(request.message().trim());
        item.setAudience(request.audience().trim().toUpperCase(Locale.ROOT));
        item.setEmergency(request.emergency());
        item = announcements.save(item);
        return Map.of("id", item.getId(), "message", "Announcement published");
    }

    @GetMapping("/bills")
    public List<Map<String, Object>> bills() {
        AppUser user = currentUser.requireUser();
        return bills.findByTenantIdOrderByDueDateDesc(user.getTenantId()).stream()
                .filter(bill -> user.getRole() != UserRole.RESIDENT || ownsApartment(user, bill.getApartment()))
                .map(this::billView).toList();
    }

    @GetMapping("/amenities")
    public List<Map<String, Object>> amenities() {
        return amenities.findByTenantIdOrderByNameAsc(currentUser.requireTenantId()).stream()
                .map(a -> Map.<String, Object>of("id", a.getId(), "name", a.getName(), "capacity", a.getCapacity(),
                        "bookingFee", value(a.getBookingFee()), "approvalRequired", a.isApprovalRequired()))
                .toList();
    }

    @PostMapping("/amenities") @PreAuthorize("hasRole('SOCIETY_ADMIN')") @Transactional
    public Map<String,Object> amenity(@Valid @RequestBody AmenityRequest request){Amenity a=new Amenity();a.setTenantId(currentUser.requireTenantId());a.setName(request.name());a.setCapacity(request.capacity());a.setBookingFee(request.bookingFee());a.setApprovalRequired(request.approvalRequired());a=amenities.save(a);return Map.of("id",a.getId(),"message","Amenity created");}

    @PatchMapping("/amenities/{id}") @PreAuthorize("hasRole('SOCIETY_ADMIN')") @Transactional
    public Map<String,Object> updateAmenity(@PathVariable Long id, @Valid @RequestBody AmenityRequest request) {
        Amenity amenity = amenities.findByIdAndTenantId(id, currentUser.requireTenantId())
                .orElseThrow(() -> new IllegalArgumentException("Amenity was not found"));
        amenity.setName(request.name());
        amenity.setCapacity(request.capacity());
        amenity.setBookingFee(request.bookingFee());
        amenity.setApprovalRequired(request.approvalRequired());
        amenity = amenities.save(amenity);
        return Map.of("id", amenity.getId(), "message", "Amenity price and settings updated");
    }

    @GetMapping("/bookings")
    public List<Map<String, Object>> bookings() {
        AppUser user = currentUser.requireUser();
        return bookings.findByTenantIdOrderByStartTimeDesc(user.getTenantId()).stream()
                .filter(b -> user.getRole() != UserRole.RESIDENT || b.getResident().getUser().getId().equals(user.getId()))
                .map(this::bookingView).toList();
    }

    @PostMapping("/bookings")
    @PreAuthorize("hasRole('RESIDENT')")
    @Transactional
    public Map<String, Object> book(@Valid @RequestBody BookingRequest request) {
        AppUser user = currentUser.requireUser();
        if (!request.endTime().isAfter(request.startTime())) throw new IllegalArgumentException("End time must be after start time");
        Amenity amenity = amenities.findByIdAndTenantId(request.amenityId(), user.getTenantId())
                .orElseThrow(() -> new IllegalArgumentException("Amenity was not found"));
        if (bookings.existsByTenantIdAndAmenityIdAndStartTimeLessThanAndEndTimeGreaterThan(
                user.getTenantId(), amenity.getId(), request.endTime(), request.startTime())) {
            throw new IllegalArgumentException("Amenity is already booked for this time");
        }
        Booking booking = new Booking();
        booking.setTenantId(user.getTenantId());
        booking.setAmenity(amenity);
        booking.setResident(residentFor(user, null));
        booking.setStartTime(request.startTime());
        booking.setEndTime(request.endTime());
        booking.setApprovalStatus(amenity.isApprovalRequired() ? "PENDING" : "APPROVED");
        booking.setAmount(value(amenity.getBookingFee()));
        booking.setPaymentMethod("ONLINE");
        booking.setPaymentStatus("PENDING");
        return bookingView(bookings.save(booking));
    }

    @PostMapping("/bookings/admin")
    @PreAuthorize("hasRole('SOCIETY_ADMIN')")
    @Transactional
    public Map<String, Object> createAdminBooking(@Valid @RequestBody AdminBookingRequest request) {
        AppUser user = currentUser.requireUser();
        if (!request.endTime().isAfter(request.startTime())) throw new IllegalArgumentException("End time must be after start time");
        Amenity amenity = amenities.findByIdAndTenantId(request.amenityId(), user.getTenantId())
                .orElseThrow(() -> new IllegalArgumentException("Amenity was not found"));
        if (bookings.existsByTenantIdAndAmenityIdAndStartTimeLessThanAndEndTimeGreaterThan(
                user.getTenantId(), amenity.getId(), request.endTime(), request.startTime())) {
            throw new IllegalArgumentException("Amenity is already booked for this time");
        }
        String paymentMethod = request.paymentMethod().trim().toUpperCase(Locale.ROOT);
        if (!Set.of("ONLINE", "CASH").contains(paymentMethod)) throw new IllegalArgumentException("Payment method must be ONLINE or CASH");
        Booking booking = new Booking();
        booking.setTenantId(user.getTenantId());
        booking.setAmenity(amenity);
        booking.setResident(residentFor(user, request.residentId()));
        booking.setStartTime(request.startTime());
        booking.setEndTime(request.endTime());
        booking.setApprovalStatus(amenity.isApprovalRequired() ? "PENDING" : "APPROVED");
        booking.setAmount(value(amenity.getBookingFee()));
        booking.setPaymentMethod(paymentMethod);
        booking.setPaymentStatus(paymentMethod.equals("ONLINE") ? "PAID" : "PENDING_COLLECTION");
        booking.setPaymentReference(clean(request.paymentReference()));
        return bookingView(bookings.save(booking));
    }

    @PatchMapping("/bookings/{id}/approval")
    @PreAuthorize("hasRole('SOCIETY_ADMIN')")
    @Transactional
    public Map<String, Object> updateBookingApproval(@PathVariable Long id, @Valid @RequestBody BookingApprovalRequest request) {
        Booking booking = bookings.findByIdAndTenantId(id, currentUser.requireTenantId())
                .orElseThrow(() -> new IllegalArgumentException("Booking was not found"));
        String approval = request.approvalStatus().trim().toUpperCase(Locale.ROOT);
        if (!Set.of("APPROVED", "REJECTED").contains(approval)) throw new IllegalArgumentException("Approval status must be APPROVED or REJECTED");
        booking.setApprovalStatus(approval);
        return bookingView(bookings.save(booking));
    }

    private Resident residentFor(AppUser user, Long requestedId) { return residentFor(user, requestedId, null); }
    private Resident residentFor(AppUser user, Long requestedId, String unitNo) {
        if (user.getRole() == UserRole.RESIDENT) {
            return residents.findFirstByUserOrderByIdAsc(user)
                    .orElseThrow(() -> new IllegalArgumentException("Resident profile is not configured"));
        }
        if (requestedId == null && clean(unitNo).isBlank()) throw new IllegalArgumentException("Resident is required");
        if (requestedId == null) return residents.findByTenantIdOrderByIdAsc(user.getTenantId()).stream()
                .filter(resident -> unitNo.trim().equalsIgnoreCase(resident.getApartment().getUnitNo())).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Resident apartment was not found"));
        return residents.findByIdAndTenantId(requestedId, user.getTenantId())
                .orElseThrow(() -> new IllegalArgumentException("Resident was not found"));
    }

    private boolean ownsApartment(AppUser user, Apartment apartment) {
        return residents.findFirstByUserOrderByIdAsc(user)
                .map(r -> r.getApartment().getId().equals(apartment.getId())).orElse(false);
    }

    private Map<String, Object> apartmentView(Apartment a) {
        return map("id", a.getId(), "unitNo", a.getUnitNo(), "block", a.getBlock() == null ? "" : a.getBlock().getName(),
                "floor", a.getFloorNo(), "type", a.getUnitType(), "occupancy", a.getOccupancyStatus(),
                "ownerName", clean(a.getOwnerName()), "ownerPhone", clean(a.getOwnerPhone()));
    }

    private Map<String, Object> residentView(Resident r) {
        return map("id", r.getId(), "name", r.getUser().getFullName(), "email", r.getUser().getEmail(),
                "phone", clean(r.getUser().getPhone()), "unitNo", r.getApartment().getUnitNo(),
                "residentType", r.getResidentType(), "vehicleNumber", clean(r.getVehicleNumber()));
    }

    private Map<String, Object> complaintView(Complaint c) {
        return map("id", c.getId(), "title", c.getTitle(), "category", c.getCategory(), "priority", c.getPriority(),
                "description", c.getDescription(), "status", c.getStatus(), "assignedTo", clean(c.getAssignedTo()),
                "resolutionNotes", clean(c.getResolutionNotes()), "dueAt", c.getDueAt(), "escalatedAt", c.getEscalatedAt(), "closedAt", c.getClosedAt(), "resident", c.getResident().getUser().getFullName(),
                "unitNo", c.getResident().getApartment().getUnitNo(), "createdAt", c.getCreatedAt(),
                "sparePartsUsed", clean(c.getSparePartsUsed()), "repairCost", value(c.getRepairCost()));
    }

    private Map<String, Object> visitorView(Visitor v) {
        return map("id", v.getId(), "name", v.getVisitorName(), "phone", v.getVisitorPhone(), "purpose", v.getPurpose(),
                "resident", v.getResident().getUser().getFullName(), "unitNo", v.getResident().getApartment().getUnitNo(),
                "expectedAt", v.getExpectedAt(), "checkInAt", v.getCheckInAt(), "checkOutAt", v.getCheckOutAt(),
                "approvalStatus", v.getApprovalStatus(), "status", v.getStatus(), "qrCode", v.getQrCode(),
                "vehicleNumber", clean(v.getVehicleNumber()), "photoReference", clean(v.getPhotoReference()));
    }

    private Map<String, Object> billView(MaintenanceBill b) {
        return map("id", b.getId(), "unitNo", b.getApartment().getUnitNo(), "month", b.getBillMonth(),
                "baseAmount", value(b.getBaseAmount()), "lateFee", value(b.getLateFee()), "totalAmount", value(b.getTotalAmount()),
                "dueDate", b.getDueDate(), "paymentStatus", b.getPaymentStatus());
    }

    private Map<String, Object> bookingView(Booking b) {
        return map("id", b.getId(), "amenity", b.getAmenity().getName(), "resident", b.getResident().getUser().getFullName(),
                "unitNo", b.getResident().getApartment().getUnitNo(), "startTime", b.getStartTime(), "endTime", b.getEndTime(),
                "approvalStatus", b.getApprovalStatus(), "amount", value(b.getAmount()),
                "paymentMethod", clean(b.getPaymentMethod()), "paymentStatus", clean(b.getPaymentStatus()),
                "paymentReference", clean(b.getPaymentReference()));
    }

    private static Map<String, Object> map(Object... values) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int i = 0; i < values.length; i += 2) result.put((String) values[i], values[i + 1]);
        return result;
    }

    private static String clean(String value) { return value == null ? "" : value; }
    private static BigDecimal value(BigDecimal value) { return value == null ? BigDecimal.ZERO : value; }
    private static long slaHours(String priority){return switch(priority==null?"NORMAL":priority.toUpperCase(Locale.ROOT)){case "EMERGENCY"->2;case "HIGH"->8;case "LOW"->72;default->24;};}

    public record ComplaintRequest(@NotBlank @Size(max=120) String title, @NotBlank String category,
                                   @NotBlank String priority, @NotBlank @Size(max=2000) String description, Long residentId) {}
    public record ComplaintUpdate(@NotBlank String status, String assignedTo, String resolutionNotes, String sparePartsUsed, BigDecimal repairCost) {}
    public record VisitorRequest(@NotBlank String name, @NotBlank String phone, @NotBlank String purpose,
                                 @NotNull @FutureOrPresent LocalDateTime expectedAt, Long residentId, String unitNo, String vehicleNumber, String photoReference) {}
    public record VisitorScanRequest(@NotBlank String qrCode) {}
    public record AnnouncementRequest(@NotBlank String title, @NotBlank @Size(max=3000) String message,
                                      @NotBlank String audience, boolean emergency) {}
    public record BookingRequest(@NotNull Long amenityId, @NotNull @Future LocalDateTime startTime,
                                 @NotNull @Future LocalDateTime endTime) {}
    public record AdminBookingRequest(@NotNull Long amenityId, @NotNull Long residentId,
                                      @NotNull LocalDateTime startTime, @NotNull LocalDateTime endTime,
                                      @NotBlank String paymentMethod, String paymentReference) {}
    public record BookingApprovalRequest(@NotBlank String approvalStatus) {}
    public record ApartmentRequest(@NotBlank String unitNo,@NotBlank String block,@PositiveOrZero int floor,@NotBlank String unitType,@NotBlank String occupancy,@NotBlank String ownerName){}
    public record ResidentRequest(@NotBlank String name,@Email @NotBlank String email,@NotBlank String unitNo,@NotBlank String residentType,@NotBlank @Size(min=8,max=72) String temporaryPassword){}
    public record AmenityRequest(@NotBlank String name,@Positive int capacity,@NotNull @PositiveOrZero BigDecimal bookingFee,boolean approvalRequired){}
}
