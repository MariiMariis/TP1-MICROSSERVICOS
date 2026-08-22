package br.com.medflow.medicalrecord.dto;

import br.com.medflow.medicalrecord.domain.Attachment;
import br.com.medflow.medicalrecord.domain.RecordType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public record MedicalRecordRequest(

        @NotNull(message = "patientId e obrigatorio")
        @Positive(message = "patientId deve ser positivo")
        Long patientId,

        String patientName,

        @NotNull(message = "recordType e obrigatorio (CONSULTA, EXAME, PROCEDIMENTO, INTERNACAO, VACINA)")
        RecordType recordType,

        @NotBlank(message = "specialty e obrigatorio")
        String specialty,

        @NotBlank(message = "professional e obrigatorio")
        String professional,

        @NotNull(message = "occurredAt e obrigatorio")
        LocalDateTime occurredAt,

        List<String> tags,

        Map<String, Object> clinicalData,

        List<Attachment> attachments
) {
}
