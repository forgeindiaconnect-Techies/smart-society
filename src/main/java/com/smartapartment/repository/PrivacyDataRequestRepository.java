package com.smartapartment.repository;

import com.smartapartment.entity.PrivacyDataRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PrivacyDataRequestRepository extends JpaRepository<PrivacyDataRequest, Long> {
    List<PrivacyDataRequest> findAllByOrderByCreatedAtDesc();
}
