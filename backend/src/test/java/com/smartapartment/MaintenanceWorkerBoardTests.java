package com.smartapartment;

import com.smartapartment.dto.MaintenanceManagerDtos.ManagerWorkerBoardItemDto;
import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import com.smartapartment.service.*;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class MaintenanceWorkerBoardTests {
    private final WorkerAvailabilityRepository availability = mock(WorkerAvailabilityRepository.class);
    private final WorkerAttendanceRepository attendance = mock(WorkerAttendanceRepository.class);
    private final MaintenanceManagerService service = new MaintenanceManagerService(
            mock(MaintenanceRequestRepository.class), mock(MaintenanceStatusHistoryRepository.class),
            availability, attendance, mock(AppUserRepository.class), mock(NotificationRepository.class),
            mock(MaintenanceTrackingService.class), mock(AutoAssignmentService.class));

    private ManagerWorkerBoardItemDto board(String status, boolean clockIn, boolean clockOut) {
        AppUser worker = new AppUser(); worker.setId(1L); worker.setFullName("Worker");
        WorkerAvailability av = new WorkerAvailability(); av.setStatus("AVAILABLE");
        when(availability.findByWorkerId(1L)).thenReturn(Optional.of(av));
        WorkerAttendance att = new WorkerAttendance(); att.setAttendanceStatus(status);
        if (clockIn) att.setClockIn(LocalDateTime.now().minusHours(2));
        if (clockOut) att.setClockOut(LocalDateTime.now().minusMinutes(5));
        when(attendance.findFirstByWorkerIdAndDateOrderByCreatedAtDesc(1L, LocalDate.now()))
                .thenReturn(status == null ? Optional.empty() : Optional.of(att));
        List<ManagerWorkerBoardItemDto> items = ReflectionTestUtils.invokeMethod(service,
                "buildWorkerBoard", List.of(worker), LocalDate.now(), LocalDateTime.now());
        return items.get(0);
    }

    @Test void noAttendanceOverridesStaleAvailableStatus() {
        var item = board(null,false,false);
        assertEquals("OFFLINE",item.availabilityStatus());
        assertTrue(item.colorStatus().contains("OFFLINE"));
    }
    @Test void explicitOfflineOverridesStaleAvailableStatus() {
        assertEquals("OFFLINE",board("OFFLINE",false,false).availabilityStatus());
    }
    @Test void completedShiftCannotRemainAvailable() {
        assertEquals("OFFLINE",board("PRESENT",true,true).availabilityStatus());
    }
    @Test void lateClockedInWorkerCanBeAvailable() {
        var item = board("LATE",true,false);
        assertEquals("AVAILABLE",item.availabilityStatus());
        assertTrue(item.colorStatus().contains("AVAILABLE"));
    }
    @Test void leaveIsAbsentEvenWithStaleAvailability() {
        var item = board("ON_LEAVE",false,false);
        assertEquals("ABSENT",item.availabilityStatus());
        assertTrue(item.colorStatus().contains("ABSENT"));
    }
}
