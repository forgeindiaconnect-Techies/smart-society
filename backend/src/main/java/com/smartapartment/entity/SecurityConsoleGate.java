package com.smartapartment.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalTime;

/** Security-console policy; leaves the legacy gate administration contract intact. */
@Entity @Getter @Setter
@Table(name = "security_console_gates", uniqueConstraints = @UniqueConstraint(columnNames = {"tenant_id", "gate_id"}))
public class SecurityConsoleGate extends BaseEntity {
    @ManyToOne(optional = false) private Gate gate;
    private String designatedType = "VEHICULAR_MAIN";
    private String operatingStatus = "OPEN";
    private LocalTime opensAt;
    private LocalTime closesAt;
}
