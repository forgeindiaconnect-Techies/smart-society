package com.smartapartment.controller.superadmin;

import com.smartapartment.entity.AppUser;
import com.smartapartment.entity.Notification;
import com.smartapartment.repository.AppUserRepository;
import com.smartapartment.repository.NotificationRepository;
import jakarta.transaction.Transactional;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;
import java.util.Map;

@RestController
@PreAuthorize("hasRole('SUPER_ADMIN')")
@RequestMapping("/api/superadmin/monitoring")
public class SuperAdminMonitoringController {

    private final AppUserRepository users;
    private final NotificationRepository notifications;

    public SuperAdminMonitoringController(AppUserRepository users, NotificationRepository notifications) {
        this.users = users;
        this.notifications = notifications;
    }

    @GetMapping("/data")
    public ResponseEntity<Map<String, Object>> getMonitoringData() {
        return ResponseEntity.ok(Map.of(
            "stats", Map.of(
                "gateEntriesToday", "1,248",
                "billsPending", "342",
                "adminApprovals", "67",
                "openRisks", "14"
            ),
            "watchlist", List.of(
                Map.of("society", "Green Nest Apartments", "module", "Billing", "currentSignal", "46 unpaid bills need follow-up", "owner", "Society Admin", "accessRule", "Admin can approve waivers and mark payments"),
                Map.of("society", "Lakeview Residency", "module", "Gate Entries", "currentSignal", "12 visitors waiting at gate", "owner", "Security + Admin", "accessRule", "Admin controls visitor policy, security records entry"),
                Map.of("society", "Urban Heights", "module", "Complaints", "currentSignal", "8 unassigned maintenance tickets", "owner", "Society Admin", "accessRule", "Admin assigns teams and closes after resolution"),
                Map.of("society", "Royal Gardens", "module", "Expenses", "currentSignal", "Rs. 72,000 awaiting approval", "owner", "Society Admin", "accessRule", "Admin approves or rejects vendor bills")
            ),
            "commandWatch", List.of(
                Map.of("module", "Billing", "metrics", "1,500 pending bills | Rs. 4,50,000 arrears | 85% collection", "actionLabel", "Trigger Reminder", "actionType", "trigger-reminder"),
                Map.of("module", "Gate Entries", "metrics", "1,248 check-ins | 42 delays | 120 staff entries", "actionLabel", "Audit Logs", "actionType", "audit-gate"),
                Map.of("module", "Residents", "metrics", "4,500 records | 98% KYC | 85% occupancy", "actionLabel", "Sync KYC", "actionType", "sync-kyc"),
                Map.of("module", "Complaints", "metrics", "145 open | 22 escalated | 12 hrs avg SLA", "actionLabel", "Escalate All", "actionType", "escalate-complaints"),
                Map.of("module", "Amenities", "metrics", "82 bookings | Rs. 15,000 revenue | 5 damages", "actionLabel", "Review Damages", "actionType", "review-damages"),
                Map.of("module", "Expenses", "metrics", "Rs. 4.2M spent | 14 pending approvals", "actionLabel", "Audit Expenses", "actionType", "audit-expenses"),
                Map.of("module", "Announcements", "metrics", "12 active notices | 85% read rate", "actionLabel", "Broadcast Global", "actionType", "global-broadcast"),
                Map.of("module", "Reports", "metrics", "24 generated today | 150 downloads", "actionLabel", "Force Generation", "actionType", "force-reports")
            )
        ));
    }

    @org.springframework.web.bind.annotation.PostMapping("/action")
    @Transactional
    public ResponseEntity<Map<String, Object>> performMonitoringAction(@org.springframework.web.bind.annotation.RequestBody Map<String, String> payload) {
        String action = payload.get("action");
        String actionTitle = switch (action == null ? "" : action) {
            case "trigger-reminder" -> "Maintenance payment reminder";
            case "audit-gate" -> "Gate-entry audit initiated";
            case "sync-kyc" -> "Resident KYC sync initiated";
            case "escalate-complaints" -> "Open complaints escalated";
            case "review-damages" -> "Amenity damage review requested";
            case "audit-expenses" -> "Expense audit initiated";
            case "global-broadcast" -> "Platform-wide announcement";
            case "force-reports" -> "Report generation initiated";
            default -> null;
        };
        if (actionTitle == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Unsupported monitoring action"));
        }
        String message = "A platform administrator has initiated: " + actionTitle + ". Please review your SmartSociety notifications for details.";
        int recipientCount = 0;
        for (AppUser user : users.findAll()) {
            Notification notification = new Notification();
            notification.setTenantId(user.getTenantId());
            notification.setUserId(user.getId());
            notification.setType("PLATFORM_ACTION");
            notification.setTitle(actionTitle);
            notification.setMessage(message);
            notification.setReadStatus(false);
            notifications.save(notification);
            recipientCount++;
        }
        return ResponseEntity.ok(Map.of("status", "success", "message", actionTitle + " was sent to " + recipientCount + " platform users.", "recipients", recipientCount));
    }
}
