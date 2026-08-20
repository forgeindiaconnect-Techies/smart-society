package com.smartsociety.entity;

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

    private String audience;

    private boolean emergency;
}
