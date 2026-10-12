package com.smartapartment.repository;

import com.smartapartment.entity.GateIncident;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GateIncidentRepository extends JpaRepository<GateIncident, Long> {
    List<GateIncident> findByTenantIdOrderByOccurredAtDesc(String tenantId);
}
