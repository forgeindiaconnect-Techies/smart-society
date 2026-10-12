package com.smartapartment.repository;

import com.smartapartment.entity.PaymentGatewayConfig;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PaymentGatewayConfigRepository extends JpaRepository<PaymentGatewayConfig, Long> {
    List<PaymentGatewayConfig> findAllByOrderByCreatedAtAsc();
}
