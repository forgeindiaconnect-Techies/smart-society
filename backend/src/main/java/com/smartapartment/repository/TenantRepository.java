package com.smartapartment.repository;

import com.smartapartment.entity.Tenant;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.List;

public interface TenantRepository extends JpaRepository<Tenant, Long> {
    Optional<Tenant> findByCode(String code);
    List<Tenant> findAllByOrderByCreatedAtDesc();
    long countByApprovedFalse();
}
