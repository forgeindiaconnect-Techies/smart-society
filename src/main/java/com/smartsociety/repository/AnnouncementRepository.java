package com.smartsociety.repository;

import com.smartsociety.entity.Announcement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AnnouncementRepository extends JpaRepository<Announcement, Long> {
    List<Announcement> findTop5ByTenantIdOrderByCreatedAtDesc(String tenantId);
}
