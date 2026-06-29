package com.smartsociety.controller;

import com.smartsociety.dto.AuthResponse;
import com.smartsociety.dto.LoginRequest;
import com.smartsociety.dto.RegisterTenantRequest;
import com.smartsociety.service.AuthService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register-tenant")
    public AuthResponse registerTenant(@Valid @RequestBody RegisterTenantRequest request) {
        return authService.registerTenant(request);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @PostMapping("/dashboard-login")
    public ResponseEntity<Map<String, String>> dashboardLogin(@RequestBody DashboardLoginRequest request, HttpSession session) {
        DemoDashboardCredential credential = DemoDashboardCredential.find(request.platform(), request.role());

        if (credential == null
                || !credential.username().equalsIgnoreCase(safe(request.username()))
                || !credential.password().equals(request.password())) {
            return ResponseEntity.status(401).body(Map.of("message", "Invalid username or password"));
        }

        session.setAttribute("dashboard:" + credential.platform() + ":" + credential.role(), Boolean.TRUE);
        return ResponseEntity.ok(Map.of(
                "message", "Login successful",
                "redirect", credential.redirect(),
                "role", credential.role()
        ));
    }

    private static String safe(String value) {
        return value == null ? "" : value.trim();
    }

    public record DashboardLoginRequest(String platform, String role, String username, String password) {
    }

    private record DemoDashboardCredential(String platform, String role, String username, String password, String redirect) {
        private static final DemoDashboardCredential[] CREDENTIALS = {
                new DemoDashboardCredential("smartsociety", "superadmin", "superadmin@smartsociety.com", "Super@123", "/dashboards/superadmin"),
                new DemoDashboardCredential("smartsociety", "admin", "admin@smartsociety.com", "Admin@123", "/dashboards/society-admin"),
                new DemoDashboardCredential("smartsociety", "resident", "resident@smartsociety.com", "Resident@123", "/dashboards/resident"),
                new DemoDashboardCredential("smartsociety", "security", "security@smartsociety.com", "Security@123", "/dashboards/security"),
                new DemoDashboardCredential("smartsociety", "maintenance", "maintenance@smartsociety.com", "Maintenance@123", "/dashboards/maintenance"),
                new DemoDashboardCredential("propertydirect", "superadmin", "superadmin@propertydirect.com", "Super@123", "/propertydirect/dashboards/superadmin"),
                new DemoDashboardCredential("propertydirect", "admin", "admin@propertydirect.com", "Admin@123", "/propertydirect/dashboards/admin"),
                new DemoDashboardCredential("propertydirect", "customer", "customer@propertydirect.com", "Customer@123", "/propertydirect/dashboards/customer")
        };

        private static DemoDashboardCredential find(String platform, String role) {
            String safePlatform = safe(platform);
            String safeRole = safe(role);
            for (DemoDashboardCredential credential : CREDENTIALS) {
                if (credential.platform().equalsIgnoreCase(safePlatform) && credential.role().equalsIgnoreCase(safeRole)) {
                    return credential;
                }
            }
            return null;
        }
    }
}
