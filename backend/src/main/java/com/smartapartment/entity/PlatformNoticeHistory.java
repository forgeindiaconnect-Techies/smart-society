package com.smartapartment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "platform_notice_history")
public class PlatformNoticeHistory extends BaseEntity {

    @Column(nullable = false, length = 180)
    private String title;

    @Column(nullable = false, length = 3000)
    private String message;

    @Column(nullable = false, length = 160)
    private String senderName;

    @Column(nullable = false, length = 180)
    private String senderEmail;

    @Column(nullable = false, length = 180)
    private String targetLabel;

    @Column(length = 80)
    private String category;

    @Column(length = 40)
    private String priority;

    private boolean emergency;
    private Integer validDays;
    private Integer societyCount;
    private Integer notifiedUsers;
}
