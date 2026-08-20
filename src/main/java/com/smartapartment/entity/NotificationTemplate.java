package com.smartapartment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "notification_templates")
public class NotificationTemplate extends BaseEntity {

    private String templateName;
    
    // SMS, EMAIL, PUSH
    private String channel;
    
    private String subject;
    
    @Column(length = 2000)
    private String bodyContent;
    
    private boolean isActive;
}
