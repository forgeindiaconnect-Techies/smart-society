package com.smartapartment.controller.superadmin;

import com.smartapartment.entity.AppUser;
import com.smartapartment.entity.UserRole;
import com.smartapartment.entity.RoleAccessPolicy;
import com.smartapartment.repository.AppUserRepository;
import com.smartapartment.repository.RoleAccessPolicyRepository;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@RestController
@PreAuthorize("hasRole('SUPER_ADMIN')")
@RequestMapping("/api/superadmin/roles")
@SuppressWarnings("null")
public class SuperAdminRoleController {
    private final AppUserRepository users;
    private final RoleAccessPolicyRepository policies;

    public SuperAdminRoleController(AppUserRepository users, RoleAccessPolicyRepository policies) {
        this.users = users;
        this.policies = policies;
    }

    @GetMapping("/list")
    public ResponseEntity<List<Map<String, Object>>> getRoles() {
        seedPolicies();
        return ResponseEntity.ok(policies.findAllByOrderByRoleNameAsc().stream()
                .map(policy -> Map.<String, Object>of("id", policy.getId(), "role", policy.getRoleName(),
                        "permissions", policy.getPermissions(), "status", policy.isActive() ? "Active" : "Disabled"))
                .toList());
    }

    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> updatePolicy(@PathVariable Long id, @RequestBody RolePolicyRequest request) {
        RoleAccessPolicy policy = policies.findById(id).orElseThrow(() -> new IllegalArgumentException("Role policy was not found"));
        policy.setPermissions(request.permissions().trim());
        policy.setActive(request.active());
        RoleAccessPolicy saved = policies.save(policy);
        return ResponseEntity.ok(Map.of("id", saved.getId(), "role", saved.getRoleName(), "permissions", saved.getPermissions(), "status", saved.isActive() ? "Active" : "Disabled"));
    }

    @PostMapping("/provision")
    public ResponseEntity<String> assignCustomRole(@RequestParam Long userId, @RequestParam String roleName) {
        AppUser user = findUser(userId);
        UserRole role;
        try {
            role = UserRole.valueOf(roleName.trim().toUpperCase().replace('-', '_').replace(' ', '_'));
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Unsupported role: " + roleName);
        }
        user.setRole(role);
        user.setAccountLocked(false);
        user.setAccessRevokedAt(null);
        users.save(user);
        return ResponseEntity.ok("Role assigned successfully");
    }

    @PostMapping("/revoke")
    public ResponseEntity<String> revokeAccess(@RequestParam Long userId) {
        AppUser user = findUser(userId);
        user.setAccountLocked(true);
        user.setAccessRevokedAt(LocalDateTime.now());
        users.save(user);
        return ResponseEntity.ok("Access revoked for user");
    }

    @PostMapping("/authorize-mobile")
    public ResponseEntity<String> authorizeMobileApp(@RequestParam Long userId, @RequestParam boolean authorized) {
        AppUser user = findUser(userId);
        user.setMobileAppAuthorized(authorized);
        users.save(user);
        return ResponseEntity.ok("Mobile app access updated");
    }

    private AppUser findUser(Long userId) {
        return users.findById(userId).orElseThrow(() -> new IllegalArgumentException("User was not found"));
    }

    private String permissionsFor(UserRole role) {
        return switch (role) {
            case SUPER_ADMIN -> "Platform-wide access";
            case SOCIETY_ADMIN -> "Full society administration";
            case ACCOUNTANT -> "Finance and billing";
            case SECURITY_STAFF -> "Gate, visitor and security operations";
            case MAINTENANCE_STAFF -> "Assigned maintenance operations";
            case RESIDENT -> "Own resident services";
            case FACILITY_MANAGER -> "Facilities and maintenance management";
        };
    }

    private void seedPolicies() {
        Arrays.stream(UserRole.values()).forEach(role -> policies.findByRoleName(role.name()).orElseGet(() -> {
            RoleAccessPolicy policy = new RoleAccessPolicy(); policy.setRoleName(role.name()); policy.setPermissions(permissionsFor(role)); policy.setActive(true); return policies.save(policy);
        }));
    }

    public record RolePolicyRequest(String permissions, boolean active) {}
}
