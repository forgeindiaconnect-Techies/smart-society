package com.smartapartment.entity;
import jakarta.persistence.*;import java.time.LocalDateTime;import lombok.Getter;import lombok.Setter;
@Getter @Setter @Entity @Table(name="community_polls")
public class CommunityPoll extends BaseEntity{ @Column(nullable=false)private String question;@Column(length=2000)private String optionsJson;private LocalDateTime closesAt;private boolean anonymous;@Column(length=2000)private String description;private String category;private String audience;private boolean resultsVisible; }
