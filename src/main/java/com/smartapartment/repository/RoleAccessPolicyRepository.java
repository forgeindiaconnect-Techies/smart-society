package com.smartapartment.repository;

import com.smartapartment.entity.RoleAccessPolicy;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RoleAccessPolicyRepository extends JpaRepository<RoleAccessPolicy, Long> {
    Optional<RoleAccessPolicy> findByRoleName(String roleName);
    List<RoleAccessPolicy> findAllByOrderByRoleNameAsc();
}
