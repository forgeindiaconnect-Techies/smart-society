package com.smartsociety.controller;

import com.smartsociety.dto.ApartmentReportMailRequest;
import com.smartsociety.service.MailService;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/mail")
public class MailController {

    private final MailService mailService;

    public MailController(MailService mailService) {
        this.mailService = mailService;
    }

    @PostMapping("/report-apartment")
    public ResponseEntity<Map<String, Object>> reportApartment(@Valid @RequestBody ApartmentReportMailRequest request) {
        Map<String, Object> result = mailService.sendApartmentReport(request);
        return Boolean.TRUE.equals(result.get("sent"))
                ? ResponseEntity.ok(result)
                : ResponseEntity.accepted().body(result);
    }
}
