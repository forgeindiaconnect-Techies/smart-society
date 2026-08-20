package com.smartapartment.entity;
import jakarta.persistence.*;import java.time.LocalDateTime;import lombok.Getter;import lombok.Setter;
@Getter @Setter @Entity @Table(name="property_visits")
public class PropertyVisit extends BaseEntity{private Long customerId;@ManyToOne(optional=false)private PropertyListing listing;private LocalDateTime scheduledAt;private String visitStatus;@Column(length=1000)private String notes;}
