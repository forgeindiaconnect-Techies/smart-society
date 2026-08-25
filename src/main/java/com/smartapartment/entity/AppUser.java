package com.smartapartment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "users")
public class AppUser extends BaseEntity {

    @Column(nullable = false)
    private String fullName;

    @Column(nullable = false, unique = true)
    private String email;

    private String phone;

    private String designation;

    private String employeeId;

    private LocalDate joiningDate;

    private String workShift;

    private String address;

    private String emergencyContactName;

    private String emergencyContactPhone;

    private String profileNotes;

    @Column(nullable = false)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    private UserRole role;

    private boolean accountLocked;

    // Super Admin security controls
    private boolean mfaEnabled;
    
    private String mfaSecret;

    // Super Admin access controls
    private boolean mobileAppAuthorized;
    
    @Column(name = "access_revoked_at")
    private java.time.LocalDateTime accessRevokedAt;}
