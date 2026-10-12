package com.smartapartment.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterTenantRequest(
        @NotBlank String societyName,
        @Email @NotBlank String contactEmail,
        @NotBlank String phone,
        @NotBlank String address,
        @NotBlank String city,
        @NotBlank String state,
        @NotBlank String country,
        @NotBlank @Pattern(regexp = "[0-9]{6}", message = "Postal code must contain 6 digits") String postalCode,
        @NotBlank String societyType,
        String registrationNumber,
        @Positive Integer totalUnits,
        @PositiveOrZero Integer totalWings,
        @NotBlank String adminName,
        @NotBlank String adminDesignation,
        @Email @NotBlank String adminEmail,
        @NotBlank @Size(min = 8, max = 72) String password
) {
}
