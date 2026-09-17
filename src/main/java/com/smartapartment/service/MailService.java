package com.smartapartment.service;

import com.smartapartment.dto.ApartmentReportMailRequest;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class MailService {
    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final JavaMailSender mailSender;
    private final String fromAddress;
    private final String mailHost;
    private final String propertyDirectContactRecipient;
    private final String brevoApiKey;

    public MailService(
            ObjectProvider<JavaMailSender> mailSenderProvider,
            @Value("${app.mail.from:no-reply@propertydirect.local}") String fromAddress,
            @Value("${spring.mail.host:}") String mailHost,
            @Value("${app.propertydirect.contact-recipient:}") String propertyDirectContactRecipient,
            @Value("${app.mail.brevo-api-key:}") String brevoApiKey
    ) {
        this.mailSender = mailSenderProvider.getIfAvailable();
        this.fromAddress = fromAddress;
        this.mailHost = mailHost;
        this.propertyDirectContactRecipient = propertyDirectContactRecipient;
        String resolvedKey = StringUtils.hasText(brevoApiKey) ? brevoApiKey.trim() : "";
        if (!StringUtils.hasText(resolvedKey)) {
            String envKey = System.getenv("BREVO_API_KEY");
            if (StringUtils.hasText(envKey)) {
                resolvedKey = envKey.trim();
            }
        }
        this.brevoApiKey = resolvedKey;
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

        // 1. Primary path: Dispatch directly via Brevo Transactional Email REST API
        if (StringUtils.hasText(brevoApiKey)) {
            Map<String, Object> brevoResult = sendViaBrevoApi(email.trim(), otp);
            if (Boolean.TRUE.equals(brevoResult.get("sent"))) {
                return brevoResult;
            }
            log.warn("Brevo REST API delivery attempt failed: {}", brevoResult.get("message"));
            // If SMTP is not explicitly configured, return Brevo's informative diagnostic result directly
            if (!StringUtils.hasText(mailHost) || mailSender == null) {
                return brevoResult;
            }
        }

        // 2. Secondary path: JavaMailSender SMTP
        if (!StringUtils.hasText(mailHost) || mailSender == null) {
            return Map.of(
                    "sent", false,
                    "message", "Mail delivery is not configured. Provide Brevo API key or configure SMTP relay."
            );
        }
        if (!StringUtils.hasText(fromAddress) || fromAddress.endsWith(".local")) {
            return Map.of(
                    "sent", false,
                    "message", "APP_MAIL_FROM must be a verified Brevo sender email, not a local placeholder."
            );
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(email.trim());
            message.setSubject("Your SmartApartment / PropertyDirect password reset code");
            message.setText("""
                    Hello,

                    You requested a password reset for your account on SmartApartment / PropertyDirect.

                    Your 6-digit verification code is:

                    %s

                    This code is valid for 15 minutes. Please do not share this OTP with anyone.

                    If you did not request a password reset, please ignore this email.

                    Regards,
                    SmartApartment & PropertyDirect Security Team
                    """.formatted(otp));
            mailSender.send(message);
            return Map.of("sent", true, "message", "Real-time OTP email dispatched to " + email);
        } catch (MailException ex) {
            log.warn("Password reset OTP email delivery failed for {}", email, ex);
            return Map.of("sent", false, "message", "Mail sending failed: " + ex.getMessage());
        }
    }

    private Map<String, Object> sendViaBrevoApi(String email, String otp) {
        try {
            String senderEmail = StringUtils.hasText(fromAddress) && !fromAddress.endsWith(".local")
                    ? fromAddress.trim()
                    : "selvakumarc029@gmail.com";
            String senderName = "SmartApartment Security";

            String htmlBody = """
                    <!DOCTYPE html>
                    <html>
                    <body style="margin:0;padding:24px;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
                      <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);border:1px solid #e2e8f0;">
                        <div style="background:#2563eb;padding:26px 24px;text-align:center;">
                          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.02em;">SmartApartment</h1>
                          <p style="margin:4px 0 0;color:#bfdbfe;font-size:13px;font-weight:600;">Account Security & Verification</p>
                        </div>
                        <div style="padding:32px 28px;">
                          <h2 style="margin:0 0 10px;font-size:18px;color:#0f172a;font-weight:700;">Password Reset Verification Code</h2>
                          <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#475569;">
                            We received a request to reset your password for SmartApartment / PropertyDirect. Use the 6-digit verification code below:
                          </p>
                          <div style="background:#eff6ff;border:2px dashed #93c5fd;border-radius:12px;padding:18px;text-align:center;margin:0 0 22px;">
                            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:34px;font-weight:900;letter-spacing:8px;color:#1d4ed8;">%s</span>
                          </div>
                          <p style="margin:0 0 16px;font-size:13px;color:#64748b;line-height:1.5;">
                            This code is valid for <strong>15 minutes</strong>. If you did not request this password reset, please ignore this email.
                          </p>
                          <hr style="border:0;border-top:1px solid #e2e8f0;margin:22px 0;">
                          <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
                            Automated message from SmartApartment Security System
                          </p>
                        </div>
                      </div>
                    </body>
                    </html>
                    """.formatted(otp);

            String textBody = "Your SmartApartment password reset verification code is: " + otp + ". This code expires in 15 minutes.";

            String jsonPayload = """
                    {
                      "sender": {"name": "%s", "email": "%s"},
                      "to": [{"email": "%s"}],
                      "subject": "Your SmartApartment Password Reset Verification Code",
                      "htmlContent": "%s",
                      "textContent": "%s"
                    }
                    """.formatted(
                    escapeJson(senderName),
                    escapeJson(senderEmail),
                    escapeJson(email.trim()),
                    escapeJson(htmlBody),
                    escapeJson(textBody)
            );

            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(10))
                    .build();

            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.brevo.com/v3/smtp/email"))
                    .timeout(Duration.ofSeconds(15))
                    .header("api-key", brevoApiKey)
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonPayload, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = client.send(httpRequest, HttpResponse.BodyHandlers.ofString());
            int status = response.statusCode();
            String respBody = response.body() != null ? response.body() : "";

            if (status >= 200 && status < 300) {
                log.info("Brevo API: OTP email successfully sent to {}", email);
                return Map.of("sent", true, "message", "Real-time OTP email dispatched to " + email + " via Brevo.");
            }

            log.warn("Brevo API returned status {}: {}", status, respBody);
            String diagnostic = "Brevo API error (" + status + "): " + respBody;
            if (respBody.contains("unrecognised IP address")) {
                diagnostic = "Brevo API: IP not authorized. Please authorize your IP (2401:4900:1cc8:81e0:b569:6619:56c9:15a9) at https://app.brevo.com/security/authorised_ips";
            } else if (respBody.contains("Key not authorized") || respBody.contains("sender")) {
                diagnostic = "Brevo API: Sender email '" + senderEmail + "' is not verified in Brevo. Set APP_MAIL_FROM to your verified Brevo sender email.";
            }
            return Map.of("sent", false, "message", diagnostic);
        } catch (Exception ex) {
            log.warn("Exception calling Brevo API for {}", email, ex);
            return Map.of("sent", false, "message", "Brevo API request failed: " + ex.getMessage());
        }
    }

    private static String escapeJson(String text) {
        if (text == null) return "";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\b' -> sb.append("\\b");
                case '\f' -> sb.append("\\f");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    if (c < ' ') {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
                }
            }
        }
        return sb.toString();
    }

    private static String safe(String value, String fallback) {
        return StringUtils.hasText(value) ? value.trim() : fallback;
    }
}
