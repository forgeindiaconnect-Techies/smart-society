package com.smartapartment.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "gate_incidents")
public class GateIncident extends BaseEntity {
    private String incidentType;
    private String description;
    private String location;
    private String vehicleNumber;
    private String severity;
    private String peopleInvolved;
    private String immediateAction;
    private String escalatedTo;
    private String emergencyServices;
    private String evidenceReference;
    private String witnessDetails;
    private String resolutionStatus;
    private String reportedBy;
    private LocalDateTime occurredAt;
}
