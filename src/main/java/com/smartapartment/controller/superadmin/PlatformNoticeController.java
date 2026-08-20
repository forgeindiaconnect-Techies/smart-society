package com.smartapartment.controller.superadmin;

import com.smartapartment.entity.Announcement;
import com.smartapartment.entity.AppUser;
import com.smartapartment.entity.Notification;
import com.smartapartment.entity.Tenant;
import com.smartapartment.repository.AnnouncementRepository;
import com.smartapartment.repository.AppUserRepository;
import com.smartapartment.repository.NotificationRepository;
import com.smartapartment.repository.TenantRepository;
import jakarta.servlet.http.HttpSession;
import jakarta.transaction.Transactional;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/superadmin/notices")
@SuppressWarnings("null")
class SuperAdminPlatformNoticeController {

    private final AnnouncementRepository announcements;
    private final TenantRepository tenants;
    private final AppUserRepository users;
    private final NotificationRepository notifications;

    public SuperAdminPlatformNoticeController(AnnouncementRepository announcements, TenantRepository tenants,
                                    AppUserRepository users, NotificationRepository notifications) {
        this.announcements = announcements;
        this.tenants = tenants;
        this.users = users;
        this.notifications = notifications;
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> sendPlatformNotice(@RequestBody NoticeRequest request, HttpSession session) {
        boolean isSuperAdminSession = Boolean.TRUE.equals(session.getAttribute("dashboard:smartapartment:superadmin"));
        boolean isSuperAdminRole = SecurityContextHolder.getContext().getAuthentication() != null
                && SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream()
                        .anyMatch(a -> a.getAuthority().equals("ROLE_SUPER_ADMIN"));

        if (!isSuperAdminSession && !isSuperAdminRole) {
            return ResponseEntity.status(403).body(Map.of("message", "SuperAdmin authentication required"));
        }

        if (request.message() == null || request.message().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Notice message content is required"));
        }

        String title = (request.title() != null && !request.title().trim().isEmpty()) 
                ? request.title().trim() 
                : "Official Platform Notice";
        String target = request.target() == null ? "" : request.target().trim();
        boolean allSocieties = "ALL_REGISTERED_SOCIETIES".equals(target);
        boolean specificSociety = "SPECIFIC_SOCIETY".equals(target);
        if (!allSocieties && !specificSociety) {
            return ResponseEntity.badRequest().body(Map.of("message", "Choose all registered societies or one specific society"));
        }
        List<Tenant> recipients;
        if (allSocieties) {
            recipients = tenants.findAll();
        } else {
            if (request.specificSocietyId() == null || request.specificSocietyId().isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("message", "Select a target society"));
            }
            try {
                recipients = List.of(tenants.findById(Long.valueOf(request.specificSocietyId()))
                        .orElseThrow(() -> new IllegalArgumentException("Selected society was not found")));
            } catch (NumberFormatException exception) {
                return ResponseEntity.badRequest().body(Map.of("message", "Selected society is invalid"));
            }
        }
        boolean isUrgent = "URGENT".equalsIgnoreCase(request.priority()) || Boolean.TRUE.equals(request.emergency());
        int validDays = (request.validDays() != null && request.validDays() > 0) ? request.validDays() : 7;
        LocalDateTime validUntil = LocalDateTime.now().plusDays(validDays);
        int notifiedUsers = 0;
        for (Tenant tenant : recipients) {
            Announcement announcement = new Announcement();
            announcement.setTenantId(tenant.getCode());
            announcement.setTitle(title);
            announcement.setMessage(request.message().trim());
            announcement.setGlobal(allSocieties);
            announcement.setAudience(allSocieties ? "ALL_REGISTERED_SOCIETIES" : tenant.getSocietyName());
            announcement.setEmergency(isUrgent);
            announcement.setValidUntil(validUntil);
            announcements.save(announcement);
            for (AppUser user : users.findByTenantId(tenant.getCode())) {
                Notification notification = new Notification();
                notification.setTenantId(tenant.getCode());
                notification.setUserId(user.getId());
                notification.setType("PLATFORM_NOTICE");
                notification.setTitle(title);
                notification.setMessage(request.message().trim());
                notification.setReadStatus(false);
                notifications.save(notification);
                notifiedUsers++;
            }
        }
        
        return ResponseEntity.ok(Map.of(
            "status", "SUCCESS",
            "message", "Platform notice successfully broadcasted!",
            "target", allSocieties ? "All registered societies" : recipients.getFirst().getSocietyName(),
            "societyCount", recipients.size(),
            "notifiedUsers", notifiedUsers
        ));
    }

    @GetMapping
    public ResponseEntity<List<Announcement>> getNotices(HttpSession session) {
        return ResponseEntity.ok(announcements.findAll());
    }

    public record NoticeRequest(
        String target,
        String specificSocietyId,
        String title,
        String message,
        String category,
        String priority,
        Boolean emergency,
        Integer validDays
    ) {}
}
