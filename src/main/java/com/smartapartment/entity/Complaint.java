package com.smartapartment.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "complaints")
public class Complaint extends BaseEntity {

    @ManyToOne
    private Resident resident;

    private String category;

    private String priority;

    private String title;

    private String description;

    private String assignedTo;

    private String resolutionNotes;

    private String sparePartsUsed;

    private BigDecimal repairCost;

    private LocalDateTime dueAt;
    private LocalDateTime escalatedAt;
    private LocalDateTime closedAt;
}
