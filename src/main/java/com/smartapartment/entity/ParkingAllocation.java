package com.smartapartment.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter @Entity
@Table(name="parking_allocations", uniqueConstraints=@UniqueConstraint(name="uk_parking_tenant_slot", columnNames={"tenant_id","slot_number"}))
public class ParkingAllocation extends BaseEntity {
    @Column(name="slot_number", nullable=false) private String slotNumber;
    @ManyToOne(optional=false) private Apartment apartment;
    private String vehicleNumber;
    private String vehicleType;
}
