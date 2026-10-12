package com.smartapartment.security;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.Set;

/** Prevent security staff from bypassing console policy through superseded gate routes. */
@Component
public class SecurityConsoleLegacyGuardFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain)
            throws ServletException,IOException {
        var auth=SecurityContextHolder.getContext().getAuthentication();
        String path=request.getRequestURI().substring(request.getContextPath().length());
        boolean guard=auth!=null && auth.getAuthorities().stream().anyMatch(a->a.getAuthority().equals("ROLE_SECURITY_STAFF"));
        boolean mutation=!Set.of("GET","HEAD","OPTIONS").contains(request.getMethod());
        boolean legacy=path.equals("/api/society/visitors") || path.startsWith("/api/society/visitors/")
                || path.equals("/api/society/gate-entries") || path.startsWith("/api/society/gate-entries/");
        if(guard && mutation && legacy) {
            response.setStatus(403);response.setContentType("application/json");
            response.getWriter().write("{\"message\":\"Use the security console for gate decisions. A gate-bound session and audit record are required.\"}");
            return;
        }
        chain.doFilter(request,response);
    }
}
