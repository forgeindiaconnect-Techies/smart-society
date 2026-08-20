package com.smartapartment.entity;
import jakarta.persistence.*;import java.math.BigDecimal;import java.time.LocalDate;import lombok.Getter;import lombok.Setter;
@Getter @Setter @Entity @Table(name="society_assets")
public class SocietyAsset extends BaseEntity{ @Column(nullable=false)private String name;private String category;private String location;private String serialNumber;private LocalDate purchasedOn;private BigDecimal purchaseCost;private LocalDate warrantyUntil;private LocalDate nextServiceDate;private Long vendorId;private String vendorName;private String vendorPhone;private String amcProvider;private LocalDate amcUntil;private LocalDate lastServiceDate;private Integer serviceIntervalDays;private String assetCondition;@Column(length=2000)private String notes; }
