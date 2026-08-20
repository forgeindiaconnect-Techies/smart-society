package com.smartapartment.repository;
import com.smartapartment.entity.SocietyDocument;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface SocietyDocumentRepository extends JpaRepository<SocietyDocument,Long>{List<SocietyDocument> findByTenantIdOrderByCreatedAtDesc(String t);Optional<SocietyDocument> findByIdAndTenantId(Long id,String t);}
