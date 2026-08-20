package com.smartsociety.service;

import com.smartsociety.dto.DashboardStats;
import com.smartsociety.repository.ApartmentRepository;
import com.smartsociety.repository.ComplaintRepository;
import com.smartsociety.repository.MaintenanceBillRepository;
import com.smartsociety.repository.ResidentRepository;
import com.smartsociety.repository.VisitorRepository;
import org.springframework.stereotype.Service;

@Service
public class DashboardService {

    private final ResidentRepository residentRepository;
    private final ApartmentRepository apartmentRepository;
    private final ComplaintRepository complaintRepository;
    private final MaintenanceBillRepository billRepository;
    private final VisitorRepository visitorRepository;

    public DashboardService(ResidentRepository residentRepository,
                            ApartmentRepository apartmentRepository,
                            ComplaintRepository complaintRepository,
                            MaintenanceBillRepository billRepository,
                            VisitorRepository visitorRepository) {
        this.residentRepository = residentRepository;
        this.apartmentRepository = apartmentRepository;
        this.complaintRepository = complaintRepository;
        this.billRepository = billRepository;
        this.visitorRepository = visitorRepository;
    }

    public DashboardStats stats(String tenantId) {
        return new DashboardStats(
                residentRepository.countByTenantId(tenantId),
                apartmentRepository.countByTenantId(tenantId),
                complaintRepository.countByTenantIdAndStatus(tenantId, "OPEN"),
                billRepository.monthlyRevenue(tenantId),
                visitorRepository.countByTenantId(tenantId),
                billRepository.countByTenantIdAndPaymentStatus(tenantId, "UNPAID")
        );
    }
}
