package com.smartapartment.repository;

import com.smartapartment.entity.NotificationTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface NotificationTemplateRepository extends JpaRepository<NotificationTemplate, Long> {
    List<NotificationTemplate> findAllByOrderByCreatedAtDesc();
}
