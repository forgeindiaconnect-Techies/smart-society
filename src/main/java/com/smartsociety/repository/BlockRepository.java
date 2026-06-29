package com.smartsociety.repository;

import com.smartsociety.entity.Block;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BlockRepository extends JpaRepository<Block, Long> {
    List<Block> findByTenantId(String tenantId);
    Optional<Block> findByTenantIdAndName(String tenantId, String name);
}
