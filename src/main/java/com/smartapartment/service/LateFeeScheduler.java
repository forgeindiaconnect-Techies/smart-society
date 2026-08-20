package com.smartapartment.service;

import com.smartapartment.entity.BillingRule;
import com.smartapartment.entity.MaintenanceBill;
import com.smartapartment.repository.BillingRuleRepository;
import com.smartapartment.repository.MaintenanceBillRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LateFeeScheduler {
    private final BillingRuleRepository rules;
    private final MaintenanceBillRepository bills;

    public LateFeeScheduler(BillingRuleRepository rules, MaintenanceBillRepository bills) {
        this.rules = rules;
        this.bills = bills;
    }

    @Scheduled(cron = "0 10 0 * * *")
    @Transactional
    public void applyOverdueLateFees() {
        for (BillingRule rule : rules.findAll()) {
            if (!rule.isAutoCalculateLateFees()) continue;
            bills.findByTenantIdAndPaymentStatusIgnoreCaseAndDueDateBefore(rule.getTenantId(), "UNPAID", LocalDate.now())
                    .stream().filter(bill -> bill.getLateFee() == null || bill.getLateFee().signum() == 0)
                    .forEach(bill -> { BigDecimal fee = feeFor(rule, bill); if (fee.signum() > 0) { bill.setLateFee(fee); bill.setTotalAmount(bill.getBaseAmount().add(fee)); } });
        }
    }

    private BigDecimal feeFor(BillingRule rule, MaintenanceBill bill) {
        if (rule.getLateFeeFixedAmount() != null) return BigDecimal.valueOf(rule.getLateFeeFixedAmount());
        if (rule.getLateFeePercentage() != null && bill.getBaseAmount() != null) return bill.getBaseAmount()
                .multiply(BigDecimal.valueOf(rule.getLateFeePercentage())).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        return rule.getLateFee() == null ? BigDecimal.ZERO : rule.getLateFee();
    }
}
