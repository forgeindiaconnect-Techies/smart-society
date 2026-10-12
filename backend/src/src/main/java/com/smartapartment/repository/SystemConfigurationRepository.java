package com.smartapartment.repository;

import com.smartapartment.entity.SystemConfiguration;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SystemConfigurationRepository extends JpaRepository<SystemConfiguration, Long> {
    List<SystemConfiguration> findAllByOrderByConfigKeyAsc();
}
