package com.smartapartment.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "payment_gateway_configs")
public class PaymentGatewayConfig extends BaseEntity {

    private String providerName;
    
    private String merchantId;
    
    private String apiKey;
    
    private String apiSecret;

    private String environment = "Sandbox";

    private String transactionFee = "0%";
    
    private boolean isActive;
    
    private boolean digitalInvoicingEnabled;
}
