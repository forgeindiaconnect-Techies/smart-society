package com.smartapartment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "role_access_policies")
public class RoleAccessPolicy extends BaseEntity {
    @Column(nullable = false, unique = true)
    private String roleName;

    @Column(nullable = false, length = 1000)
    private String permissions;

    @Column(length = 2000)
    private String modulePermissions = "";

    @Column(length = 1000)
    private String allowedActions = "";

    @Column(length = 40)
    private String dataScope = "ASSIGNED_SOCIETY";

    private Double approvalLimit = 0D;

    private Integer sessionTimeoutMinutes = 30;

    private Integer maxConcurrentSessions = 2;

    private Boolean mfaRequired = false;

    private Boolean sensitiveActionReauth = true;

    private Boolean ipRestrictionEnabled = false;

    private Boolean auditLoggingEnabled = true;

    private Boolean exportAllowed = false;

    @Column(length = 2000)
    private String policyNotes = "";

    private boolean active = true;
}
