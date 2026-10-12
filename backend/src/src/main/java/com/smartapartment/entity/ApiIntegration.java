package com.smartapartment.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "api_integrations")
public class ApiIntegration extends BaseEntity {

    private String serviceName;
    
    private String apiKey;
    
    private String apiSecret;
    
    private String webhookUrl;
    
    private boolean isActive;
    
    private String description;
}
