package com.smartapartment.repository;

import com.smartapartment.entity.Visitor;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface VisitorRepository extends JpaRepository<Visitor, Long> {
    long countByTenantId(String tenantId);
    List<Visitor> findByTenantIdOrderByExpectedAtDesc(String tenantId);
    Optional<Visitor> findByIdAndTenantId(Long id, String tenantId);
    Optional<Visitor> findByTenantIdAndQrCode(String tenantId, String qrCode);
}
