package com.smartapartment.entity;
import jakarta.persistence.*;import lombok.Getter;import lombok.Setter;
@Getter @Setter @Entity @Table(name="poll_votes",uniqueConstraints=@UniqueConstraint(name="uk_poll_user",columnNames={"tenant_id","poll_id","user_id"}))
public class PollVote extends BaseEntity{ @ManyToOne(optional=false)private CommunityPoll poll;@ManyToOne(optional=false)private AppUser user;private int optionIndex; }
