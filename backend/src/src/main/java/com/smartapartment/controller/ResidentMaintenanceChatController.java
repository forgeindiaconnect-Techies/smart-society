package com.smartapartment.controller;

import com.smartapartment.entity.*;
import com.smartapartment.repository.AppUserRepository;
import com.smartapartment.repository.ChatConversationRepository;
import com.smartapartment.service.CurrentUserService;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;

@RestController
@RequestMapping("/api/resident/maintenance-chat")
public class ResidentMaintenanceChatController {
    private final CurrentUserService currentUser;
    private final AppUserRepository users;
    private final ChatConversationRepository conversations;

    public ResidentMaintenanceChatController(CurrentUserService currentUser, AppUserRepository users,
                                             ChatConversationRepository conversations) {
        this.currentUser = currentUser; this.users = users; this.conversations = conversations;
    }

    private AppUser resident() {
        AppUser actor = currentUser.requireUser();
        if (actor.getRole() != UserRole.RESIDENT || actor.getTenantId() == null)
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "A society resident account is required");
        return actor;
    }

    public record Worker(Long id, String name, String designation) {}

    @GetMapping("/workers")
    public List<Worker> workers() {
        AppUser actor = resident();
        return users.findByTenantIdAndRole(actor.getTenantId(), UserRole.MAINTENANCE_STAFF).stream()
                .filter(u -> !u.isAccountLocked() && u.getAccessRevokedAt() == null)
                .map(u -> new Worker(u.getId(), u.getFullName(), u.getDesignation()))
                .sorted(Comparator.comparing(Worker::name, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                .toList();
    }

    @PostMapping("/workers/{workerId}/conversation")
    @Transactional
    public Map<String, Object> start(@PathVariable Long workerId) {
        AppUser actor = resident();
        AppUser worker = users.findById(workerId).filter(u -> u.getRole() == UserRole.MAINTENANCE_STAFF
                && Objects.equals(actor.getTenantId(), u.getTenantId())
                && !u.isAccountLocked() && u.getAccessRevokedAt() == null)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Worker is not available in your society"));
        // Serialize starts for this resident so double-clicks reuse the same thread.
        users.lockAttendanceUser(actor.getId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        String reference = "DIRECT-" + actor.getId() + "-" + worker.getId();
        ChatConversation conversation = conversations.findByTicketNumberAndConversationType(reference, "CUSTOMER_MAINTENANCE")
                .orElseGet(() -> {
                    ChatConversation c = new ChatConversation();
                    c.setTenantId(actor.getTenantId()); c.setCustomerId(actor.getEmail());
                    c.setCustomerName(actor.getFullName()); c.setConversationType("CUSTOMER_MAINTENANCE");
                    c.setMaintenanceUserId(worker.getEmail()); c.setMaintenanceUserName(worker.getFullName());
                    c.setTicketNumber(reference); c.setTicketTitle("Maintenance conversation");
                    return conversations.save(c);
                });
        if (!Objects.equals(conversation.getTenantId(), actor.getTenantId())
                || !actor.getEmail().equalsIgnoreCase(conversation.getCustomerId()))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        return Map.of("conversationKey", "req_" + reference + "_cust", "conversationId", conversation.getId());
    }
}
