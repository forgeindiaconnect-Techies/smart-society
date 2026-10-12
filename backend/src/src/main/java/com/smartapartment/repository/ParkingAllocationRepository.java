package com.smartapartment.repository;
import com.smartapartment.entity.ParkingAllocation;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ParkingAllocationRepository extends JpaRepository<ParkingAllocation,Long>{List<ParkingAllocation> findByTenantIdOrderBySlotNumberAsc(String t); Optional<ParkingAllocation> findByIdAndTenantId(Long id,String t);}
