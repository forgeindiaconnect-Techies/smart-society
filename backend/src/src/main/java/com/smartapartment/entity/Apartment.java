package com.smartapartment.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "apartments")
public class Apartment extends BaseEntity {
    /** Stable, read-only public reference; existing records receive the same format. */
    @jakarta.persistence.Transient
    @com.fasterxml.jackson.annotation.JsonProperty(access = com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY)
    public String getApartmentCode() {
        return getId() == null ? null : String.format(java.util.Locale.ROOT, "SMT-%04d", getId());
    }


    @ManyToOne
    private Block block;

    private int floorNo;

    private String unitNo;

    private String unitType;

    private String occupancyStatus;

    private String ownerName;

    private String ownerPhone;

    private String ownerEmail;

    private Integer builtUpAreaSqFt;

    private String parkingSlot;

    private BigDecimal monthlyMaintenance;

    private LocalDate possessionDate;

    private String notes;
}
