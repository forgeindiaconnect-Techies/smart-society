package com.smartapartment.repository;
import com.smartapartment.entity.MaintenanceHub;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MaintenanceHubRepository extends JpaRepository<MaintenanceHub, Long> {
    List<MaintenanceHub> findByActiveTrue();
    List<MaintenanceHub> findByCityIgnoreCaseAndActiveTrue(String city);
}
