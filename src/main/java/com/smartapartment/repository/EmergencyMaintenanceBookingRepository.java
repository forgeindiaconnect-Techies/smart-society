package com.smartapartment.repository;
import com.smartapartment.entity.EmergencyMaintenanceBooking;
import org.springframework.data.jpa.repository.*;
import jakarta.persistence.LockModeType;
import java.util.*;
public interface EmergencyMaintenanceBookingRepository extends JpaRepository<EmergencyMaintenanceBooking, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from EmergencyMaintenanceBooking b where b.id = :id")
    Optional<EmergencyMaintenanceBooking> lockById(Long id);
    List<EmergencyMaintenanceBooking> findByJobStatusIn(Collection<String> statuses);
    long countByPartnerIdAndJobStatusIn(Long partnerId, Collection<String> statuses);
    List<EmergencyMaintenanceBooking> findByPartnerIdAndJobStatusIn(Long partnerId, Collection<String> statuses);
    Optional<EmergencyMaintenanceBooking> findByOrderReference(String orderReference);
    List<EmergencyMaintenanceBooking> findByPartnerIdAndRatingIsNotNull(Long partnerId);
}
