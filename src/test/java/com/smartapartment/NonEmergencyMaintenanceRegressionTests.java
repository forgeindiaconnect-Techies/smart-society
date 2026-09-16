package com.smartapartment;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.time.LocalDateTime;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartapartment.entity.CommonMaintenanceTicket;
import com.smartapartment.repository.CommonMaintenanceTicketRepository;

@SpringBootTest
@AutoConfigureMockMvc
class NonEmergencyMaintenanceRegressionTests {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private CommonMaintenanceTicketRepository ticketRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private MockHttpSession loginAsMaintenanceStaff() throws Exception {
        MvcResult result = mvc.perform(post("/api/auth/dashboard-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"platform\":\"smartapartment\",\"role\":\"maintenance\",\"username\":\"maintenance@smartapartment\",\"password\":\"maintenance123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.redirect").value("/dashboards/maintenance"))
                .andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    private MockHttpSession registerCustomer(String name, String phone) throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String regJson = String.format("""
            {
                "name": "%s",
                "phone": "%s",
                "email": "cust-%s@example.com",
                "username": "user-%s",
                "password": "password123"
            }
            """, name, phone, suffix, suffix);
        MvcResult res = mvc.perform(post("/api/auth/propertydirect/register-customer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(regJson))
                .andExpect(status().isOk())
                .andReturn();
        return (MockHttpSession) res.getRequest().getSession(false);
    }

    @Test
    @DisplayName("1. Create Ticket: Both CommonMaintenance API and Dispatch Non-Emergency Ticket creation work")
    void testCreateTicket() throws Exception {
        // A. CommonMaintenance API creation
        String commonPayload = """
            {
                "sourcePlatform": "smartsociety",
                "serviceType": "Plumbing",
                "title": "Kitchen Sink Drain Leaking",
                "description": "Slow leak beneath sink cabinet",
                "serviceAddress": "Tower A, Flat 304",
                "city": "Bangalore",
                "priority": "HIGH"
            }
            """;
        MvcResult res1 = mvc.perform(post("/api/maintenance")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(commonPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.title").value("Kitchen Sink Drain Leaking"))
                .andExpect(jsonPath("$.serviceType").value("Plumbing"))
                .andExpect(jsonPath("$.ticketStatus").value("REQUESTED"))
                .andReturn();

        // B. Dispatch endpoint creation by resident/customer with priority SLA calculation
        MockHttpSession residentSession = registerCustomer("Resident Rao", "9876543110");
        String dispatchTicketPayload = """
            {
                "title": "Corridor Light Fixture Flickering",
                "description": "Fluorescent tube flickering on 4th floor",
                "serviceAddress": "Tower B, 4th Floor Corridor",
                "city": "Bangalore",
                "category": "Electrical",
                "priority": "HIGH",
                "phone": "9876543110"
            }
            """;
        MvcResult res2 = mvc.perform(post("/api/maintenance/dispatch/tickets?platform=propertydirect")
                        .session(residentSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(dispatchTicketPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.title").value("Corridor Light Fixture Flickering"))
                .andExpect(jsonPath("$.priority").value("HIGH"))
                .andExpect(jsonPath("$.dueAt", notNullValue()))
                .andReturn();

        JsonNode created = objectMapper.readTree(res2.getResponse().getContentAsString());
        assertNotNull(created.get("id").asLong());
    }

    @Test
    @DisplayName("2. View Ticket: Retrieve tickets via Common Maintenance and Dispatch lists")
    void testViewTicket() throws Exception {
        MockHttpSession adminSession = loginAsMaintenanceStaff();

        // Seed a ticket
        CommonMaintenanceTicket t = new CommonMaintenanceTicket();
        t.setSourcePlatform("smartsociety");
        t.setTargetEntityType("GENERAL");
        t.setTitle("Clubhouse AC Filter Cleaning");
        t.setDescription("Routine monthly service");
        t.setServiceType("HVAC");
        t.setServiceAddress("Clubhouse Block");
        t.setCity("Bangalore");
        t.setPriority("MEDIUM");
        t.setTicketStatus("REQUESTED");
        t.setCreatedAt(LocalDateTime.now());
        t = ticketRepository.save(t);

        // View via /api/maintenance
        mvc.perform(get("/api/maintenance"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", not(empty())))
                .andExpect(jsonPath("$[?(@.id == " + t.getId() + ")].title").value(hasItem("Clubhouse AC Filter Cleaning")));

        // View via /api/maintenance/dispatch/tickets
        mvc.perform(get("/api/maintenance/dispatch/tickets").session(adminSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", not(empty())))
                .andExpect(jsonPath("$[?(@.id == " + t.getId() + ")].title").value(hasItem("Clubhouse AC Filter Cleaning")));
    }

    @Test
    @DisplayName("3. Update Ticket: Modify status, notes, and vendor callback")
    void testUpdateTicket() throws Exception {
        MockHttpSession adminSession = loginAsMaintenanceStaff();

        CommonMaintenanceTicket t = new CommonMaintenanceTicket();
        t.setSourcePlatform("smartsociety");
        t.setTargetEntityType("GENERAL");
        t.setTitle("Gym Treadmill Belt Alignment");
        t.setDescription("Belt slipping at speed > 8km/h");
        t.setServiceType("Fitness Equipment");
        t.setPriority("LOW");
        t.setTicketStatus("REQUESTED");
        t = ticketRepository.save(t);

        // Update via Dispatch PATCH endpoint
        String patchPayload = """
            {
                "status": "IN_PROGRESS",
                "notes": "Technician inspected equipment and ordered replacement tension spring."
            }
            """;
        mvc.perform(patch("/api/maintenance/dispatch/tickets/" + t.getId())
                        .session(adminSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(patchPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ticketStatus").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.vendorNotes").value("Technician inspected equipment and ordered replacement tension spring."));
    }

    @Test
    @DisplayName("4. Assign Ticket: Assign technician/vendor to non-emergency ticket")
    void testAssignTicket() throws Exception {
        CommonMaintenanceTicket t = new CommonMaintenanceTicket();
        t.setSourcePlatform("smartsociety");
        t.setTargetEntityType("GENERAL");
        t.setTitle("Lobby Glass Door Sensor Adjustment");
        t.setDescription("Sensor sometimes fails to open on approach");
        t.setServiceType("Carpentry / Automation");
        t.setPriority("MEDIUM");
        t.setTicketStatus("REQUESTED");
        t = ticketRepository.save(t);

        // Assign vendor via CommonMaintenance status update
        String assignPayload = """
            {
                "ticketStatus": "ASSIGNED",
                "vendorId": 101,
                "vendorName": "Apex Automation Systems",
                "vendorPhone": "9876500001",
                "vendorEmail": "support@apexautomation.com",
                "vendorNotes": "Dispatched technician for sensor calibration"
            }
            """;
        mvc.perform(patch("/api/maintenance/" + t.getId() + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(assignPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ticketStatus").value("ASSIGNED"))
                .andExpect(jsonPath("$.vendorId").value(101))
                .andExpect(jsonPath("$.vendorName").value("Apex Automation Systems"));
    }

    @Test
    @DisplayName("5. SLA Calculations: SLA deadline generated accurately according to ticket priority")
    void testTicketSlaCalculation() throws Exception {
        MockHttpSession residentSession = registerCustomer("SLA Tester", "9876543112");

        // HIGH priority -> 24 hours
        String highPayload = """
            {
                "title": "Main Water Pump Humming Loudly",
                "description": "Bearing noise heard from pump room",
                "serviceAddress": "Basement Utility Room",
                "city": "Bangalore",
                "category": "Plumbing",
                "priority": "HIGH",
                "phone": "9876543112"
            }
            """;
        MvcResult highRes = mvc.perform(post("/api/maintenance/dispatch/tickets?platform=propertydirect")
                        .session(residentSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(highPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dueAt", notNullValue()))
                .andReturn();

        JsonNode highNode = objectMapper.readTree(highRes.getResponse().getContentAsString());
        LocalDateTime highDue = LocalDateTime.parse(highNode.get("dueAt").asText());
        assertTrue(highDue.isAfter(LocalDateTime.now().plusHours(23)) && highDue.isBefore(LocalDateTime.now().plusHours(25)),
                "HIGH priority due date should be approximately 24 hours from creation");

        // LOW priority -> 72 hours
        String lowPayload = """
            {
                "title": "Garden Bench Paint Touch-up",
                "description": "Minor peeling on courtyard bench",
                "serviceAddress": "Courtyard Garden",
                "city": "Bangalore",
                "category": "Carpentry",
                "priority": "LOW",
                "phone": "9876543112"
            }
            """;
        MvcResult lowRes = mvc.perform(post("/api/maintenance/dispatch/tickets?platform=propertydirect")
                        .session(residentSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(lowPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dueAt", notNullValue()))
                .andReturn();

        JsonNode lowNode = objectMapper.readTree(lowRes.getResponse().getContentAsString());
        LocalDateTime lowDue = LocalDateTime.parse(lowNode.get("dueAt").asText());
        assertTrue(lowDue.isAfter(LocalDateTime.now().plusHours(71)) && lowDue.isBefore(LocalDateTime.now().plusHours(73)),
                "LOW priority due date should be approximately 72 hours from creation");
    }

    @Test
    @DisplayName("6. Complete Ticket: Resolving ticket populates resolvedAt timestamp")
    void testCompleteTicket() throws Exception {
        MockHttpSession adminSession = loginAsMaintenanceStaff();

        CommonMaintenanceTicket t = new CommonMaintenanceTicket();
        t.setSourcePlatform("smartsociety");
        t.setTargetEntityType("GENERAL");
        t.setTitle("Intercom Line Noise");
        t.setDescription("Static on line between gate and Flat 201");
        t.setServiceType("Electrical");
        t.setPriority("MEDIUM");
        t.setTicketStatus("IN_PROGRESS");
        t = ticketRepository.save(t);

        String resolvePayload = """
            {
                "status": "RESOLVED",
                "notes": "Loose junction box crimp repaired. Audio crystal clear now."
            }
            """;
        mvc.perform(patch("/api/maintenance/dispatch/tickets/" + t.getId())
                        .session(adminSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(resolvePayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ticketStatus").value("RESOLVED"))
                .andExpect(jsonPath("$.resolvedAt", notNullValue()));
    }

    @Test
    @DisplayName("7. Existing Filters: Filter by sourcePlatform and ticketStatus")
    void testTicketFilters() throws Exception {
        // Seed tickets across platforms and statuses
        CommonMaintenanceTicket t1 = new CommonMaintenanceTicket();
        t1.setSourcePlatform("smartsociety");
        t1.setTargetEntityType("GENERAL");
        t1.setTitle("Filter Test Society 1");
        t1.setServiceType("General");
        t1.setTicketStatus("REQUESTED");
        ticketRepository.save(t1);

        CommonMaintenanceTicket t2 = new CommonMaintenanceTicket();
        t2.setSourcePlatform("propertydirect");
        t2.setTargetEntityType("GENERAL");
        t2.setTitle("Filter Test PropertyDirect 2");
        t2.setServiceType("General");
        t2.setTicketStatus("RESOLVED");
        ticketRepository.save(t2);

        // Filter by platform = smartsociety
        mvc.perform(get("/api/maintenance?sourcePlatform=smartsociety"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].sourcePlatform", everyItem(equalToIgnoringCase("smartsociety"))));

        // Filter by status = RESOLVED
        mvc.perform(get("/api/maintenance?status=RESOLVED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].ticketStatus", everyItem(equalToIgnoringCase("RESOLVED"))));
    }

    @Test
    @DisplayName("8. Existing Dashboard Metrics: Maintenance Admin dashboard renders Track 1 and Track 2 without conflict")
    void testDashboardMetricsAndIsolation() throws Exception {
        MockHttpSession adminSession = loginAsMaintenanceStaff();

        MvcResult pageRes = mvc.perform(get("/dashboards/maintenance").session(adminSession))
                .andExpect(status().isOk())
                .andReturn();

        String html = pageRes.getResponse().getContentAsString();

        // Verify Track 1 (Routine Non-Emergency Tickets) navigation and sections
        assertTrue(html.contains("Track 1: Tickets (Non-Emergency)"), "Track 1 header must be present");
        assertTrue(html.contains("data-panel=\"tasks\""), "My Assigned Tasks panel link must be present");
        assertTrue(html.contains("data-panel=\"complaints\""), "Open Ticket Pool panel link must be present");
        assertTrue(html.contains("data-panel=\"assets\""), "Assets & Preventive panel link must be present");
        assertTrue(html.contains("data-table=\"tasks\""), "Tasks table attribute must be present");
        assertTrue(html.contains("data-table=\"maintenance-complaints\""), "Complaints table attribute must be present");

        // Verify Track 2 (Emergency Dispatch) navigation and sections
        assertTrue(html.contains("Track 2: Live Bookings (Emergency)"), "Track 2 header must be present");
        assertTrue(html.contains("data-panel=\"dispatch\""), "Emergency dispatch link must be present");
        assertTrue(html.contains("id=\"liveDispatchTable\""), "Live dispatch table must be present");
        assertTrue(html.contains("id=\"unassignedActionTable\""), "Unassigned action table must be present");
        assertTrue(html.contains("id=\"hubMasterTable\""), "Hub master table must be present");

        // Verify isolation: Emergency dispatch API returns 200 independently
        mvc.perform(get("/api/maintenance/dispatch/bookings").session(adminSession))
                .andExpect(status().isOk());

        // Verify non-emergency tickets API returns 200 independently
        mvc.perform(get("/api/maintenance/dispatch/tickets").session(adminSession))
                .andExpect(status().isOk());
    }
}
