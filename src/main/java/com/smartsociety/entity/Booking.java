package com.smartsociety.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "bookings")
public class Booking extends BaseEntity {

    @ManyToOne
    private Amenity amenity;

    @ManyToOne
    private Resident resident;

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    private String approvalStatus;
}
