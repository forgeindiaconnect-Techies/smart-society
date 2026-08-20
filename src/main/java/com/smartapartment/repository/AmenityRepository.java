package com.smartapartment.repository;

import com.smartapartment.entity.Amenity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AmenityRepository extends JpaRepository<Amenity, Long> {
    List<Amenity> findByTenantIdOrderByNameAsc(String tenantId);
    Optional<Amenity> findByIdAndTenantId(Long id, String tenantId);
}
