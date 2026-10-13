package com.smartapartment.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.util.StringUtils;

import javax.sql.DataSource;
import java.net.URI;
import java.nio.charset.StandardCharsets;

@Configuration
public class DataSourceConfig {

    private static final Logger log = LoggerFactory.getLogger(DataSourceConfig.class);

    @Bean
    @Primary
    public DataSource dataSource(
            @Value("${spring.datasource.url:}") String springUrl,
            @Value("${spring.datasource.username:}") String springUsername,
            @Value("${spring.datasource.password:}") String springPassword,
            @Value("${spring.datasource.driver-class-name:}") String springDriver) {

        HikariConfig config = buildHikariConfig(springUrl, springUsername, springPassword, springDriver);
        return new HikariDataSource(config);
    }

    public HikariConfig buildHikariConfig(
            String springUrl,
            String springUsername,
            String springPassword,
            String springDriver) {

        String url = StringUtils.hasText(springUrl) ? springUrl.trim() : "";
        if (!StringUtils.hasText(url) || url.equals("jdbc:h2:file:./data/smartsociety;AUTO_SERVER=TRUE")) {
            String envDbUrl = System.getenv("DB_URL");
            String envDatabaseUrl = System.getenv("DATABASE_URL");
            if (StringUtils.hasText(envDbUrl)) {
                url = envDbUrl.trim();
            } else if (StringUtils.hasText(envDatabaseUrl)) {
                url = envDatabaseUrl.trim();
            } else if (!StringUtils.hasText(url)) {
                url = "jdbc:h2:file:./data/smartsociety;AUTO_SERVER=TRUE";
            }
        }

        String username = StringUtils.hasText(springUsername) ? springUsername.trim() : "";
        if (!StringUtils.hasText(username)) {
            String envUser = System.getenv("DB_USERNAME");
            if (StringUtils.hasText(envUser)) {
                username = envUser.trim();
            }
        }

        String password = springPassword != null ? springPassword : "";
        if (!StringUtils.hasText(password)) {
            String envPass = System.getenv("DB_PASSWORD");
            if (envPass != null) {
                password = envPass.trim();
            }
        }

        String driver = StringUtils.hasText(springDriver) ? springDriver.trim() : "";
        if (!StringUtils.hasText(driver)) {
            String envDriver = System.getenv("DB_DRIVER");
            if (StringUtils.hasText(envDriver)) {
                driver = envDriver.trim();
            }
        }

        // Strip enclosing quotes if user accidentally pasted them in dashboard
        if (url.startsWith("\"") && url.endsWith("\"") && url.length() > 1) {
            url = url.substring(1, url.length() - 1).trim();
        }
        if (url.startsWith("'") && url.endsWith("'") && url.length() > 1) {
            url = url.substring(1, url.length() - 1).trim();
        }

        boolean isPostgres = url.startsWith("postgres://") || url.startsWith("postgresql://") || url.startsWith("jdbc:postgresql:");

        if (isPostgres) {
            if (!StringUtils.hasText(driver)) {
                driver = "org.postgresql.Driver";
            }
            // Explicitly set PostgreSQL dialect fallback so Hibernate never fails with dialect metadata errors
            System.setProperty("hibernate.dialect", "org.hibernate.dialect.PostgreSQLDialect");

            String rawUri = url;
            if (rawUri.startsWith("jdbc:")) {
                rawUri = rawUri.substring(5);
            }
            if (rawUri.startsWith("postgres://")) {
                rawUri = "postgresql://" + rawUri.substring("postgres://".length());
            }

            try {
                URI uri = new URI(rawUri);
                String userInfo = uri.getUserInfo();
                if (StringUtils.hasText(userInfo)) {
                    String[] parts = userInfo.split(":", 2);
                    if (!StringUtils.hasText(username)) {
                        username = java.net.URLDecoder.decode(parts[0], StandardCharsets.UTF_8);
                    }
                    if (!StringUtils.hasText(password) && parts.length > 1) {
                        password = java.net.URLDecoder.decode(parts[1], StandardCharsets.UTF_8);
                    }
                }

                String host = uri.getHost();
                int port = uri.getPort() > 0 ? uri.getPort() : 5432;
                String path = uri.getPath();
                String query = uri.getQuery();

                if (StringUtils.hasText(host)) {
                    StringBuilder jdbc = new StringBuilder("jdbc:postgresql://")
                            .append(host)
                            .append(":")
                            .append(port)
                            .append(StringUtils.hasText(path) ? path : "");

                    if (StringUtils.hasText(query)) {
                        jdbc.append("?").append(query);
                        if (!query.contains("sslmode")) {
                            jdbc.append("&sslmode=require");
                        }
                    } else {
                        jdbc.append("?sslmode=require");
                    }
                    url = jdbc.toString();
                    log.info("Normalized PostgreSQL JDBC URL for host {}:{}", host, port);
                }
            } catch (Exception e) {
                log.warn("Could not parse URI structure ({}), using URL as-is", e.getMessage());
                if (!url.startsWith("jdbc:")) {
                    url = "jdbc:" + url;
                }
            }
        } else if (url.startsWith("jdbc:h2:") || url.contains("h2:file:")) {
            if (!StringUtils.hasText(driver)) {
                driver = "org.h2.Driver";
            }
            if (!StringUtils.hasText(username)) {
                username = "sa";
            }
            if (!StringUtils.hasText(password)) {
                password = "";
            }
            System.setProperty("hibernate.dialect", "org.hibernate.dialect.H2Dialect");
        } else if (url.startsWith("jdbc:mysql:")) {
            if (!StringUtils.hasText(driver)) {
                driver = "com.mysql.cj.jdbc.Driver";
            }
            System.setProperty("hibernate.dialect", "org.hibernate.dialect.MySQLDialect");
        }

        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(url);
        config.setUsername(username);
        config.setPassword(password);
        if (StringUtils.hasText(driver)) {
            config.setDriverClassName(driver);
        }

        config.setMaximumPoolSize(10);
        config.setMinimumIdle(2);
        config.setConnectionTimeout(30000);
        config.setInitializationFailTimeout(30000);
        config.setIdleTimeout(600000);
        config.setMaxLifetime(1800000);

        log.info("Configured DataSource with driver [{}] and URL [{}] (user: [{}])",
                driver, sanitizeUrlForLogging(url), username);

        return config;
    }

    private String sanitizeUrlForLogging(String url) {
        if (url == null) return "null";
        return url.replaceAll(":[^/@:]+@", ":***@");
    }
}
