package com.smartapartment.controller;

import com.smartapartment.dto.AuthResponse;
import com.smartapartment.dto.LoginRequest;
import com.smartapartment.dto.RegisterTenantRequest;
import com.smartapartment.entity.AppUser;
import com.smartapartment.entity.UserRole;
import com.smartapartment.entity.PropertyCustomer;
import com.smartapartment.repository.PropertyCustomerRepository;
import com.smartapartment.service.AuthService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import java.util.HashMap;
import java.util.Map;
import org.springframework.core.env.Environment;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final Map<String, DashboardCredential> dashboardCredentials;
    private final PropertyCustomerRepository propertyDirectCustomers;
    private final PasswordEncoder passwordEncoder;

    public AuthController(AuthService authService, Environment environment, PropertyCustomerRepository propertyDirectCustomers, PasswordEncoder passwordEncoder) {
        this.authService = authService;
        this.dashboardCredentials = DashboardCredential.load(environment);
        this.propertyDirectCustomers = propertyDirectCustomers;
        this.passwordEncoder = passwordEncoder;
    }

    @PostMapping("/register-tenant")
    public Map<String,String> registerTenant(@Valid @RequestBody RegisterTenantRequest request) {
        authService.registerTenant(request);
        return Map.of("message", "Society registered and awaiting platform approval");
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @PostMapping("/dashboard-login")
    public ResponseEntity<Map<String, String>> dashboardLogin(@RequestBody DashboardLoginRequest request, HttpSession session) {
        String platform = safe(request.platform()).toLowerCase();
        if ("smartapartment".equals(platform) || "smartsociety".equals(platform)) {
            try {
                AppUser user = authService.authenticate(request.username(), request.password());
                String dashboardRole = dashboardRole(user.getRole());
                if (!safe(request.role()).isBlank() && !dashboardRole.equalsIgnoreCase(safe(request.role()))) {
                    return ResponseEntity.status(403).body(Map.of("message", "This account does not have the selected role"));
                }

                var authentication = new UsernamePasswordAuthenticationToken(
                        user.getEmail(), null, java.util.List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())));
                SecurityContext context = SecurityContextHolder.createEmptyContext();
                context.setAuthentication(authentication);
                SecurityContextHolder.setContext(context);
                session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);
                session.setAttribute("dashboard:smartapartment:" + dashboardRole, Boolean.TRUE);

                return ResponseEntity.ok(Map.of(
                        "message", "Login successful",
                        "redirect", dashboardRedirect(user.getRole()),
                        "role", dashboardRole,
                        "name", user.getFullName()
                ));
            } catch (IllegalArgumentException exception) {
                return ResponseEntity.status(401).body(Map.of("message", exception.getMessage()));
            }
        }

        String normalizedUsername = safe(request.username()).trim().toLowerCase();
        DashboardCredential credential = safe(request.role()).isBlank()
                ? findCredential(request.platform(), normalizedUsername, request.password())
                : dashboardCredentials.get(DashboardCredential.key(request.platform(), request.role()));

        if (credential == null
                || !credential.username().equalsIgnoreCase(normalizedUsername)
                || !credential.password().equals(request.password())) {
            
            // Try database authentication as a fallback
            try {
                AppUser user = authService.authenticate(normalizedUsername, request.password());
                String dashboardRole = dashboardRole(user.getRole());
                
                var authentication = new UsernamePasswordAuthenticationToken(
                        user.getEmail(), null, java.util.List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())));
                SecurityContext context = SecurityContextHolder.createEmptyContext();
                context.setAuthentication(authentication);
                SecurityContextHolder.setContext(context);
                session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);
                session.setAttribute("dashboard:smartapartment:" + dashboardRole, Boolean.TRUE);

                return ResponseEntity.ok(Map.of(
                        "message", "Login successful",
                        "redirect", dashboardRedirect(user.getRole()),
                        "role", dashboardRole,
                        "name", user.getFullName()
                ));
            } catch (Exception ignored) {
            }

            PropertyCustomer customer = findPropertyDirectCustomer(request);
            if (customer != null) {
                session.setAttribute("dashboard:propertydirect:customer", Boolean.TRUE);
                session.setAttribute("propertydirect:customerId", customer.getId());
                return ResponseEntity.ok(Map.of(
                        "message", "Login successful",
                        "redirect", "/propertydirect/dashboards/customer",
                        "role", "customer",
                        "name", customer.getName()
                ));
            }
            return ResponseEntity.status(401).body(Map.of("message", "Invalid username or password"));
        }

        session.setAttribute("dashboard:" + credential.platform() + ":" + credential.role(), Boolean.TRUE);
        if ("propertydirect".equalsIgnoreCase(credential.platform()) && "admin".equalsIgnoreCase(credential.role())) {
            String username = safe(credential.username()).toLowerCase();
            PropertyCustomer owner = propertyDirectCustomers.findByUsernameIgnoreCase(username).orElseGet(() -> {
                PropertyCustomer customer = new PropertyCustomer();
                customer.setTenantId("propertydirect");
                customer.setName("Property Owner Admin");
                customer.setPhone("Not provided");
                customer.setEmail(username.contains("@") ? username : username + "@propertydirect.local");
                customer.setUsername(username);
                customer.setPasswordHash(passwordEncoder.encode(credential.password()));
                return propertyDirectCustomers.save(customer);
            });
            session.setAttribute("propertydirect:customerId", owner.getId());
        }
        return ResponseEntity.ok(Map.of(
                "message", "Login successful",
                "redirect", credential.redirect(),
                "role", credential.role()
        ));
    }

    @PostMapping("/propertydirect/register-customer")
    public ResponseEntity<Map<String, String>> registerPropertyDirectCustomer(@RequestBody PropertyDirectCustomerRegisterRequest request, HttpSession session) {
        String name = safe(request.name());
        String phone = safe(request.phone());
        String email = safe(request.email()).toLowerCase();
        String username = safe(request.username()).toLowerCase();
        String password = safe(request.password());

        if (name.isBlank() || phone.isBlank() || email.isBlank() || username.isBlank() || password.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Please fill name, phone, email, username and password"));
        }
        if (password.length() < 6) {
            return ResponseEntity.badRequest().body(Map.of("message", "Password must be at least 6 characters"));
        }
        if (username.contains("admin") || username.contains("superadmin")) {
            return ResponseEntity.badRequest().body(Map.of("message", "Customer username cannot use admin words"));
        }
        if (propertyDirectCustomers.existsByUsernameIgnoreCaseOrEmailIgnoreCase(username, email)) {
            return ResponseEntity.status(409).body(Map.of("message", "This username already exists"));
        }

        PropertyCustomer customer = new PropertyCustomer();
        customer.setTenantId("propertydirect"); customer.setName(name); customer.setPhone(phone);
        customer.setEmail(email); customer.setUsername(username); customer.setPasswordHash(passwordEncoder.encode(password));
        propertyDirectCustomers.save(customer);
        session.setAttribute("dashboard:propertydirect:customer", Boolean.TRUE);
        session.setAttribute("propertydirect:customerId", customer.getId());
        return ResponseEntity.ok(Map.of(
                "message", "Customer account created",
                "redirect", "/propertydirect/dashboards/customer",
                "role", "customer",
                "name", name
        ));
    }

    private PropertyCustomer findPropertyDirectCustomer(DashboardLoginRequest request) {
        if (!"propertydirect".equalsIgnoreCase(safe(request.platform()))) return null;
        String role = safe(request.role()).toLowerCase();
        if (!role.isBlank() && !"customer".equals(role)) return null;
        PropertyCustomer customer = propertyDirectCustomers.findByUsernameIgnoreCase(safe(request.username())).orElse(null);
        if (customer == null || !passwordEncoder.matches(request.password(), customer.getPasswordHash())) return null;
        return customer;
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

    private static String dashboardRole(UserRole role) {
        return switch (role) {
            case SUPER_ADMIN -> "superadmin";
            case SOCIETY_ADMIN, ACCOUNTANT, FACILITY_MANAGER -> "admin";
            case RESIDENT -> "resident";
            case SECURITY_STAFF -> "security";
            case MAINTENANCE_STAFF -> "maintenance";
        };
    }

    private static String dashboardRedirect(UserRole role) {
        return switch (role) {
            case SUPER_ADMIN -> "/dashboards/superadmin";
            case SOCIETY_ADMIN, ACCOUNTANT, FACILITY_MANAGER -> "/dashboards/society-admin";
            case RESIDENT -> "/dashboards/resident";
            case SECURITY_STAFF -> "/dashboards/security";
            case MAINTENANCE_STAFF -> "/dashboards/maintenance";
        };
    }

    public record DashboardLoginRequest(String platform, String role, String username, String password) {
    }

    public record PropertyDirectCustomerRegisterRequest(String name, String phone, String email, String username, String password) {
    }

    private record DashboardCredential(String platform, String role, String username, String password, String redirect) {
        private static final DashboardRoute[] ROUTES = {
                new DashboardRoute("propertydirect", "superadmin", "/propertydirect/dashboards/superadmin"),
                new DashboardRoute("propertydirect", "admin", "/propertydirect/dashboards/admin"),
                new DashboardRoute("propertydirect", "customer", "/propertydirect/dashboards/customer")
        };

        private static Map<String, DashboardCredential> load(Environment environment) {
            Map<String, DashboardCredential> credentials = new HashMap<>();
            boolean allowDemo = Boolean.parseBoolean(environment.getProperty("SEED_DEMO_ACCOUNTS", "true"));
            for (DashboardRoute route : ROUTES) {
                String prefix = "DASHBOARD_LOGIN_" + route.platform().toUpperCase() + "_" + route.role().toUpperCase();
                DefaultCredential defaultCredential = DefaultCredential.forRoute(route.platform(), route.role(), allowDemo);
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
        private static DefaultCredential forRoute(String platform, String role, boolean allowDemo) {
            if (allowDemo && "propertydirect".equalsIgnoreCase(platform) && "superadmin".equalsIgnoreCase(role)) {
                return new DefaultCredential("superadmin@propertydirect", "superadmin123");
            }
            if (allowDemo && "propertydirect".equalsIgnoreCase(platform) && "admin".equalsIgnoreCase(role)) {
                return new DefaultCredential("admin@propertydirect", "admin123");
            }
            return new DefaultCredential("", "");
        }
    }
}
