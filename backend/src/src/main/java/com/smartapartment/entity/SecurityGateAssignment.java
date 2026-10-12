package com.smartapartment.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalTime;

@Getter
@Setter
@Entity
@Table(name = "security_gate_assignments", uniqueConstraints = @UniqueConstraint(columnNames = {"tenant_id", "security_guard_id", "gate_id"}))
public class SecurityGateAssignment extends BaseEntity {
    @ManyToOne(optional = false)
    private AppUser securityGuard;

    @ManyToOne(optional = false)
    private Gate gate;

    private LocalTime shiftStart;
    private LocalTime shiftEnd;
}
