import type { ValidationRule } from '../types';

export interface ValidationResult {
  valid: boolean;
  errorMessage?: string;
}

/**
 * Validate a cell value against a validation rule.
 */
export function validateCellValue(value: string, rule: ValidationRule): ValidationResult {
  // Allow blank values if specified
  if (rule.allowBlank && (!value || value.trim() === '')) {
    return { valid: true };
  }

  switch (rule.type) {
    case 'list':
      return validateList(value, rule);
    case 'number':
      return validateNumber(value, rule);
    case 'date':
      return validateDate(value, rule);
    case 'custom':
      // Custom validation would require formula evaluation; treat as always valid for now
      return { valid: true };
    default:
      return { valid: true };
  }
}

function validateList(value: string, rule: ValidationRule): ValidationResult {
  const items = rule.listItems || [];
  if (items.length === 0) {
    return {
      valid: false,
      errorMessage: rule.errorMessage || 'No valid options available.',
    };
  }

  const found = items.some((item) => item === value);
  if (!found) {
    return {
      valid: false,
      errorMessage: rule.errorMessage || `Value must be one of: ${items.join(', ')}`,
    };
  }

  return { valid: true };
}

function validateNumber(value: string, rule: ValidationRule): ValidationResult {
  const num = Number(value);
  if (isNaN(num) || value.trim() === '') {
    return {
      valid: false,
      errorMessage: rule.errorMessage || 'Value must be a number.',
    };
  }

  if (rule.min !== undefined && num < rule.min) {
    return {
      valid: false,
      errorMessage: rule.errorMessage || `Value must be at least ${rule.min}.`,
    };
  }

  if (rule.max !== undefined && num > rule.max) {
    return {
      valid: false,
      errorMessage: rule.errorMessage || `Value must be at most ${rule.max}.`,
    };
  }

  return { valid: true };
}

function validateDate(value: string, rule: ValidationRule): ValidationResult {
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return {
      valid: false,
      errorMessage: rule.errorMessage || 'Value must be a valid date.',
    };
  }

  // If min/max provided (as timestamps), check date range
  if (rule.min !== undefined) {
    const minDate = new Date(rule.min);
    if (date < minDate) {
      return {
        valid: false,
        errorMessage: rule.errorMessage || `Date must be after ${minDate.toLocaleDateString()}.`,
      };
    }
  }

  if (rule.max !== undefined) {
    const maxDate = new Date(rule.max);
    if (date > maxDate) {
      return {
        valid: false,
        errorMessage: rule.errorMessage || `Date must be before ${maxDate.toLocaleDateString()}.`,
      };
    }
  }

  return { valid: true };
}
