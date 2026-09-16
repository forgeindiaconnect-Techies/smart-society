package com.smartapartment.repository;
import com.smartapartment.entity.AuditLog;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface AuditLogRepository extends JpaRepository<AuditLog,Long>{
    List<AuditLog> findTop100ByTenantIdOrderByCreatedAtDesc(String t);
    List<AuditLog> findByModuleOrderByCreatedAtDesc(String module);
    List<AuditLog> findByModuleAndDetailsContainingOrderByCreatedAtDesc(String module, String snippet);
}
