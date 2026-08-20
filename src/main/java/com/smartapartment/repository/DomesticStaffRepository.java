package com.smartapartment.repository;import com.smartapartment.entity.DomesticStaff;import java.util.*;import org.springframework.data.jpa.repository.JpaRepository;
public interface DomesticStaffRepository extends JpaRepository<DomesticStaff,Long>{List<DomesticStaff> findByTenantIdOrderByNameAsc(String t);Optional<DomesticStaff> findByIdAndTenantId(Long id,String t);}
