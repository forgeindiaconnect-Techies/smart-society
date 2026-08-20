package com.smartsociety.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "subscriptions")
public class Subscription extends BaseEntity {

    @ManyToOne
    @JoinColumn(name = "tenant_ref_id")
    private Tenant tenant;

    @ManyToOne
    private SubscriptionPlan plan;

    private LocalDate startDate;

    private LocalDate endDate;

    private String billingCycle;

    private String paymentStatus;
}
