package com.smartapartment.repository;

import com.smartapartment.entity.WorkflowAction;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkflowActionRepository extends JpaRepository<WorkflowAction, Long> {
    List<WorkflowAction> findTop100ByTenantIdOrderByCreatedAtDesc(String tenantId);
    Optional<WorkflowAction> findByIdAndTenantId(Long id, String tenantId);
}
