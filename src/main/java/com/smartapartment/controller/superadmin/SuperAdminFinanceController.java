package com.smartapartment.controller.superadmin;

import org.springframework.security.access.prepost.PreAuthorize;
import com.smartapartment.entity.BankAccount;
import com.smartapartment.entity.PaymentGatewayConfig;
import com.smartapartment.repository.PaymentGatewayConfigRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@PreAuthorize("hasRole('SUPER_ADMIN')")
@RequestMapping("/api/superadmin/finance")
public class SuperAdminFinanceController {
    private final PaymentGatewayConfigRepository gateways;
    public SuperAdminFinanceController(PaymentGatewayConfigRepository gateways) { this.gateways = gateways; }

    @GetMapping("/bank-accounts")
    public ResponseEntity<List<BankAccount>> getBankAccounts() {
        return ResponseEntity.ok(List.of());
    }

    @PostMapping("/bank-accounts")
    public ResponseEntity<BankAccount> linkBankAccount(@RequestBody BankAccount account) {
        // Stubbed: Link official society bank account
        return ResponseEntity.ok(account);
    }

    @GetMapping("/payment-gateways")
    public ResponseEntity<List<Map<String, Object>>> getPaymentGateways() {
        if (gateways.count() == 0) { PaymentGatewayConfig gateway = new PaymentGatewayConfig(); gateway.setProviderName("Stripe"); gateway.setEnvironment("Sandbox"); gateway.setTransactionFee("2.9% + Rs. 30"); gateway.setDigitalInvoicingEnabled(true); gateway.setActive(false); gateways.save(gateway); }
        return ResponseEntity.ok(gateways.findAllByOrderByCreatedAtAsc().stream().map(gateway -> Map.<String,Object>of("id", gateway.getId(), "providerName", gateway.getProviderName(), "environment", gateway.getEnvironment(), "transactionFee", gateway.getTransactionFee(), "configured", gateway.getMerchantId()!=null&&!gateway.getMerchantId().isBlank(), "digitalInvoicingEnabled", gateway.isDigitalInvoicingEnabled(), "active", gateway.isActive())).toList());
    }

    @PostMapping("/payment-gateways")
    public ResponseEntity<Map<String, Object>> configureGateway(@RequestBody PaymentGatewayConfig config) {
        if (config.getProviderName() == null || config.getProviderName().isBlank()) {
            throw new IllegalArgumentException("Payment gateway provider is required");
        }
        PaymentGatewayConfig saved = gateways.save(config);
        return ResponseEntity.ok(gatewayView(saved));
    }

    @PutMapping("/payment-gateways/{id}")
    public ResponseEntity<Map<String,Object>> updateGateway(@PathVariable Long id, @RequestBody PaymentGatewayConfig request) {
        PaymentGatewayConfig gateway = gateways.findById(id).orElseThrow(() -> new IllegalArgumentException("Gateway was not found"));
        gateway.setProviderName(request.getProviderName()); gateway.setMerchantId(request.getMerchantId()); gateway.setEnvironment(request.getEnvironment()); gateway.setTransactionFee(request.getTransactionFee()); gateway.setDigitalInvoicingEnabled(request.isDigitalInvoicingEnabled()); gateway.setActive(request.isActive());
        if (request.getApiKey() != null && !request.getApiKey().isBlank()) gateway.setApiKey(request.getApiKey());
        return ResponseEntity.ok(gatewayView(gateways.save(gateway)));
    }

    private Map<String,Object> gatewayView(PaymentGatewayConfig gateway) { return Map.of("id",gateway.getId(),"providerName",gateway.getProviderName(),"environment",gateway.getEnvironment(),"transactionFee",gateway.getTransactionFee(),"configured",true,"digitalInvoicingEnabled",gateway.isDigitalInvoicingEnabled(),"active",gateway.isActive(),"message","Gateway settings saved securely"); }

    @PostMapping("/late-fees/rules")
    public ResponseEntity<String> setLateFeeRules(@RequestParam Long billingRuleId, 
                                                  @RequestParam Double percentage, 
                                                  @RequestParam Double fixedAmount) {
        // Stubbed: Update billing rule with automated late fee calculation rules
        return ResponseEntity.ok("Late fee rules updated");
    }

    @PostMapping("/invoicing/toggle")
    public ResponseEntity<String> toggleDigitalInvoicing(@RequestParam boolean enable) {
        // Stubbed: Enable or disable digital invoicing modules system-wide
        return ResponseEntity.ok("Digital invoicing module status updated");
    }
}
