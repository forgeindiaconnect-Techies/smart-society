package com.smartapartment.repository;import com.smartapartment.entity.PropertyCustomer;import java.util.*;import org.springframework.data.jpa.repository.JpaRepository;
public interface PropertyCustomerRepository extends JpaRepository<PropertyCustomer,Long>{Optional<PropertyCustomer> findByUsernameIgnoreCase(String u);boolean existsByUsernameIgnoreCaseOrEmailIgnoreCase(String u,String e);}
