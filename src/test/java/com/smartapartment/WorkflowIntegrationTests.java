package com.smartapartment;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import jakarta.servlet.http.HttpSession;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartapartment.entity.BillingRule;
import com.smartapartment.repository.BillingRuleRepository;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest @AutoConfigureMockMvc
class WorkflowIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired BillingRuleRepository billingRules;

    @Test void societyApisRejectAnonymousRequests() throws Exception {
        mvc.perform(get("/api/society/overview")).andExpect(status().is3xxRedirection());
    }

    @Test void publicPagesCanLoadTheirStylesAndImagesWithoutLogin() throws Exception {
        mvc.perform(get("/"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("id=\"landingHeader\"")))
                .andExpect(content().string(containsString("id=\"phoneCarousel\"")))
                .andExpect(content().string(containsString("id=\"landingDemoForm\"")))
                .andExpect(content().string(containsString("Managed <em>Smarter.</em>")));
        mvc.perform(get("/shared/css/theme.css")).andExpect(status().isOk());
        mvc.perform(get("/smartapartment/css/styles.css")).andExpect(status().isOk());
        mvc.perform(get("/smartapartment/js/landing.js")).andExpect(status().isOk());
        mvc.perform(get("/shared/images/smartapartment-cinematic-1.webp")).andExpect(status().isOk());
        mvc.perform(get("/favicon.svg")).andExpect(status().isOk());
    }

    @Test void adminLoginLoadsTenantDataAndBillingIsIdempotent() throws Exception {
        HttpSession session = mvc.perform(post("/api/auth/dashboard-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"platform\":\"smartapartment\",\"role\":\"admin\",\"username\":\"admin@smartapartment\",\"password\":\"admin123\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.redirect").value("/dashboards/society-admin"))
                .andReturn().getRequest().getSession(false);

        mvc.perform(get("/api/society/me").session((org.springframework.mock.web.MockHttpSession) session))
                .andExpect(status().isOk()).andExpect(jsonPath("$.tenantId").value("green-heights"))
                .andExpect(jsonPath("$.role").value("SOCIETY_ADMIN"));

        mvc.perform(post("/api/billing/generate").param("amount","2500").session((org.springframework.mock.web.MockHttpSession) session))
                .andExpect(status().isOk()).andExpect(jsonPath("$.count").value(1));
        mvc.perform(post("/api/billing/generate").param("amount","2500").session((org.springframework.mock.web.MockHttpSession) session))
                .andExpect(status().isOk()).andExpect(jsonPath("$.count").value(0));
        mvc.perform(get("/api/society/bills").session((org.springframework.mock.web.MockHttpSession) session))
                .andExpect(status().isOk()).andExpect(jsonPath("$",hasSize(1)));
    }

    @Test void residentCannotUseAdminBillingEndpoint() throws Exception {
        HttpSession session = mvc.perform(post("/api/auth/dashboard-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"platform\":\"smartapartment\",\"role\":\"resident\",\"username\":\"resident@smartapartment\",\"password\":\"resident123\"}"))
                .andExpect(status().isOk()).andReturn().getRequest().getSession(false);
        mvc.perform(post("/api/billing/generate").session((org.springframework.mock.web.MockHttpSession) session))
                .andExpect(status().isForbidden());
    }

    @Test void everyDashboardUsesTheUnifiedLandingPageDesignSystem() throws Exception {
        mvc.perform(get("/shared/css/dashboard-system.css")).andExpect(status().isOk());
        mvc.perform(get("/shared/js/dashboard-system.js")).andExpect(status().isOk());

        Object[][] dashboardLogins = {
                {"/dashboards/superadmin", "smartapartment", "superadmin", "superadmin@smartapartment", "superadmin123"},
                {"/dashboards/society-admin", "smartapartment", "admin", "admin@smartapartment", "admin123"},
                {"/dashboards/resident", "smartapartment", "resident", "resident@smartapartment", "resident123"},
                {"/dashboards/security", "smartapartment", "security", "security@smartapartment", "security123"},
                {"/dashboards/maintenance", "smartapartment", "maintenance", "maintenance@smartapartment", "maintenance123"},
                {"/propertydirect/dashboards/superadmin", "propertydirect", "superadmin", "superadmin@propertydirect", "superadmin123"},
                {"/propertydirect/dashboards/admin", "propertydirect", "admin", "admin@propertydirect", "admin123"}
        };
        for (Object[] item : dashboardLogins) {
            var session = login((String) item[1], (String) item[2], (String) item[3], (String) item[4]);
            mvc.perform(get((String) item[0]).session(session))
                    .andExpect(status().isOk())
                    .andExpect(content().string(containsString("/shared/css/dashboard-system.css")))
                    .andExpect(content().string(containsString("/shared/js/dashboard-system.js")));
        }

        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String registration = "{\"name\":\"Dashboard Test Customer\",\"phone\":\"9000000000\",\"email\":\"dashboard-" + suffix + "@example.com\",\"username\":\"dashboard-" + suffix + "\",\"password\":\"secret123\"}";
        var customer = (org.springframework.mock.web.MockHttpSession) mvc.perform(post("/api/auth/propertydirect/register-customer")
                        .contentType(MediaType.APPLICATION_JSON).content(registration))
                .andExpect(status().isOk()).andReturn().getRequest().getSession(false);
        mvc.perform(get("/propertydirect/dashboards/customer").session(customer))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("/shared/css/dashboard-system.css")))
                .andExpect(content().string(containsString("/shared/js/dashboard-system.js")));
    }

    @Test void advancedSocietyWorkflowsAreRoleScopedAndTenantIsolated() throws Exception {
        var admin = login("smartapartment", "admin", "admin@smartapartment", "admin123");
        var resident = login("smartapartment", "resident", "resident@smartapartment", "resident123");
        var security = login("smartapartment", "security", "security@smartapartment", "security123");

        BillingRule foreignRule = new BillingRule();
        foreignRule.setTenantId("another-society");
        foreignRule.setName("Must remain invisible");
        foreignRule.setAmount(new BigDecimal("999"));
        foreignRule.setDueDay(5);
        foreignRule.setLateFee(BigDecimal.ZERO);
        foreignRule.setFrequency("MONTHLY");
        billingRules.save(foreignRule);

        mvc.perform(post("/api/society/advanced/billing-rules").session(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Quarterly sinking fund\",\"amount\":1500,\"dueDay\":12,\"lateFee\":50,\"frequency\":\"QUARTERLY\",\"nextRunDate\":\"2099-01-01\",\"automatic\":false}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Quarterly sinking fund"));
        mvc.perform(get("/api/society/advanced/billing-rules").session(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].name", not(hasItem("Must remain invisible"))));
        mvc.perform(post("/api/society/advanced/billing-rules").session(resident)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Forbidden\",\"amount\":1,\"dueDay\":1,\"lateFee\":0,\"frequency\":\"MONTHLY\",\"automatic\":false}"))
                .andExpect(status().isForbidden());

        String deliveryJson = mvc.perform(post("/api/society/advanced/deliveries").session(security)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"unitNo\":\"A-204\",\"provider\":\"QuickCart\",\"agentName\":\"Arun\",\"phone\":\"9876543210\",\"packageType\":\"PARCEL\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.message").value("Delivery recorded"))
                .andReturn().getResponse().getContentAsString();
        long deliveryId = json.readTree(deliveryJson).get("id").asLong();
        mvc.perform(patch("/api/society/advanced/deliveries/{id}/collect", deliveryId).session(resident))
                .andExpect(status().isOk()).andExpect(jsonPath("$.message").value("Delivery collected"));

        String pollJson = mvc.perform(post("/api/society/advanced/polls").session(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"question\":\"Install solar panels?\",\"options\":[\"Yes\",\"No\"],\"closesAt\":\"2099-01-01T12:00:00\",\"anonymous\":true}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        long pollId = json.readTree(pollJson).get("id").asLong();
        mvc.perform(post("/api/society/advanced/polls/{id}/vote", pollId).param("option", "0").session(resident))
                .andExpect(status().isOk()).andExpect(jsonPath("$.option").value(0));
        mvc.perform(post("/api/society/advanced/polls/{id}/vote", pollId).param("option", "1").session(resident))
                .andExpect(status().isOk()).andExpect(jsonPath("$.option").value(1));
        mvc.perform(get("/api/society/advanced/polls").session(resident))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == " + pollId + ")].selectedOption").value(hasItem(1)));
    }

    @Test void propertyDiscoveryPersistsShortlistsSearchesVisitsAndServices() throws Exception {
        var owner = login("propertydirect", "admin", "admin@propertydirect", "admin123");
        String listingJson = mvc.perform(post("/api/property/listings").session(owner)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Test Lake View Home\",\"society\":\"Lake View\",\"locality\":\"Whitefield\",\"city\":\"Bangalore\",\"type\":\"RENT\",\"propertyType\":\"APARTMENT\",\"price\":32000,\"deposit\":100000,\"maintenance\":2500,\"areaSqft\":1100,\"bhk\":\"2 BHK\",\"furnishing\":\"Semi Furnished\",\"parking\":\"Car Parking\",\"amenities\":\"Gym, Pool\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.verificationStatus").value("PENDING"))
                .andReturn().getResponse().getContentAsString();
        long listingId = json.readTree(listingJson).get("id").asLong();
        mvc.perform(patch("/api/property/listings/{id}/verification", listingId).param("status", "VERIFIED").session(owner))
                .andExpect(status().isOk()).andExpect(jsonPath("$.verificationStatus").value("VERIFIED"));
        mvc.perform(get("/api/property/listings").param("city", "Bangalore").param("bhk", "2 BHK").param("maxPrice", "35000"))
                .andExpect(status().isOk()).andExpect(jsonPath("$[*].id", hasItem((int) listingId)));

        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String registration = "{\"name\":\"Test Customer\",\"phone\":\"9000000000\",\"email\":\"customer-" + suffix + "@example.com\",\"username\":\"customer-" + suffix + "\",\"password\":\"secret123\"}";
        var customer = (org.springframework.mock.web.MockHttpSession) mvc.perform(post("/api/auth/propertydirect/register-customer")
                        .contentType(MediaType.APPLICATION_JSON).content(registration))
                .andExpect(status().isOk()).andReturn().getRequest().getSession(false);

        mvc.perform(post("/api/property/saved/{id}", listingId).session(customer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.message").value("Property shortlisted"));
        mvc.perform(get("/api/property/saved").session(customer))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].listing.id").value(listingId));
        mvc.perform(post("/api/property/saved-searches").session(customer).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Affordable Whitefield\",\"city\":\"Bangalore\",\"locality\":\"Whitefield\",\"type\":\"RENT\",\"bhk\":\"2 BHK\",\"minPrice\":20000,\"maxPrice\":35000,\"alertsEnabled\":true}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.alertsEnabled").value(true));
        mvc.perform(post("/api/property/visits").session(customer).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"listingId\":" + listingId + ",\"scheduledAt\":\"2099-01-02T11:00:00\",\"notes\":\"Morning preferred\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.visitStatus").value("REQUESTED"));
        mvc.perform(post("/api/property/services").session(customer).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"listingId\":" + listingId + ",\"serviceType\":\"LEGAL_DOCUMENTATION\",\"preferredAt\":\"2099-01-03T11:00:00\",\"details\":\"Review rental agreement\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.requestStatus").value("REQUESTED"));
    }

    private org.springframework.mock.web.MockHttpSession login(String platform, String role, String username, String password) throws Exception {
        return (org.springframework.mock.web.MockHttpSession) mvc.perform(post("/api/auth/dashboard-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(java.util.Map.of("platform", platform, "role", role, "username", username, "password", password))))
                .andExpect(status().isOk()).andReturn().getRequest().getSession(false);
    }
}
