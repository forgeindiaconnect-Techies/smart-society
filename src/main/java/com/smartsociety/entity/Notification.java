package com.smartsociety.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "notifications")
public class Notification extends BaseEntity {

    private Long userId;

    private String type;

    private String title;

    @Column(length = 2000)
    private String message;

    private boolean readStatus;
}
