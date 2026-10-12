package com.smartapartment;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class SmartApartmentApplication {

    public static void main(String[] args) {
        SpringApplication.run(SmartApartmentApplication.class, args);
    }
}
