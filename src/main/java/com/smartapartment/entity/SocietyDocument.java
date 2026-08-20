package com.smartapartment.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter @Entity @Table(name="society_documents")
public class SocietyDocument extends BaseEntity {
    @Column(nullable=false) private String name;
    private String category;
    private String contentType;
    private String storageUrl;
    private Long uploadedByUserId;
}
