package com.smartapartment.repository;import com.smartapartment.entity.SavedProperty;import java.util.*;import org.springframework.data.jpa.repository.JpaRepository;
public interface SavedPropertyRepository extends JpaRepository<SavedProperty,Long>{List<SavedProperty> findByCustomerIdOrderByCreatedAtDesc(Long c);Optional<SavedProperty> findByCustomerIdAndListingId(Long c,Long l);}
