package br.com.medflow.appointment.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record PatientSnapshot(
        Long id,
        String fullName,
        String healthPlan,
        boolean active
) {
}
