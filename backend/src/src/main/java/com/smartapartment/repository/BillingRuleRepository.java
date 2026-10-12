package com.smartapartment.repository;import com.smartapartment.entity.BillingRule;import java.util.*;import org.springframework.data.jpa.repository.JpaRepository;
public interface BillingRuleRepository extends JpaRepository<BillingRule,Long>{List<BillingRule> findByTenantIdOrderByNameAsc(String t);Optional<BillingRule> findByIdAndTenantId(Long id,String t);}
