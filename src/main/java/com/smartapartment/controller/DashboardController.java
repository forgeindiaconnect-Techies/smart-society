package com.smartapartment.controller;

import com.smartapartment.security.TenantContext;
import com.smartapartment.service.DashboardService;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Controller;
import com.smartapartment.repository.TenantRepository;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class DashboardController {

    private final DashboardService dashboardService;
    private final TenantRepository tenantRepository;

    public DashboardController(DashboardService dashboardService, TenantRepository tenantRepository) {
        this.dashboardService = dashboardService;
        this.tenantRepository = tenantRepository;
    }

    @GetMapping("/")
    public String home() {
        return "index";
    }

    @GetMapping({"/saas", "/saas/"})
    public String saasHome() {
        return "redirect:/#products";
    }

    @GetMapping("/login")
    public String login() {
        return "auth/login";
    }

    @GetMapping("/dashboard")
    public String dashboard(Model model) {
        model.addAttribute("stats", dashboardService.stats(TenantContext.getOrDefault()));
        return "redirect:/dashboards/society-admin";
    }

    @GetMapping("/dashboards/superadmin")
    public String superAdminDashboard(HttpSession session, Model model) {
        if (!isLoggedIn(session, "smartapartment", "superadmin")) return "redirect:/?loginRequired=true";
        model.addAttribute("societies", tenantRepository.findAll());
        return "dashboards/superadmin";
    }

    @GetMapping("/dashboards/society-admin")
    public String societyAdminDashboard(HttpSession session) {
        if (!isLoggedIn(session, "smartapartment", "admin")) return "redirect:/?loginRequired=true";
        return "dashboards/society-admin";
    }

    @GetMapping("/dashboards/resident")
    public String residentDashboard(HttpSession session) {
        if (!isLoggedIn(session, "smartapartment", "resident")) return "redirect:/?loginRequired=true";
        return "dashboards/resident";
    }

    @GetMapping("/dashboards/security")
    public String securityDashboard(HttpSession session) {
        if (!isLoggedIn(session, "smartapartment", "security")) return "redirect:/?loginRequired=true";
        return "dashboards/security";
    }

    @GetMapping("/dashboards/maintenance")
    public String maintenanceDashboard(HttpSession session) {
        if (!isLoggedIn(session, "smartapartment", "maintenance")) return "redirect:/?loginRequired=true";
        return "dashboards/maintenance";
    }

    @GetMapping("/terms/onboarding")
    public String onboardingTerms() {
        return "terms/onboarding";
    }

    @GetMapping("/terms/daily-operations")
    public String dailyOperationsTerms() {
        return "terms/daily-operations";
    }

    @GetMapping("/terms/finance-reports")
    public String financeReportsTerms() {
        return "terms/finance-reports";
    }

    @GetMapping({"/propertydirect", "/propertydirect/"})
    public String propertyDirectHome() {
        return "propertydirect/index";
    }

    @GetMapping("/propertydirect/apartments")
    public String propertyDirectApartments() {
        return "propertydirect/apartments";
    }

    @GetMapping("/propertydirect/apartment-detail")
    public String propertyDirectApartmentDetail() {
        return "propertydirect/apartment-detail";
    }

    @GetMapping("/propertydirect/dashboards/superadmin")
    public String propertyDirectSuperAdmin(HttpSession session) {
        if (!isLoggedIn(session, "propertydirect", "superadmin")) return "redirect:/propertydirect?loginRequired=true";
        return "propertydirect/dashboards/superadmin";
    }

    @GetMapping("/propertydirect/dashboards/admin")
    public String propertyDirectAdmin(HttpSession session) {
        if (!isLoggedIn(session, "propertydirect", "admin")) return "redirect:/propertydirect?loginRequired=true";
        return "propertydirect/dashboards/admin";
    }

    @GetMapping("/propertydirect/dashboards/customer")
    public String propertyDirectCustomer(HttpSession session) {
        if (!isLoggedIn(session, "propertydirect", "customer")) return "redirect:/propertydirect?loginRequired=true";
        return "propertydirect/dashboards/customer";
    }

    @GetMapping("/propertydirect/terms/apartment-search")
    public String propertyDirectApartmentSearchTerms() {
        return "propertydirect/terms/apartment-search";
    }

    @GetMapping("/propertydirect/terms/post-property")
    public String propertyDirectPostPropertyTerms() {
        return "propertydirect/terms/post-property";
    }

    @GetMapping("/propertydirect/terms/services-payments")
    public String propertyDirectServicesPaymentsTerms() {
        return "propertydirect/terms/services-payments";
    }

    @GetMapping("/propertydirect/terms/plans-dashboards")
    public String propertyDirectPlansDashboardsTerms() {
        return "propertydirect/terms/plans-dashboards";
    }

    private boolean isLoggedIn(HttpSession session, String platform, String role) {
        return Boolean.TRUE.equals(session.getAttribute("dashboard:" + platform + ":" + role));
    }
}
