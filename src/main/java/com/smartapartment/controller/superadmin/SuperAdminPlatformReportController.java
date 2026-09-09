package com.smartapartment.controller.superadmin;

import com.smartapartment.entity.AppUser;
import com.smartapartment.entity.MaintenanceBill;
import com.smartapartment.entity.SubscriptionPlan;
import com.smartapartment.repository.*;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Objects;

@RestController
@RequestMapping("/api/superadmin")
public class SuperAdminPlatformReportController {

    private final AppUserRepository userRepository;
    private final SubscriptionPlanRepository subscriptionPlanRepository;
    private final PropertyListingRepository propertyListingRepository;
    private final MaintenanceBillRepository maintenanceBillRepository;
    private final ComplaintRepository complaintRepository;
    private final ExpenseRepository expenseRepository;
    private final AuditLogRepository auditLogRepository;

    public SuperAdminPlatformReportController(
            AppUserRepository userRepository,
            SubscriptionPlanRepository subscriptionPlanRepository,
            PropertyListingRepository propertyListingRepository,
            MaintenanceBillRepository maintenanceBillRepository,
            ComplaintRepository complaintRepository,
            ExpenseRepository expenseRepository,
            AuditLogRepository auditLogRepository) {
        this.userRepository = userRepository;
        this.subscriptionPlanRepository = subscriptionPlanRepository;
        this.propertyListingRepository = propertyListingRepository;
        this.maintenanceBillRepository = maintenanceBillRepository;
        this.complaintRepository = complaintRepository;
        this.expenseRepository = expenseRepository;
        this.auditLogRepository = auditLogRepository;
    }

    public record ExportReportRequest(
            String scope,
            String format,
            String datePeriod,
            String startDate,
            String endDate,
            String statusFilter,
            Boolean includeMetadata,
            String reportTitle
    ) {}

    @PostMapping(value = "/export-platform-report")
    public ResponseEntity<byte[]> generatePlatformReport(
            @RequestBody(required = false) ExportReportRequest request,
            HttpSession session) {

        if (request == null) {
            request = new ExportReportRequest("OVERVIEW", "CSV", "ALL_TIME", null, null, "ALL", true, "Platform Operations Executive Report");
        }

        String scope = Objects.requireNonNullElse(request.scope(), "OVERVIEW").toUpperCase();
        String format = Objects.requireNonNullElse(request.format(), "CSV").toUpperCase();
        String reportTitle = (request.reportTitle() != null && !request.reportTitle().isBlank()) 
                ? request.reportTitle().trim() 
                : "Platform Operations Executive Report";

        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
        String readableTimestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));

        byte[] fileBytes;
        String contentType;
        String fileExtension;

        if ("JSON".equals(format)) {
            contentType = MediaType.APPLICATION_JSON_VALUE;
            fileExtension = "json";
            fileBytes = buildJsonReport(scope, reportTitle, readableTimestamp, request).getBytes(StandardCharsets.UTF_8);
        } else if ("HTML".equals(format)) {
            contentType = MediaType.TEXT_HTML_VALUE;
            fileExtension = "html";
            fileBytes = buildHtmlReport(scope, reportTitle, readableTimestamp, request).getBytes(StandardCharsets.UTF_8);
        } else {
            contentType = "text/csv; charset=utf-8";
            fileExtension = "csv";
            fileBytes = buildCsvReport(scope, reportTitle, readableTimestamp, request).getBytes(StandardCharsets.UTF_8);
        }

        String filename = "SmartApartment_Report_" + scope + "_" + timestamp + "." + fileExtension;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(contentType));
        headers.setContentDisposition(ContentDisposition.attachment().filename(filename).build());

        return new ResponseEntity<>(fileBytes, headers, HttpStatus.OK);
    }

    private String buildCsvReport(String scope, String title, String timestamp, ExportReportRequest request) {
        StringBuilder csv = new StringBuilder();
        csv.append("=================================================================\n");
        csv.append("\"").append(title.toUpperCase()).append("\"\n");
        csv.append("=================================================================\n");
        csv.append("\"Generated Timestamp\",\"").append(timestamp).append("\"\n");
        csv.append("\"Report Scope\",\"").append(scope).append("\"\n");
        csv.append("\"Filter Status\",\"").append(Objects.requireNonNullElse(request.statusFilter(), "ALL")).append("\"\n");
        csv.append("\"Date Period\",\"").append(Objects.requireNonNullElse(request.datePeriod(), "ALL_TIME")).append("\"\n");
        csv.append("\n");

        long userCount = userRepository.count();
        long planCount = subscriptionPlanRepository.count();
        long listingCount = propertyListingRepository.count();
        long billCount = maintenanceBillRepository.count();
        long complaintCount = complaintRepository.count();
        long expenseCount = expenseRepository.count();

        switch (scope) {
            case "USERS" -> {
                csv.append("\"USER ACCOUNTS & GOVERNANCE REGISTER\"\n");
                csv.append("\"ID\",\"Email\",\"Full Name\",\"Role\",\"Status\",\"Created At\"\n");
                userRepository.findAll().forEach(u -> 
                    csv.append(u.getId()).append(",")
                       .append("\"").append(safe(u.getEmail())).append("\",")
                       .append("\"").append(safe(u.getFullName())).append("\",")
                       .append("\"").append(safe(u.getRole() != null ? u.getRole().name() : "USER")).append("\",")
                       .append("\"").append(!u.isAccountLocked() ? "Active" : "Locked").append("\",")
                       .append("\"").append(safe(u.getCreatedAt())).append("\"\n")
                );
            }
            case "SUBSCRIPTIONS" -> {
                csv.append("\"SUBSCRIPTION PLANS CATALOGUE\"\n");
                csv.append("\"ID\",\"Plan Name\",\"Billing Cycle\",\"Monthly Price (INR)\",\"Max Apartments\",\"Status\"\n");
                subscriptionPlanRepository.findAll().forEach(p ->
                    csv.append(p.getId()).append(",")
                       .append("\"").append(safe(p.getName())).append("\",")
                       .append("\"").append(safe(p.getBillingCycle())).append("\",")
                       .append(p.getMonthlyPrice() != null ? p.getMonthlyPrice() : 0).append(",")
                       .append(p.getMaxApartments() != null ? p.getMaxApartments() : 0).append(",")
                       .append("\"").append(Boolean.TRUE.equals(p.getActive()) ? "Active" : "Inactive").append("\"\n")
                );
            }
            case "FINANCE" -> {
                csv.append("\"FINANCIAL LEDGER & BILLING REGISTER\"\n");
                csv.append("\"Bill ID\",\"Unit / Flat\",\"Total Amount (INR)\",\"Due Date\",\"Payment Status\"\n");
                maintenanceBillRepository.findAll().forEach(b -> {
                    String flatNum = (b.getApartment() != null && b.getApartment().getUnitNo() != null) 
                            ? b.getApartment().getUnitNo() 
                            : "Unit-" + b.getId();
                    csv.append(b.getId()).append(",")
                       .append("\"").append(safe(flatNum)).append("\",")
                       .append(b.getTotalAmount() != null ? b.getTotalAmount() : 0).append(",")
                       .append("\"").append(safe(b.getDueDate())).append("\",")
                       .append("\"").append(safe(b.getPaymentStatus())).append("\"\n");
                });
            }
            default -> {
                csv.append("\"KEY PLATFORM METRICS SUMMARY\"\n");
                csv.append("\"Metric\",\"Value\",\"Category\"\n");
                csv.append("\"Total Registered Users\",").append(userCount).append(",\"User Management\"\n");
                csv.append("\"Active Subscription Plans\",").append(planCount).append(",\"SaaS Billing\"\n");
                csv.append("\"Active Property Listings\",").append(listingCount).append(",\"PropertyDirect Listings\"\n");
                csv.append("\"Total Maintenance Bills\",").append(billCount).append(",\"Society Finance\"\n");
                csv.append("\"Logged Complaints & Tickets\",").append(complaintCount).append(",\"Support & Maintenance\"\n");
                csv.append("\"Recorded Society Expenses\",").append(expenseCount).append(",\"Finance & Ledger\"\n");
            }
        }
        return csv.toString();
    }

    private String buildJsonReport(String scope, String title, String timestamp, ExportReportRequest request) {
        StringBuilder json = new StringBuilder();
        json.append("{\n");
        json.append("  \"title\": \"").append(escapeJson(title)).append("\",\n");
        json.append("  \"timestamp\": \"").append(timestamp).append("\",\n");
        json.append("  \"scope\": \"").append(scope).append("\",\n");
        json.append("  \"metrics\": {\n");
        json.append("    \"totalUsers\": ").append(userRepository.count()).append(",\n");
        json.append("    \"totalSubscriptionPlans\": ").append(subscriptionPlanRepository.count()).append(",\n");
        json.append("    \"totalPropertyListings\": ").append(propertyListingRepository.count()).append(",\n");
        json.append("    \"totalMaintenanceBills\": ").append(maintenanceBillRepository.count()).append(",\n");
        json.append("    \"totalComplaints\": ").append(complaintRepository.count()).append("\n");
        json.append("  },\n");
        json.append("  \"statusFilter\": \"").append(Objects.requireNonNullElse(request.statusFilter(), "ALL")).append("\"\n");
        json.append("}\n");
        return json.toString();
    }

    private String buildHtmlReport(String scope, String title, String timestamp, ExportReportRequest request) {
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>%s</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 40px; color: #1e293b; background: #fff; }
                .header { border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 25px; }
                h1 { color: #0f172a; margin: 0 0 5px 0; font-size: 24px; }
                .meta { color: #64748b; font-size: 13px; }
                table { width: 100%%; border-collapse: collapse; margin-top: 20px; }
                th { background: #f8fafc; color: #475569; text-align: left; padding: 10px; border-bottom: 2px solid #e2e8f0; font-size: 13px; }
                td { padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
                .card-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 25px; }
                .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; }
                .card strong { font-size: 20px; color: #2563eb; display: block; margin-top: 5px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>%s</h1>
                <div class="meta">Generated: %s | Scope: %s | Platform: SmartApartment & PropertyDirect</div>
            </div>

            <div class="card-grid">
                <div class="card">Total Users<strong>%d</strong></div>
                <div class="card">Subscription Plans<strong>%d</strong></div>
                <div class="card">Property Listings<strong>%d</strong></div>
            </div>

            <h2>Platform Governance Summary</h2>
            <table>
                <thead>
                    <tr><th>Module</th><th>Record Count</th><th>Operational Status</th></tr>
                </thead>
                <tbody>
                    <tr><td>User Management & Accounts</td><td>%d</td><td>Active</td></tr>
                    <tr><td>Subscription Billing</td><td>%d</td><td>Active</td></tr>
                    <tr><td>Maintenance & Finance</td><td>%d</td><td>Active</td></tr>
                </tbody>
            </table>
        </body>
        </html>
        """.formatted(
                title, title, timestamp, scope,
                userRepository.count(), subscriptionPlanRepository.count(), propertyListingRepository.count(),
                userRepository.count(), subscriptionPlanRepository.count(), maintenanceBillRepository.count()
        );
    }

    private String safe(Object obj) {
        if (obj == null) return "";
        return obj.toString().replace("\"", "'").replace("\n", " ");
    }

    private String escapeJson(String text) {
        if (text == null) return "";
        return text.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ");
    }
}
