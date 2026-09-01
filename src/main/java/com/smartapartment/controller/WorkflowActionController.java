package com.smartapartment.controller;

import com.smartapartment.entity.WorkflowAction;
import com.smartapartment.service.WorkflowActionService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/workflows")
public class WorkflowActionController {
    private final WorkflowActionService workflows;

    public WorkflowActionController(WorkflowActionService workflows) {
        this.workflows = workflows;
    }

    @GetMapping
    public List<WorkflowAction> list(Authentication authentication, HttpSession session) {
        return workflows.list(authentication, session);
    }

    @PostMapping
    public WorkflowAction create(@Valid @RequestBody WorkflowRequest request,
                                 Authentication authentication, HttpSession session) {
        return workflows.create(request.workspace(), request.dashboardRole(), request.panel(), request.actionType(),
                request.targetLabel(), request.details(), authentication, session);
    }

    @PatchMapping("/{id}/status")
    public WorkflowAction updateStatus(@PathVariable Long id, @RequestParam @NotBlank String status,
                                       Authentication authentication, HttpSession session) {
        return workflows.updateStatus(id, status, authentication, session);
    }

    public record WorkflowRequest(@NotBlank String workspace, @NotBlank String dashboardRole,
                                  @NotBlank String panel, @NotBlank String actionType,
                                  @NotBlank String targetLabel, Map<String, Object> details) { }
}
