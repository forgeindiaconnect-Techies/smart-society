package com.smartapartment.repository;import com.smartapartment.entity.PollVote;import java.util.*;import org.springframework.data.jpa.repository.JpaRepository;
public interface PollVoteRepository extends JpaRepository<PollVote,Long>{Optional<PollVote> findByTenantIdAndPollIdAndUserId(String t,Long p,Long u);List<PollVote> findByTenantIdAndPollId(String t,Long p);}
