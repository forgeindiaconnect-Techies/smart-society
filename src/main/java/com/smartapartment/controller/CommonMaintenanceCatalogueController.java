package com.smartapartment.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping("/api/common-maintenance")
public class CommonMaintenanceCatalogueController {

    private static final List<ServiceCategoryResponse> CATEGORIES = List.of(
            new ServiceCategoryResponse("Cleaning", "Home, bathroom, kitchen, sofa and move-in deep cleaning"),
            new ServiceCategoryResponse("Carpentry", "Door, cupboard, furniture, wardrobe, curtain and installation work"),
            new ServiceCategoryResponse("Electrical", "Switch board, fan, light, wiring and appliance inspection"),
            new ServiceCategoryResponse("Plumbing", "Tap, sink, leakage, bathroom fitting and drainage support"),
            new ServiceCategoryResponse("Painting", "Wall touch-up, repainting, damp check and waterproofing inspection"),
            new ServiceCategoryResponse("Packers & Movers", "Local shifting, intercity movement and handover logistics"),
            new ServiceCategoryResponse("Legal & Agreement", "Rental agreement, verification and document workflow"),
            new ServiceCategoryResponse("Pest Control", "Cockroach, termite, bed bug and sanitization treatment")
    );

    private static final List<ServiceResponse> SERVICES = List.of(
            new ServiceResponse("Home Cleaning", "Cleaning", "Bathroom, kitchen, sofa and full-home cleaning", "Rs. 499", "Quality re-check support", "Bathroom/kitchen surface cleaning, dusting, floor cleaning and basic sanitation", "Material replacement, civil work and heavy stain restoration"),
            new ServiceResponse("Bathroom Cleaning", "Cleaning", "Deep cleaning for bathroom fixtures, tiles and floor", "Rs. 399", "Quality re-check support", "Toilet, wash basin, mirror, floor and tile scrubbing", "Plumbing repair, fixtures and hardware replacement"),
            new ServiceResponse("Kitchen Cleaning", "Cleaning", "Kitchen platform, tiles, sink and exhaust-area cleaning", "Rs. 499", "Quality re-check support", "Degreasing, sink cleaning, platform cleaning and appliance exterior wipe", "Chimney dismantling, pest treatment and spare parts"),
            new ServiceResponse("Drill & Hang", "Carpentry", "Wall shelf, curtain rod, frame and small fixture installation", "Rs. 99", "30 days", "Drilling, hanging, alignment check and basic installation", "Mounting brackets, shelves, rods and other purchased materials"),
            new ServiceResponse("Door & Lock Fitting", "Carpentry", "Door lock, latch, handle, hinge and door alignment work", "Rs. 149", "30 days", "Inspection, fitting, tightening and minor alignment", "New lockset, major door replacement and polish work"),
            new ServiceResponse("Cupboard Hinge", "Carpentry", "Cupboard hinge, handle, drawer channel and wardrobe repair", "Rs. 179", "30 days", "Hinge/channel inspection, tightening, minor repair and fitting", "New hinges, channels, handles and carpentry material"),
            new ServiceResponse("Furniture Assembly", "Carpentry", "Bed, table, chair, sofa, cabinet and modular furniture assembly", "Rs. 299", "60 days", "Assembly labour, alignment and basic stability check", "Missing screws, hardware kit, custom fabrication and relocation"),
            new ServiceResponse("Tap Repair", "Plumbing", "Tap leakage, washer, faucet and minor bathroom fitting support", "Rs. 199", "30 days", "Leak inspection, tightening and minor fitting support", "New tap, washer, pipe, valve and concealed-line work"),
            new ServiceResponse("Switch Board Repair", "Electrical", "Switch board, socket, light and electrical point inspection", "Rs. 149", "30 days", "Point inspection, switch/socket fitting and basic safety check", "New switchboard, wire, MCB, fan/light hardware and concealed wiring"),
            new ServiceResponse("Fan Repair", "Electrical", "Fan noise, speed, regulator and installation support", "Rs. 199", "30 days", "Inspection, tightening, regulator check and basic repair", "New fan, capacitor, regulator and wiring material"),
            new ServiceResponse("Painting & Waterproofing", "Painting", "Wall touch-up, damp inspection and repainting quote", "Rs. 399", "Inspection-based", "Wall inspection, scope validation and estimate preparation", "Paint, putty, waterproofing chemical and civil repair"),
            new ServiceResponse("Packers & Movers", "Packers & Movers", "Home shifting enquiry with vendor quote workflow", "Rs. 999", "Vendor policy", "Requirement capture, pickup/drop details and vendor assignment", "Packing material, transport charges, insurance and loading extras"),
            new ServiceResponse("Rental & Legal Agreement", "Legal & Agreement", "Rental/sale agreement draft and verification support", "Rs. 299", "Document support", "Requirement capture, draft workflow and status tracking", "Government fees, stamp duty, courier and lawyer consultation"),
            new ServiceResponse("Pest Control & Sanitization", "Pest Control", "Termite, cockroach, bed bug and herbal sanitization support", "Rs. 299", "Treatment-based", "Inspection, treatment scheduling and vendor update tracking", "Repeat treatment outside warranty and specialized chemical upgrades")
    );

    @GetMapping("/services")
    public CatalogueResponse services(@RequestParam(required = false) String sourcePlatform,
                                      @RequestParam(required = false) String category) {
        String platform = normalizePlatform(sourcePlatform);
        String selectedCategory = category == null ? "" : category.trim().toLowerCase(Locale.ROOT);
        List<ServiceResponse> filtered = SERVICES.stream()
                .filter(service -> selectedCategory.isBlank() || service.category().toLowerCase(Locale.ROOT).equals(selectedCategory))
                .toList();
        return new CatalogueResponse(
                platform,
                "Bangalore",
                "External vendor",
                "Use this catalogue for SmartSociety resident maintenance and PropertyDirect customer home services.",
                CATEGORIES,
                filtered
        );
    }

    private static String normalizePlatform(String sourcePlatform) {
        if (sourcePlatform == null || sourcePlatform.isBlank()) return "shared";
        String value = sourcePlatform.trim().toLowerCase(Locale.ROOT);
        return switch (value) {
            case "smartsociety", "propertydirect", "shared" -> value;
            default -> "shared";
        };
    }

    public record CatalogueResponse(
            String sourcePlatform,
            String city,
            String vendorModel,
            String description,
            List<ServiceCategoryResponse> categories,
            List<ServiceResponse> services
    ) {}

    public record ServiceCategoryResponse(
            String name,
            String description
    ) {}

    public record ServiceResponse(
            String name,
            String category,
            String description,
            String startingPrice,
            String warranty,
            String includes,
            String excludes
    ) {}
}
