package com.smartapartment.repository;import com.smartapartment.entity.CommunityPoll;import java.util.*;import org.springframework.data.jpa.repository.JpaRepository;
public interface CommunityPollRepository extends JpaRepository<CommunityPoll,Long>{List<CommunityPoll> findByTenantIdOrderByCreatedAtDesc(String t);Optional<CommunityPoll> findByIdAndTenantId(Long id,String t);}
