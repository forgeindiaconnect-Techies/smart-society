package com.smartapartment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "society_gates", uniqueConstraints = @UniqueConstraint(columnNames = {"tenant_id", "gate_number"}))
public class Gate extends BaseEntity {
    @Column(name = "gate_number", nullable = false, length = 40)
    private String gateNumber;

    @Column(nullable = false, length = 120)
    private String gateName;

    @Column(nullable = false, length = 30)
    private String gateType = "BOTH";

    @Column(length = 240)
    private String location;
}
