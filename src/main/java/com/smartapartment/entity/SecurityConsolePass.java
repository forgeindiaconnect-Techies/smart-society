package com.smartapartment.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity @Getter @Setter
@Table(name = "security_console_passes", uniqueConstraints = @UniqueConstraint(columnNames = {"tenant_id", "visitor_id"}))
public class SecurityConsolePass extends BaseEntity {
    @ManyToOne(optional = false) private Visitor visitor;
    @ManyToOne(optional = false) private Gate assignedGate;
    private boolean allGates;
    private String pinDigest;
    private String tokenId;
    private LocalDateTime validUntil;
    private String direction = "ENTRY";
}
