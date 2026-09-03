package br.com.medflow.patient.config;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.time.LocalDate;

/**
 * Linha de infra/seed/patients.json. O arquivo carrega tambem dados clinicos (endereco com
 * GeoJSON, alergias, medicamentos), que pertencem ao medical-record-service e sao ignorados aqui:
 * cada servico le do mesmo arquivo apenas o que e do seu dominio.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record SeedPatient(
        long id,
        String cpf,
        String fullName,
        LocalDate birthDate,
        String email,
        String phone,
        String healthPlan
) {
}
