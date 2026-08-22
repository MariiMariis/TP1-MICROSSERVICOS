package br.com.medflow.medicalrecord.repository;

import br.com.medflow.medicalrecord.domain.MedicalRecord;
import br.com.medflow.medicalrecord.domain.RecordType;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MedicalRecordRepository extends MongoRepository<MedicalRecord, String> {
    List<MedicalRecord> findByPatientIdOrderByOccurredAtDesc(Long patientId);

    List<MedicalRecord> findBySpecialtyIgnoreCase(String specialty);

    List<MedicalRecord> findByRecordType(RecordType recordType);

    List<MedicalRecord> findByTagsContaining(String tag);

    @Query("{ 'clinicalData.?0': { $exists: true } }")
    List<MedicalRecord> findByClinicalDataKey(String key);
}
