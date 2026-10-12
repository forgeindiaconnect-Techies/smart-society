package com.smartapartment.repository;

import com.smartapartment.entity.PropertyImage;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PropertyImageRepository extends JpaRepository<PropertyImage, Long> {
    List<PropertyImage> findByPropertyIdOrderByPrimaryDescCreatedAtAsc(Long propertyId);
}
