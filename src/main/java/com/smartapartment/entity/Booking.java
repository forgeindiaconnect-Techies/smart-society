package com.smartapartment.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.math.BigDecimal;

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

    private BigDecimal amount;

    private String paymentMethod;

    private String paymentStatus;

    private String paymentReference;

    private String bookingReference;
    private String eventType;
    private String eventPurpose;
    private Integer expectedGuests;
    private Integer childrenCount;
    private Integer vehicleCount;
    private String organizerName;
    private String organizerPhone;
    private String organizerEmail;
    private String setupStyle;
    private String equipmentRequired;
    private String cateringDetails;
    private String decorationDetails;
    private String accessibilityNeeds;
    private String vehicleDetails;
    private BigDecimal securityDeposit;
    private String depositStatus;
    private String termsAccepted;
    private String emergencyContact;
    private String specialInstructions;
}
