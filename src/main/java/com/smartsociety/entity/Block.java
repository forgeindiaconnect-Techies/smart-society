package com.smartsociety.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "blocks")
public class Block extends BaseEntity {

    private String name;

    private int totalFloors;
}
