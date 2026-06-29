package com.smartsociety.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "audit_logs")
public class AuditLog extends BaseEntity {

    private Long userId;

    private String action;

    private String module;

    private String ipAddress;

    @Column(length = 3000)
    private String details;
}
