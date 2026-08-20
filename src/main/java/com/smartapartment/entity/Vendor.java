package com.smartapartment.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter @Entity @Table(name="vendors")
public class Vendor extends BaseEntity {
    @Column(nullable=false) private String name;
    private String serviceCategory;
    private String phone;
    private String email;
    private String taxNumber;
}
