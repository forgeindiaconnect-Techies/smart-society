package com.smartapartment.controller;

import com.smartapartment.entity.AppUser;
import com.smartapartment.entity.Complaint;
import com.smartapartment.entity.Resident;
import com.smartapartment.entity.UserRole;
import com.smartapartment.repository.ComplaintRepository;
import com.smartapartment.repository.ResidentRepository;
import com.smartapartment.service.CurrentUserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Map;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/society/helpdesk")
public class AiHelpdeskController {
    private final CurrentUserService currentUser;
    private final ComplaintRepository complaints;
    private final ResidentRepository residents;

    public AiHelpdeskController(CurrentUserService currentUser, ComplaintRepository complaints, ResidentRepository residents) {
        this.currentUser = currentUser;
        this.complaints = complaints;
        this.residents = residents;
    }

    @PostMapping("/ask")
    public Map<String, Object> ask(@Valid @RequestBody HelpdeskRequest request) {
        AppUser user = currentUser.requireUser();
        Routing routing = route(request.question());
        return Map.of("answer", answerFor(routing, user.getRole()), "category", routing.category(),
                "suggestedTeam", routing.team(), "canCreateTicket", user.getRole() == UserRole.RESIDENT);
    }

    @PostMapping("/tickets")
    @Transactional
    public Map<String, Object> createTicket(@Valid @RequestBody TicketRequest request) {
        AppUser user = currentUser.requireUser();
        if (user.getRole() != UserRole.RESIDENT) throw new IllegalArgumentException("Only residents can create helpdesk tickets");
        Resident resident = residents.findFirstByUserOrderByIdAsc(user)
                .orElseThrow(() -> new IllegalArgumentException("Resident profile is not configured"));
        Routing routing = route(request.question());
        Complaint complaint = new Complaint();
        complaint.setTenantId(user.getTenantId());
        complaint.setResident(resident);
        complaint.setTitle(request.question().trim().substring(0, Math.min(request.question().trim().length(), 120)));
        complaint.setDescription(request.question().trim());
        complaint.setCategory(routing.category());
        complaint.setPriority(routing.priority());
        complaint.setAssignedTo(routing.team());
        complaint.setStatus("OPEN");
        complaint.setDueAt(LocalDateTime.now().plusHours(routing.slaHours()));
        complaint = complaints.save(complaint);
        return Map.of("id", complaint.getId(), "message", "Ticket routed to " + routing.team());
    }

    private Routing route(String question) {
        String text = question.toLowerCase(Locale.ROOT);
        if (text.matches(".*(leak|plumb|water pipe|tap|drain).*")) return new Routing("Plumbing", "Maintenance Team", "HIGH", 8);
        if (text.matches(".*(electric|power|light|lift|generator).*")) return new Routing("Electrical", "Maintenance Team", "HIGH", 8);
        if (text.matches(".*(visitor|guest|gate|delivery|parking|vehicle).*")) return new Routing("Security", "Security Desk", "NORMAL", 24);
        if (text.matches(".*(bill|maintenance fee|payment|late fee|receipt).*")) return new Routing("Billing", "Society Admin", "NORMAL", 24);
        if (text.matches(".*(clubhouse|gym|amenity|booking|hall).*")) return new Routing("Amenities", "Society Admin", "NORMAL", 24);
        return new Routing("General", "Society Admin", "NORMAL", 24);
    }

    private String answerFor(Routing routing, UserRole role) {
        String base = switch (routing.category()) {
            case "Amenities" -> "Check the Amenities dashboard for available slots and booking status. Booking requests needing approval are handled by the society admin.";
            case "Billing" -> "Open Maintenance Billing to view dues, payment status, receipts, and any late fee applied after the due date.";
            case "Security" -> "Use Visitor Management for approved guests and Gate Entries for live entry or exit status.";
            case "Plumbing", "Electrical" -> "This looks like a " + routing.category().toLowerCase(Locale.ROOT) + " issue. I can route it to the Maintenance Team with the relevant SLA.";
            default -> "I can route this to the Society Admin, who can assign the right team or share the relevant notice.";
        };
        return role == UserRole.RESIDENT ? base : base + " Your role can monitor and update the assigned workflow from this dashboard.";
    }

    public record HelpdeskRequest(@NotBlank String question) { }
    public record TicketRequest(@NotBlank String question) { }
    private record Routing(String category, String team, String priority, int slaHours) { }
}
