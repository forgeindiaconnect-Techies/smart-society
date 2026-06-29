package com.smartsociety.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@Entity
@Table(name = "amenities")
public class Amenity extends BaseEntity {

    private String name;

    private int capacity;

    private BigDecimal bookingFee;

    private boolean approvalRequired;
}
