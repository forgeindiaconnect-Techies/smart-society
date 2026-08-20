package com.smartapartment.repository;
import com.smartapartment.entity.CommunityEvent;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface CommunityEventRepository extends JpaRepository<CommunityEvent,Long>{List<CommunityEvent> findByTenantIdOrderByStartsAtDesc(String t);Optional<CommunityEvent> findByIdAndTenantId(Long id,String t);}
