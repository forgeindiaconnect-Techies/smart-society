package com.smartapartment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "workflow_actions")
public class WorkflowAction extends BaseEntity {
    @Column(nullable = false, length = 40)
    private String workspace;

    @Column(nullable = false, length = 40)
    private String dashboardRole;

    @Column(nullable = false, length = 80)
    private String panel;

    @Column(nullable = false, length = 80)
    private String actionType;

    @Column(nullable = false, length = 500)
    private String targetLabel;

    @Column(length = 180)
    private String actorRef;

    @Column(nullable = false, length = 40)
    private String workflowStatus;

    @Lob
    @Column(columnDefinition = "CLOB")
    private String detailsJson;
}
