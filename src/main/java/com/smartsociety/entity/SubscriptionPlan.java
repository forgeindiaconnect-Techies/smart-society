package com.smartsociety.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@Entity
@Table(name = "subscription_plans")
public class SubscriptionPlan extends BaseEntity {

    private String name;

    private BigDecimal monthlyPrice;

    private Integer maxApartments;

    private Integer maxResidents;

    private boolean visitorManagement;

    private boolean amenityBooking;

    private boolean analytics;
}
