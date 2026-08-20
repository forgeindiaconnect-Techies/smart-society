package com.smartapartment.repository;

import com.smartapartment.entity.Announcement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AnnouncementRepository extends JpaRepository<Announcement, Long> {
    List<Announcement> findTop5ByTenantIdOrderByCreatedAtDesc(String tenantId);
    List<Announcement> findByTenantIdOrderByCreatedAtDesc(String tenantId);

    @org.springframework.data.jpa.repository.Query("SELECT a FROM Announcement a WHERE a.tenantId = 'platform' AND (a.isGlobal = true OR (a.recipientEmail IS NOT NULL AND LOWER(a.recipientEmail) = LOWER(:email))) ORDER BY a.createdAt DESC")
    List<Announcement> findNoticesForEmail(@org.springframework.data.repository.query.Param("email") String email);
}
