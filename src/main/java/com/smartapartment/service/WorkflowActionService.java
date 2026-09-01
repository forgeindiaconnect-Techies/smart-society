package com.smartapartment.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartapartment.entity.AppUser;
import com.smartapartment.entity.WorkflowAction;
import com.smartapartment.repository.AppUserRepository;
import com.smartapartment.repository.WorkflowActionRepository;
import jakarta.servlet.http.HttpSession;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WorkflowActionService {
    private final WorkflowActionRepository actions;
    private final AppUserRepository users;
    private final ObjectMapper mapper;

    public WorkflowActionService(WorkflowActionRepository actions, AppUserRepository users, ObjectMapper mapper) {
        this.actions = actions;
        this.users = users;
        this.mapper = mapper;
    }

    @Transactional
    public WorkflowAction create(String workspace, String role, String panel, String actionType,
                                 String targetLabel, Map<String, Object> details,
                                 Authentication authentication, HttpSession session) {
        Actor actor = requireActor(authentication, session);
        WorkflowAction action = new WorkflowAction();
        action.setTenantId(actor.tenantId());
        action.setWorkspace(clean(workspace, 40));
        action.setDashboardRole(clean(role, 40));
        action.setPanel(clean(panel, 80));
        action.setActionType(clean(actionType, 80));
        action.setTargetLabel(clean(targetLabel, 500));
        action.setActorRef(actor.reference());
        action.setWorkflowStatus(initialStatus(actionType));
        try {
            action.setDetailsJson(mapper.writeValueAsString(details == null ? Map.of() : details));
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Workflow details could not be stored", exception);
        }
        return actions.save(action);
    }

    public List<WorkflowAction> list(Authentication authentication, HttpSession session) {
        Actor actor = requireActor(authentication, session);
        return actions.findTop100ByTenantIdOrderByCreatedAtDesc(actor.tenantId());
    }

    @Transactional
    public WorkflowAction updateStatus(Long id, String status, Authentication authentication, HttpSession session) {
        Actor actor = requireActor(authentication, session);
        WorkflowAction action = actions.findByIdAndTenantId(id, actor.tenantId())
                .orElseThrow(() -> new IllegalArgumentException("Workflow action was not found"));
        action.setWorkflowStatus(clean(status, 40).toUpperCase(Locale.ROOT));
        return actions.save(action);
    }

    private Actor requireActor(Authentication authentication, HttpSession session) {
        if (Boolean.TRUE.equals(session.getAttribute("dashboard:propertydirect:superadmin")))
            return new Actor("propertydirect", "propertydirect:superadmin");
        if (Boolean.TRUE.equals(session.getAttribute("dashboard:propertydirect:admin")))
            return new Actor("propertydirect", "propertydirect:admin");
        Object customerId = session.getAttribute("propertydirect:customerId");
        if (customerId instanceof Long id) return new Actor("propertydirect", "propertydirect:customer:" + id);
        if (authentication != null && authentication.isAuthenticated()
                && !"anonymousUser".equals(authentication.getPrincipal())) {
            AppUser user = users.findByEmail(authentication.getName())
                    .orElseThrow(() -> new IllegalStateException("Authenticated account no longer exists"));
            return new Actor(user.getTenantId(), user.getEmail());
        }
        throw new IllegalStateException("Dashboard login is required");
    }

    private static String initialStatus(String actionType) {
        String value = actionType == null ? "" : actionType.toLowerCase(Locale.ROOT);
        return value.matches("approve|complete|close|resolve-task|mark-paid|checkin|checkout") ? "COMPLETED" : "SUBMITTED";
    }

    private static String clean(String value, int limit) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException("Workflow fields are required");
        String trimmed = value.trim();
        return trimmed.length() <= limit ? trimmed : trimmed.substring(0, limit);
    }

    private record Actor(String tenantId, String reference) { }
}
