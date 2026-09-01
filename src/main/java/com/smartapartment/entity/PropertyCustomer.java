package com.smartapartment.entity;
import com.fasterxml.jackson.annotation.JsonIgnore;import jakarta.persistence.*;import lombok.Getter;import lombok.Setter;
@Getter @Setter @Entity @Table(name="property_customers",uniqueConstraints={@UniqueConstraint(columnNames="username"),@UniqueConstraint(columnNames="email")})
public class PropertyCustomer extends BaseEntity{private String name;private String phone;private String email;private String username;@JsonIgnore private String passwordHash;@Column(nullable=false,length=20,columnDefinition="varchar(20) default 'CUSTOMER'")private String role="CUSTOMER";@Column(nullable=false,columnDefinition="boolean default true")private boolean active=true;}
