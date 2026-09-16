package com.smartapartment.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Column;
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

    private String visitorEmail;

    private String purpose;

    private String vehicleNumber;

    private String photoReference;

    private String idProofType;

    private String idProofNumber;

    private Integer personsCount;

    private String specialInstructions;

    private String entryType = "GUEST";

    // Legacy display field retained for backward compatibility. New code uses entryGate/exitGate.
    private String gateNumber;

    @Column(length = 40, unique = true)
    private String passNumber;

    @Column(length = 40)
    private String visitorCategory;

    @ManyToOne
    private Gate entryGate;

    @ManyToOne
    private Gate exitGate;

    @ManyToOne
    private AppUser entrySecurity;

    @ManyToOne
    private AppUser exitSecurity;

    private LocalDateTime exitTime;

    private String qrCode;

    private String approvalStatus;

    private LocalDateTime expectedAt;

    private LocalDateTime checkInAt;

    private LocalDateTime checkOutAt;
}
