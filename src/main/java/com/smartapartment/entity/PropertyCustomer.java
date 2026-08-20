package com.smartapartment.entity;
import jakarta.persistence.*;import lombok.Getter;import lombok.Setter;
@Getter @Setter @Entity @Table(name="property_customers",uniqueConstraints={@UniqueConstraint(columnNames="username"),@UniqueConstraint(columnNames="email")})
public class PropertyCustomer extends BaseEntity{private String name;private String phone;private String email;private String username;private String passwordHash;}
