package com.smartapartment.repository;
import com.smartapartment.entity.Vendor;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface VendorRepository extends JpaRepository<Vendor,Long>{List<Vendor> findByTenantIdOrderByNameAsc(String t);Optional<Vendor> findByIdAndTenantId(Long id,String t);}
