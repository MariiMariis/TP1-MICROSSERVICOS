package br.com.medflow.patient.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record PatientRequest(

        @NotBlank(message = "cpf e obrigatorio")
        @Pattern(regexp = "[0-9]{11}", message = "cpf deve conter exatamente 11 digitos numericos")
        String cpf,

        @NotBlank(message = "fullName e obrigatorio")
        @Size(min = 3, max = 150, message = "fullName deve ter entre 3 e 150 caracteres")
        String fullName,

        @NotNull(message = "birthDate e obrigatorio")
        @Past(message = "birthDate deve ser uma data no passado")
        LocalDate birthDate,

        @Email(message = "email invalido")
        String email,

        @Size(max = 20, message = "phone deve ter no maximo 20 caracteres")
        String phone,

        @Size(max = 60, message = "healthPlan deve ter no maximo 60 caracteres")
        String healthPlan
) {
}
