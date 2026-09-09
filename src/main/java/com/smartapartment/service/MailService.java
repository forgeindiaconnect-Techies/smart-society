package com.smartapartment.service;

import com.smartapartment.dto.ApartmentReportMailRequest;
import java.util.Map;
import org.springframework.beans.factory.ObjectProvider;
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
    private final String propertyDirectContactRecipient;

    public MailService(
            ObjectProvider<JavaMailSender> mailSenderProvider,
            @Value("${app.mail.from:no-reply@propertydirect.local}") String fromAddress,
            @Value("${spring.mail.host:}") String mailHost,
            @Value("${app.propertydirect.contact-recipient:}") String propertyDirectContactRecipient
    ) {
        this.mailSender = mailSenderProvider.getIfAvailable();
        this.fromAddress = fromAddress;
        this.mailHost = mailHost;
        this.propertyDirectContactRecipient = propertyDirectContactRecipient;
    }

    public Map<String, Object> sendApartmentReport(ApartmentReportMailRequest request) {
        if (!StringUtils.hasText(mailHost) || mailSender == null) {
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

    /**
     * Delivers a website contact request to the configured PropertyDirect support
     * mailbox. The caller can retain the request in the admin inbox when SMTP or
     * the recipient has not been configured yet.
     */
    public Map<String, Object> sendPropertyDirectContactNotification(
            String name, String email, String phone, String contactMessage, Long messageId) {
        if (!StringUtils.hasText(propertyDirectContactRecipient)) {
            return Map.of("sent", false, "message", "No PropertyDirect contact recipient is configured.");
        }
        if (!StringUtils.hasText(mailHost) || mailSender == null) {
            return Map.of("sent", false, "message", "SMTP is not configured.");
        }

        SimpleMailMessage notification = new SimpleMailMessage();
        notification.setFrom(fromAddress);
        notification.setTo(propertyDirectContactRecipient.trim());
        notification.setReplyTo(email.trim());
        notification.setSubject("[PropertyDirect] New contact message #" + messageId);
        notification.setText("""
                A new PropertyDirect website contact message needs review.

                Reference: PD-MSG-%s
                From: %s
                Email: %s
                Phone: %s

                Message:
                %s

                The message is also available in the PropertyDirect Super Admin support inbox.
                """.formatted(messageId, safe(name, "Website visitor"), email.trim(), phone.trim(), contactMessage.trim()));
        try {
            mailSender.send(notification);
            return Map.of("sent", true, "message", "Support email notification sent.");
        } catch (MailException ex) {
            return Map.of("sent", false, "message", "Support email delivery failed.");
        }
    }

    public Map<String, Object> sendPasswordResetOtp(String email, String otp) {
        if (!StringUtils.hasText(email)) {
            return Map.of("sent", false, "message", "Email address is required.");
        }
        if (StringUtils.hasText(mailHost) && mailSender != null) {
            try {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setFrom(fromAddress);
                message.setTo(email.trim());
                message.setSubject("[SmartApartment] Your Password Reset Verification Code: " + otp);
                message.setText("""
                        Hello,

                        You requested a password reset for your account on SmartApartment / PropertyDirect.

                        Your 6-Digit Verification Code (OTP) is: %s

                        This code is valid for 15 minutes. Please do not share this OTP with anyone.

                        If you did not request a password reset, please ignore this email.

                        Regards,
                        SmartApartment & PropertyDirect Security Team
                        """.formatted(otp));
                mailSender.send(message);
                return Map.of("sent", true, "message", "Real-time OTP email dispatched to " + email);
            } catch (MailException ex) {
                return Map.of("sent", false, "message", "Mail sending failed: " + ex.getMessage());
            }
        }
        return Map.of("sent", false, "message", "SMTP is not configured. Local fallback active.");
    }

    private static String safe(String value, String fallback) {
        return StringUtils.hasText(value) ? value.trim() : fallback;
    }
}
