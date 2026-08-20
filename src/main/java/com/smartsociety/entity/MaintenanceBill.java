package com.smartsociety.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "maintenance_bills")
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
