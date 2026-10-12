package com.smartapartment.repository;
import com.smartapartment.entity.SecurityConsoleEvent;
import org.springframework.data.repository.Repository;
import java.util.*;
public interface SecurityConsoleEventRepository extends Repository<SecurityConsoleEvent, Long> {
    SecurityConsoleEvent save(SecurityConsoleEvent event);
    List<SecurityConsoleEvent> findTop200ByTenantIdOrderByIdDesc(String tenantId);
    List<SecurityConsoleEvent> findByTenantIdAndOccurredAtAfter(String tenantId, java.time.LocalDateTime after);
    Optional<SecurityConsoleEvent> findFirstByTenantIdAndEventTypeInOrderByIdDesc(String tenantId, Collection<String> types);
}
