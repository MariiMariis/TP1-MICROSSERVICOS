package br.com.medflow.appointment.exception;

public class PatientServiceUnavailableException extends RuntimeException {
    public PatientServiceUnavailableException(String message) {
        super(message);
    }
}
