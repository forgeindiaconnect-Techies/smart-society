package com.smartapartment.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterTenantRequest(
        @NotBlank String societyName,
        @Email @NotBlank String contactEmail,
        @NotBlank String phone,
        @NotBlank String address,
        @NotBlank String city,
        @NotBlank String adminName,
        @Email @NotBlank String adminEmail,
        @NotBlank @Size(min = 8, max = 72) String password
) {
}
