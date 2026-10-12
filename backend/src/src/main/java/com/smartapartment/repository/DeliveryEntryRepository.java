package com.smartapartment.repository;import com.smartapartment.entity.DeliveryEntry;import java.util.*;import org.springframework.data.jpa.repository.JpaRepository;
public interface DeliveryEntryRepository extends JpaRepository<DeliveryEntry,Long>{List<DeliveryEntry> findByTenantIdOrderByArrivedAtDesc(String t);Optional<DeliveryEntry> findByIdAndTenantId(Long id,String t);}
