package com.smartsociety.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record RegisterTenantRequest(
        @NotBlank String societyName,
        @Email String contactEmail,
        @NotBlank String phone,
        @NotBlank String address,
        @NotBlank String city,
        @NotBlank String adminName,
        @Email String adminEmail,
        @NotBlank String password
) {
}
