package com.smartapartment.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "helpdesk_routing_rules")
public class HelpdeskRoutingRule extends BaseEntity {

    private String issueCategory;
    
    private Long primaryAssigneeRoleId; // Alternatively store UserRole enum
    
    private Long escalationAssigneeRoleId;
    
    // SLA in hours
    private Integer escalationSlaHours;
    
    private boolean isActive;
}
