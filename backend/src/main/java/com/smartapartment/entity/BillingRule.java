package com.smartapartment.entity;
import jakarta.persistence.*;import java.math.BigDecimal;import java.time.LocalDate;import lombok.Getter;import lombok.Setter;
@Getter @Setter @Entity @Table(name="billing_rules",uniqueConstraints=@UniqueConstraint(name="uk_billing_rule_tenant_name",columnNames={"tenant_id","name"}))
public class BillingRule extends BaseEntity{ @Column(nullable=false)private String name;    private BigDecimal amount;

    // Late fee configurations
    private Double lateFeePercentage;
    
    private Double lateFeeFixedAmount;
    
    private boolean autoCalculateLateFees;
private int dueDay;private BigDecimal lateFee;private String frequency;private LocalDate nextRunDate;private boolean automatic; }
