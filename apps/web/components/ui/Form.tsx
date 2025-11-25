"use client";

import { useForm, UseFormReturn, FieldValues, DefaultValues, Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ReactNode } from "react";

// Hook personalizado para formularios con Zod
export function useZodForm<T extends z.ZodSchema<any, any>>(
  schema: T,
  defaultValues?: DefaultValues<z.infer<T>>
) {
  return useForm<z.infer<T>>({
    resolver: zodResolver(schema as any),
    defaultValues,
    mode: "onChange", // Validar mientras escribe
  });
}

// Componente Input con validación
interface FormInputProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  name: Path<T>;
  label: string;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function FormInput<T extends FieldValues>({
  form,
  name,
  label,
  type = "text",
  placeholder,
  disabled,
}: FormInputProps<T>) {
  const error = form.formState.errors[name];

  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: "block",
          marginBottom: 6,
          fontSize: 14,
          fontWeight: 600,
          color: "#333",
        }}
      >
        {label}
      </label>
      <input
        {...form.register(name)}
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: "100%",
          padding: "12px 16px",
          border: `2px solid ${error ? "#e74c3c" : "#e0e0e0"}`,
          borderRadius: 8,
          fontSize: 16,
          transition: "border-color 0.2s",
          outline: "none",
        }}
        onFocus={(e) => {
          if (!error) e.target.style.borderColor = "#667eea";
        }}
        onBlur={(e) => {
          if (!error) e.target.style.borderColor = "#e0e0e0";
        }}
      />
      {error && (
        <span
          style={{
            display: "block",
            marginTop: 4,
            fontSize: 12,
            color: "#e74c3c",
          }}
        >
          {error.message as string}
        </span>
      )}
    </div>
  );
}

// Componente Select con validación
interface FormSelectProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  name: Path<T>;
  label: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}

export function FormSelect<T extends FieldValues>({
  form,
  name,
  label,
  options,
  placeholder,
  disabled,
}: FormSelectProps<T>) {
  const error = form.formState.errors[name];

  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: "block",
          marginBottom: 6,
          fontSize: 14,
          fontWeight: 600,
          color: "#333",
        }}
      >
        {label}
      </label>
      <select
        {...form.register(name)}
        disabled={disabled}
        style={{
          width: "100%",
          padding: "12px 16px",
          border: `2px solid ${error ? "#e74c3c" : "#e0e0e0"}`,
          borderRadius: 8,
          fontSize: 16,
          background: "white",
          cursor: "pointer",
          outline: "none",
        }}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <span
          style={{
            display: "block",
            marginTop: 4,
            fontSize: 12,
            color: "#e74c3c",
          }}
        >
          {error.message as string}
        </span>
      )}
    </div>
  );
}

// Componente Textarea con validación
interface FormTextareaProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  name: Path<T>;
  label: string;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}

export function FormTextarea<T extends FieldValues>({
  form,
  name,
  label,
  placeholder,
  rows = 3,
  disabled,
}: FormTextareaProps<T>) {
  const error = form.formState.errors[name];

  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: "block",
          marginBottom: 6,
          fontSize: 14,
          fontWeight: 600,
          color: "#333",
        }}
      >
        {label}
      </label>
      <textarea
        {...form.register(name)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        style={{
          width: "100%",
          padding: "12px 16px",
          border: `2px solid ${error ? "#e74c3c" : "#e0e0e0"}`,
          borderRadius: 8,
          fontSize: 16,
          resize: "vertical",
          outline: "none",
        }}
      />
      {error && (
        <span
          style={{
            display: "block",
            marginTop: 4,
            fontSize: 12,
            color: "#e74c3c",
          }}
        >
          {error.message as string}
        </span>
      )}
    </div>
  );
}

// Wrapper de formulario
interface FormProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  onSubmit: (data: T) => void | Promise<void>;
  children: ReactNode;
}

export function Form<T extends FieldValues>({ form, onSubmit, children }: FormProps<T>) {
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      {children}
    </form>
  );
}

