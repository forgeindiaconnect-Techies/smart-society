package com.smartapartment;

import com.smartapartment.controller.ResidentMaintenanceChatController;
import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import com.smartapartment.service.CurrentUserService;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ResidentMaintenanceChatTests {
    private final CurrentUserService current = mock(CurrentUserService.class, withSettings().mockMaker(org.mockito.MockMakers.SUBCLASS));
    private final AppUserRepository users = mock(AppUserRepository.class, withSettings().mockMaker(org.mockito.MockMakers.SUBCLASS));
    private final ChatConversationRepository conversations = mock(ChatConversationRepository.class, withSettings().mockMaker(org.mockito.MockMakers.SUBCLASS));
    private final ResidentMaintenanceChatController controller = new ResidentMaintenanceChatController(current, users, conversations);

    private AppUser user(long id, String tenant, UserRole role) {
        AppUser u = new AppUser(); u.setId(id); u.setTenantId(tenant); u.setRole(role);
        u.setEmail("user" + id + "@example.com"); u.setFullName("User " + id); return u;
    }

    @Test void directoryExcludesLockedAndRevokedWorkers() {
        when(current.requireUser()).thenReturn(user(1, "society", UserRole.RESIDENT));
        AppUser active = user(2,"society",UserRole.MAINTENANCE_STAFF);
        AppUser locked = user(3,"society",UserRole.MAINTENANCE_STAFF); locked.setAccountLocked(true);
        AppUser revoked = user(4,"society",UserRole.MAINTENANCE_STAFF); revoked.setAccessRevokedAt(java.time.LocalDateTime.now());
        when(users.findByTenantIdAndRole("society",UserRole.MAINTENANCE_STAFF)).thenReturn(List.of(active,locked,revoked));
        assertEquals(List.of(2L), controller.workers().stream().map(ResidentMaintenanceChatController.Worker::id).toList());
    }

    @Test void rejectsWorkerFromAnotherSociety() {
        when(current.requireUser()).thenReturn(user(1,"society",UserRole.RESIDENT));
        when(users.findById(2L)).thenReturn(Optional.of(user(2,"other",UserRole.MAINTENANCE_STAFF)));
        assertEquals(404, assertThrows(ResponseStatusException.class, () -> controller.start(2L)).getStatusCode().value());
        verifyNoInteractions(conversations);
    }

    @Test void startsAndReusesTheSelectedWorkersConversation() {
        AppUser resident = user(1,"society",UserRole.RESIDENT), worker = user(2,"society",UserRole.MAINTENANCE_STAFF);
        when(current.requireUser()).thenReturn(resident);
        when(users.findById(2L)).thenReturn(Optional.of(worker));
        when(users.lockAttendanceUser(1L)).thenReturn(Optional.of(resident));
        when(conversations.findByTicketNumberAndConversationType("DIRECT-1-2","CUSTOMER_MAINTENANCE")).thenReturn(Optional.empty());
        when(conversations.save(any())).thenAnswer(call -> { ChatConversation c = call.getArgument(0); c.setId(10L); return c; });
        assertEquals("req_DIRECT-1-2_cust",controller.start(2L).get("conversationKey"));
        var captor = org.mockito.ArgumentCaptor.forClass(ChatConversation.class);
        verify(conversations).save(captor.capture());
        ChatConversation saved = captor.getValue();
        assertEquals(resident.getEmail(), saved.getCustomerId());
        assertEquals(worker.getEmail(), saved.getMaintenanceUserId());
        assertEquals("society",saved.getTenantId());
        when(conversations.findByTicketNumberAndConversationType("DIRECT-1-2","CUSTOMER_MAINTENANCE")).thenReturn(Optional.of(saved));
        assertEquals(10L,controller.start(2L).get("conversationId"));
        verify(conversations,times(1)).save(any());
    }

    @Test void workerCannotUseTheResidentDirectory() {
        when(current.requireUser()).thenReturn(user(1,"society",UserRole.MAINTENANCE_STAFF));
        assertThrows(ResponseStatusException.class,controller::workers);
        verifyNoInteractions(users);
    }
}
