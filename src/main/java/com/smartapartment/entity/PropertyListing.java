package com.smartapartment.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter @Entity @Table(name = "properties")
public class PropertyListing extends BaseEntity {
    /** Stable, read-only public reference; existing records receive the same format. */
    @jakarta.persistence.Transient
    @com.fasterxml.jackson.annotation.JsonProperty(access = com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY)
    public String getApartmentCode() {
        return getId() == null ? null : String.format(java.util.Locale.ROOT, "PDT-%04d", getId());
    }

    // 1. Primary Key inherited from BaseEntity: id
    
    // 2-3. Title & Description
    private String title;
    @Column(length = 4000) private String description;
    
    // 4-5. Categorization
    @Column(name = "property_type") private String propertyType = "APARTMENT";
    @Column(name = "listing_type") private String listingType = "RENT";
    
    // 6-9. Financials & Core Dimensions
    private BigDecimal price;
    private Integer bedrooms = 2;
    private Integer bathrooms = 2;
    private Integer area = 1200; // sqft
    
    // 10-12. Detailed Area Specs
    @Column(name = "carpet_area") private Integer carpetArea;
    @Column(name = "built_up_area") private Integer builtUpArea;
    @Column(name = "plot_area") private Integer plotArea;
    
    // 13-18. Structure & Condition
    private Integer floor;
    @Column(name = "total_floors") private Integer totalFloors;
    private String facing;
    private String furnishing;
    @Column(name = "construction_status") private String constructionStatus = "Ready to Move";
    @Column(name = "property_age") private String propertyAge = "1-3 Years";
    
    // 19-24. Location Hierarchy
    @Column(length = 1000) private String address;
    private String city;
    private String state;
    private String pincode;
    private Double latitude;
    private Double longitude;
    
    // 25-26. Ownership & Agent Links
    @Column(name = "owner_id") private Long ownerId;
    @Column(name = "agent_id") private Long agentId;
    
    // 27-28. Statuses
    private String status = "PUBLISHED"; // Pending, Published, Rejected, Suspended, Sold, Rented, Expired
    @Column(name = "verification_status") private String verificationStatus = "VERIFIED"; // Pending, Verified, Rejected
    
    // Additional fields for application rendering
    private String society;
    private String locality;
    private BigDecimal deposit;
    private BigDecimal maintenance;
    private String bhk;
    private String parking;
    private LocalDate availableFrom;
    private String reviewedBy;
    private LocalDateTime reviewedAt;
    @Column(length = 2000) private String reviewNote;
    @Column(length = 2000) private String rejectionReason;
    private long viewCount;
    private String imageUrl;
    @Lob @Column(columnDefinition = "CLOB") private String imageUrls;
    @Column(length = 2000) String amenities;
    @Column(length = 2000) String notes;

    public Integer getAreaSqft() { return area; }
    public void setAreaSqft(Integer areaSqft) { this.area = areaSqft; }
    public Long getCustomerId() { return ownerId; }
    public void setCustomerId(Long customerId) { this.ownerId = customerId; }
    public void setOwner(PropertyCustomer customer) { if (customer != null) this.ownerId = customer.getId(); }
}
