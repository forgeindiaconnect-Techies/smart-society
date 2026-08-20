package com.smartapartment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

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
