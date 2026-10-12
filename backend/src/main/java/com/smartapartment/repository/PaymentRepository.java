package com.smartapartment.repository;

import com.smartapartment.entity.Payment;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    List<Payment> findByTenantIdOrderByPaidAtDesc(String tenantId);
    boolean existsByTenantIdAndTransactionId(String tenantId, String transactionId);
}
