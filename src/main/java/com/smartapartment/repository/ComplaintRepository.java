package com.smartapartment.repository;

import com.smartapartment.entity.Complaint;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.List;

public interface ComplaintRepository extends JpaRepository<Complaint, Long> {
    long countByTenantIdAndStatus(String tenantId, String status);
    Optional<Complaint> findFirstByTenantIdAndTitleOrderByIdAsc(String tenantId, String title);
    List<Complaint> findByTenantIdOrderByCreatedAtDesc(String tenantId);
    Optional<Complaint> findByIdAndTenantId(Long id, String tenantId);
}
