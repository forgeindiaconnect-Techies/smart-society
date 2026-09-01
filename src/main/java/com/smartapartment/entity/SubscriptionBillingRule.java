package com.smartapartment.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "subscription_billing_rules")
public class SubscriptionBillingRule extends BaseEntity {
    private String ruleName;
    private String planName;
    private BigDecimal amount;
    private String billingCycle;
    private Integer graceDays;
    private LocalDate effectiveFrom;
    private String invoicePrefix;
    private BigDecimal taxRate;
    private BigDecimal lateFee;
    private Boolean autoRenew = false;
    private Boolean proratedBilling = false;
    private String notes;
}
