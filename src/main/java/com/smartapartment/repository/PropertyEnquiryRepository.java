package com.smartapartment.repository;import com.smartapartment.entity.PropertyEnquiry;import java.util.*;import org.springframework.data.jpa.repository.JpaRepository;
public interface PropertyEnquiryRepository extends JpaRepository<PropertyEnquiry,Long>{List<PropertyEnquiry> findByCustomerIdOrderByCreatedAtDesc(Long c);}
