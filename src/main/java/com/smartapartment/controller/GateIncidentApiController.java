package com.smartapartment.controller;

import com.smartapartment.entity.GateIncident;
import com.smartapartment.repository.GateIncidentRepository;
import com.smartapartment.service.CurrentUserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/society/gate-incidents")
public class GateIncidentApiController {
    private final CurrentUserService currentUser;
    private final GateIncidentRepository incidents;

    public GateIncidentApiController(CurrentUserService currentUser, GateIncidentRepository incidents) {
        this.currentUser = currentUser;
        this.incidents = incidents;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('SOCIETY_ADMIN','SECURITY_STAFF')")
    public List<GateIncident> list() {
        return incidents.findByTenantIdOrderByOccurredAtDesc(currentUser.requireTenantId());
    }

    @PostMapping
    @PreAuthorize("hasRole('SECURITY_STAFF')")
    public GateIncident create(@Valid @RequestBody IncidentRequest request) {
        GateIncident incident = new GateIncident();
        incident.setTenantId(currentUser.requireTenantId());
        incident.setIncidentType(request.incidentType().trim());
        incident.setDescription(request.description().trim());
        incident.setLocation(request.location().trim());
        incident.setVehicleNumber(request.vehicleNumber());
        incident.setReportedBy(currentUser.requireUser().getFullName());
        incident.setOccurredAt(request.occurredAt());
        return incidents.save(incident);
    }

    public record IncidentRequest(@NotBlank String incidentType, @NotBlank String description, @NotBlank String location,
                                  String vehicleNumber, @NotNull LocalDateTime occurredAt) { }
}
