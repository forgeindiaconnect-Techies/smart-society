package com.smartapartment.repository;

import com.smartapartment.entity.Expense;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExpenseRepository extends JpaRepository<Expense, Long> {
    List<Expense> findByTenantIdOrderByExpenseDateDesc(String tenantId);
    Optional<Expense> findByIdAndTenantId(Long id, String tenantId);
}
