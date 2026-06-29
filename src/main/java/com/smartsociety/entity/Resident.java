package com.smartsociety.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "residents")
public class Resident extends BaseEntity {

    @OneToOne
    private AppUser user;

    @ManyToOne
    private Apartment apartment;

    private String residentType;

    private LocalDate moveInDate;

    private String vehicleNumber;
}
