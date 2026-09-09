package com.smartapartment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "security_guard_assignments")
public class SecurityGuardAssignment extends BaseEntity {

    @ManyToOne(optional = false)
    private AppUser securityGuard;

    @Column(nullable = false, length = 80)
    private String assignmentType;

    @Column(nullable = false, length = 160)
    private String assignmentValue;

    @Column(length = 120)
    private String shiftName;

    @Column(length = 500)
    private String notes;
}
