package com.smartapartment.repository;

import com.smartapartment.entity.SecurityGateAssignment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SecurityGateAssignmentRepository extends JpaRepository<SecurityGateAssignment, Long> {
    List<SecurityGateAssignment> findByTenantIdOrderByCreatedAtDesc(String tenantId);
    List<SecurityGateAssignment> findByTenantIdAndSecurityGuardIdOrderByCreatedAtDesc(String tenantId, Long securityGuardId);
    Optional<SecurityGateAssignment> findByTenantIdAndSecurityGuardIdAndGateId(String tenantId, Long securityGuardId, Long gateId);
    void deleteByTenantIdAndSecurityGuardIdAndGateId(String tenantId, Long securityGuardId, Long gateId);
}
