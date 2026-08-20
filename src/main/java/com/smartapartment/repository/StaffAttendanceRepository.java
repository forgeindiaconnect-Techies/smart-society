package com.smartapartment.repository;
import com.smartapartment.entity.StaffAttendance;
import java.time.LocalDate;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface StaffAttendanceRepository extends JpaRepository<StaffAttendance,Long>{List<StaffAttendance> findByTenantIdOrderByWorkDateDesc(String t);Optional<StaffAttendance> findByTenantIdAndUserIdAndWorkDate(String t,Long u,LocalDate d);}
