package com.smartsociety.security;

public final class TenantContext {

    private static final ThreadLocal<String> CURRENT_TENANT = new ThreadLocal<>();

    private TenantContext() {
    }

    public static void setTenantId(String tenantId) {
        CURRENT_TENANT.set(tenantId);
    }

    public static String getTenantId() {
        return CURRENT_TENANT.get();
    }

    public static String getOrDefault() {
        String tenantId = CURRENT_TENANT.get();
        return tenantId == null || tenantId.isBlank() ? "platform" : tenantId;
    }

    public static void clear() {
        CURRENT_TENANT.remove();
    }
}
