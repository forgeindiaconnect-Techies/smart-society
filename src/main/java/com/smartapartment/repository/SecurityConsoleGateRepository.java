package com.smartapartment.repository;
import com.smartapartment.entity.SecurityConsoleGate;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface SecurityConsoleGateRepository extends JpaRepository<SecurityConsoleGate, Long> {
    List<SecurityConsoleGate> findByTenantIdOrderByIdAsc(String tenantId);
    Optional<SecurityConsoleGate> findByTenantIdAndGateId(String tenantId, Long gateId);
}
