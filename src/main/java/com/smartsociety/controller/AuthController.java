package com.smartsociety.controller;

import com.smartsociety.dto.AuthResponse;
import com.smartsociety.dto.LoginRequest;
import com.smartsociety.dto.RegisterTenantRequest;
import com.smartsociety.service.AuthService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import java.util.HashMap;
import java.util.Map;
import org.springframework.core.env.Environment;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final Map<String, DashboardCredential> dashboardCredentials;

    public AuthController(AuthService authService, Environment environment) {
        this.authService = authService;
        this.dashboardCredentials = DashboardCredential.load(environment);
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
        DashboardCredential credential = safe(request.role()).isBlank()
                ? findCredential(request.platform(), request.username(), request.password())
                : dashboardCredentials.get(DashboardCredential.key(request.platform(), request.role()));

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

    private DashboardCredential findCredential(String platform, String username, String password) {
        return dashboardCredentials.values().stream()
                .filter(credential -> credential.platform().equalsIgnoreCase(safe(platform)))
                .filter(credential -> credential.username().equalsIgnoreCase(safe(username)))
                .filter(credential -> credential.password().equals(password))
                .findFirst()
                .orElse(null);
    }

    private static String safe(String value) {
        return value == null ? "" : value.trim();
    }

    public record DashboardLoginRequest(String platform, String role, String username, String password) {
    }

    private record DashboardCredential(String platform, String role, String username, String password, String redirect) {
        private static final DashboardRoute[] ROUTES = {
                new DashboardRoute("smartsociety", "superadmin", "/dashboards/superadmin"),
                new DashboardRoute("smartsociety", "admin", "/dashboards/society-admin"),
                new DashboardRoute("smartsociety", "resident", "/dashboards/resident"),
                new DashboardRoute("smartsociety", "security", "/dashboards/security"),
                new DashboardRoute("smartsociety", "maintenance", "/dashboards/maintenance"),
                new DashboardRoute("propertydirect", "superadmin", "/propertydirect/dashboards/superadmin"),
                new DashboardRoute("propertydirect", "admin", "/propertydirect/dashboards/admin"),
                new DashboardRoute("propertydirect", "customer", "/propertydirect/dashboards/customer")
        };

        private static Map<String, DashboardCredential> load(Environment environment) {
            Map<String, DashboardCredential> credentials = new HashMap<>();
            for (DashboardRoute route : ROUTES) {
                String prefix = "DASHBOARD_LOGIN_" + route.platform().toUpperCase() + "_" + route.role().toUpperCase();
                DefaultCredential defaultCredential = DefaultCredential.forRoute(route.platform(), route.role());
                String username = environment.getProperty(prefix + "_USERNAME", defaultCredential.username());
                String password = environment.getProperty(prefix + "_PASSWORD", defaultCredential.password());
                if (!safe(username).isBlank() && !safe(password).isBlank()) {
                    DashboardCredential credential = new DashboardCredential(
                            route.platform(),
                            route.role(),
                            username,
                            password,
                            route.redirect()
                    );
                    credentials.put(key(route.platform(), route.role()), credential);
                }
            }
            return credentials;
        }

        private static String key(String platform, String role) {
            return safe(platform).toLowerCase() + ":" + safe(role).toLowerCase();
        }
    }

    private record DashboardRoute(String platform, String role, String redirect) {
    }

    private record DefaultCredential(String username, String password) {
        private static DefaultCredential forRoute(String platform, String role) {
            return switch (safe(platform).toLowerCase() + ":" + safe(role).toLowerCase()) {
                case "smartsociety:superadmin" -> new DefaultCredential("superadmin@smartsociety", "superadmin123");
                case "smartsociety:admin" -> new DefaultCredential("admin@smartsociety", "admin123");
                case "smartsociety:resident" -> new DefaultCredential("resident@smartsociety", "resident123");
                case "smartsociety:security" -> new DefaultCredential("security@smartsociety", "security123");
                case "smartsociety:maintenance" -> new DefaultCredential("maintenance@smartsociety", "maintenance123");
                case "propertydirect:superadmin" -> new DefaultCredential("superadmin@propertydirect", "superadmin123");
                case "propertydirect:admin" -> new DefaultCredential("admin@propertydirect", "admin123");
                case "propertydirect:customer" -> new DefaultCredential("customer@propertydirect", "customer123");
                default -> new DefaultCredential("", "");
            };
        }
    }
}
