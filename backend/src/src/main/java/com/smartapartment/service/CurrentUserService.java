package com.smartapartment.service;

import com.smartapartment.entity.AppUser;
import com.smartapartment.repository.AppUserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class CurrentUserService {

    private final AppUserRepository users;

    public CurrentUserService(AppUserRepository users) {
        this.users = users;
    }

    public AppUser requireUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || "anonymousUser".equals(authentication.getPrincipal())) {
            throw new IllegalStateException("Authentication is required");
        }
        return users.findByEmail(authentication.getName())
                .orElseThrow(() -> new IllegalStateException("Authenticated account no longer exists"));
    }

    public String requireTenantId() {
        return requireUser().getTenantId();
    }
}
