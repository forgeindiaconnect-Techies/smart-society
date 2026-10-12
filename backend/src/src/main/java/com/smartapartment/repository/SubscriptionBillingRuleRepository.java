package com.smartapartment.repository;

import com.smartapartment.entity.SubscriptionBillingRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SubscriptionBillingRuleRepository extends JpaRepository<SubscriptionBillingRule, Long> {
    List<SubscriptionBillingRule> findAllByOrderByCreatedAtAsc();
}
