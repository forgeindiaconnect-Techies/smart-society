package com.smartapartment.repository;import com.smartapartment.entity.PropertyServiceRequest;import java.util.*;import org.springframework.data.jpa.repository.JpaRepository;
public interface PropertyServiceRequestRepository extends JpaRepository<PropertyServiceRequest,Long>{List<PropertyServiceRequest> findByCustomerIdOrderByCreatedAtDesc(Long c);}
