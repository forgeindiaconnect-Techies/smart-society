package com.smartapartment.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "bank_accounts")
public class BankAccount extends BaseEntity {

    private String accountName;
    
    private String accountNumber;
    
    private String ifscCode;
    
    private String bankName;
    
    private String branchName;
    
    private boolean isPrimary;
    
    private boolean isActive;
}
