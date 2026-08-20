package com.smartapartment.entity;

import jakarta.persistence.*;
import java.time.*;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter @Entity
@Table(name="staff_attendance", uniqueConstraints=@UniqueConstraint(name="uk_attendance_user_date", columnNames={"tenant_id","user_id","work_date"}))
public class StaffAttendance extends BaseEntity {
    @ManyToOne(optional=false) private AppUser user;
    @Column(name="work_date", nullable=false) private LocalDate workDate;
    private LocalDateTime checkInAt;
    private LocalDateTime checkOutAt;
}
