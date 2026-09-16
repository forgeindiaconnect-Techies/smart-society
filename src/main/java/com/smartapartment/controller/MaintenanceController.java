package com.smartapartment.controller;

import com.smartapartment.entity.EmergencyMaintenanceBooking;
import com.smartapartment.service.EmergencyMaintenanceService;
import com.smartapartment.service.EmergencyMaintenanceService.Actor;
import com.smartapartment.service.EmergencyMaintenanceService.BookingInput;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Production API facade for the three-stage maintenance booking and live-tracking workflow.
 *
 * The project already contains a richer emergency-dispatch engine under
 * /api/maintenance/dispatch.  This controller intentionally reuses that engine and exposes the
 * stable contract required by the resident tracking and admin operations views.
 */
@RestController
@RequestMapping("/api/maintenance")
public class MaintenanceController {

    private static final long MAX_IMAGE_BYTES = 5L * 1024L * 1024L;
    private static final long MAX_IMAGE_PIXELS = 20_000_000L;

    private final EmergencyMaintenanceService service;

    public MaintenanceController(EmergencyMaintenanceService service) {
        this.service = service;
    }

    public record BookRequest(
            String residentName,
            @NotBlank @Size(max = 120) String unitNumber,
            @NotBlank @Size(max = 40) String contactNumber,
            @NotBlank String tradeCategory,
            @NotBlank @Size(max = 120) String hub,
            @NotBlank @Size(max = 3000) String description,
            @Size(max = 600) String serviceAddress,
            @Size(max = 80) String city,
            Double latitude,
            Double longitude) {}

    @PostMapping("/book")
    public Map<String, Object> book(HttpSession session, @Valid @RequestBody BookRequest request) {
        Actor actor = service.actor(session, "smartsociety");
        String trade = normalizeTrade(request.tradeCategory());
        String city = request.city() == null || request.city().isBlank()
                ? service.inferCityForHub(request.hub())
                : request.city().trim();
        String address = request.serviceAddress() == null || request.serviceAddress().isBlank()
                ? request.unitNumber() + ", " + request.hub() + ", " + city
                : request.serviceAddress().trim();

        BookingInput input = new BookingInput(
                request.contactNumber().trim(),
                address,
                city,
                request.hub().trim(),
                trade,
                request.description().trim(),
                request.latitude(),
                request.longitude());

        EmergencyMaintenanceBooking created = service.createWorkflow(actor, input, request.unitNumber());
        Map<String, Object> body = service.workflowView(actor, created);
        body.put("message", "Maintenance booking created");
        return body;
    }

    @GetMapping("/orders/active")
    public List<Map<String, Object>> activeOrders(HttpSession session) {
        return service.workflowActiveOrders(service.actor(session, "smartsociety"));
    }

    @GetMapping("/orders/metrics")
    public Map<String, Object> metrics(HttpSession session) {
        return service.workflowMetrics(service.actor(session, "smartsociety"));
    }

    @GetMapping("/orders/resident/{orderId}")
    public Map<String, Object> residentOrder(HttpSession session, @PathVariable String orderId) {
        Actor actor = service.actor(session, "smartsociety");
        return service.workflowView(actor, service.workflowReadable(actor, orderId));
    }

    public record StageRequest(
            @NotBlank String stage,
            String imageUrl,
            Double latitude,
            Double longitude,
            @Size(max = 2000) String notes,
            Boolean adminOverride) {}

    @PostMapping(value = "/orders/{id}/stage", consumes = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> stageJson(HttpSession session,
                                         @PathVariable String id,
                                         @Valid @RequestBody StageRequest request) {
        Actor actor = service.actor(session, "smartsociety");
        EmergencyMaintenanceBooking updated = service.workflowStage(
                actor, id, request.stage(), null, request.imageUrl(),
                request.latitude(), request.longitude(), request.notes(),
                Boolean.TRUE.equals(request.adminOverride()));
        return service.workflowView(actor, updated);
    }

    @PostMapping(value = "/orders/{id}/stage", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> stageMultipart(HttpSession session,
                                              @PathVariable String id,
                                              @RequestParam @NotBlank String stage,
                                              @RequestParam(required = false) MultipartFile photo,
                                              @RequestParam(required = false) String imageUrl,
                                              @RequestParam(required = false) Double latitude,
                                              @RequestParam(required = false) Double longitude,
                                              @RequestParam(required = false) @Size(max = 2000) String notes,
                                              @RequestParam(defaultValue = "false") boolean adminOverride) throws IOException {
        Actor actor = service.actor(session, "smartsociety");
        byte[] normalizedImage = null;
        if (photo != null && !photo.isEmpty()) normalizedImage = normalizeImage(photo);
        EmergencyMaintenanceBooking updated = service.workflowStage(
                actor, id, stage, normalizedImage, imageUrl, latitude, longitude, notes, adminOverride);
        return service.workflowView(actor, updated);
    }

    public record ReviewRequest(
            @Min(1) @Max(5) int rating,
            @Size(max = 1000) String comment,
            List<@Size(max = 40) String> tags) {}

    @PostMapping("/orders/{id}/review")
    public Map<String, Object> review(HttpSession session,
                                      @PathVariable String id,
                                      @Valid @RequestBody ReviewRequest request) {
        Actor actor = service.actor(session, "smartsociety");
        service.workflowReview(actor, id, request.rating(), request.comment(), request.tags());
        EmergencyMaintenanceBooking updated = service.workflowReadable(actor, id);
        return Map.of(
                "message", "Thank you for your feedback",
                "order", service.workflowView(actor, updated));
    }

    public record ReassignRequest(@NotNull Long partnerId) {}

    @PostMapping("/orders/{id}/reassign")
    public Map<String, Object> reassign(HttpSession session,
                                        @PathVariable String id,
                                        @Valid @RequestBody ReassignRequest request) {
        Actor actor = service.actor(session, "smartsociety");
        EmergencyMaintenanceBooking order = service.workflowReadable(actor, id);
        service.adminAssignPartner(actor, order.getId(), request.partnerId());
        EmergencyMaintenanceBooking updated = service.workflowReadable(actor, String.valueOf(order.getId()));
        return service.workflowView(actor, updated);
    }

    /** SSE equivalent of /topic/order/{id}. */
    @GetMapping(value = "/topic/order/{id}", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter orderEvents(HttpSession session, @PathVariable String id) {
        return service.subscribeOrder(service.actor(session, "smartsociety"), id);
    }

    /** SSE equivalent of /topic/admin/orders. */
    @GetMapping(value = "/topic/admin/orders", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter adminEvents(HttpSession session) {
        return service.subscribeAdmin(service.actor(session, "smartsociety"));
    }

    private String normalizeTrade(String raw) {
        if (raw == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trade category is required");
        String value = raw.trim().toUpperCase(Locale.ROOT);
        return switch (value) {
            case "PLUMBING", "PLUMBER" -> "Plumbing";
            case "ELECTRICAL", "ELECTRICIAN" -> "Electrical";
            case "CARPENTRY", "CARPENTER" -> "Carpentry";
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trade category must be PLUMBING, ELECTRICAL, or CARPENTRY");
        };
    }

    private byte[] normalizeImage(MultipartFile upload) throws IOException {
        if (upload.getSize() <= 0 || upload.getSize() > MAX_IMAGE_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Upload a valid PNG or JPEG image up to 5 MB");
        }
        byte[] input = upload.getBytes();
        try (ImageInputStream stream = ImageIO.createImageInputStream(new ByteArrayInputStream(input))) {
            if (stream == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid image");
            var readers = ImageIO.getImageReaders(stream);
            if (!readers.hasNext()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid image");
            ImageReader reader = readers.next();
            try {
                reader.setInput(stream);
                String format = reader.getFormatName().toUpperCase(Locale.ROOT);
                if (!Set.of("JPEG", "JPG", "PNG").contains(format)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only JPEG and PNG images are accepted");
                }
                long pixels = (long) reader.getWidth(0) * reader.getHeight(0);
                if (pixels > MAX_IMAGE_PIXELS) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image must be under 20 megapixels");
                }
                ByteArrayOutputStream output = new ByteArrayOutputStream();
                if (!ImageIO.write(reader.read(0), "png", output)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unable to process image");
                }
                return output.toByteArray();
            } finally {
                reader.dispose();
            }
        }
    }
}
