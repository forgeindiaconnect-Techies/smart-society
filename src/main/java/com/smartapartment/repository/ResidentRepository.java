package com.smartapartment.repository;

import com.smartapartment.entity.AppUser;
import com.smartapartment.entity.Resident;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.List;

public interface ResidentRepository extends JpaRepository<Resident, Long> {
    long countByTenantId(String tenantId);
    Optional<Resident> findFirstByUserOrderByIdAsc(AppUser user);
    List<Resident> findByTenantIdOrderByIdAsc(String tenantId);
    Optional<Resident> findByIdAndTenantId(Long id, String tenantId);
}
