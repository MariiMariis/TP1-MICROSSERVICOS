package br.com.medflow.patient.repository;

import br.com.medflow.patient.domain.Patient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PatientRepository extends JpaRepository<Patient, Long> {
    Optional<Patient> findByCpf(String cpf);

    boolean existsByCpf(String cpf);

    List<Patient> findByFullNameContainingIgnoreCase(String name);
}
