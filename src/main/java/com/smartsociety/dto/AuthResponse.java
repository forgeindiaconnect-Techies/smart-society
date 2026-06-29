package com.smartsociety.dto;

public record AuthResponse(
        String token,
        String role,
        String tenantId,
        String fullName
) {
}
