package com.smartsociety.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record ApartmentReportMailRequest(
        @NotBlank String name,
        @NotBlank String phone,
        @Email @NotBlank String email,
        String apartment,
        String issueType,
        String details
) {
}
