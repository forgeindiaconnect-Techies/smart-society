package com.smartsociety.entity;

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

    private String vendorName;

    private BigDecimal amount;

    private LocalDate expenseDate;

    private String approvalStatus;
}
