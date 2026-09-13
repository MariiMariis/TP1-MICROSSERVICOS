package br.com.medflow.appointment.exception;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiError> handleNotFound(ResourceNotFoundException ex, HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiError.of(404, "Not Found", ex.getMessage(), req.getRequestURI()));
    }

    @ExceptionHandler(PatientNotFoundException.class)
    public ResponseEntity<ApiError> handlePatientNotFound(PatientNotFoundException ex, HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(ApiError.of(422, "Unprocessable Entity", ex.getMessage(), req.getRequestURI()));
    }

    @ExceptionHandler(PatientServiceUnavailableException.class)
    public ResponseEntity<ApiError> handleUnavailable(PatientServiceUnavailableException ex, HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(ApiError.of(503, "Service Unavailable", ex.getMessage(), req.getRequestURI()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException ex, HttpServletRequest req) {
        Map<String, String> fields = new LinkedHashMap<>();
        for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
            fields.put(fieldError.getField(), fieldError.getDefaultMessage());
        }
        ApiError body = new ApiError(LocalDateTime.now(), 400, "Bad Request",
                "Erro de validacao nos dados enviados", req.getRequestURI(), fields);
        return ResponseEntity.badRequest().body(body);
    }
}
