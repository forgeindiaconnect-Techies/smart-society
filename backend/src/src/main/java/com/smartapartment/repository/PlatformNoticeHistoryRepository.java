package com.smartapartment.repository;

import com.smartapartment.entity.PlatformNoticeHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PlatformNoticeHistoryRepository extends JpaRepository<PlatformNoticeHistory, Long> {
    List<PlatformNoticeHistory> findTop100ByOrderByCreatedAtDesc();
}
