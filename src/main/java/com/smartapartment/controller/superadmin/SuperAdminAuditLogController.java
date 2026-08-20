package com.smartapartment.controller.superadmin;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;
import java.util.Map;

@RestController
@PreAuthorize("hasRole('SUPER_ADMIN')")
@RequestMapping("/api/superadmin/audit")
public class SuperAdminAuditLogController {

    @GetMapping("/data")
    public ResponseEntity<Map<String, Object>> getAuditData() {
        return ResponseEntity.ok(Map.of(
            "stats", Map.of(
                "auditEventsLogged", "42,891",
                "minuteActionsToday", "1,420",
                "securityOverrides", "3",
                "systemHealth", "100% Normal"
            ),
            "stream", List.of(
                Map.of("time", "10:52:41 AM", "society", "Green Nest", "module", "SECURITY", "actor", "Guard Vikram", "detail", "Verified Pre-Approved Guest Code [SG-4921] for Guest: Rohit Sharma (Flat A-101)", "ip", "192.168.1.42", "status", "SUCCESS"),
                Map.of("time", "10:51:18 AM", "society", "Green Nest", "module", "FINANCE", "actor", "Accountant Suresh", "detail", "Approved Vendor Payment INV-2026-801 (Rs. 18,500 - Apex Elevators)", "ip", "192.168.1.110", "status", "APPROVED"),
                Map.of("time", "10:49:05 AM", "society", "Lakeview Res.", "module", "HELPDESK", "actor", "Plumber Ramesh", "detail", "Updated Ticket #T-102 (Water Leakage) Status to [IN_PROGRESS]", "ip", "192.168.2.88", "status", "IN_PROGRESS"),
                Map.of("time", "10:46:12 AM", "society", "Urban Heights", "module", "SECURITY", "actor", "Guard Ramu", "detail", "Logged Walk-in Visitor [Arun Kumar] for Flat B-202 (Delivery)", "ip", "192.168.3.15", "status", "WAITING_APP"),
                Map.of("time", "10:44:02 AM", "society", "Green Nest", "module", "FINANCE", "actor", "Resident Kavya", "detail", "Completed Maintenance Bill Payment Rs. 2,500 (Ref: TXN-994821)", "ip", "157.48.20.11", "status", "PAID_VERIFIED"),
                Map.of("time", "10:40:30 AM", "society", "Lakeview Res.", "module", "ADMIN_CTRL", "actor", "Admin Rekha", "detail", "Published Society Broadcast Notice: 'Tank Cleaning Tomorrow'", "ip", "192.168.2.10", "status", "BROADCASTED"),
                Map.of("time", "10:35:10 AM", "society", "Royal Gardens", "module", "SECURITY", "actor", "Main Gate Desk", "detail", "Triggered Security Emergency Panic Alert (Gate #1)", "ip", "192.168.4.1", "status", "ESCALATED"),
                Map.of("time", "10:30:14 AM", "society", "Green Nest", "module", "AUTH", "actor", "System Auth", "detail", "User Session Created for Society Admin (admin@smartsociety)", "ip", "127.0.0.1", "status", "AUTHENTICATED")
            )
        ));
    }
}
