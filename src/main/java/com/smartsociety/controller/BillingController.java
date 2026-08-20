package com.smartsociety.controller;

import com.smartsociety.security.TenantContext;
import com.smartsociety.service.BillingService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.Map;

@RestController
@RequestMapping("/api/billing")
public class BillingController {

    private final BillingService billingService;

    public BillingController(BillingService billingService) {
        this.billingService = billingService;
    }

    @PostMapping("/generate")
    public Map<String, Object> generate(@RequestParam(defaultValue = "2500") BigDecimal amount) {
        int count = billingService.generateMonthlyBills(TenantContext.getOrDefault(), YearMonth.now().toString(), amount);
        return Map.of("message", "Bills generated", "count", count);
    }
}
