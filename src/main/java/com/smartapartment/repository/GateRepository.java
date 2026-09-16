package com.smartapartment.repository;

import com.smartapartment.entity.Gate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GateRepository extends JpaRepository<Gate, Long> {
    List<Gate> findByTenantIdOrderByGateNumberAsc(String tenantId);
    List<Gate> findByTenantIdAndStatusOrderByGateNumberAsc(String tenantId, String status);
    Optional<Gate> findByIdAndTenantId(Long id, String tenantId);
    Optional<Gate> findFirstByTenantIdAndGateNumberIgnoreCase(String tenantId, String gateNumber);
    boolean existsByTenantIdAndGateNumberIgnoreCase(String tenantId, String gateNumber);
}
