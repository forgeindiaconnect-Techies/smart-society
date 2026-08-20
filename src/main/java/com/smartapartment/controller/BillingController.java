package com.smartapartment.controller;

import com.smartapartment.service.BillingService;
import com.smartapartment.service.CurrentUserService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/billing")
public class BillingController {

    private final BillingService billingService;
    private final CurrentUserService currentUser;

    public BillingController(BillingService billingService, CurrentUserService currentUser) {
        this.billingService = billingService;
        this.currentUser = currentUser;
    }

    @PostMapping("/generate")
    public Map<String, Object> generate(@RequestParam(defaultValue = "2500") BigDecimal amount,
                                        @RequestParam(required = false) String month) {
        YearMonth cycle = parseMonth(month);
        int count = billingService.generateMonthlyBills(currentUser.requireTenantId(), cycle.toString(), amount);
        return Map.of("message", "Bills generated", "count", count, "month", cycle.toString());
    }

    private YearMonth parseMonth(String month) {
        if (month == null || month.isBlank()) return YearMonth.now();
        try { return YearMonth.parse(month.trim()); }
        catch (Exception ignored) { return YearMonth.parse(month.trim(), DateTimeFormatter.ofPattern("MMMM uuuu", Locale.ENGLISH)); }
    }
}
