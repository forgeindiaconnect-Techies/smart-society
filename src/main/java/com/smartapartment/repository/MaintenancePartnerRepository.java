package com.smartapartment.repository;
import com.smartapartment.entity.MaintenancePartner;
import org.springframework.data.jpa.repository.*;
import jakarta.persistence.LockModeType;
import java.util.*;
public interface MaintenancePartnerRepository extends JpaRepository<MaintenancePartner, Long> {
    Optional<MaintenancePartner> findByUserId(Long userId);
    List<MaintenancePartner> findByHubId(Long hubId);
    List<MaintenancePartner> findByHubIdAndOnDutyTrue(Long hubId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from MaintenancePartner p where p.id = :id")
    Optional<MaintenancePartner> lockById(Long id);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from MaintenancePartner p where p.hubId = :hubId and p.onDuty = true and (p.workState = 'IDLE' or p.availability = 'IDLE') order by p.id")
    List<MaintenancePartner> available(Long hubId, String trade);
}
