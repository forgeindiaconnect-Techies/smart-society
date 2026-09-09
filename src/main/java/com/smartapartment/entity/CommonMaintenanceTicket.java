package com.smartapartment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "common_maintenance_tickets")
public class CommonMaintenanceTicket extends BaseEntity {

    @Column(nullable = false, length = 40)
    private String sourcePlatform;

    @Column(nullable = false, length = 80)
    private String targetEntityType;

    private Long targetEntityId;

    private Long requesterId;

    @Column(length = 120)
    private String requesterName;

    @Column(length = 40)
    private String requesterPhone;

    @Column(length = 160)
    private String requesterEmail;

    @Column(nullable = false, length = 120)
    private String serviceType;

    @Column(length = 120)
    private String serviceCategory;

    @Column(length = 120)
    private String serviceOption;

    @Column(length = 80)
    private String priceLabel;

    @Column(length = 80)
    private String warrantyLabel;

    @Column(nullable = false, length = 180)
    private String title;

    @Column(length = 3000)
    private String description;

    @Column(length = 600)
    private String serviceAddress;

    @Column(length = 60)
    private String city;

    @Column(length = 30)
    private String priority;

    @Column(length = 40)
    private String ticketStatus;

    private LocalDateTime preferredAt;

    private LocalDateTime alternateAt;

    private LocalDateTime dueAt;

    private LocalDateTime assignedAt;

    private LocalDateTime resolvedAt;

    private Long vendorId;

    @Column(length = 120)
    private String vendorName;

    @Column(length = 40)
    private String vendorPhone;

    @Column(length = 160)
    private String vendorEmail;

    @Column(length = 80)
    private String externalReference;

    @Column(length = 3000)
    private String vendorNotes;

    @Column(length = 1200)
    private String billReference;

    @Column(length = 80)
    private String accessType;

    @Column(length = 80)
    private String contactMethod;

    @Column(length = 120)
    private String attachmentReference;
}
