package com.smartapartment.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter @Entity @Table(name="community_events")
public class CommunityEvent extends BaseEntity {
    @Column(nullable=false) private String title;
    @Column(length=2000) private String description;
    private String venue;
    private LocalDateTime startsAt;
    private LocalDateTime endsAt;
}
