package com.smartsociety.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

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
}
