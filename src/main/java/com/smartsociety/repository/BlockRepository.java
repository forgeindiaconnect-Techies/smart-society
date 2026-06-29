package com.smartsociety.repository;

import com.smartsociety.entity.Block;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BlockRepository extends JpaRepository<Block, Long> {
    List<Block> findByTenantId(String tenantId);
}
