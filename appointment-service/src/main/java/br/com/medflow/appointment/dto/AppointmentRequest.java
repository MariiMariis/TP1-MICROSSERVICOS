package br.com.medflow.appointment.dto;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

public record AppointmentRequest(

        @NotNull(message = "patientId e obrigatorio")
        @Positive(message = "patientId deve ser positivo")
        Long patientId,

        @NotBlank(message = "doctorName e obrigatorio")
        @Size(max = 150)
        String doctorName,

        @NotBlank(message = "specialty e obrigatorio")
        @Size(max = 80)
        String specialty,

        @NotNull(message = "scheduledAt e obrigatorio")
        @Future(message = "scheduledAt deve ser uma data/hora futura")
        LocalDateTime scheduledAt,

        @Size(max = 500)
        String notes
) {
}
