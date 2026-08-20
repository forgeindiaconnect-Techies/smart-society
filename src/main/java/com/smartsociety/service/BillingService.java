package com.smartsociety.service;

import com.smartsociety.entity.Apartment;
import com.smartsociety.entity.MaintenanceBill;
import com.smartsociety.repository.ApartmentRepository;
import com.smartsociety.repository.MaintenanceBillRepository;
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
        int created = 0;
        for (Apartment apartment : apartmentRepository.findByTenantId(tenantId)) {
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
