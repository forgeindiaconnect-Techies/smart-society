package com.smartapartment.repository;

import com.smartapartment.entity.SecurityGuardAssignment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SecurityGuardAssignmentRepository extends JpaRepository<SecurityGuardAssignment, Long> {
    List<SecurityGuardAssignment> findByTenantIdOrderByCreatedAtDesc(String tenantId);
    List<SecurityGuardAssignment> findByTenantIdAndSecurityGuardIdOrderByCreatedAtDesc(String tenantId, Long securityGuardId);
}
