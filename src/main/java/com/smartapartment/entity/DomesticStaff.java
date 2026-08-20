package com.smartapartment.entity;
import jakarta.persistence.*;import lombok.Getter;import lombok.Setter;
@Getter @Setter @Entity @Table(name="domestic_staff")
public class DomesticStaff extends BaseEntity{ @Column(nullable=false)private String name;private String phone;private String serviceType;private String identityStatus;private boolean blacklisted;private String passCode;private String assignedArea;private String emergencyContact;private String workingDays;private String shiftStart;private String shiftEnd;private String notes;private String addressProof; }
