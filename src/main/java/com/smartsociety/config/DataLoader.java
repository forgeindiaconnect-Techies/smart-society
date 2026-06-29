package com.smartsociety.config;

import com.smartsociety.entity.AppUser;
import com.smartsociety.entity.Apartment;
import com.smartsociety.entity.Block;
import com.smartsociety.entity.Complaint;
import com.smartsociety.entity.Resident;
import com.smartsociety.entity.SubscriptionPlan;
import com.smartsociety.entity.Tenant;
import com.smartsociety.entity.UserRole;
import com.smartsociety.repository.ApartmentRepository;
import com.smartsociety.repository.AppUserRepository;
import com.smartsociety.repository.BlockRepository;
import com.smartsociety.repository.ComplaintRepository;
import com.smartsociety.repository.ResidentRepository;
import com.smartsociety.repository.SubscriptionPlanRepository;
import com.smartsociety.repository.TenantRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;
import java.util.UUID;

@Configuration
public class DataLoader {

    @Bean
    CommandLineRunner seedData(AppUserRepository users,
                               TenantRepository tenants,
                               SubscriptionPlanRepository plans,
                               BlockRepository blocks,
                               ApartmentRepository apartments,
                               ResidentRepository residents,
                               ComplaintRepository complaints,
                               PasswordEncoder encoder,
                               Environment environment) {
        return args -> {
            String superAdminEmail = environment.getProperty("SEED_SUPER_ADMIN_EMAIL", "platform-owner@localhost.invalid");
            String superAdminPassword = environment.getProperty("SEED_SUPER_ADMIN_PASSWORD", UUID.randomUUID().toString());
            String residentEmail = environment.getProperty("SEED_RESIDENT_EMAIL", "resident@localhost.invalid");
            String residentPassword = environment.getProperty("SEED_RESIDENT_PASSWORD", UUID.randomUUID().toString());

            if (users.findByEmail(superAdminEmail).isPresent()) {
                return;
            }

            SubscriptionPlan plan = new SubscriptionPlan();
            plan.setTenantId("platform");
            plan.setName("Premium Plan");
            plan.setMonthlyPrice(new BigDecimal("4999"));
            plan.setMaxApartments(500);
            plan.setMaxResidents(1500);
            plan.setVisitorManagement(true);
            plan.setAmenityBooking(true);
            plan.setAnalytics(true);
            plans.save(plan);

            Tenant tenant = new Tenant();
            tenant.setTenantId("green-heights");
            tenant.setCode("green-heights");
            tenant.setSocietyName("Green Heights Apartment");
            tenant.setContactEmail("admin@greenheights.com");
            tenant.setPhone("9876543210");
            tenant.setAddress("Main Road");
            tenant.setCity("Chennai");
            tenant.setApproved(true);
            tenants.save(tenant);

            AppUser superAdmin = new AppUser();
            superAdmin.setTenantId("platform");
            superAdmin.setFullName("Platform Super Admin");
            superAdmin.setEmail(superAdminEmail);
            superAdmin.setPasswordHash(encoder.encode(superAdminPassword));
            superAdmin.setRole(UserRole.SUPER_ADMIN);
            users.save(superAdmin);

            AppUser residentUser = new AppUser();
            residentUser.setTenantId("green-heights");
            residentUser.setFullName("Demo Resident");
            residentUser.setEmail(residentEmail);
            residentUser.setPasswordHash(encoder.encode(residentPassword));
            residentUser.setRole(UserRole.RESIDENT);
            users.save(residentUser);

            Block block = new Block();
            block.setTenantId("green-heights");
            block.setName("Block A");
            block.setTotalFloors(10);
            blocks.save(block);

            Apartment apartment = new Apartment();
            apartment.setTenantId("green-heights");
            apartment.setBlock(block);
            apartment.setFloorNo(2);
            apartment.setUnitNo("A-204");
            apartment.setUnitType("2BHK");
            apartment.setOccupancyStatus("OCCUPIED");
            apartment.setOwnerName("Demo Owner");
            apartment.setOwnerPhone("9876543210");
            apartments.save(apartment);

            Resident resident = new Resident();
            resident.setTenantId("green-heights");
            resident.setUser(residentUser);
            resident.setApartment(apartment);
            resident.setResidentType("OWNER");
            resident.setVehicleNumber("TN01AB1234");
            residents.save(resident);

            Complaint complaint = new Complaint();
            complaint.setTenantId("green-heights");
            complaint.setResident(resident);
            complaint.setTitle("Water leakage");
            complaint.setCategory("Plumbing");
            complaint.setPriority("HIGH");
            complaint.setDescription("Leakage near kitchen sink");
            complaint.setStatus("OPEN");
            complaints.save(complaint);
        };
    }
}
