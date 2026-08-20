package com.smartapartment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "role_access_policies")
public class RoleAccessPolicy extends BaseEntity {
    @Column(nullable = false, unique = true)
    private String roleName;

    @Column(nullable = false, length = 1000)
    private String permissions;

    private boolean active = true;
}
