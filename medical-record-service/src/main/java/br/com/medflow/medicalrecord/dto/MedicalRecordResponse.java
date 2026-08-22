package br.com.medflow.medicalrecord.dto;

import br.com.medflow.medicalrecord.domain.Attachment;
import br.com.medflow.medicalrecord.domain.MedicalRecord;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public record MedicalRecordResponse(
        String id,
        Long patientId,
        String patientName,
        String recordType,
        String specialty,
        String professional,
        LocalDateTime occurredAt,
        List<String> tags,
        Map<String, Object> clinicalData,
        List<Attachment> attachments,
        LocalDateTime createdAt
) {
    public static MedicalRecordResponse from(MedicalRecord record) {
        return new MedicalRecordResponse(
                record.getId(),
                record.getPatientId(),
                record.getPatientName(),
                record.getRecordType() == null ? null : record.getRecordType().name(),
                record.getSpecialty(),
                record.getProfessional(),
                record.getOccurredAt(),
                record.getTags(),
                record.getClinicalData(),
                record.getAttachments(),
                record.getCreatedAt()
        );
    }
}
