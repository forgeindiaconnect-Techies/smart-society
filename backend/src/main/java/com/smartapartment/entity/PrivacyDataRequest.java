package com.smartapartment.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "privacy_data_requests")
public class PrivacyDataRequest extends BaseEntity {

    private Long requestedByUserId;
    
    // Type of request: DELETION, EXPORT, CORRECTION
    private String requestType;
    
    // PENDING, PROCESSED, REJECTED
    private String status;
    
    private String details;
    
    private java.time.LocalDateTime processedAt;
    
    private Long processedByAdminId;
}
