package com.smartsociety.repository;

import com.smartsociety.entity.MaintenanceBill;
import org.springframework.data.jpa.repository.JpaRepository;

import java.math.BigDecimal;

public interface MaintenanceBillRepository extends JpaRepository<MaintenanceBill, Long> {
    long countByTenantIdAndPaymentStatus(String tenantId, String paymentStatus);
    default BigDecimal monthlyRevenue(String tenantId) {
        return findAll().stream()
                .filter(b -> tenantId.equals(b.getTenantId()))
                .filter(b -> "PAID".equalsIgnoreCase(b.getPaymentStatus()))
                .map(MaintenanceBill::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
