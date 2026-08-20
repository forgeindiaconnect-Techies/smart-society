package com.smartapartment.controller;


import com.smartapartment.entity.SubscriptionPlan;
import com.smartapartment.entity.Tenant;
import com.smartapartment.entity.AppUser;
import com.smartapartment.entity.UserRole;
import com.smartapartment.repository.AppUserRepository;
import com.smartapartment.repository.SubscriptionPlanRepository;
import com.smartapartment.repository.TenantRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/platform")
@SuppressWarnings("null")
public class PlatformApiController {

    private final TenantRepository tenants;
    private final SubscriptionPlanRepository plans;
    private final AppUserRepository users;

    public PlatformApiController(TenantRepository tenants, SubscriptionPlanRepository plans, AppUserRepository users) {
        this.tenants = tenants;
        this.plans = plans;
        this.users = users;
    }

    @GetMapping("/overview")
    public Map<String, Object> overview() {
        return Map.of(
                "tenants", tenants.count(),
                "users", users.count(),
                "plans", plans.count(),
                "pendingTenants", tenants.countByApprovedFalse(),
                "activeSocieties", tenants.count(),
                "monthlyRevenue", 125000,
                "trialAccounts", tenants.countByApprovedFalse(),
                "openTickets", 12
        );
    }

    @GetMapping("/tenants")
    public List<Tenant> tenants() {
        return tenants.findAllByOrderByCreatedAtDesc();
    }

    @PostMapping("/tenants")
    @Transactional
    public Tenant createTenant(@Valid @RequestBody TenantRequest request) {
        Tenant tenant = new Tenant();
        tenant.setCode(nextTenantCode(request.societyName()));
        updateTenantFields(tenant, request);
        tenant.setApproved(false);
        return tenants.save(tenant);
    }

    @PutMapping("/tenants/{id}")
    @Transactional
    public Tenant updateTenant(@PathVariable Long id, @Valid @RequestBody TenantRequest request) {
        Tenant tenant = tenants.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Society was not found"));
        updateTenantFields(tenant, request);
        return tenants.save(tenant);
    }

    @PatchMapping("/tenants/{id}/approval")
    @Transactional
    public Tenant approval(@PathVariable Long id, @RequestParam boolean approved) {
        Tenant tenant = tenants.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Society was not found"));
        tenant.setApproved(approved);
        return tenants.save(tenant);
    }

    @GetMapping("/plans")
    public List<SubscriptionPlan> plans() {
        return plans.findAll();
    }

    @PostMapping("/plans")
    @Transactional
    public SubscriptionPlan createPlan(@Valid @RequestBody PlanRequest request) {
        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setTenantId("platform");
        updatePlanFields(plan, request);
        return plans.save(plan);
    }

    @PutMapping("/plans/{id}")
    @Transactional
    public SubscriptionPlan updatePlan(@PathVariable Long id, @Valid @RequestBody PlanRequest request) {
        SubscriptionPlan plan = plans.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Plan was not found"));
        updatePlanFields(plan, request);
        return plans.save(plan);
    }

    @PutMapping("/tenants/{id}/plan")
    @Transactional
    public Tenant updateTenantPlan(@PathVariable Long id, @RequestParam Long planId) {
        Tenant tenant = tenants.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Society was not found"));
        plans.findById(planId)
                .orElseThrow(() -> new IllegalArgumentException("Plan was not found"));
        return tenants.save(tenant);
    }

    @GetMapping("/users")
    public List<Map<String, Object>> users() {
        return users.findAll().stream()
                .map(user -> Map.<String, Object>of(
                        "id", user.getId(),
                        "name", user.getFullName(),
                        "email", user.getEmail(),
                        "role", user.getRole(),
                        "tenantId", user.getTenantId(),
                        "locked", user.isAccountLocked()
                ))
                .toList();
    }

    @PutMapping("/users/{id}")
    @Transactional
    public Map<String, Object> updateUser(@PathVariable Long id, @Valid @RequestBody UserRequest request) {
        AppUser user = users.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User was not found"));
        user.setFullName(request.fullName().trim());
        user.setRole(request.role());
        user.setAccountLocked(request.locked());
        AppUser saved = users.save(user);
        return Map.of("id", saved.getId(), "name", saved.getFullName(), "role", saved.getRole(),
                "locked", saved.isAccountLocked());
    }

    private void updatePlanFields(SubscriptionPlan plan, PlanRequest request) {
        plan.setName(request.name());
        plan.setMonthlyPrice(request.monthlyPrice());
        plan.setMaxApartments(request.maxApartments());
        plan.setMaxResidents(request.maxResidents());
        plan.setVisitorManagement(request.visitorManagement());
        plan.setAmenityBooking(request.amenityBooking());
        plan.setAnalytics(request.analytics());
    }

    private void updateTenantFields(Tenant tenant, TenantRequest request) {
        tenant.setSocietyName(request.societyName().trim());
        tenant.setCity(request.city().trim());
        tenant.setContactEmail(request.contactEmail() == null ? "" : request.contactEmail().trim());
        tenant.setPhone(request.phone() == null ? "" : request.phone().trim());
        tenant.setAddress(request.address() == null ? "" : request.address().trim());
    }

    private String nextTenantCode(String societyName) {
        String base = societyName.toUpperCase().replaceAll("[^A-Z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
        if (base.isBlank()) base = "SOCIETY";
        base = base.length() > 24 ? base.substring(0, 24) : base;
        String code = base;
        int suffix = 2;
        while (tenants.findByCode(code).isPresent()) {
            code = base + "-" + suffix++;
        }
        return code;
    }

    public record PlanRequest(
            @NotBlank String name,
            @NotNull @PositiveOrZero BigDecimal monthlyPrice,
            @Positive int maxApartments,
            @Positive int maxResidents,
            boolean visitorManagement,
            boolean amenityBooking,
            boolean analytics
    ) {}

    public record TenantRequest(
            @NotBlank String societyName,
            @NotBlank String city,
            String contactEmail,
            String phone,
            String address
    ) {}

    public record UserRequest(
            @NotBlank String fullName,
            @NotNull UserRole role,
            boolean locked
    ) {}
}
