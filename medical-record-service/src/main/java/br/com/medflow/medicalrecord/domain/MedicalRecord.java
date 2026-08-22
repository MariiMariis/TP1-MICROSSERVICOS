package br.com.medflow.medicalrecord.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Document(collection = "medical_records")
@CompoundIndex(name = "idx_patient_occurred", def = "{'patientId': 1, 'occurredAt': -1}")
public class MedicalRecord {
    @Id
    private String id;

    @Indexed
    private Long patientId;

    private String patientName;

    private RecordType recordType;

    @Indexed
    private String specialty;

    private String professional;

    private LocalDateTime occurredAt;

    private List<String> tags = new ArrayList<>();

    private Map<String, Object> clinicalData = new LinkedHashMap<>();

    private List<Attachment> attachments = new ArrayList<>();

    private LocalDateTime createdAt = LocalDateTime.now();

    public MedicalRecord() {
    }

    public MedicalRecord(Long patientId, String patientName, RecordType recordType, String specialty,
                         String professional, LocalDateTime occurredAt, List<String> tags,
                         Map<String, Object> clinicalData, List<Attachment> attachments) {
        this.patientId = patientId;
        this.patientName = patientName;
        this.recordType = recordType;
        this.specialty = specialty;
        this.professional = professional;
        this.occurredAt = occurredAt;
        this.tags = tags == null ? new ArrayList<>() : new ArrayList<>(tags);
        this.clinicalData = clinicalData == null ? new LinkedHashMap<>() : new LinkedHashMap<>(clinicalData);
        this.attachments = attachments == null ? new ArrayList<>() : new ArrayList<>(attachments);
        this.createdAt = LocalDateTime.now();
    }

    public String getId() { return id; }
    public Long getPatientId() { return patientId; }
    public String getPatientName() { return patientName; }
    public RecordType getRecordType() { return recordType; }
    public String getSpecialty() { return specialty; }
    public String getProfessional() { return professional; }
    public LocalDateTime getOccurredAt() { return occurredAt; }
    public List<String> getTags() { return tags; }
    public Map<String, Object> getClinicalData() { return clinicalData; }
    public List<Attachment> getAttachments() { return attachments; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    public void setId(String id) { this.id = id; }
    public void setPatientId(Long patientId) { this.patientId = patientId; }
    public void setPatientName(String patientName) { this.patientName = patientName; }
    public void setRecordType(RecordType recordType) { this.recordType = recordType; }
    public void setSpecialty(String specialty) { this.specialty = specialty; }
    public void setProfessional(String professional) { this.professional = professional; }
    public void setOccurredAt(LocalDateTime occurredAt) { this.occurredAt = occurredAt; }
    public void setTags(List<String> tags) { this.tags = tags; }
    public void setClinicalData(Map<String, Object> clinicalData) { this.clinicalData = clinicalData; }
    public void setAttachments(List<Attachment> attachments) { this.attachments = attachments; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
