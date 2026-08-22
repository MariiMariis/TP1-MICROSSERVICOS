package br.com.medflow.medicalrecord.domain;

public record Attachment(
        String fileName,
        String contentType,
        String url,
        Integer sizeKb
) {
}
