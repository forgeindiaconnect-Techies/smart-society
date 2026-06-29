package com.smartsociety.repository;

import com.smartsociety.entity.Apartment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ApartmentRepository extends JpaRepository<Apartment, Long> {
    List<Apartment> findByTenantId(String tenantId);
    long countByTenantId(String tenantId);
    Optional<Apartment> findByTenantIdAndUnitNo(String tenantId, String unitNo);
}
