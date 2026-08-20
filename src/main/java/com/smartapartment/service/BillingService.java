package com.smartapartment.service;

import com.smartapartment.entity.Apartment;
import com.smartapartment.entity.MaintenanceBill;
import com.smartapartment.repository.ApartmentRepository;
import com.smartapartment.repository.MaintenanceBillRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;

@Service
public class BillingService {

    private final ApartmentRepository apartmentRepository;
    private final MaintenanceBillRepository billRepository;

    public BillingService(ApartmentRepository apartmentRepository, MaintenanceBillRepository billRepository) {
        this.apartmentRepository = apartmentRepository;
        this.billRepository = billRepository;
    }

    @Transactional
    public int generateMonthlyBills(String tenantId, String billMonth, BigDecimal amount) {
        if (tenantId == null || tenantId.isBlank()) {
            throw new IllegalArgumentException("Tenant is required");
        }
        try {
            java.time.YearMonth.parse(billMonth);
        } catch (RuntimeException exception) {
            throw new IllegalArgumentException("Bill month must use YYYY-MM format");
        }
        if (amount == null || amount.signum() <= 0) {
            throw new IllegalArgumentException("Bill amount must be greater than zero");
        }
        int created = 0;
        for (Apartment apartment : apartmentRepository.findByTenantId(tenantId)) {
            if (billRepository.existsByTenantIdAndApartmentIdAndBillMonth(tenantId, apartment.getId(), billMonth)) {
                continue;
            }
            MaintenanceBill bill = new MaintenanceBill();
            bill.setTenantId(tenantId);
            bill.setApartment(apartment);
            bill.setBillMonth(billMonth);
            bill.setBaseAmount(amount);
            bill.setLateFee(BigDecimal.ZERO);
            bill.setTotalAmount(amount);
            bill.setDueDate(LocalDate.now().plusDays(15));
            bill.setPaymentStatus("UNPAID");
            billRepository.save(bill);
            created++;
        }
        return created;
    }
}
