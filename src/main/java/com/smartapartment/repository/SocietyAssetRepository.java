package com.smartapartment.repository;import com.smartapartment.entity.SocietyAsset;import java.util.*;import org.springframework.data.jpa.repository.JpaRepository;
public interface SocietyAssetRepository extends JpaRepository<SocietyAsset,Long>{List<SocietyAsset> findByTenantIdOrderByNameAsc(String t);Optional<SocietyAsset> findByIdAndTenantId(Long id,String t);}
