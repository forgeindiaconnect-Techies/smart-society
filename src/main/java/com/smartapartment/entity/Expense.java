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
@Table(name = "expenses")
public class Expense extends BaseEntity {

    private String category;

    private String expenseTitle;

    private String vendorName;

    private String vendorPhone;

    private String invoiceNumber;

    private LocalDate invoiceDate;

    private LocalDate dueDate;

    private BigDecimal amount;

    private BigDecimal taxAmount;

    private LocalDate expenseDate;

    private String approvalStatus;

    private String paymentMode;

    private String paymentReference;

    private LocalDate paidDate;

    @jakarta.persistence.Column(length = 2000)
    private String description;

    @jakarta.persistence.Column(length = 1000)
    private String approvalNote;
}
