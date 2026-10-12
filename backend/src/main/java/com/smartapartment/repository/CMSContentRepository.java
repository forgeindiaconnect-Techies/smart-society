package com.smartapartment.repository;

import com.smartapartment.entity.CMSContent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CMSContentRepository extends JpaRepository<CMSContent, Long> {
    List<CMSContent> findByCategoryOrderByCreatedAtDesc(String category);
    List<CMSContent> findByCategoryAndActiveTrue(String category);
}
