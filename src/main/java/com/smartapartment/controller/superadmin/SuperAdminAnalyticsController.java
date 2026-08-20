package com.smartapartment.controller.superadmin;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Map;

@RestController
@PreAuthorize("hasRole('SUPER_ADMIN')")
@RequestMapping("/api/superadmin/analytics")
public class SuperAdminAnalyticsController {

    @GetMapping("/data")
    public ResponseEntity<Map<String, String>> getAnalyticsData() {
        return ResponseEntity.ok(Map.of(
            "mrr", "MRR +18%",
            "visitors", "Visitor Logs 42K",
            "payments", "Payments 96% Success",
            "sla", "Avg Complaint SLA 14h"
        ));
    }
}
