package com.smartapartment.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

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
}
