package com.smartapartment.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity @Getter @Setter
@Table(name = "security_console_watchlist")
public class SecurityConsoleWatch extends BaseEntity {
    private String identifierType;
    private String identifierValue;
    private String reason;
}
