package com.smartsociety.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "payments")
public class Payment extends BaseEntity {

    @ManyToOne
    private MaintenanceBill bill;

    private BigDecimal amount;

    private String paymentMode;

    private String transactionId;

    private String paymentStatus;

    private LocalDateTime paidAt;
}
