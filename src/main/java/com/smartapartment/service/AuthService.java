package com.smartapartment.service;

import com.smartapartment.dto.AuthResponse;
import com.smartapartment.dto.LoginRequest;
import com.smartapartment.dto.RegisterTenantRequest;
import com.smartapartment.entity.AppUser;
import com.smartapartment.entity.Tenant;
import com.smartapartment.entity.UserRole;
import com.smartapartment.repository.AppUserRepository;
import com.smartapartment.repository.TenantRepository;
import com.smartapartment.security.JwtService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

@Service
public class AuthService {

    private final AppUserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(AppUserRepository userRepository,
                       TenantRepository tenantRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService) {
        this.userRepository = userRepository;
        this.tenantRepository = tenantRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public void registerTenant(RegisterTenantRequest request) {
        String tenantCode = request.societyName()
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");

        if (tenantCode.isBlank()) {
            throw new IllegalArgumentException("Society name must contain letters or numbers");
        }
        if (tenantRepository.findByCode(tenantCode).isPresent()) {
            throw new IllegalArgumentException("A society with this name already exists");
        }
        String adminEmail = normalizeEmail(request.adminEmail());
        if (userRepository.findByEmail(adminEmail).isPresent()) {
            throw new IllegalArgumentException("An account with this email already exists");
        }

        Tenant tenant = new Tenant();
        tenant.setTenantId(tenantCode);
        tenant.setCode(tenantCode);
        tenant.setSocietyName(request.societyName());
        tenant.setContactEmail(request.contactEmail());
        tenant.setPhone(request.phone());
        tenant.setAddress(request.address());
        tenant.setCity(request.city());
        tenant.setApproved(false);
        tenantRepository.save(tenant);

        AppUser admin = new AppUser();
        admin.setTenantId(tenantCode);
        admin.setFullName(request.adminName());
        admin.setEmail(adminEmail);
        admin.setPhone(request.phone());
        admin.setRole(UserRole.SOCIETY_ADMIN);
        admin.setPasswordHash(passwordEncoder.encode(request.password()));
        userRepository.save(admin);

    }

    public AuthResponse login(LoginRequest request) {
        AppUser user = authenticate(request.email(), request.password());
        return toResponse(user);
    }

    public AppUser authenticate(String email, String password) {
        AppUser user = userRepository.findByEmail(normalizeEmail(email))
                .orElseThrow(() -> new IllegalArgumentException("Invalid email or password"));
        if (password == null || !passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid email or password");
        }
        if (user.isAccountLocked() || !"ACTIVE".equalsIgnoreCase(user.getStatus())) {
            throw new IllegalArgumentException("This account is not active");
        }
        if (user.getRole() != UserRole.SUPER_ADMIN) {
            Tenant tenant = tenantRepository.findByCode(user.getTenantId())
                    .orElseThrow(() -> new IllegalArgumentException("Society account was not found"));
            if (!tenant.isApproved()) {
                throw new IllegalArgumentException("Society registration is awaiting approval");
            }
        }
        return user;
    }

    private static String normalizeEmail(String email) {
        if (email == null) return "";
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        if (normalized.endsWith("@smartsociety")) {
            normalized = normalized.replace("@smartsociety", "@smartapartment");
        }
        return normalized;
    }

    private AuthResponse toResponse(AppUser user) {
        return new AuthResponse(jwtService.generateToken(user), user.getRole().name(), user.getTenantId(), user.getFullName());
    }
}
