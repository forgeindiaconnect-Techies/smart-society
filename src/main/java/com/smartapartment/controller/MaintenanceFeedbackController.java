package com.smartapartment.controller;

import com.smartapartment.service.EmergencyMaintenanceService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Controller
public class MaintenanceFeedbackController {
    private final EmergencyMaintenanceService emergencyMaintenanceService;

    public MaintenanceFeedbackController(EmergencyMaintenanceService emergencyMaintenanceService) {
        this.emergencyMaintenanceService = emergencyMaintenanceService;
    }

    @GetMapping("/feedback/{orderReference}")
    public String feedback(@PathVariable String orderReference,
                           @RequestParam String token,
                           Model model) {
        Map<String, Object> data = emergencyMaintenanceService.publicFeedbackView(orderReference, token);
        model.addAttribute("feedback", data);
        model.addAttribute("orderReference", orderReference);
        model.addAttribute("token", token);
        return "maintenance-feedback";
    }

    public record FeedbackRequest(@Min(1) @Max(5) int rating, @Size(max = 1000) String review, String token) {}

    @PostMapping("/api/maintenance/feedback/{orderReference}")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> submit(@PathVariable String orderReference,
                                                       @RequestBody FeedbackRequest request) {
        emergencyMaintenanceService.submitPublicFeedback(orderReference, request.token(), request.rating(), request.review());
        return ResponseEntity.ok(Map.of("message", "Thank you. Your feedback has been recorded.", "submitted", true));
    }
}
