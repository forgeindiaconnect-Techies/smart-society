package com.smartsociety.service;

import com.smartsociety.dto.AuthResponse;
import com.smartsociety.dto.LoginRequest;
import com.smartsociety.dto.RegisterTenantRequest;
import com.smartsociety.entity.AppUser;
import com.smartsociety.entity.Tenant;
import com.smartsociety.entity.UserRole;
import com.smartsociety.repository.AppUserRepository;
import com.smartsociety.repository.TenantRepository;
import com.smartsociety.security.JwtService;
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
    public AuthResponse registerTenant(RegisterTenantRequest request) {
        String tenantCode = request.societyName()
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");

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
        admin.setEmail(request.adminEmail());
        admin.setPhone(request.phone());
        admin.setRole(UserRole.SOCIETY_ADMIN);
        admin.setPasswordHash(passwordEncoder.encode(request.password()));
        userRepository.save(admin);

        return toResponse(admin);
    }

    public AuthResponse login(LoginRequest request) {
        AppUser user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new IllegalArgumentException("Invalid email or password"));
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid email or password");
        }
        return toResponse(user);
    }

    private AuthResponse toResponse(AppUser user) {
        return new AuthResponse(jwtService.generateToken(user), user.getRole().name(), user.getTenantId(), user.getFullName());
    }
}
