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

    private LocalDateTime workStartedAt;
    private LocalDateTime estimatedCompletionAt;

    public String getWorkProgress() {
        return switch (ticketStatus == null ? "REQUESTED" : ticketStatus) {
            case "ASSIGNED" -> "Started";
            case "DISPATCHED", "IN_PROGRESS" -> "Processing";
            case "RESOLVED", "CLOSED", "INVOICED" -> "Completed";
            case "ON_HOLD" -> "On hold";
            case "CANCELLED" -> "Cancelled";
            default -> "Awaiting assignment";
        };
    }

    @Column(nullable = false, length = 40)
    private String sourcePlatform;

    @Column(name = "ticket_code", length = 32, unique = true)
    private String ticketCode;

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


    @com.fasterxml.jackson.annotation.JsonProperty(access = com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY)
    public String getTicketId() {
        if (ticketCode != null && !ticketCode.isBlank()) return ticketCode;
        if (getId() == null) return null;
        int year = getCreatedAt() != null ? getCreatedAt().getYear() : java.time.LocalDate.now().getYear();
        return String.format(java.util.Locale.ROOT, "TCK-%04d-%04d", year, getId());
    }

    @com.fasterxml.jackson.annotation.JsonProperty(access = com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY)
    public String getTicketReference() {
        return getId() == null ? null : String.format(java.util.Locale.ROOT, "TKT-%05d", getId());
    }
}
