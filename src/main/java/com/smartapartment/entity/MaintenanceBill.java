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

    private BigDecimal lateFee;

    private BigDecimal totalAmount;

    private LocalDate dueDate;

    private String paymentStatus;
}
