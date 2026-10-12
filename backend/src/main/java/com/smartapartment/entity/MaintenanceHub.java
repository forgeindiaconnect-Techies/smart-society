package com.smartapartment.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity @Getter @Setter
@Table(name = "maintenance_hubs")
public class MaintenanceHub extends BaseEntity {
    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false, length = 80)
    private String city;

    @Column(length = 120)
    private String area;

    private Double latitude;
    private Double longitude;
    private Double radiusKm = 10.0;
    private boolean active = true;

    public Double getCoverageRadiusKm() {
        return radiusKm == null ? 10.0 : radiusKm;
    }

    public void setCoverageRadiusKm(Double coverageRadiusKm) {
        this.radiusKm = coverageRadiusKm;
    }
}
