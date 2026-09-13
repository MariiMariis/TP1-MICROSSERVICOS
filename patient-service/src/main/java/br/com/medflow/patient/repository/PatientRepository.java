package br.com.medflow.patient.repository;

import br.com.medflow.patient.domain.Patient;
import org.springframework.stereotype.Repository;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Repository
public class PatientRepository {
    private final Map<Long, Patient> storage = new ConcurrentHashMap<>();
    private final AtomicLong sequence = new AtomicLong();

    public List<Patient> findAll() {
        return storage.values().stream()
                .sorted(Comparator.comparing(Patient::getId))
                .toList();
    }

    public Optional<Patient> findById(Long id) {
        return Optional.ofNullable(storage.get(id));
    }

    public boolean existsByCpf(String cpf) {
        return storage.values().stream().anyMatch(p -> p.getCpf().equals(cpf));
    }

    public Patient save(Patient patient) {
        if (patient.getId() == null) {
            patient.assignId(sequence.incrementAndGet());
        }
        storage.put(patient.getId(), patient);
        return patient;
    }

    public long count() {
        return storage.size();
    }
}
