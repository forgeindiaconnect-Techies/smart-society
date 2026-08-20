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
@Table(name = "visitors")
public class Visitor extends BaseEntity {

    @ManyToOne
    private Resident resident;

    private String visitorName;

    private String visitorPhone;

    private String purpose;

    private String qrCode;

    private String approvalStatus;

    private LocalDateTime expectedAt;

    private LocalDateTime checkInAt;

    private LocalDateTime checkOutAt;
}
