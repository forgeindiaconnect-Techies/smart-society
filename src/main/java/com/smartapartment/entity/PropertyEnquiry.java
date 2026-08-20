package com.smartapartment.entity;
import jakarta.persistence.*;import lombok.Getter;import lombok.Setter;
@Getter @Setter @Entity @Table(name="property_enquiries")
public class PropertyEnquiry extends BaseEntity{private Long listingId;private Long customerId;private String name;private String phone;private String email;private String enquiryType;@Column(length=2000)private String message;}
