package com.smartsociety.repository;

import com.smartsociety.entity.Complaint;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ComplaintRepository extends JpaRepository<Complaint, Long> {
    long countByTenantIdAndStatus(String tenantId, String status);
}
