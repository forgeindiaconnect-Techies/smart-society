package com.smartapartment.entity;

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

    private String planCode;

    private String description;

    private BigDecimal monthlyPrice;

    private Integer maxApartments;

    private Integer maxResidents;

    private Integer maxAdmins;

    private Integer maxSecurityStaff;

    private Integer maxMaintenanceStaff;

    private Integer storageGb;

    private Integer auditHistoryDays;

    private Integer trialDays;

    private Integer graceDays;

    private String billingCycle;

    private String supportLevel;

    private Boolean active = true;

    private Boolean featured = false;

    private boolean visitorManagement;

    private boolean amenityBooking;

    private boolean analytics;

    private Boolean billingManagement = false;

    private Boolean complaintManagement = false;

    private Boolean announcementManagement = false;

    private Boolean expenseManagement = false;

    private Boolean paymentGateway = false;

    private Boolean apiAccess = false;

    private Boolean prioritySupport = false;
}
