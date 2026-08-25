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
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.crypto.password.PasswordEncoder;

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
    private final PasswordEncoder passwordEncoder;

    public PlatformApiController(TenantRepository tenants, SubscriptionPlanRepository plans,
                                 AppUserRepository users, PasswordEncoder passwordEncoder) {
        this.tenants = tenants;
        this.plans = plans;
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    @GetMapping("/overview")
    public Map<String, Object> overview() {
        List<Tenant> realTenants = tenants.findAllByOrderByCreatedAtDesc().stream().filter(this::isRealTenant).toList();
        long realUsers = users.findAll().stream().filter(user -> !"green-heights".equalsIgnoreCase(user.getTenantId())).count();
        long pending = realTenants.stream().filter(tenant -> !tenant.isApproved()).count();
        return Map.of(
                "tenants", realTenants.size(),
                "users", realUsers,
                "plans", plans.count(),
                "pendingTenants", pending,
                "activeSocieties", realTenants.stream().filter(Tenant::isApproved).count(),
                "monthlyRevenue", 0,
                "trialAccounts", pending,
                "openTickets", 0
        );
    }

    @GetMapping("/tenants")
    public List<Tenant> tenants() {
        return tenants.findAllByOrderByCreatedAtDesc().stream().filter(this::isRealTenant).toList();
    }

    @PostMapping("/tenants")
    @Transactional
    public Tenant createTenant(@Valid @RequestBody TenantRequest request) {
        requireText(request.adminName(), "Administrator name is required");
        requireText(request.adminEmail(), "Administrator email is required");
        requireText(request.adminPhone(), "Administrator phone number is required");
        requireText(request.adminPassword(), "Administrator password is required");
        if (request.adminPassword().length() < 8) {
            throw new IllegalArgumentException("Administrator password must contain at least 8 characters");
        }
        if (!request.adminPassword().matches("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,72}$")) {
            throw new IllegalArgumentException("Administrator password must include uppercase, lowercase, number and symbol");
        }
        String adminEmail = request.adminEmail().trim().toLowerCase(java.util.Locale.ROOT);
        if (users.findByEmail(adminEmail).isPresent()) {
            throw new IllegalArgumentException("An account with this administrator email already exists");
        }
        Tenant tenant = new Tenant();
        String tenantCode = nextTenantCode(request.societyName());
        tenant.setCode(tenantCode);
        tenant.setTenantId(tenantCode);
        updateTenantFields(tenant, request);
        tenant.setApproved(Boolean.TRUE.equals(request.approved()));
        Tenant savedTenant = tenants.save(tenant);

        AppUser administrator = new AppUser();
        administrator.setTenantId(tenantCode);
        administrator.setFullName(request.adminName().trim());
        administrator.setEmail(adminEmail);
        administrator.setPhone(request.adminPhone().trim());
        administrator.setDesignation(text(request.adminDesignation(), "Primary Society Administrator"));
        administrator.setRole(UserRole.SOCIETY_ADMIN);
        administrator.setPasswordHash(passwordEncoder.encode(request.adminPassword()));
        administrator.setAccountLocked(false);
        users.save(administrator);
        return savedTenant;
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
        List<String> catalogue = List.of("Free", "Standard", "Premium");
        return plans.findAll().stream()
                .filter(plan -> catalogue.contains(plan.getName()))
                .sorted(java.util.Comparator.comparingInt(plan -> catalogue.indexOf(plan.getName())))
                .toList();
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
        SubscriptionPlan plan = plans.findById(planId)
                .orElseThrow(() -> new IllegalArgumentException("Plan was not found"));
        if (!List.of("Free", "Standard", "Premium").contains(plan.getName())) {
            throw new IllegalArgumentException("Only an active catalogue plan can be assigned");
        }
        tenant.setSubscriptionPlanId(plan.getId());
        tenant.setSubscriptionStartedOn(java.time.LocalDate.now());
        tenant.setSubscriptionRenewsOn(java.time.LocalDate.now().plusMonths(1));
        tenant.setSubscriptionStatus("ACTIVE");
        return tenants.save(tenant);
    }

    @GetMapping("/users")
    public List<Map<String, Object>> users() {
        return users.findAll().stream()
                .filter(user -> !"green-heights".equalsIgnoreCase(user.getTenantId()))
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

    private boolean isRealTenant(Tenant tenant) {
        return tenant != null && !"green-heights".equalsIgnoreCase(tenant.getCode())
                && !"green-heights".equalsIgnoreCase(tenant.getTenantId());
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
        plan.setPlanCode(text(request.planCode(), plan.getPlanCode()));
        plan.setDescription(text(request.description(), plan.getDescription()));
        plan.setMonthlyPrice(request.monthlyPrice());
        plan.setMaxApartments(request.maxApartments());
        plan.setMaxResidents(request.maxResidents());
        plan.setMaxAdmins(number(request.maxAdmins(), plan.getMaxAdmins(), 1));
        plan.setMaxSecurityStaff(number(request.maxSecurityStaff(), plan.getMaxSecurityStaff(), 1));
        plan.setMaxMaintenanceStaff(number(request.maxMaintenanceStaff(), plan.getMaxMaintenanceStaff(), 1));
        plan.setStorageGb(number(request.storageGb(), plan.getStorageGb(), 5));
        plan.setAuditHistoryDays(number(request.auditHistoryDays(), plan.getAuditHistoryDays(), 30));
        plan.setTrialDays(number(request.trialDays(), plan.getTrialDays(), 0));
        plan.setGraceDays(number(request.graceDays(), plan.getGraceDays(), 0));
        plan.setBillingCycle(text(request.billingCycle(), plan.getBillingCycle() == null ? "MONTHLY" : plan.getBillingCycle()));
        plan.setSupportLevel(text(request.supportLevel(), plan.getSupportLevel() == null ? "STANDARD" : plan.getSupportLevel()));
        plan.setActive(request.active() == null ? (plan.getActive() == null ? Boolean.TRUE : plan.getActive()) : request.active());
        plan.setFeatured(request.featured() == null ? Boolean.TRUE.equals(plan.getFeatured()) : request.featured());
        plan.setVisitorManagement(request.visitorManagement());
        plan.setAmenityBooking(request.amenityBooking());
        plan.setAnalytics(request.analytics());
        plan.setBillingManagement(Boolean.TRUE.equals(request.billingManagement()));
        plan.setComplaintManagement(Boolean.TRUE.equals(request.complaintManagement()));
        plan.setAnnouncementManagement(Boolean.TRUE.equals(request.announcementManagement()));
        plan.setExpenseManagement(Boolean.TRUE.equals(request.expenseManagement()));
        plan.setPaymentGateway(Boolean.TRUE.equals(request.paymentGateway()));
        plan.setApiAccess(Boolean.TRUE.equals(request.apiAccess()));
        plan.setPrioritySupport(Boolean.TRUE.equals(request.prioritySupport()));
    }

    private static String text(String requested, String fallback) {
        return requested == null ? (fallback == null ? "" : fallback) : requested.trim();
    }

    private static int number(Integer requested, Integer existing, int fallback) {
        return requested == null ? (existing == null ? fallback : existing) : Math.max(0, requested);
    }

    private static void requireText(String value, String message) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(message);
    }

    private void updateTenantFields(Tenant tenant, TenantRequest request) {
        tenant.setSocietyName(request.societyName().trim());
        tenant.setCity(request.city().trim());
        tenant.setContactEmail(text(request.contactEmail() == null ? request.adminEmail() : request.contactEmail(), tenant.getContactEmail()));
        tenant.setContactName(text(request.contactName() == null ? request.adminName() : request.contactName(), tenant.getContactName()));
        tenant.setPhone(text(request.phone() == null ? request.adminPhone() : request.phone(), tenant.getPhone()));
        tenant.setWebsite(text(request.website(), tenant.getWebsite()));
        tenant.setAddress(text(request.address(), tenant.getAddress()));
        tenant.setState(text(request.state(), tenant.getState()));
        tenant.setCountry(text(request.country(), tenant.getCountry()));
        tenant.setPostalCode(text(request.postalCode(), tenant.getPostalCode()));
        tenant.setSocietyType(text(request.societyType(), tenant.getSocietyType()));
        tenant.setRegistrationNumber(text(request.registrationNumber(), tenant.getRegistrationNumber()));
        tenant.setOnboardingNotes(text(request.onboardingNotes(), tenant.getOnboardingNotes()));
        if (request.totalUnits() != null) tenant.setTotalUnits(Math.max(0, request.totalUnits()));
        if (request.totalWings() != null) tenant.setTotalWings(Math.max(0, request.totalWings()));
        if (request.approved() != null) tenant.setApproved(request.approved());
        if (request.subscriptionPlanId() != null) {
            SubscriptionPlan plan = plans.findById(request.subscriptionPlanId())
                    .orElseThrow(() -> new IllegalArgumentException("Subscription plan was not found"));
            if (!List.of("Free", "Standard", "Premium").contains(plan.getName())) {
                throw new IllegalArgumentException("Select a plan from the active catalogue");
            }
            tenant.setSubscriptionPlanId(plan.getId());
            tenant.setSubscriptionStartedOn(java.time.LocalDate.now());
            tenant.setSubscriptionRenewsOn(java.time.LocalDate.now().plusMonths(1));
            tenant.setSubscriptionStatus("ACTIVE");
        }
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
            boolean analytics,
            String planCode,
            String description,
            Integer maxAdmins,
            Integer maxSecurityStaff,
            Integer maxMaintenanceStaff,
            Integer storageGb,
            Integer auditHistoryDays,
            Integer trialDays,
            Integer graceDays,
            String billingCycle,
            String supportLevel,
            Boolean active,
            Boolean featured,
            Boolean billingManagement,
            Boolean complaintManagement,
            Boolean announcementManagement,
            Boolean expenseManagement,
            Boolean paymentGateway,
            Boolean apiAccess,
            Boolean prioritySupport
    ) {}

    public record TenantRequest(
            @NotBlank String societyName,
            @NotBlank String city,
            @Email String contactEmail,
            String contactName,
            String phone,
            String website,
            String address,
            String state,
            String country,
            String postalCode,
            String societyType,
            String registrationNumber,
            @PositiveOrZero Integer totalUnits,
            @PositiveOrZero Integer totalWings,
            String onboardingNotes,
            Long subscriptionPlanId,
            Boolean approved,
            String adminName,
            String adminDesignation,
            @Email String adminEmail,
            String adminPhone,
            @Size(min = 8, max = 72) String adminPassword
    ) {}

    public record UserRequest(
            @NotBlank String fullName,
            @NotNull UserRole role,
            boolean locked
    ) {}
}
