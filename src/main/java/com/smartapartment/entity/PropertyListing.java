package com.smartapartment.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter @Entity @Table(name = "property_listings")
public class PropertyListing extends BaseEntity {
    private Long customerId;
    @JsonIgnore @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", foreignKey = @ForeignKey(name = "fk_property_owner"))
    private PropertyCustomer owner;
    private String title;
    @Column(length = 4000) private String description;
    private String society;
    private String locality;
    @Column(length = 1000) private String address;
    private String city;
    private String pincode;
    private String listingType;
    private String propertyType = "APARTMENT";
    private BigDecimal price;
    private BigDecimal deposit;
    private BigDecimal maintenance;
    private Integer areaSqft;
    private String bhk;
    private Integer bathrooms;
    private String furnishing;
    private String parking;
    private LocalDate availableFrom;
    private Double latitude;
    private Double longitude;
    private String verificationStatus = "PENDING";
    private String reviewedBy;
    private LocalDateTime reviewedAt;
    @Column(length = 2000) private String reviewNote;
    @Column(length = 2000) private String rejectionReason;
    private long viewCount;
    private String imageUrl;
    @Lob @Column(columnDefinition = "CLOB") private String imageUrls;
    @Column(length = 2000) private String amenities;
    @Column(length = 2000) private String notes;
}
