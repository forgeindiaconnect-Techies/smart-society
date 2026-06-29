package com.smartsociety.service;

import com.smartsociety.dto.ApartmentReportMailRequest;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class MailService {

    private final JavaMailSender mailSender;
    private final String fromAddress;
    private final String mailHost;

    public MailService(
            JavaMailSender mailSender,
            @Value("${app.mail.from:no-reply@propertydirect.local}") String fromAddress,
            @Value("${spring.mail.host:}") String mailHost
    ) {
        this.mailSender = mailSender;
        this.fromAddress = fromAddress;
        this.mailHost = mailHost;
    }

    public Map<String, Object> sendApartmentReport(ApartmentReportMailRequest request) {
        if (!StringUtils.hasText(mailHost)) {
            return Map.of(
                    "sent", false,
                    "message", "Mail request saved, but SMTP is not configured.",
                    "to", request.email()
            );
        }

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(request.email().trim());
        message.setSubject("PropertyDirect apartment report received");
        message.setText("""
                Hello %s,

                We received your apartment report.

                Apartment: %s
                Issue type: %s
                Details: %s
                Phone: %s

                PropertyDirect team will review this listing.
                """.formatted(
                request.name(),
                safe(request.apartment(), "Selected apartment"),
                safe(request.issueType(), "Apartment report"),
                safe(request.details(), "No extra details provided"),
                request.phone()
        ));

        try {
            mailSender.send(message);
            return Map.of(
                    "sent", true,
                    "message", "Report email sent successfully.",
                    "to", request.email()
            );
        } catch (MailException ex) {
            return Map.of(
                    "sent", false,
                    "message", "Mail sending failed: " + ex.getMessage(),
                    "to", request.email()
            );
        }
    }

    private static String safe(String value, String fallback) {
        return StringUtils.hasText(value) ? value.trim() : fallback;
    }
}
