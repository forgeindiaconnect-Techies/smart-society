package com.smartapartment.entity;
import jakarta.persistence.*;import java.time.LocalDateTime;import lombok.Getter;import lombok.Setter;
@Getter @Setter @Entity @Table(name="property_service_requests")
public class PropertyServiceRequest extends BaseEntity{private Long customerId;private Long listingId;private String serviceType;private LocalDateTime preferredAt;private String requestStatus;@Column(length=1500)private String details;}
