package com.smartapartment;

import com.smartapartment.entity.Apartment;
import com.smartapartment.entity.PropertyListing;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ApartmentCodeTests {
    @Test void moduleCodesRemainStableAfterEditing() {
        Apartment apartment = new Apartment();
        PropertyListing property = new PropertyListing();
        assertNull(apartment.getApartmentCode());
        assertNull(property.getApartmentCode());
        apartment.setId(27L);
        property.setId(27L);
        apartment.setUnitNo("A-201");
        property.setTitle("Updated home");
        assertEquals("SMT-0027", apartment.getApartmentCode());
        assertEquals("PDT-0027", property.getApartmentCode());
        property.setId(10001L);
        assertEquals("PDT-10001", property.getApartmentCode());
    }
}
