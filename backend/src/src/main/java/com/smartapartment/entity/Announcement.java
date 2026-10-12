package com.smartapartment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "announcements")
public class Announcement extends BaseEntity {

    private String title;

    @Column(length = 3000)
    private String message;

    @Column(nullable = false)
    private java.time.LocalDateTime validUntil;

    private boolean isGlobal;

    private String audience;

    private String recipientEmail;

    private boolean emergency;

    private String category;

    private java.time.LocalDateTime effectiveFrom;

    private boolean actionRequired;

    private String contactPerson;

    private String contactPhone;

    private String attachmentReference;

    private boolean inAppNotification;

    private boolean emailNotification;
}
