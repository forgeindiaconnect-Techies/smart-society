package com.smartapartment.entity;
import jakarta.persistence.*;import lombok.Getter;import lombok.Setter;
@Getter @Setter @Entity @Table(name="saved_properties",uniqueConstraints=@UniqueConstraint(name="uk_saved_customer_listing",columnNames={"customer_id","listing_id"}))
public class SavedProperty extends BaseEntity{private Long customerId;@ManyToOne(optional=false)private PropertyListing listing;}
