package com.smartsociety.repository;

import com.smartsociety.entity.Resident;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ResidentRepository extends JpaRepository<Resident, Long> {
    long countByTenantId(String tenantId);
}
