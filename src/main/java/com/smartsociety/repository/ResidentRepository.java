package com.smartsociety.repository;

import com.smartsociety.entity.AppUser;
import com.smartsociety.entity.Resident;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ResidentRepository extends JpaRepository<Resident, Long> {
    long countByTenantId(String tenantId);
    Optional<Resident> findByUser(AppUser user);
}
