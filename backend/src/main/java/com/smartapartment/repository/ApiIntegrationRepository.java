package com.smartapartment.repository;

import com.smartapartment.entity.ApiIntegration;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ApiIntegrationRepository extends JpaRepository<ApiIntegration, Long> {
    List<ApiIntegration> findAllByOrderByCreatedAtAsc();
}
