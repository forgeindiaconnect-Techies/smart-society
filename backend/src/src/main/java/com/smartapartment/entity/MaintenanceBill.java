package com.smartapartment.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "maintenance_bills", uniqueConstraints = @UniqueConstraint(
        name = "uk_bill_tenant_apartment_month", columnNames = {"tenant_id", "apartment_id", "bill_month"}))
public class MaintenanceBill extends BaseEntity {

    @ManyToOne
    private Apartment apartment;

    private String billMonth;

    private BigDecimal baseAmount;

    private String invoiceNumber;

    private LocalDate invoiceDate;

    private LocalDate billingPeriodStart;

    private LocalDate billingPeriodEnd;

    private BigDecimal baseRatePerSqFt;

    private Integer billedAreaSqFt;

    private BigDecimal waterPreviousReading;

    private BigDecimal waterCurrentReading;

    private BigDecimal waterUnits;

    private BigDecimal waterRatePerUnit;

    private BigDecimal waterAmount;

    private BigDecimal commonPowerFee;

    private BigDecimal sinkingFund;

    private BigDecimal repairReserve;

    private BigDecimal parkingFee;

    private BigDecimal amenityFee;

    private BigDecimal otherCharges;

    private String otherChargeDescription;

    private BigDecimal previousBalance;

    private BigDecimal creditAdjustment;

    private BigDecimal taxableAmount;

    private BigDecimal cgstRate;

    private BigDecimal cgstAmount;

    private BigDecimal sgstRate;

    private BigDecimal sgstAmount;

    private BigDecimal roundOff;

    private BigDecimal lateFee;

    private BigDecimal totalAmount;

    private LocalDate dueDate;

    private String paymentStatus;

    private String paymentTerms;

    private String bankName;

    private String bankAccountNumber;

    private String bankIfsc;

    private String upiId;

    private String societyGstin;

    private String societyPan;

    private String notes;
}
