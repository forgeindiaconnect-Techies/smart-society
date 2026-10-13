package com.smartapartment.config;

import com.zaxxer.hikari.HikariConfig;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class DataSourceConfigTest {

    @Test
    void testH2Default() {
        DataSourceConfig config = new DataSourceConfig();
        HikariConfig hc = config.buildHikariConfig(
                "jdbc:h2:file:./data/smartsociety;AUTO_SERVER=TRUE",
                "sa",
                "",
                ""
        );
        assertNotNull(hc);
        assertEquals("org.h2.Driver", hc.getDriverClassName());
        assertTrue(hc.getJdbcUrl().startsWith("jdbc:h2:"));
        assertEquals("sa", hc.getUsername());
    }

    @Test
    void testPostgresUrlNormalization() {
        DataSourceConfig config = new DataSourceConfig();
        HikariConfig hc = config.buildHikariConfig(
                "postgres://myuser:mypassword@junction.proxy.rlwy.net:49210/railway",
                "",
                "",
                ""
        );
        assertNotNull(hc);
        assertEquals("org.postgresql.Driver", hc.getDriverClassName());
        assertEquals("myuser", hc.getUsername());
        assertEquals("mypassword", hc.getPassword());
        assertTrue(hc.getJdbcUrl().startsWith("jdbc:postgresql://junction.proxy.rlwy.net:49210/railway"));
        assertTrue(hc.getJdbcUrl().contains("sslmode=require"));
        assertFalse(hc.getJdbcUrl().contains("myuser:mypassword@"));
    }

    @Test
    void testCleanPostgresJdbcUrl() {
        DataSourceConfig config = new DataSourceConfig();
        HikariConfig hc = config.buildHikariConfig(
                "jdbc:postgresql://host.render.com:5432/mydb?sslmode=require",
                "pguser",
                "secret",
                ""
        );
        assertNotNull(hc);
        assertEquals("org.postgresql.Driver", hc.getDriverClassName());
        assertEquals("pguser", hc.getUsername());
        assertEquals("secret", hc.getPassword());
        assertEquals("jdbc:postgresql://host.render.com:5432/mydb?sslmode=require", hc.getJdbcUrl());
    }
}
