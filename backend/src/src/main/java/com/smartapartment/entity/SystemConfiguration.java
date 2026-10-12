package com.smartapartment.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "system_configurations")
public class SystemConfiguration extends BaseEntity {

    private String configKey;
    
    private String configValue;
    
    private String description;
    
    // Config types: GLOBAL_PROFILE, SECURITY_POLICY, NOTIFICATION_PREF, etc.
    private String configType;
    
    private boolean isActive;
}
