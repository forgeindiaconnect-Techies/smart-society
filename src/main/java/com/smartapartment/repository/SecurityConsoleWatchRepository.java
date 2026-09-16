package com.smartapartment.repository;
import com.smartapartment.entity.SecurityConsoleWatch;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface SecurityConsoleWatchRepository extends JpaRepository<SecurityConsoleWatch, Long> {
    List<SecurityConsoleWatch> findByTenantIdAndStatus(String tenantId, String status);
}
