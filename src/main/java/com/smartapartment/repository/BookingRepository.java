package com.smartapartment.repository;

import com.smartapartment.entity.Booking;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BookingRepository extends JpaRepository<Booking, Long> {
    List<Booking> findByTenantIdOrderByStartTimeDesc(String tenantId);
    Optional<Booking> findByIdAndTenantId(Long id, String tenantId);
    boolean existsByTenantIdAndAmenityIdAndStartTimeLessThanAndEndTimeGreaterThan(
            String tenantId, Long amenityId, LocalDateTime endTime, LocalDateTime startTime);
}
