package com.smartapartment.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Immutable;
import java.time.LocalDateTime;

/** Append-only through the application: no update or delete endpoint. */
@Entity @Immutable @Getter @Setter
@Table(name = "security_console_events")
public class SecurityConsoleEvent {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false, updatable = false) private String tenantId;
    @Column(updatable = false) private Long guardId;
    @Column(updatable = false) private String guardName;
    @Column(updatable = false) private Long gateId;
    @Column(updatable = false) private String gateNumber;
    @Column(updatable = false) private Long visitorId;
    @Column(updatable = false) private String visitorName;
    @Column(updatable = false) private String eventType;
    @Column(updatable = false) private String severity;
    @Column(length = 2000, updatable = false) private String details;
    @Lob @Column(updatable = false) private String photo;
    @Column(nullable = false, updatable = false) private LocalDateTime occurredAt = LocalDateTime.now();
}
