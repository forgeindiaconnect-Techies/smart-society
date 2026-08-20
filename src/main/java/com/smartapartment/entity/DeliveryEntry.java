package com.smartapartment.entity;
import jakarta.persistence.*;import java.time.LocalDateTime;import lombok.Getter;import lombok.Setter;
@Getter @Setter @Entity @Table(name="delivery_entries")
public class DeliveryEntry extends BaseEntity{ @ManyToOne(optional=false)private Apartment apartment;private String provider;private String agentName;private String agentPhone;private String packageType;private String approvalStatus;private LocalDateTime arrivedAt;private LocalDateTime collectedAt;private String trackingNumber;private String recipientName;private String storageLocation;private String packageCondition;private String deliveryNotes;private String photoReference;private String collectedBy; }
