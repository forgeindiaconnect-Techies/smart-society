package com.smartapartment.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import com.smartapartment.entity.AppUser;
import com.smartapartment.repository.AppUserRepository;
import com.smartapartment.entity.PropertyCustomer;
import com.smartapartment.repository.PropertyCustomerRepository;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final AppUserRepository users;
    private final PropertyCustomerRepository propertyUsers;

    public JwtAuthenticationFilter(JwtService jwtService, AppUserRepository users, PropertyCustomerRepository propertyUsers) {
        this.jwtService = jwtService;
        this.users = users;
        this.propertyUsers = propertyUsers;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        try {
            String header = request.getHeader("Authorization");
            if (header != null && header.startsWith("Bearer ")) {
                Claims claims = jwtService.parse(header.substring(7));
                AppUser user = users.findByEmail(claims.getSubject()).orElse(null);
                if (user != null && !user.isAccountLocked() && user.getAccessRevokedAt() == null && user.getRole() != null) {
                    TenantContext.setTenantId(user.getTenantId());
                    var auth = new UsernamePasswordAuthenticationToken(
                            user.getEmail(),
                            null,
                            List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()))
                    );
                    SecurityContextHolder.getContext().setAuthentication(auth);
                } else if ("propertydirect".equals(claims.get("platform", String.class))) {
                    PropertyCustomer propertyUser = propertyUsers.findByEmailIgnoreCase(claims.getSubject()).orElse(null);
                    if (propertyUser != null && propertyUser.isActive() && "ACTIVE".equalsIgnoreCase(propertyUser.getStatus())) {
                        TenantContext.setTenantId("propertydirect");
                        var auth = new UsernamePasswordAuthenticationToken(
                                propertyUser.getEmail(),
                                null,
                                List.of(new SimpleGrantedAuthority("ROLE_" + propertyUser.getRole()))
                        );
                        SecurityContextHolder.getContext().setAuthentication(auth);
                    }
                }
            }
            filterChain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }
}
