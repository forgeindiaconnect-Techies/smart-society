package com.smartsociety.repository;

import com.smartsociety.entity.Complaint;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ComplaintRepository extends JpaRepository<Complaint, Long> {
    long countByTenantIdAndStatus(String tenantId, String status);
    Optional<Complaint> findByTenantIdAndTitle(String tenantId, String title);
}
