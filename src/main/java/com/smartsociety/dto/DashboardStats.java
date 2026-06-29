package com.smartsociety.dto;

import java.math.BigDecimal;

public record DashboardStats(
        long totalResidents,
        long totalApartments,
        long pendingComplaints,
        BigDecimal monthlyRevenue,
        long visitorCount,
        long unpaidBills
) {
}
