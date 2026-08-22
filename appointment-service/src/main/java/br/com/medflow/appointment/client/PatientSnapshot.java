package br.com.medflow.appointment.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record PatientSnapshot(
        Long id,
        String fullName,
        String healthPlan,
        boolean active,
        boolean dataFromFallback
) {
    public static PatientSnapshot fallbackFor(Long patientId, String reason) {
        return new PatientSnapshot(patientId, "Paciente #" + patientId + " (dados nao confirmados: " + reason + ")",
                "NAO_VERIFICADO", true, true);
    }
}
