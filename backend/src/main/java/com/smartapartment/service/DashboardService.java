package com.smartapartment.service;

import com.smartapartment.dto.DashboardStats;
import com.smartapartment.repository.ApartmentRepository;
import com.smartapartment.repository.ComplaintRepository;
import com.smartapartment.repository.MaintenanceBillRepository;
import com.smartapartment.repository.ResidentRepository;
import com.smartapartment.repository.VisitorRepository;
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
