package com.smartapartment.controller;

import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import com.smartapartment.service.CurrentUserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.*;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/society/operations")
public class OperationsApiController {
 private final CurrentUserService current;private final ParkingAllocationRepository parking;private final ApartmentRepository apartments;private final VendorRepository vendors;private final CommunityEventRepository events;private final SocietyDocumentRepository documents;private final StaffAttendanceRepository attendance;private final NotificationRepository notifications;private final AuditLogRepository audits;
 public OperationsApiController(CurrentUserService c,ParkingAllocationRepository p,ApartmentRepository a,VendorRepository v,CommunityEventRepository e,SocietyDocumentRepository d,StaffAttendanceRepository s,NotificationRepository n,AuditLogRepository l){current=c;parking=p;apartments=a;vendors=v;events=e;documents=d;attendance=s;notifications=n;audits=l;}

 @GetMapping("/parking") public List<ParkingAllocation> parking(){return parking.findByTenantIdOrderBySlotNumberAsc(current.requireTenantId());}
 @PostMapping("/parking") @PreAuthorize("hasRole('SOCIETY_ADMIN')") @Transactional public ParkingAllocation parking(@Valid @RequestBody ParkingRequest r){String t=current.requireTenantId();Apartment a=apartments.findFirstByTenantIdAndUnitNoOrderByIdAsc(t,r.unitNo()).orElseThrow(()->new IllegalArgumentException("Apartment was not found"));ParkingAllocation p=new ParkingAllocation();p.setTenantId(t);p.setSlotNumber(r.slot());p.setApartment(a);p.setVehicleNumber(r.vehicleNumber());p.setVehicleType(r.vehicleType());return parking.save(p);}
 @GetMapping("/vendors") public List<Vendor> vendors(){return vendors.findByTenantIdOrderByNameAsc(current.requireTenantId());}
 @PostMapping("/vendors") @PreAuthorize("hasRole('SOCIETY_ADMIN')") @Transactional public Vendor vendor(@Valid @RequestBody VendorRequest r){Vendor v=new Vendor();v.setTenantId(current.requireTenantId());v.setName(r.name());v.setServiceCategory(r.category());v.setPhone(r.phone());v.setEmail(r.email());return vendors.save(v);}
 @GetMapping("/events") public List<CommunityEvent> events(){return events.findByTenantIdOrderByStartsAtDesc(current.requireTenantId());}
 @PostMapping("/events") @PreAuthorize("hasRole('SOCIETY_ADMIN')") @Transactional public CommunityEvent event(@Valid @RequestBody EventRequest r){if(!r.endsAt().isAfter(r.startsAt()))throw new IllegalArgumentException("Event end must be after start");CommunityEvent e=new CommunityEvent();e.setTenantId(current.requireTenantId());e.setTitle(r.title());e.setDescription(r.description());e.setVenue(r.venue());e.setStartsAt(r.startsAt());e.setEndsAt(r.endsAt());return events.save(e);}
 @GetMapping("/documents") public List<SocietyDocument> documents(){return documents.findByTenantIdOrderByCreatedAtDesc(current.requireTenantId());}
 @PostMapping("/documents") @PreAuthorize("hasRole('SOCIETY_ADMIN')") @Transactional public SocietyDocument document(@Valid @RequestBody DocumentRequest r){AppUser u=current.requireUser();SocietyDocument d=new SocietyDocument();d.setTenantId(u.getTenantId());d.setName(r.name());d.setCategory(r.category());d.setContentType(r.contentType());d.setStorageUrl(r.storageUrl());d.setUploadedByUserId(u.getId());return documents.save(d);}
 @PostMapping("/attendance/{action}") @PreAuthorize("hasAnyRole('SECURITY_STAFF','MAINTENANCE_STAFF','ACCOUNTANT','FACILITY_MANAGER')") @Transactional public Map<String,Object> attendance(@PathVariable String action){AppUser u=current.requireUser();StaffAttendance a=attendance.findByTenantIdAndUserIdAndWorkDate(u.getTenantId(),u.getId(),LocalDate.now()).orElseGet(()->{StaffAttendance x=new StaffAttendance();x.setTenantId(u.getTenantId());x.setUser(u);x.setWorkDate(LocalDate.now());return x;});if("checkin".equals(action)){if(a.getCheckInAt()!=null)throw new IllegalArgumentException("Already checked in");a.setCheckInAt(LocalDateTime.now());}else if("checkout".equals(action)){if(a.getCheckInAt()==null)throw new IllegalArgumentException("Check in first");a.setCheckOutAt(LocalDateTime.now());}else throw new IllegalArgumentException("Unsupported attendance action");a=attendance.save(a);return Map.of("id",a.getId(),"workDate",a.getWorkDate(),"checkInAt",a.getCheckInAt(),"checkOutAt",a.getCheckOutAt()==null?"":a.getCheckOutAt().toString());}
 @GetMapping("/notifications") public List<Notification> notifications(){AppUser u=current.requireUser();return notifications.findByTenantIdAndUserIdOrderByCreatedAtDesc(u.getTenantId(),u.getId());}
 @PatchMapping("/notifications/{id}/read") @Transactional public void read(@PathVariable Long id){AppUser u=current.requireUser();Notification n=notifications.findByIdAndTenantIdAndUserId(id,u.getTenantId(),u.getId()).orElseThrow(()->new IllegalArgumentException("Notification was not found"));n.setReadStatus(true);notifications.save(n);}
 @GetMapping("/audit") @PreAuthorize("hasRole('SOCIETY_ADMIN')") public List<AuditLog> audit(){return audits.findTop100ByTenantIdOrderByCreatedAtDesc(current.requireTenantId());}
 public record ParkingRequest(@NotBlank String slot,@NotBlank String unitNo,String vehicleNumber,String vehicleType){}
 public record VendorRequest(@NotBlank String name,@NotBlank String category,String phone,@Email String email){}
 public record EventRequest(@NotBlank String title,String description,@NotBlank String venue,@NotNull LocalDateTime startsAt,@NotNull LocalDateTime endsAt){}
 public record DocumentRequest(@NotBlank String name,@NotBlank String category,@NotBlank String contentType,@NotBlank String storageUrl){}
}
