package com.smartapartment.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity @Getter @Setter
@Table(name = "maintenance_partners")
public class MaintenancePartner extends BaseEntity {
    @Column(nullable = false) private Long userId;
    private String name;
    private String phone;
    private Long hubId;
    private String trade; // Primary trade / skill
    private String skillCategories;
    private String employmentType = "THIRD_PARTY"; // INTERNAL or THIRD_PARTY
    private String company;
    private boolean onDuty = true; // Duty State: On Duty vs Off Duty
    private String workState = "IDLE"; // Work State: IDLE, BUSY, OFFLINE
    private String availability = "IDLE";
    private Double coverageRadiusKm = 10.0;
    private Double latitude;
    private Double longitude;
    private LocalDateTime locationUpdatedAt;
    private Float rating = 0.0f;
    private Integer ratingCount = 0;
}
