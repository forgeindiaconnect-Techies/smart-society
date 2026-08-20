package com.smartapartment.controller.superadmin;

import com.smartapartment.entity.SubscriptionBillingRule;
import com.smartapartment.repository.SubscriptionBillingRuleRepository;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;
import java.util.Map;
import java.math.BigDecimal;

@RestController
@PreAuthorize("hasRole('SUPER_ADMIN')")
@RequestMapping("/api/superadmin/subscriptions")
public class SuperAdminSubscriptionController {
    private final SubscriptionBillingRuleRepository rules;
    public SuperAdminSubscriptionController(SubscriptionBillingRuleRepository rules) { this.rules = rules; }

    @GetMapping("/data")
    public ResponseEntity<Map<String, Object>> getSubscriptionData() {
        return ResponseEntity.ok(Map.of(
            "mapping", List.of(
                Map.of("society", "Green Nest Apartments", "plan", "Premium", "flats", "486 / Unlimited", "renewal", "02 Aug 2026", "adminOwner", "Arun Kumar", "status", "Current"),
                Map.of("society", "Lakeview Residency", "plan", "Standard", "flats", "214 / 500", "renewal", "18 Jul 2026", "adminOwner", "Rekha N", "status", "Renewal Due"),
                Map.of("society", "Urban Heights", "plan", "Free", "flats", "48 / 50", "renewal", "Trial ends 10 Jul 2026", "adminOwner", "Dev M", "status", "Upgrade Needed")
            ),
            "admins", List.of(
                Map.of("admin", "Arun Kumar", "society", "Green Nest Apartments", "role", "Society Admin", "lastLogin", "Today 10:42 AM", "mfa", "Enabled", "status", "Active"),
                Map.of("admin", "Rekha N", "society", "Lakeview Residency", "role", "Society Admin", "lastLogin", "Yesterday 6:14 PM", "mfa", "Pending", "status", "MFA Pending"),
                Map.of("admin", "Dev M", "society", "Urban Heights", "role", "Trial Admin", "lastLogin", "Jul 1, 2026", "mfa", "Disabled", "status", "Needs Review")
            ),
            "rules", ensureRules().stream().map(rule -> Map.of("id", rule.getId(), "rule", rule.getRuleName(), "plan", rule.getPlanName(), "amount", "Rs. " + rule.getAmount(), "cycle", rule.getBillingCycle(), "grace", rule.getGraceDays() + " days", "status", rule.getStatus())).toList()
        ));
    }

    @PutMapping("/rules/{id}") @Transactional
    public SubscriptionBillingRule updateBillingRule(@PathVariable Long id, @Valid @RequestBody RuleRequest request) {
        SubscriptionBillingRule rule = rules.findById(id).orElseThrow(() -> new IllegalArgumentException("Billing rule was not found"));
        rule.setRuleName(request.ruleName()); rule.setPlanName(request.planName()); rule.setAmount(request.amount()); rule.setBillingCycle(request.billingCycle()); rule.setGraceDays(request.graceDays()); rule.setStatus(request.status());
        return rules.save(rule);
    }

    @Transactional List<SubscriptionBillingRule> ensureRules() { if (rules.count() == 0) { create("Starter Trial","Free",BigDecimal.ZERO,"30 days",0,"Active"); create("Standard Monthly","Standard",new BigDecimal("4999"),"Monthly",7,"Live"); create("Premium Monthly","Premium",new BigDecimal("9999"),"Monthly",10,"Review"); } return rules.findAllByOrderByCreatedAtAsc(); }
    private void create(String name,String plan,BigDecimal amount,String cycle,int grace,String status){ SubscriptionBillingRule rule=new SubscriptionBillingRule(); rule.setTenantId("platform"); rule.setRuleName(name); rule.setPlanName(plan); rule.setAmount(amount); rule.setBillingCycle(cycle); rule.setGraceDays(grace); rule.setStatus(status); rules.save(rule); }
    public record RuleRequest(@NotBlank String ruleName,@NotBlank String planName,@NotNull @PositiveOrZero BigDecimal amount,@NotBlank String billingCycle,@NotNull @PositiveOrZero Integer graceDays,@NotBlank String status) {}
}
