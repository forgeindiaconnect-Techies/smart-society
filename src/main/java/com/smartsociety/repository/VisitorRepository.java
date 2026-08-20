package com.smartsociety.repository;

import com.smartsociety.entity.Visitor;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VisitorRepository extends JpaRepository<Visitor, Long> {
    long countByTenantId(String tenantId);
}
