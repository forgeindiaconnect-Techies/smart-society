package com.smartapartment;

import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import com.smartapartment.service.*;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

class MaintenanceChatIdentityTests {
    private final AppUserRepository users = mock(AppUserRepository.class);
    private final MaintenanceRequestRepository requests = mock(MaintenanceRequestRepository.class);
    private final ChatService service = new ChatService(mock(ChatConversationRepository.class),
            mock(ChatMessageRepository.class), requests, mock(CurrentUserService.class), mock(ResidentRepository.class), users);

    private AppUser worker() {
        AppUser worker = new AppUser(); worker.setId(12L); worker.setTenantId("society");
        worker.setFullName("Selvakumar Chinnaraj"); worker.setEmail("selvak@example.com");
        worker.setRole(UserRole.MAINTENANCE_STAFF);
        when(users.findByTenantId("society")).thenReturn(List.of(worker)); return worker;
    }
    @Test void accountIdResolvesCurrentRosterName() {
        worker();
        Optional<AppUser> result = ReflectionTestUtils.invokeMethod(service,"accountIdentity","selvak@example.com","society");
        assertEquals("Selvakumar Chinnaraj",result.orElseThrow().getFullName());
    }
    @Test void assignedWorkerOverridesStaleConversationName() {
        worker();
        ChatConversation c = new ChatConversation(); c.setTenantId("society"); c.setMaintenanceRequestId(1L);
        c.setMaintenanceUserName("Kumar (AC Specialist)");
        MaintenanceRequest request = new MaintenanceRequest(); request.setTenantId("society"); request.setAssignedWorkerId(12L);
        when(requests.findById(1L)).thenReturn(Optional.of(request));
        Optional<AppUser> result = ReflectionTestUtils.invokeMethod(service,"workerIdentity",c);
        assertEquals("Selvakumar Chinnaraj",result.orElseThrow().getFullName());
    }
    @Test void unlinkedPresetNameDoesNotIdentifyAWorker() {
        ChatConversation c = new ChatConversation(); c.setTenantId("society"); c.setMaintenanceUserName("Kumar");
        Optional<AppUser> result = ReflectionTestUtils.invokeMethod(service,"workerIdentity",c);
        assertTrue(result.isEmpty());
    }
    @Test void senderCannotResolveToWorkerInAnotherTenant() {
        worker(); when(users.findByTenantId("other")).thenReturn(List.of());
        Optional<AppUser> result = ReflectionTestUtils.invokeMethod(service,"accountIdentity","selvak@example.com","other");
        assertTrue(result.isEmpty());
    }
}
