package com.smartapartment.repository;
import com.smartapartment.entity.SecurityConsolePass;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface SecurityConsolePassRepository extends JpaRepository<SecurityConsolePass, Long> {
    List<SecurityConsolePass> findByTenantIdOrderByIdDesc(String tenantId);
    Optional<SecurityConsolePass> findByTenantIdAndVisitorId(String tenantId, Long visitorId);
    Optional<SecurityConsolePass> findByIdAndTenantId(Long id, String tenantId);
}
