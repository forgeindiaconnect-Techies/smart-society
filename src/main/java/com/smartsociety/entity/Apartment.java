package com.smartsociety.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "apartments")
public class Apartment extends BaseEntity {

    @ManyToOne
    private Block block;

    private int floorNo;

    private String unitNo;

    private String unitType;

    private String occupancyStatus;

    private String ownerName;

    private String ownerPhone;
}
